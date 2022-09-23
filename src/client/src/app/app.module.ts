import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DocumentEditorComponent } from './document-editor/document-editor.component';
import { DocumentsListComponent } from './documents-list/documents-list.component';

@NgModule({
  declarations: [
    AppComponent,
    DocumentEditorComponent,
    DocumentsListComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    MonacoEditorModule.forRoot(),
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
