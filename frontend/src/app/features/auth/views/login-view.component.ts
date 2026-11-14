import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { networkOrServerMessage } from '../../../core/utils/errors';
import { emailValidator } from '../../../core/utils/validators';
import { PasswordFieldComponent } from '../../../shared/password-field/password-field.component';
import { AuthModalService } from '../auth-modal.service';

@Component({
  selector: 'app-login-view',
  imports: [ReactiveFormsModule, PasswordFieldComponent],
  templateUrl: './login-view.component.html',
})
export class LoginViewComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  protected readonly modal = inject(AuthModalService);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, emailValidator]],
    password: ['', [Validators.required]],
    remember: [true],
  });
  protected readonly loading = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);

  protected showError(name: 'email' | 'password'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  protected emailMessage(): string {
    return this.form.controls.email.hasError('required')
      ? 'Saisissez votre adresse e-mail.'
      : 'Adresse e-mail invalide.';
  }

  protected submit(): void {
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password, remember } = this.form.getRawValue();
    this.loading.set(true);
    this.auth.login(email.trim(), password, remember).subscribe({
      next: (user) => {
        this.loading.set(false);
        this.modal.completeLogin(user);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(networkOrServerMessage(err) ?? 'E-mail ou mot de passe incorrect.');
      },
    });
  }
}
