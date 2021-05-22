import { Directive, HostListener } from '@angular/core';

@Directive({
  selector: '[appModalToggle]',
  exportAs: 'appModalToggle'
})
export class ModalToggleDirective {
  isOpen = false;

  constructor() { }

  @HostListener('click')
  toggle(): void {
    this.isOpen = !this.isOpen;
  }

}
