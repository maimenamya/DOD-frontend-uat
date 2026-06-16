import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-master-list-toolbar',
  templateUrl: './master-list-toolbar.component.html',
})
export class MasterListToolbarComponent {
  readonly search = input('');
  readonly placeholder = input('ค้นหา...');
  readonly searchChange = output<string>();

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchChange.emit(value);
  }
}
