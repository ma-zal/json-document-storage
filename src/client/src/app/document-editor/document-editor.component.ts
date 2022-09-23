import cryptoRandomString from 'crypto-random-string';
import * as JSON5 from 'json5';
import { URI } from 'monaco-editor/esm/vs/base/common/uri';
import { /*editor as MonacoEditor,*/ languages as MonacoLanguages } from 'monaco-editor';
import { NgxEditorModel } from 'ngx-monaco-editor-v2';
import { catchError, combineLatest, map, of, shareReplay, Subject, switchMap, tap } from 'rxjs';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { default as jsonSchemaDraft07 } from 'ajv/lib/refs/json-schema-draft-07.json';
import { parseDocument } from '@common/document-parse';
import { JsonDocumentToSave } from '@server/db/document';
import { JsonDocumentService } from '../json-document.service';
import { JSONData } from '@common/json-data.type';

const emptyDocument: JsonDocumentToSave = {
  id: null,
  title: '',
  notes: '',
  contents_raw: JSON.stringify({
    "welcomeTo": "JSON document store",
  }, null, 2) + '\n',
  schema: JSON.stringify({
    "type": "object",
    "required": [
      "welcomeTo"
    ],
    "properties": {
      "welcomeTo": {
        "type": "string"
      },
    },
  }, null, 2) + '\n',
  write_access_token: ''

};

@Component({
  selector: 'app-document-editor',
  templateUrl: './document-editor.component.html',
  styleUrls: ['./document-editor.component.scss']
})
export class DocumentEditorComponent implements OnInit, OnDestroy {

  uiTabIndex = 0;

  error: string | undefined;
  isLoading: boolean = true;
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
    uri: URI.parse('file:///contents.json'), // Used as ID in Monaco Editor. Must be defined anyhow, but unique.
    language: 'json',
    value: '',
  };

  schemaModel: NgxEditorModel = {
   uri: URI.parse('file:///myschema.json'), // Used as ID in Monaco Editor. Must be defined anyhow, but unique.
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
          uri: 'http://local/myschema-schema.json',
          fileMatch: ['myschema.json'], // Associate with schema editor
          schema: jsonSchemaDraft07
        },,
        ...(schemaJson ? [
          {
            uri: 'http://local/contents-schema.json',
            fileMatch: ['contents.json'], // associate with contents.
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
        this.error = undefined;
        this.isLoading = true;
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
        this.isLoading = false;
        this.error = err.message;
        throw err;
      }),
    ).subscribe((document) => {
      this.isLoading = false;
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
    try {
      this.isLoading = true;
      this.error = undefined;

      this.applySchemaFromEditor();

      // Apply contents from editor
      this.document.contents_raw = this.contentsModel.value;

      const schema = this.document.schema || null;

      // Check the document validation (throws error)
      parseDocument(this.document.contents_raw, schema);

      this.jsonDocumentService.set({
        id: this.document.id,
        title: this.document.title,
        notes: this.document.notes,
        contents_raw: this.document.contents_raw,
        schema: schema,
        write_access_token: this.document.write_access_token,
      }).subscribe({
        next: (document) => {
          this.document.id = document.id;

          this.isLoading = false;

          // Route to document editation (used, when stored a new document).
          if (!this.activeRoute.snapshot.params['documentId']) {
            this.router.navigate(['/document', this.document.id]);
          }
        },
        // Error catch
        error: (err: Error) => {
          this.error = err.message;
          this.isLoading = false;
      }});
    } catch (e: any) {
      this.error = 'Document was not saved. Error reason: ' + e.message;
      this.isLoading = false;
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
    this.useContentsSchema(this.schemaModel.value);
  }

}
