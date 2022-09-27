import { tap } from 'rxjs';
import { Component, OnInit } from '@angular/core';
import { JsonDocumentListItem } from '@common/json-document.type';
import { JsonDocumentService } from '../json-document.service';

@Component({
  selector: 'app-documents-list',
  templateUrl: './documents-list.component.html',
  styleUrls: ['./documents-list.component.scss']
})
export class DocumentsListComponent implements OnInit {

  error: string|undefined;
  isLoading = true;
  documents: JsonDocumentListItem[] = [];

  constructor(
    private jsonDocumentService: JsonDocumentService,
  ) {
    this.isLoading = true;
    jsonDocumentService.list().pipe(
      tap((list) => {
        // Save to controller
        this.documents = list;
      })
    ).subscribe({
      next: () => {
        this.isLoading = false;
      },
      error: (err: Error) => {
        this.error = err.message;
        this.isLoading = false;
      }
    })
  }

  ngOnInit(): void {
  }

}
