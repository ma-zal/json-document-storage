import { catchError, Observable, ObservableInput, tap } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  JsonDocument, JsonDocumentListItem, JsonDocumentToSave, JsonPublicDocument
} from '@server/db/document';

@Injectable({
  providedIn: 'root'
})
export class JsonDocumentService {

  constructor(private http: HttpClient) { }

  get(documentId: string): Observable<JsonPublicDocument> {
    return this.http.get<JsonPublicDocument>('/api/manage/document/' + documentId).pipe(
      catchError(throwHttpServerErrorMessage)
    );
  }  

  set(document: JsonDocumentToSave): Observable<JsonPublicDocument> {
    return this.http.post<JsonDocument>('/api/manage/document', document).pipe(
      tap((document) => {
        document.created_at = new Date(document.created_at as any as string);
        document.updated_at = new Date(document.updated_at as any as string);
      }),
      catchError(throwHttpServerErrorMessage)
    );
  }

  list(): Observable<JsonDocumentListItem[]> {
    return this.http.get<JsonDocumentListItem[]>('/api/manage/documents').pipe(
      tap((documents) => {
        documents.forEach((document) => {
          document.created_at = new Date(document.created_at as any as string);
          document.updated_at = new Date(document.updated_at as any as string);
        });
      }),
      catchError(throwHttpServerErrorMessage)
    );
    Date.parse
  }

}


function throwHttpServerErrorMessage<T>(err: HttpErrorResponse, o: ObservableInput<T>): Observable<T> {
  if (err.error?.error) {
    throw new Error(err.error.error);
  } else {
    throw err;
  }
}
