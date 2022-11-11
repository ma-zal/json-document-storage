import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import monacoEditorLoader from '@monaco-editor/loader';
import { editor as MonacoEditor, languages as MonacoLanguages } from 'monaco-editor';
import { URI } from 'monaco-editor/esm/vs/base/common/uri';
import { default as jsonSchemaDraft07 } from 'ajv/lib/refs/json-schema-draft-07.json';
import { combineLatest, first, ReplaySubject, Subject } from 'rxjs';
import * as JSON5 from 'json5';
import { JSONData } from '@common/json-data.type';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

type Monaco = typeof monacoEditor;


/**
 * Monaco editor with 3 models (3 files):
 * 
 * 1) JSON contents
 * 2) Text notes
 * 3) Document JSON schema
 */
@Component({
  selector: 'app-monaco-document-multi-editor',
  templateUrl: './monaco-document-multi-editor.component.html',
  styleUrls: ['./monaco-document-multi-editor.component.scss']
})
export class MonacoDocumentMultiEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('monacoEditorContainer') monacoEditorDiv!: ElementRef;

  @Input() contentsFormControl!: FormControl<string>;
  @Input() notesFormControl!: FormControl<string>;
  @Input() schemaFormControl!: FormControl<string>;
  @Output() onAfterInit = new EventEmitter<MonacoDocumentMultiEditorComponent>();

  public editorInstance: MonacoEditor.IStandaloneCodeEditor|undefined;

  private readonly editorOptions: MonacoEditor.IStandaloneEditorConstructionOptions = {
    theme: 'vs-dark',
    scrollBeyondLastLine: false,
    language: 'json',
    minimap: {
      enabled: false,
    },
    wordBasedSuggestions: false,
    fontSize: 16,
    fontFamily: 'monospace',
    lineNumbersMinChars: 2,
    formatOnPaste: false,
    tabSize: 2,
  };  

  private readonly FAKE_FILENAME_CONTENTS = 'contents.json';
  private readonly FAKE_FILENAME_SCHEMA = 'myschema.json'
  private readonly FAKE_FILENAME_NOTES = 'notes.txt'
  private readonly CONTENTS_MODEL_URI = URI.parse(`file:///${this.FAKE_FILENAME_CONTENTS}`);
  private readonly SCHEMA_MODEL_URI = URI.parse(`file:///${this.FAKE_FILENAME_SCHEMA}`);
  private readonly NOTES_MODEL_URI = URI.parse(`file:///${this.FAKE_FILENAME_NOTES}`);

  /** Saved states of Monaco Editor tabs */
  private savedStates: Record<string, MonacoEditor.ICodeEditorViewState> = {};

  /** Observable for transfering schema from source (editor, loader) into validator and into document to save. */
  private contentsSchemaUpdater$ = new Subject<string>();
  private monacoInitialized$ = new ReplaySubject<void>();

  /**
   * === `window.monaco`
   *
   * Filled during `ngAfterViewInit()`
   */
  private monaco!: Monaco;


  constructor() {
  }


  ngAfterViewInit(): void {
    this.initAndConfigMonaco().catch((err) => {
      alert(err.message);
    });
  }


  async initAndConfigMonaco() {
    this.monaco = await monacoEditorLoader.init();  // === window.monaco
    this.editorInstance = this.monaco.editor.create(this.monacoEditorDiv.nativeElement, this.editorOptions);

    this.monaco.languages.json.jsonDefaults.setDiagnosticsOptions(<MonacoLanguages.json.DiagnosticsOptions>{
      allowComments: true,
      trailingCommas: 'ignore',
    });
    
    const editor = this.monaco.editor;
    // Clean old models (if not cleaned during last controlled destroy).
    editor.getModel(this.CONTENTS_MODEL_URI)?.dispose();
    editor.getModel(this.NOTES_MODEL_URI)?.dispose();
    editor.getModel(this.SCHEMA_MODEL_URI)?.dispose();
    // Create model for each "file" (and remove old one).
    const contentsMonacoModel = editor.createModel(this.contentsFormControl.value, 'json', this.CONTENTS_MODEL_URI);
    const notesMonacoModel = editor.createModel(this.notesFormControl.value, undefined, this.NOTES_MODEL_URI);
    const schemaMonacoModel = editor.createModel(this.schemaFormControl.value, 'json', this.SCHEMA_MODEL_URI);
    // Display the document contents
    this.switchMonacoEditorModel(this.CONTENTS_MODEL_URI);

    // Map editor changes into reactive form.
    contentsMonacoModel.onDidChangeContent((event: MonacoEditor.IModelContentChangedEvent) => {
      this.contentsFormControl.setValue(contentsMonacoModel.getValue(), {emitEvent: false});
      this.contentsFormControl.markAsDirty();
    });
    notesMonacoModel.onDidChangeContent(() => {
      this.notesFormControl.setValue(notesMonacoModel.getValue(), {emitEvent: false});
      this.notesFormControl.markAsDirty();
    });
    schemaMonacoModel.onDidChangeContent(() => {
      this.schemaFormControl.setValue(schemaMonacoModel.getValue(), {emitEvent: false});
      this.schemaFormControl.markAsDirty();
    });

    // Map Reactive form changes into Monaco editor
    this.contentsFormControl.valueChanges.subscribe((value: string) => {
      if (contentsMonacoModel.getValue() !== value) {
        contentsMonacoModel.setValue(value);
      }
    });
    this.notesFormControl.registerOnChange((value: string) => {
      if (notesMonacoModel.getValue() !== value) {
        notesMonacoModel.setValue(value);
      }
    });
    this.schemaFormControl.registerOnChange((value: string) => {
      if (schemaMonacoModel.getValue() !== value) {
        schemaMonacoModel.setValue(value);

        // Start the contents validation agains schema.
        this.useContentsSchema(value);
      }
    });


    // Set/update the JSON schema of contents on schema change.
    combineLatest([
      this.contentsSchemaUpdater$,
      this.monacoInitialized$.pipe(first()),
    ]).subscribe(([schema]) => {
      this.applyContentsSchema(schema);
    });

    this.monacoInitialized$.next();
    this.onAfterInit.emit(this);
    
  }


  /**
   * Takes schema defined in Monaco SCHEMA_MODEL_URI model and uses it as schema for CONTENTS_MODEL_URI.
   */
  private applyContentsSchema(strigifiedContentsJsonSchema: string) {
    let schemaJson: JSONData | null = null;
    try {
      if (strigifiedContentsJsonSchema) {
        schemaJson = JSON5.parse(strigifiedContentsJsonSchema);
      }
    } catch (e: any) {
      alert(`Error. Schema is not JSON. Schema will be ignored. Details: ${e.message}`);
    }

    const schemas = [
      // Meta schema
      {
        uri: 'http://json-schema.org/draft-07/schema#',
        fileMatch: [this.FAKE_FILENAME_SCHEMA], // Associate with schema editor
        schema: jsonSchemaDraft07
      },,
      ...(schemaJson ? [
        {
          uri: 'http://local/contents-schema.json',  // TODO Is it needed?
          fileMatch: [this.FAKE_FILENAME_CONTENTS], // associate with contents.
          schema: schemaJson,
        }
      ] : []),
    ];

    this.monaco.languages.json.jsonDefaults.setDiagnosticsOptions(<MonacoLanguages.json.DiagnosticsOptions>{
      allowComments: true,
      trailingCommas: 'ignore',
      schemas
    });   
  }


  /**
   * @param targetModelUri 
   */
  private switchMonacoEditorModel(targetModelUri: URI) {
    if (!this.editorInstance) {
      return;  // Ignore action. Nothing to do.
    }
    const editor = this.monaco.editor;
    const currentModel = this.editorInstance.getModel();
    if (!currentModel) {
      return;
    }
    const currentUriString = currentModel.uri.toString();
    if (currentUriString === targetModelUri.toString()) {
      // Nothing to do;
      return;
    }
    // Save current editor state for future restoration
    const currentViewState = this.editorInstance.saveViewState();
    if (currentViewState) {
      this.savedStates[currentUriString] = currentViewState;
    }
    
    const targetModel = editor.getModel(targetModelUri);
    this.editorInstance.setModel(targetModel);
    const targetViewState = this.savedStates[targetModelUri.toString()];
    if (targetViewState) {
      this.editorInstance.restoreViewState(targetViewState);
    }
  }

  /**
   * Display the editation of `targetTab`. Hides the currend one.
   */
  public changeEditorTab(targetTab: 'contents'|'schema'|'notes') {
    if (!this.editorInstance) {
      return;
    }

    switch (targetTab) {
      case 'contents':
        if (this.editorInstance.getModel()?.uri.toString() === this.SCHEMA_MODEL_URI.toString()) {
          // If user switches from schema edit, then apply schema.
          this.applyJsonSchemaFromEditorAsContentsValidator();
        }
        this.switchMonacoEditorModel(this.CONTENTS_MODEL_URI);
        // this.uiTabIndex = 0;
        break;
      case 'schema':
        this.switchMonacoEditorModel(this.SCHEMA_MODEL_URI);
        // this.uiTabIndex = 1;
        break;
      case 'notes':
        this.switchMonacoEditorModel(this.NOTES_MODEL_URI)
        // this.uiTabIndex = 2;
        break;
    }
  }  

  useContentsSchema(stringifiedJsonSchema: string) {
    this.contentsSchemaUpdater$.next(stringifiedJsonSchema);
  }


  applyJsonSchemaFromEditorAsContentsValidator() {
    // Read schema from Monaco editor
    const schemaStringified = this.schemaFormControl.value;
    if (schemaStringified === undefined) {
      throw new Error(`Model ${this.SCHEMA_MODEL_URI} is missing.`);
    }
    // Write as validation schema
    this.useContentsSchema(schemaStringified);
  }


  ngOnDestroy(): void {
    this.contentsSchemaUpdater$.complete();
    this.monacoInitialized$.complete();

    // Remove all existing Editor models
    const editor = this.monaco.editor;
    editor.getModel(this.CONTENTS_MODEL_URI)?.dispose();
    editor.getModel(this.NOTES_MODEL_URI)?.dispose();
    editor.getModel(this.SCHEMA_MODEL_URI)?.dispose();
  }
}
