import * as JSON5 from 'json5';
import * as bcrypt from 'bcryptjs';
import { URI } from 'monaco-editor/esm/vs/base/common/uri';
import { editor as MonacoEditor, languages as MonacoLanguages } from 'monaco-editor';
import { BehaviorSubject, catchError, combineLatest, defer, first, firstValueFrom, map, Observable, of, ReplaySubject, Subject, switchMap, tap } from 'rxjs';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, AfterViewInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormGroup, FormControl } from '@angular/forms';
import loader from '@monaco-editor/loader';
import { default as jsonSchemaDraft07 } from 'ajv/lib/refs/json-schema-draft-07.json';
import * as toJsonSchema from 'to-json-schema';
import { parseDocument } from '@common/document-parse';
import { JsonDocumentToSave } from '@common/json-document.type';
import { JsonDocumentService } from '../json-document.service';
import { JSONData } from '@common/json-data.type';
import { SweetalertService } from '../sweetalert.service';
import { MonacoEditorService } from '../monaco-editor.service';

const FAKE_FILENAME_CONTENTS = 'contents.json';
const FAKE_FILENAME_SCHEMA = 'myschema.json'
const FAKE_FILENAME_NOTES = 'notes.txt'

const emptyDocument: LoadedOrNewJSONDocument = {
  id: null,
  title: '',
  notes: '',
  contents_raw: JSON.stringify({
    "welcomeTo": "JSON document store",
  }, null, 2) + '\n',
  schema: null,
};

