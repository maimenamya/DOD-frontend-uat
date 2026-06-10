import { Component, computed, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

import {
  controlErrorMessage,
  showControlError,
} from '../../utils/form-validation.util';

@Component({
  selector: 'app-field-error',
  template: `
    @if (visible()) {
      <p class="app-field-error" role="alert">{{ text() }}</p>
    }
  `,
})
export class FieldErrorComponent {
  readonly control = input<AbstractControl | null | undefined>(null);
  readonly validated = input(false);

  readonly visible = computed(() => showControlError(this.control(), this.validated()));
  readonly text = computed(() => controlErrorMessage(this.control()) ?? '');
}
