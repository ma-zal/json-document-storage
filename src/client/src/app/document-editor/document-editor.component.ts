import * as JSON5 from 'json5';
import * as bcrypt from 'bcryptjs';
import { BehaviorSubject, catchError, defer, firstValueFrom, map, Observable, of, switchMap, tap } from 'rxjs';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormGroup, FormControl } from '@angular/forms';
import * as toJsonSchema from 'to-json-schema';
import { parseDocument } from '@common/document-parse';
import { JsonDocumentToSave } from '@common/json-document.type';
import { JsonDocumentService } from '../json-document.service';
import { JSONData } from '@common/json-data.type';
import { SweetalertService } from '../sweetalert.service';
import { MonacoDocumentMultiEditorComponent } from '../monaco-document-multi-editor/monaco-document-multi-editor.component';


const emptyDocument = {
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
export class DocumentEditorComponent {
  
  uiTabIndex = 0;

  private monacoMultiEditor: MonacoDocumentMultiEditorComponent | undefined;
  showNotesWarning$ = new BehaviorSubject(false);

  form = new FormGroup({
    id: new FormControl<string|null>(null),
    title: new FormControl<string>('', { nonNullable: true }),
    changePassword: new FormControl<boolean>(false, { nonNullable: true }),
    newPassword1: new FormControl<string>('', { nonNullable: true }),
    newPassword2: new FormControl<string>('', { nonNullable: true }),
    contents_raw: new FormControl<string>('', { nonNullable: true }),
    notes: new FormControl<string>('', { nonNullable: true }),
    schema_raw: new FormControl<string>('', { nonNullable: true }),
  });


  constructor(
    private activeRoute: ActivatedRoute,
    private router: Router,
    private jsonDocumentService: JsonDocumentService,
    private sweetalertService: SweetalertService,
  ) {
    // Update schema in document.
    // this.contentsSchemaUpdater$.pipe(shareReplay(1)).subscribe((strigifiedSchema) => {
    //   this.document.schema = strigifiedSchema ? JSON5.parse(strigifiedSchema) : null;
    // });


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
            contents_raw: document.contents_raw,
            notes: document.notes,
            schema_raw: stringifiedSchema,
          });

          this.changeEditorTab('contents');

          // Show/hide notes warning dialog
          this.showNotesWarning$.next(!(/^[\s]*$/.test(document.notes)));  // Show if notes is filled

          // Fresh data has been loaded just now. Therefore reset the dirty flag.
          this.form.markAsPristine();
        },
        error: (err: Error) => {
          this.sweetalertService.displayError(err);
        }
      });
  }


  /**
   * 
   * When child component with Monaco initialization finished, 
   * then callback returns instance of component itself.
   */
  public onAfterMonacoEditorInit(monacoMultiEditor: MonacoDocumentMultiEditorComponent) {
    this.monacoMultiEditor = monacoMultiEditor;
  }

  /**
   * Save new document / update existing.
   */
  save() {
    return defer(async () => {

      this.sweetalertService.displayBusy({
        title: 'Saving ...'
      });

      // Apply contents from editor
      const contents_raw = this.form.controls.contents_raw.value;
      if (contents_raw === undefined) {
        throw new Error('Contents is not defined');
      }
      // Apply schema from editor
      const stringifiedSchema = this.form.controls.schema_raw.value;
      const schema = stringifiedSchema ? JSON5.parse(stringifiedSchema) : null;

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
        notes: this.form.value.notes,
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
      const stringifiedContents = this.form.value.contents_raw!;
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
    if (!this.monacoMultiEditor) {
      return;
    }

    this.monacoMultiEditor.changeEditorTab(targetTab);

    switch (targetTab) {
      case 'contents':
        this.uiTabIndex = 0;
        break;
      case 'schema':
        this.uiTabIndex = 1;
        break;
      case 'notes':
        this.uiTabIndex = 2;
        break;
    }
  }

  /**
   * Show notes tab and hide the warning.
   */
  seeNotes() {
    if (!this.monacoMultiEditor) { return; }
    this.changeEditorTab('notes');
    this.showNotesWarning$.next(false);
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
