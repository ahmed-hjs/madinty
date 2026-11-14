import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { AuthModalService } from '../../features/auth/auth-modal.service';
import { apiErrorMessage } from '../../core/utils/errors';
import { ReportService } from '../../core/services/report.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-support-button',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="sb"
      [class.done]="supported()"
      [disabled]="busy() || supported() || mine()"
      [attr.aria-pressed]="supported()"
      (click)="click()"
    >
      @if (supported()) {
        <app-icon name="check" [size]="15" [stroke]="2.4" /> Soutenu · {{ count() }}
      } @else if (mine()) {
        <app-icon name="heart" [size]="15" /> Votre signalement · {{ count() }}
      } @else {
        <app-icon name="heart" [size]="15" /> {{ busy() ? 'Envoi…' : 'Soutenir' }}
      }
    </button>
    @if (error()) {
      <p class="err" role="alert">{{ error() }}</p>
    }
  `,
  styles: `
    :host {
      display: inline-block;
    }
    .sb {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      padding: 0 16px;
      border: 1.5px solid var(--border);
      border-radius: 999px;
      background: var(--glass-control);
      color: var(--link);
      font: 600 13px/1 var(--font);
      cursor: pointer;
      transition: background 0.15s;
    }
    .sb:hover:not([disabled]) {
      background: var(--glass-hover);
    }
    .sb[disabled] {
      cursor: default;
      color: var(--muted);
    }
    .sb.done {
      border-color: transparent;
      background: var(--st-resolu-bg);
      color: var(--st-resolu-fg);
    }
    .err {
      margin: 6px 0 0;
      color: var(--st-urgent-fg);
      font-size: 12px;
    }
  `,
})
export class SupportButtonComponent {
  private readonly api = inject(ReportService);
  private readonly modal = inject(AuthModalService);

  readonly reportId = input.required<number>();
  readonly count = input(0);
  readonly supported = input(false);
  readonly mine = input(false);
  readonly changed = output<{ count: number; supported: boolean }>();

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected click(): void {
    this.modal.requireLogin(() => this.send(), 'Connectez-vous pour soutenir ce signalement.');
  }

  private send(): void {
    if (this.busy() || this.supported() || this.mine()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.support(this.reportId()).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.changed.emit({ count: r.supports_count, supported: true });
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        if (e.status === 409) return this.changed.emit({ count: this.count(), supported: true });
        this.error.set(apiErrorMessage(e, 'Impossible de soutenir ce signalement.'));
      },
    });
  }
}
