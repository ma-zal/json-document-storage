import * as JSON5 from 'json5';
import * as bcrypt from 'bcryptjs';
import { URI } from 'monaco-editor/esm/vs/base/common/uri';
import { editor as MonacoEditor, languages as MonacoLanguages } from 'monaco-editor';
import { catchError, combineLatest, defer, first, firstValueFrom, map, of, ReplaySubject, Subject, switchMap, tap } from 'rxjs';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
export class DocumentEditorComponent implements OnInit, OnDestroy {
  public CONTENTS_MODEL_URI = URI.parse(`file:///${FAKE_FILENAME_CONTENTS}`);
  public SCHEMA_MODEL_URI = URI.parse(`file:///${FAKE_FILENAME_SCHEMA}`);
  public NOTES_MODEL_URI = URI.parse(`file:///${FAKE_FILENAME_NOTES}`);

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

  showNotesWarning: boolean = false;

  /** Bind by ngModel to UI form. */
  public document: EditedDocument = {
    id: null,
    title: '',
  };

  /** Bind by ngModel to UI form. */
  public formPassword = {
    changePassword: false,
    newPassword1: '',
    newPassword2: '',
  }

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

          // Push loaded/new document into form
          this.document = {
            id: document.id,
            title: document.title,
          };
          // Create models in Monaco
          monacoEditorService.setModelValue(document.contents_raw, 'json', this.CONTENTS_MODEL_URI);
          monacoEditorService.setModelValue(document.notes, undefined, this.NOTES_MODEL_URI);
          const stringifiedSchema = document.schema ? JSON.stringify(document.schema, null, 2) : '';
          monacoEditorService.setModelValue(stringifiedSchema, 'json', this.SCHEMA_MODEL_URI);
          // Start the contents validation agains schema.
          this.useContentsSchema(stringifiedSchema);
          monacoEditorService.switchMonacoEditorModel(this.CONTENTS_MODEL_URI, this.savedStates);
          // Show/hide notes warning dialog
          this.showNotesWarning = !(/^[\s]*$/.test(document.notes));  // Show if notes is filled

          this.cdr.detectChanges();
        },
        error: (err: Error) => {
          this.sweetalertService.displayError(err);
        }
      });
  }


  ngOnInit(): void { }

  ngOnDestroy(): void {
    this.contentsSchemaUpdater$.complete();
    this.monacoInitialized$.complete();
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
      if (this.formPassword.changePassword) {
        // Check if both new passwords are same.
        if (this.formPassword.newPassword1 !== this.formPassword.newPassword2) {
          throw new Error('Entered new password does not match with confirm one.');
        }

        if (this.formPassword.newPassword1 !== '') {
          // Set/change write-protection password
          const salt = await bcrypt.genSalt(10);
          writePasswordBcrypted = await bcrypt.hash(this.formPassword.newPassword1, salt);
        } else {
          // Remove write-protection password
          writePasswordBcrypted = '';
        }
      }

      return this.uploadDocumentToServer(<JsonDocumentToSave>{
        id: this.document.id,
        title: this.document.title,
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
        this.formPassword.changePassword = false;
        this.formPassword.newPassword1 = '';
        this.formPassword.newPassword2 = '';

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
  onMonacoInit(editor: any) {
    (window as any).monaco.languages.json.jsonDefaults.setDiagnosticsOptions(<MonacoLanguages.json.DiagnosticsOptions>{
      allowComments: true,
      trailingCommas: 'ignore',
    });
    this.monacoInitialized$.next();
  }

  useContentsSchema(schema: string) {
    this.contentsSchemaUpdater$.next(schema);
  }

  applySchemaFromEditor() {
    // Read schema from Monaco editor
    const value = this.monacoEditorService.getModelEditorValue(this.SCHEMA_MODEL_URI);
    if (value === undefined) {
      throw new Error(`Model ${this.SCHEMA_MODEL_URI} is missing.`);
    }
    // Write as validation schema
    this.useContentsSchema(value);
  }

  generateSchema() {
    const existingStringifiedSchema = this.monacoEditorService.getModelEditorValue(this.SCHEMA_MODEL_URI) || '';
    const isSchemaFilled = (/^(\s)*$/g).test(existingStringifiedSchema);
    if (
      !isSchemaFilled &&
      !confirm('Some JSON schema is already defined. Would you like to override it by the generate one?')
    ) {
      return;
    }

    let currentDocumentContents: JSONData;
    try {
      const stringifiedContents = this.monacoEditorService.getModelEditorValue(this.CONTENTS_MODEL_URI);
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
    this.monacoEditorService.setModelValue(stringifiedGeneratedSchema, 'json', this.SCHEMA_MODEL_URI);
  }

  changeEditorTab(targetTab: 'contents'|'schema'|'notes') {
    switch (targetTab) {
      case 'contents':
        if (this.uiTabIndex === 1) {
          this.applySchemaFromEditor();
        }
        this.monacoEditorService.switchMonacoEditorModel(this.CONTENTS_MODEL_URI, this.savedStates);
        this.uiTabIndex = 0;
        break;
      case 'schema':
        this.monacoEditorService.switchMonacoEditorModel(this.SCHEMA_MODEL_URI, this.savedStates);
        this.uiTabIndex = 1;
        break;
      case 'notes':
        this.monacoEditorService.switchMonacoEditorModel(this.NOTES_MODEL_URI, this.savedStates)
        this.uiTabIndex = 2;
        break;
    }
  }

  /**
   * Show notes tab and hide the warning.
   */
  seeNotes() {
    this.changeEditorTab('notes');
    this.showNotesWarning = false;
    this.cdr.detectChanges();
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