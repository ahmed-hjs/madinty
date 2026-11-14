import { Component, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-password-field',
  imports: [ReactiveFormsModule],
  template: `
    <label class="label" [attr.for]="inputId()">{{ label() }}</label>
    <div class="input-wrap">
      <input
        class="input input--reveal"
        [id]="inputId()"
        [type]="visible() ? 'text' : 'password'"
        [formControl]="control()"
        [attr.autocomplete]="autocomplete()"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        [attr.aria-describedby]="invalid() ? inputId() + '-err' : null"
      />
      <button
        type="button"
        class="reveal"
        [attr.aria-pressed]="visible()"
        [attr.aria-controls]="inputId()"
        (click)="visible.set(!visible())"
      >
        {{ visible() ? 'Masquer' : 'Afficher' }}
      </button>
    </div>
  `,
})
export class PasswordFieldComponent {
  readonly control = input.required<FormControl<string>>();
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly autocomplete = input('current-password');
  readonly invalid = input(false);
  protected readonly visible = signal(false);
}
