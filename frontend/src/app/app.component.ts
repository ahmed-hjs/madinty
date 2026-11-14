import { AuthModalComponent } from './features/auth/auth-modal.component';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AuthModalComponent, RouterOutlet],
  template: '<router-outlet /><app-auth-modal />',
})
export class AppComponent {}
