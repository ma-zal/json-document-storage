import { tap } from 'rxjs';
import { Component, OnInit } from '@angular/core';
import { JsonDocumentListItem } from '@common/json-document.type';
import { JsonDocumentService } from '../json-document.service';
import { SweetalertService } from '../sweetalert.service';

@Component({
  selector: 'app-documents-list',
  templateUrl: './documents-list.component.html',
  styleUrls: ['./documents-list.component.scss']
})
export class DocumentsListComponent {

  documents: JsonDocumentListItem[] = [];

  constructor(
    private jsonDocumentService: JsonDocumentService,
    private sweetAlertService: SweetalertService,
  ) {
    this.sweetAlertService.displayBusy({ title: 'Loading ...' });

    jsonDocumentService.list().pipe(
      tap((list) => {
        // Save to controller
        this.documents = list;
      })
    ).subscribe({
      next: () => {
        this.sweetAlertService.closePopup();
      },
      error: (err: Error) => {
        err.message = 'Failed to load the list of documents. ' + err.message;
        this.sweetAlertService.displayError(err);
      }
    })
  }
}
