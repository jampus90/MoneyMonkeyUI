import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { NavBarComponent } from './shared/nav-bar/nav-bar.component';

const HIDDEN_NAV_ROUTES = ['/', '/login'];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavBarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly router = inject(Router);

  get showNav(): boolean {
    return !HIDDEN_NAV_ROUTES.includes(this.router.url);
  }
}
