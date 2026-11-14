import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { networkOrServerMessage } from '../../core/utils/errors';
import { PublicService } from '../../core/services/public.service';
import { emailValidator } from '../../core/utils/validators';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';
import { SiteHeaderComponent } from '../../shared/site-header/site-header.component';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, SiteHeaderComponent, SiteFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
})
export class ContactComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(PublicService);

  protected readonly subjects = [
    'Une question sur MADINTY',
    'Un problème technique',
    'Devenir organisme partenaire',
    'Données personnelles',
    'Autre',
  ];

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.required, emailValidator]],
    subject: [this.subjects[0], [Validators.required]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
    consent: [false, [Validators.requiredTrue]],
  });

  protected readonly submitted = signal(false);
  protected readonly loading = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);

  protected invalid(name: 'name' | 'email' | 'message' | 'consent'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  protected submit(): void {
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, email, subject, message } = this.form.getRawValue();
    this.loading.set(true);
    this.api.sendContact({ name: name.trim(), email: email.trim(), subject, message: message.trim() }).subscribe({
      next: () => {
        this.loading.set(false);
        this.sent.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(
          networkOrServerMessage(err) ??
            (err.status === 400 ? 'Certaines informations sont invalides. Vérifiez le formulaire.' : 'Envoi impossible. Réessayez.'),
        );
      },
    });
  }

  protected again(): void {
    this.form.reset({ subject: this.subjects[0] });
    this.submitted.set(false);
    this.sent.set(false);
  }
}
