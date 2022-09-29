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
    return this.swal.fire({
      title: 'Error occured',
      text: err.message,
      icon: 'error',
    });
  }

  /**
   * Closes currently diplayed popup.
   */
  closePopup() {
    return this.swal.close();
  }
}