@Component({
  selector: 'app-document-editor',
  templateUrl: './document-editor.component.html',
  styleUrls: ['./document-editor.component.scss']
})
export class DocumentEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('monacoEditorDiv') monacoEditorDiv!: ElementRef;

  public CONTENTS_MODEL_URI = URI.parse(`file:///${FAKE_FILENAME_CONTENTS}`);
  public SCHEMA_MODEL_URI = URI.parse(`file:///${FAKE_FILENAME_SCHEMA}`);
  public NOTES_MODEL_URI = URI.parse(`file:///${FAKE_FILENAME_NOTES}`);

  private editorInstance: MonacoEditor.IStandaloneCodeEditor|undefined;

  /** Saved states of Monaco Editor tabs */
  savedStates: Record<string, MonacoEditor.ICodeEditorViewState> = {};
  
  uiTabIndex = 0;

  /** Observable for transfering schema from source (editor, loader) into validator and into document to save. */
  contentsSchemaUpdater$: Subject<string> = new Subject();
  monacoInitialized$ = new ReplaySubject<void>();

  editorOptions: MonacoEditor.IStandaloneEditorConstructionOptions = {
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

  showNotesWarning$ = new BehaviorSubject(false);

  form = new FormGroup({
    id: new FormControl<string|null>(null),
    title: new FormControl<string>('', { nonNullable: true }),
    changePassword: new FormControl<boolean>(false, { nonNullable: true }),
    newPassword1: new FormControl<string>('', { nonNullable: true }),
    newPassword2: new FormControl<string>('', { nonNullable: true }),
    content_raw: new FormControl<string>('', { nonNullable: true }),
    notes: new FormControl<string>('', { nonNullable: true }),
    schema_raw: new FormControl<string>('', { nonNullable: true }),
  });


  constructor(
    private activeRoute: ActivatedRoute,
    private router: Router,
    private jsonDocumentService: JsonDocumentService,
    private sweetalertService: SweetalertService,
    private monacoEditorService: MonacoEditorService,
    private cdr: ChangeDetectorRef,
  ) {
    // Update schema in document.
    // this.contentsSchemaUpdater$.pipe(shareReplay(1)).subscribe((strigifiedSchema) => {
    //   this.document.schema = strigifiedSchema ? JSON5.parse(strigifiedSchema) : null;
    // });

    // Set schema as Monaco validator.
    combineLatest([
      this.contentsSchemaUpdater$,
      this.monacoInitialized$.pipe(first()),
    ]).subscribe(([schema]) => {
      let schemaJson: JSONData | null = null;
      try {
        if (schema) {
          schemaJson = JSON5.parse(schema);
        }
      } catch (e: any) {
        alert(`Error. Schema is not JSON. Schema will be ignored. Details: ${e.message}`);
      }

      const schemas = [
        // Meta schema
        {
          uri: 'http://json-schema.org/draft-07/schema#',
          fileMatch: [FAKE_FILENAME_SCHEMA], // Associate with schema editor
          schema: jsonSchemaDraft07
        },,
        ...(schemaJson ? [
          {
            uri: 'http://local/contents-schema.json',  // TODO Is it needed?
            fileMatch: [FAKE_FILENAME_CONTENTS], // associate with contents.
            schema: schemaJson,
          }
        ] : []),
      ];

      (window as any).monaco.languages.json.jsonDefaults.setDiagnosticsOptions(<MonacoLanguages.json.DiagnosticsOptions>{
        allowComments: true,
        trailingCommas: 'ignore',
        schemas
      });
    });

    // Document loading
    combineLatest([
      this.activeRoute.params,
      this.monacoInitialized$.pipe(first()),
    ]).pipe(
      tap(() => {
        this.sweetalertService.displayBusy({
          title: 'Loading ...'
        });
      }),
      switchMap(([params]) => {
        const documentId = params['documentId'];
        if (typeof documentId === 'string') {
          // Existing document
          return this.jsonDocumentService.get(documentId).pipe(
            map((existingDocument) => (<JsonDocumentToSave>{
              id: existingDocument.id,
              contents_raw: existingDocument.contents_raw,
              schema: existingDocument.schema,
              title: existingDocument.title,
              notes: existingDocument.notes,
            }))
          );
        } else if (documentId === undefined) {
          // New document
          return of(<JsonDocumentToSave>{
            ...emptyDocument,
            id: null,
            title: 'New document',
            notes: '',

          });
        } else {
          throw new Error(`Invalid Document ID param "${documentId}"`);
        }
      }),
      catchError((err: Error) => {
        throw err;
      }),
    ).subscribe({
        next: (document) => {
          this.sweetalertService.closePopup();

          // [Disabled] Generate a random write password for new documents
          // if (!document.id) {
          //   this.document.write_password = cryptoRandomString({length: 16, type: 'alphanumeric'});;
          // }

          const stringifiedSchema = document.schema ? JSON.stringify(document.schema, null, 2) : '';

          // Push loaded/new document into form
          this.form.patchValue({
            id: document.id,
            title: document.title,
            content_raw: document.contents_raw,
            notes: document.notes,
            schema_raw: stringifiedSchema,
          });

          // Start the contents validation agains schema.
          this.useContentsSchema(stringifiedSchema);
          monacoEditorService.switchMonacoEditorModel(this.editorInstance, this.CONTENTS_MODEL_URI, this.savedStates);
          // Show/hide notes warning dialog
          this.showNotesWarning$.next(!(/^[\s]*$/.test(document.notes)));  // Show if notes is filled

          // Fresh data has been loaded just now. Therefore reset the dirty flag.
          this.form.markAsPristine();

          this.cdr.detectChanges();  // TODO Fix something other to be able to remove this line.
        },
        error: (err: Error) => {
          this.sweetalertService.displayError(err);
        }
      });
  }


  async ngAfterViewInit() {
    await this.initAndConfigMonaco();
  }


  ngOnDestroy(): void {
    this.contentsSchemaUpdater$.complete();
    this.monacoInitialized$.complete();

    // Remove all existing Editor models
    const editor = this.monacoEditorService.getEditor();
    editor.getModel(this.CONTENTS_MODEL_URI)?.dispose();
    editor.getModel(this.NOTES_MODEL_URI)?.dispose();
    editor.getModel(this.SCHEMA_MODEL_URI)?.dispose();
  }

  /**
   * Save new document / update existing.
   */
  save() {
    return defer(async () => {

      this.sweetalertService.displayBusy({
        title: 'Saving ...'
      });

      this.applySchemaFromEditor();

      // Apply contents from editor
      const contents_raw = this.monacoEditorService.getModelEditorValue(this.CONTENTS_MODEL_URI);
      if (contents_raw === undefined) {
        throw new Error('Contents is not defined');
      }
      // Apply schema from editor
      const stringifiedSchema = this.monacoEditorService.getModelEditorValue(this.SCHEMA_MODEL_URI);
      const schema = stringifiedSchema ? JSON5.parse(stringifiedSchema) : null;

      const notes = this.monacoEditorService.getModelEditorValue(this.NOTES_MODEL_URI);

      // Check the document validation (throws error)
      parseDocument(contents_raw, schema);

      // Encrypt the new `write password` (if user entered it).
      /**
       * `undefined` ==> Do not change password  
       * EMPTY_STRING ==> Remove password
       */
      let writePasswordBcrypted: string | undefined = undefined; 
      if (this.form.value.changePassword) {
        // Check if both new passwords are same.
        if (this.form.value.newPassword1 !== this.form.value.newPassword2) {
          throw new Error('Entered new password does not match with confirm one.');
        }

        if (this.form.value.newPassword1 !== '') {
          // Set/change write-protection password
          const salt = await bcrypt.genSalt(10);
          writePasswordBcrypted = await bcrypt.hash(this.form.value.newPassword1!, salt);
        } else {
          // Remove write-protection password
          writePasswordBcrypted = '';
        }
      }

      return this.uploadDocumentToServer(<JsonDocumentToSave>{
        id: this.form.value.id,
        title: this.form.value.title,
        notes: notes,
        contents_raw: contents_raw,
        schema: schema,
        write_password_bcrypted: writePasswordBcrypted
      });
    }).subscribe({
      next: (document) => {
        this.sweetalertService.closePopup();

        // Route to document editation (used, when stored a new document).
        if (!this.activeRoute.snapshot.params['documentId']) {
          this.router.navigate(['/document', document.id]);
        }
      },
      complete: () => {
        // Remove last entered password to change.
        this.form.patchValue({
          changePassword: false,
          newPassword1: '',
          newPassword2: '',
        });

        // Clean "dirty" flag.
        this.form.markAsPristine();

        this.sweetalertService.swal.fire({
          title: 'Saved.',
          timer: 2000,
          icon: 'success',
          timerProgressBar: true,
        });
      },
      // Error catch
      error: (err: Error) => {
        err.message = 'Document was not saved. ' + err.message;
        this.sweetalertService.displayError(err);
    }});
  }


  /**
   * Saves the existing document changes or new document to server.
   * 
   */
  private async uploadDocumentToServer(document: JsonDocumentToSave) {
    try {
      return await firstValueFrom(this.jsonDocumentService.upsert(document, undefined));
    } catch (error: any) {
      if (error.status !== 401) {
        // Unknown error
        throw error;
      }
      // 401 means that document is password protected, so write password is requied.
      const { value: password } = await this.sweetalertService.swal.fire({
        title: 'Password protected',
        text: 'Existing document is password protected. Enter valid password to finish the saving.',
        input: 'password',
        inputLabel: 'Current document write password:',
        inputPlaceholder: 'Enter your password',
        inputAttributes: {
          maxlength: '100',
          autocapitalize: 'off',
          autocorrect: 'off'
        },
        confirmButtonText: 'Save document',
        showCancelButton: true,
      });
      if (password) {
        // Next try to save with password
        return firstValueFrom(this.jsonDocumentService.upsert(document, password));
      } else {
        throw new Error('Password required, but not not entered by user.');
      }
    }
  }

  getApiUrl(documentId: string) {
    return window.location.origin + '/api/document/' + documentId;
  }

  // Set MonacoEditor
  async initAndConfigMonaco() {
    const monaco = await loader.init();  // === window.monaco
    this.editorInstance = monaco.editor.create(this.monacoEditorDiv.nativeElement, this.editorOptions);

    monaco.languages.json.jsonDefaults.setDiagnosticsOptions(<MonacoLanguages.json.DiagnosticsOptions>{
      allowComments: true,
      trailingCommas: 'ignore',
    });

    const editor = this.monacoEditorService.getEditor();
    // Clean old models (if not cleaned during last controlled destroy).
    editor.getModel(this.CONTENTS_MODEL_URI)?.dispose();
    editor.getModel(this.NOTES_MODEL_URI)?.dispose();
    editor.getModel(this.SCHEMA_MODEL_URI)?.dispose();
    // Create model for each "file" (and remove old one).
    const contentModel = editor.createModel('', 'json', this.CONTENTS_MODEL_URI);
    const notesModel = editor.createModel('', undefined, this.NOTES_MODEL_URI);
    const schemaModel = editor.createModel('', 'json', this.SCHEMA_MODEL_URI);

    // Map editor changes into reactive form.
    contentModel.onDidChangeContent((event: MonacoEditor.IModelContentChangedEvent) => {
      this.form.controls.content_raw.setValue(contentModel.getValue(), {emitEvent: false});
      this.form.markAsDirty();
    });
    notesModel.onDidChangeContent(() => {
      this.form.controls.notes.setValue(notesModel.getValue(), {emitEvent: false});
      this.form.markAsDirty();
    });
    schemaModel.onDidChangeContent(() => {
      this.form.controls.schema_raw.setValue(schemaModel.getValue(), {emitEvent: false});
      this.form.markAsDirty();
    });

    // Map Reactive form changes into Monaco editor
    this.form.controls.content_raw.registerOnChange((value: string) => {
      if (contentModel.getValue() !== value) {
        contentModel.setValue(value);
      }
    });
    this.form.controls.notes.registerOnChange((value: string) => {
      if (notesModel.getValue() !== value) {
        notesModel.setValue(value);
      }
    });
    this.form.controls.schema_raw.registerOnChange((value: string) => {
      if (schemaModel.getValue() !== value) {
        schemaModel.setValue(value);
      }
    });

    this.monacoInitialized$.next();
  }


  useContentsSchema(schema: string) {
    this.contentsSchemaUpdater$.next(schema);
  }

  applySchemaFromEditor() {
    // Read schema from Monaco editor
    const schemaStringified = this.form.value.schema_raw;
    if (schemaStringified === undefined) {
      throw new Error(`Model ${this.SCHEMA_MODEL_URI} is missing.`);
    }
    // Write as validation schema
    this.useContentsSchema(schemaStringified);
  }

  generateSchema() {
    const existingStringifiedSchema = this.form.value.schema_raw!;
    const isSchemaFilled = (/^(\s)*$/g).test(existingStringifiedSchema);
    if (
      !isSchemaFilled &&
      !confirm('Some JSON schema is already defined. Would you like to override it by the generate one?')
    ) {
      return;
    }

    let currentDocumentContents: JSONData;
    try {
      const stringifiedContents =this.form.value.content_raw!;
      currentDocumentContents = JSON5.parse(stringifiedContents);
    } catch (e: any) {
      e.message = 'Failed, because Document Contents is currently not valid JSON document. Please fix it first. JSON error: ' + e.message;
      alert(e.message);
      throw e;
    }
    const schema = toJsonSchema(currentDocumentContents, {
      required: true,  // Usefull, but this is not working correctly because of bug https://github.com/ruzicka/to-json-schema/issues/12
      objects: {
        additionalProperties: false,
      }
    });
    // Fix the lib bug in `required` property
    fixSchemaBug(schema);
    // Write new chema to editor. Note: It also updates the source of ngModel `this.contentsModel.value`
    const stringifiedGeneratedSchema = JSON.stringify(schema, null, 2);
    this.form.patchValue({
      schema_raw: stringifiedGeneratedSchema,
    });
  }

  changeEditorTab(targetTab: 'contents'|'schema'|'notes') {
    if (!this.editorInstance) {
      return;
    }

    switch (targetTab) {
      case 'contents':
        if (this.uiTabIndex === 1) {
          this.applySchemaFromEditor();
        }
        this.monacoEditorService.switchMonacoEditorModel(this.editorInstance, this.CONTENTS_MODEL_URI, this.savedStates);
        this.uiTabIndex = 0;
        break;
      case 'schema':
        this.monacoEditorService.switchMonacoEditorModel(this.editorInstance, this.SCHEMA_MODEL_URI, this.savedStates);
        this.uiTabIndex = 1;
        break;
      case 'notes':
        this.monacoEditorService.switchMonacoEditorModel(this.editorInstance, this.NOTES_MODEL_URI, this.savedStates)
        this.uiTabIndex = 2;
        break;
    }
  }

  /**
   * Show notes tab and hide the warning.
   */
  seeNotes() {
    this.changeEditorTab('notes');
    this.showNotesWarning$.next(false);
    this.cdr.detectChanges();
  }

  /**
   * Called by Deactivate guard to decide if editor can be closed.
   */
  canExit(): Observable<boolean> | Promise<boolean> | boolean {
    if (!this.form.dirty) {
      return true;
    }
    return confirm('You have unsaved changes. Discard changes?');
  }
}

