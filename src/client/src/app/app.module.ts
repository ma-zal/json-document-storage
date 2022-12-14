import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DocumentEditorComponent } from './document-editor/document-editor.component';
import { DocumentsListComponent } from './documents-list/documents-list.component';
import { MonacoDocumentMultiEditorComponent } from './monaco-document-multi-editor/monaco-document-multi-editor.component';

@NgModule({
  declarations: [
    AppComponent,
    DocumentEditorComponent,
    DocumentsListComponent,
    MonacoDocumentMultiEditorComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    HttpClientModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
