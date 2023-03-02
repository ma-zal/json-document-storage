import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { JsonDocumentListItem } from '@common/json-document.type';
import { from, Observable } from 'rxjs';
import { JsonDocumentService } from '../json-document.service';
import { SweetalertService } from '../sweetalert.service';
import { DocumentsListComponent } from './documents-list.component';

describe('DocumentsListComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule
      ],
      declarations: [
        DocumentsListComponent
      ],
      providers: [
        {
          provide: JsonDocumentService,
          useClass: JsonDocumentServiceMock,
        },
        {
          provide: SweetalertService,
          useValue: jasmine.createSpyObj('SweetalertService', ['displayBusy', 'closePopup']),
        }
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(DocumentsListComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});


class JsonDocumentServiceMock {
  list(): Observable<JsonDocumentListItem[]> {
    return from([]);
  }
}