/**
 * Fixes the schema generator's bug.
 * @see https://github.com/ruzicka/to-json-schema/issues/12
 */
function fixSchemaBug(schema: any): void {
  if (typeof schema?.required === 'boolean') {
    // Fix 'object' type
    if (schema.type === 'object' && typeof schema.properties === 'object') {
      // Fix the incorrect `required` property.
      schema.required = Object.keys(schema.properties);
      // Apply recursively for all object's properties.
      Object.values(schema.properties).forEach((propertySubSchema) => fixSchemaBug(propertySubSchema));
    } else {
      // No `required` needed.
      // TODO: Can this situation (`type==='object'`, but no `properties` defined) happend, or is it not possible in JSON schema?
      delete schema.required;
    }
    // Fix 'array' type
    if (schema.type === 'array' && typeof schema.items === 'object') {
      // Apply recursively for array items type.
      fixSchemaBug(schema.items);
      // Optionally we can force array to be non-empty.
      // /*enable if needed*/ schema.minItems = 1;
    }
  }
}


interface EditedDocument extends Omit<JsonDocumentToSave, 'schema'|'notes'|'contents_raw'|'write_password_bcrypted'> {}

type LoadedOrNewJSONDocument = Omit<JsonDocumentToSave, 'write_password_bcrypted'>;