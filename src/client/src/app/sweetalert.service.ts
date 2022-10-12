import { Injectable } from '@angular/core';
import Swal, { SweetAlertOptions } from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class SweetalertService {
  constructor() {}

  dismissReasons = Swal.DismissReason;

  swal = Swal;

  /**
   * Displays modal window with busy spiner.
   */
  displayBusy(options: Partial<SweetAlertOptions>) {
    this.swal.fire({
      title: 'Busy ...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showClass: {
        // No animation
        popup: 'animate__animated animate__fadeInDown',
      },
      hideClass: {
        // No animation
        popup: 'animate__animated animate__fadeOutUp',
      },
      ...options,
    });
    this.swal.showLoading();
  }

  displayError(err: Error) {
    const htmlError = this.intoHtml(err.message);
    return this.swal.fire({
      title: 'Error occured',
      html: htmlError,
      icon: 'error',
    });
  }

  /**
   * Closes currently diplayed popup.
   */
  closePopup() {
    return this.swal.close();
  }

  /**
   * Converts plaintext into HTML.
   */
  private intoHtml(plain: string): string {
    return plain
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
      .replaceAll('\n', '<br />')
  }
}
