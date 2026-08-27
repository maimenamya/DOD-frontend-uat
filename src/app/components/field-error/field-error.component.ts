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
  /** Template-driven / custom copy. When set, shown whenever `validated` is true. */
  readonly message = input<string | null | undefined>(undefined);
  readonly label = input<string | null | undefined>(undefined);
  readonly select = input(false);

  readonly visible = computed(() => {
    const custom = this.message()?.trim();
    if (custom) return this.validated();
    return showControlError(this.control(), this.validated());
  });

  readonly text = computed(() => {
    const custom = this.message()?.trim();
    if (custom) return custom;
    return (
      controlErrorMessage(this.control(), {
        label: this.label()?.trim() || undefined,
        select: this.select(),
      }) ?? ''
    );
  });
}
