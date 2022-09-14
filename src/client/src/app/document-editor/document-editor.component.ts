import cryptoRandomString from 'crypto-random-string';
import * as JSON5 from 'json5';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { JsonDocumentToSave } from '@server/db/document';
import { JsonDocumentService } from '../json-document.service';

const emptyDocument: JsonDocumentToSave = {
  id: null,
  title: '',
  contents: JSON5.stringify({
    "welcomeTo": "JSON document store",
  }, null, 2) + '\n',
  schema: JSON5.stringify({
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
export class DocumentEditorComponent implements OnInit {

  error: string | undefined;
  isLoading: boolean = true;
  schemaEnabled = false;
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
              contents: JSON5.stringify(existingDocument.contents, null, 2) + '\n',
              schema: existingDocument.schema ? JSON5.stringify(existingDocument.schema, null, 2) + '\n' : null,
              title: existingDocument.title,
              write_access_token: ''
            }))
          );
        } else if (documentId === undefined) {
          // New document
          return of(<JsonDocumentToSave>{
            ...emptyDocument,
            id: null,
            title: 'New document',

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
        contents: document.contents,
        schema: document.schema,
        title: document.title,
        write_access_token: document.write_access_token,
      };
      this.schemaEnabled = Boolean(document.schema);
    });
  }

  ngOnInit(): void { }

  /**
   * Save new document / update existing.
   */
  save() {
    try {
      this.isLoading = true;
      this.error = undefined;
      this.jsonDocumentService.set({
        id: this.document.id,
        contents: JSON5.parse(this.document.contents),
        schema: this.document.schema && this.schemaEnabled ? JSON5.parse(this.document.schema) : null,
        title: this.document.title,
        write_access_token: this.document.write_access_token,
      }).subscribe({
        next: (document) => {
          this.document = {
            id: document.id,
            contents: JSON5.stringify(document.contents, null, 2) + '\n',
            schema: document.schema && this.schemaEnabled ? JSON5.stringify(document.schema, null, 2) + '\n' : null,
            title: document.title,
            write_access_token: this.document.write_access_token,
          };
          this.isLoading = false;

          // Route to document editation (used, when stored a new document).
          if (!this.activeRoute.snapshot.params['documentId']) {
            console.log('reload');
            this.router.navigate(['/document', this.document.id]);
          }
        },
        // Error catch
        error: (err: Error) => {
          this.error = err.message;
          this.isLoading = false;
      }});
    } catch (e: any) {
      this.error = e.message;
      this.isLoading = false;
    }
  }

  getApiUrl(documentId: string) {
    return window.location.origin + '/api/document/' + documentId;
  }
}
