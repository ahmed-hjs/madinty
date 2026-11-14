import { Component, computed, input } from '@angular/core';
import { passwordScore } from '../../core/utils/password';

@Component({
  selector: 'app-password-strength',
  template: `
    <div class="gauge" [attr.data-score]="score()" aria-hidden="true">
      @for (i of segments; track i) {
        <span [class.on]="i <= score()"></span>
      }
    </div>
    @if (value()) {
      <p class="gauge-label" aria-live="polite">Robustesse : {{ label() }}</p>
    }
  `,
  styles: [
    `
      .gauge {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
        margin-top: 8px;
      }
      .gauge span {
        height: 4px;
        border-radius: 2px;
        background: var(--am-border);
      }
      .gauge[data-score='1'] .on {
        background: var(--am-err-solid);
      }
      .gauge[data-score='2'] .on {
        background: var(--am-warn-solid);
      }
      .gauge[data-score='3'] .on,
      .gauge[data-score='4'] .on {
        background: var(--am-ok-solid);
      }
      .gauge-label {
        margin: 4px 0 0;
        color: var(--am-text-2);
        font-size: 12px;
      }
    `,
  ],
})
export class PasswordStrengthComponent {
  readonly value = input('');
  protected readonly segments = [1, 2, 3, 4];
  protected readonly score = computed(() => passwordScore(this.value()));
  protected readonly label = computed(() => ['très faible', 'faible', 'moyenne', 'bonne', 'excellente'][this.score()]);
}
