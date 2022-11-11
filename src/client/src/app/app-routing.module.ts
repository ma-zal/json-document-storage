import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DocumentEditorComponent } from './document-editor/document-editor.component';
import { DocumentsListComponent } from './documents-list/documents-list.component';
import { WarningNonSavedGuard } from './warning-non-saved.guard';

const routes: Routes = [
  {
    path: '',
    component: DocumentsListComponent,
  },
  {
    path: 'document',
    component: DocumentEditorComponent,
    canDeactivate: [WarningNonSavedGuard],
  },
  {
    path: 'document/:documentId',
    component: DocumentEditorComponent,
    canDeactivate: [WarningNonSavedGuard],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
