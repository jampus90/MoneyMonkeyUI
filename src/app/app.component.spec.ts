import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AppComponent } from './app.component';
import { routes } from './app.routes';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('criterio 6 (mvp-1-login-auth): navegar para "/" no AppComponent real renderiza a tela de login', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input#username')).toBeTruthy();
    expect(compiled.querySelector('input#password')).toBeTruthy();

    // A rota raiz deve exibir A tela de login, não a tela de login em algum
    // lugar do DOM abaixo do template de marketing padrão gerado pelo `ng new`.
    expect(compiled.textContent).not.toContain('Congratulations! Your app is running');
    expect(compiled.querySelector('.pill-group')).toBeFalsy();
  });
});
