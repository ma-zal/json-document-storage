import cryptoRandomString from 'crypto-random-string';
import * as JSON5 from 'json5';
import { URI } from 'monaco-editor/esm/vs/base/common/uri';
import { /*editor as MonacoEditor,*/ languages as MonacoLanguages } from 'monaco-editor';
import { NgxEditorModel } from 'ngx-monaco-editor-v2';
import { catchError, combineLatest, defer, map, of, shareReplay, Subject, switchMap, tap } from 'rxjs';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { default as jsonSchemaDraft07 } from 'ajv/lib/refs/json-schema-draft-07.json';
import * as toJsonSchema from 'to-json-schema';
import { parseDocument } from '@common/document-parse';
import { JsonDocumentToSave } from '@common/json-document.type';
import { JsonDocumentService } from '../json-document.service';
import { JSONData } from '@common/json-data.type';
import { SweetalertService } from '../sweetalert.service';

const FAKE_FILENAME_CONTENTS = 'contents.json';
const FAKE_FILENAME_SCHEMA = 'myschema.json'
const CONTENTS_MODEL_URI = `file:///${FAKE_FILENAME_CONTENTS}`;
const SCHEMA_MODEL_URI = `file:///${FAKE_FILENAME_SCHEMA}`;

const emptyDocument: JsonDocumentToSave = {
  id: null,
  title: '',
  notes: '',
  contents_raw: JSON.stringify({
    "welcomeTo": "JSON document store",
  }, null, 2) + '\n',
  schema: null,
  write_access_token: ''

};

@Component({
  selector: 'app-document-editor',
  templateUrl: './document-editor.component.html',
  styleUrls: ['./document-editor.component.scss']
})
export class DocumentEditorComponent implements OnInit, OnDestroy {

  uiTabIndex = 0;

  /** Observable for transfering schema from source (editor, loader) into validator and into document to save. */
  contentsSchemaUpdater$: Subject<string> = new Subject();
  monacoInitialized$ = new Subject<void>();

  editorOptions/*: MonacoEditor.IStandaloneEditorConstructionOptions*/ = {
    theme: 'vs-dark',
    scrollBeyondLastLine: false,
    language: 'json',
    minimap: {
      enabled: false,
    },
    fontSize: 18,
    fontFamily: 'monospace',
    lineNumbersMinChars: 2,
    
    // fontWeight: 'bold'
  };

  contentsModel: NgxEditorModel = {
    uri: URI.parse(CONTENTS_MODEL_URI), // Used as ID in Monaco Editor. Must be defined anyhow, but unique.
    language: 'json',
    value: '',
  };

  schemaModel: NgxEditorModel = {
   uri: URI.parse(SCHEMA_MODEL_URI), // Used as ID in Monaco Editor. Must be defined anyhow, but unique.
    language: 'json',
    value: '',
  };

  public document: JsonDocumentToSave = {
    ...emptyDocument,
    write_access_token: ''
  };
  // public writeAccessToken: string = '';

  constructor(
    private activeRoute: ActivatedRoute,
    private router: Router,
    private jsonDocumentService: JsonDocumentService,
    private sweetalertService: SweetalertService,
  ) {
    // Update schema in document.
    this.contentsSchemaUpdater$.pipe(shareReplay(1)).subscribe((strigifiedSchema) => {
      this.document.schema = strigifiedSchema ? JSON5.parse(strigifiedSchema) : null;
    });

    // Set schema as Monaco validator.
    combineLatest([
      this.contentsSchemaUpdater$,
      this.monacoInitialized$,
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
          uri: 'http://local/myschema-schema.json',  // TODO Is it needed?
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
    this.activeRoute.params.pipe(
      tap(() => {
        this.sweetalertService.displayBusy({
          title: 'Loading ...'
        });
      }),
      switchMap((params) => {
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
              write_access_token: ''
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
          // Generate a random token for new documents
          if (!document.id) {
            this.document.write_access_token = cryptoRandomString({length: 16, type: 'alphanumeric'});;
          }
          this.document = {
            id: document.id,
            contents_raw: document.contents_raw, // TODO: Not required here.
            schema: document.schema,  //TODO: Not required here, because updated by `updateSchema()` below.
            title: document.title,
            notes: document.notes,
            write_access_token: document.write_access_token,
          };
          this.contentsModel.value = document.contents_raw;
          const stringifiedSchema = document.schema ? JSON.stringify(document.schema, null, 2) : '';
          this.schemaModel.value = stringifiedSchema;
          // Start the contents validation agains schema.
          this.useContentsSchema(stringifiedSchema);
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
  async save() {
    defer(() => {

      this.sweetalertService.displayBusy({
        title: 'Saving ...'
      });

      this.applySchemaFromEditor();

      // Apply contents from editor
      this.document.contents_raw = this.contentsModel.value;

      const schema = this.document.schema || null;

      // Check the document validation (throws error)
      parseDocument(this.document.contents_raw, schema);

      return this.jsonDocumentService.set({
        id: this.document.id,
        title: this.document.title,
        notes: this.document.notes,
        contents_raw: this.document.contents_raw,
        schema: schema,
        write_access_token: this.document.write_access_token,
      });
    }).subscribe({
      next: (document) => {
        this.document.id = document.id;
        this.sweetalertService.closePopup();

        // Route to document editation (used, when stored a new document).
        if (!this.activeRoute.snapshot.params['documentId']) {
          this.router.navigate(['/document', this.document.id]);
        }
      },
      complete: () => {
        this.sweetalertService.swal.fire({
          title: 'Saved.',
          timer: 2000,
          icon: 'success',
          timerProgressBar: true,
        });
      },
      // Error catch
      error: (err: Error) => {
        err.message = 'Document was not saved. Error reason: ' + err.message;
        this.sweetalertService.displayError(err);
    }});
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
    this.useContentsSchema(this.schemaModel.value);
  }

  generateSchema() {
    const isSchemaFilled = (/^(\s)*$/g).test(this.schemaModel.value);
    if (
      !isSchemaFilled &&
      !confirm('Some JSON schema is already defined. Would you like to override it by the generate one?')
    ) {
      return;
    }

    let currentDocumentContents: JSONData;
    try {
      currentDocumentContents = JSON5.parse(this.contentsModel.value);
    } catch (e: any) {
      e.message('Failed, because Document Contents is currently not valid JSON document. Please fix it first. JSON error: ' + e.message);
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
    const stringifiedSchema = JSON.stringify(schema, null, 2);
    (window as any).monaco.editor.getModel(SCHEMA_MODEL_URI).setValue(stringifiedSchema);
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
