import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { NavBarComponent } from './nav-bar.component';
import { routes } from '../../app.routes';
import { AuthService } from '../../core/services/auth.service';

describe('NavBarComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavBarComponent],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
  });

  it('deve renderizar a marca MoneyMonkey', () => {
    const fixture = TestBed.createComponent(NavBarComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.nav-bar__wordmark')?.textContent).toContain('MoneyMonkey');
  });

  it('MVP-7 criterio 2: deve renderizar link para Painel apontando para /dashboard', () => {
    const fixture = TestBed.createComponent(NavBarComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector('a[href="/dashboard"]');
    expect(link?.textContent?.trim()).toBe('Painel');
  });

  it('MVP-7 criterio 2: link Painel deve vir antes do link Transações na nav', () => {
    const fixture = TestBed.createComponent(NavBarComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll('.nav-bar__link')).map((el) =>
      el.textContent?.trim()
    );

    expect(links.indexOf('Painel')).toBeGreaterThanOrEqual(0);
    expect(links.indexOf('Transações')).toBeGreaterThan(links.indexOf('Painel'));
  });

  it('MVP-7 criterio 2: deve marcar o link Painel como ativo quando a rota atual e /dashboard', async () => {
    const fixture = TestBed.createComponent(NavBarComponent);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const dashboardLink = compiled.querySelector('a[href="/dashboard"]');

    expect(dashboardLink?.classList.contains('nav-bar__link--active')).toBeTrue();
  });

  it('deve renderizar link para Transações apontando para /transactions', () => {
    const fixture = TestBed.createComponent(NavBarComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector('a[href="/transactions"]');
    expect(link?.textContent?.trim()).toBe('Transações');
  });

  it('deve renderizar link para Categorias apontando para /categories', () => {
    const fixture = TestBed.createComponent(NavBarComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector('a[href="/categories"]');
    expect(link?.textContent?.trim()).toBe('Categorias');
  });

  it('deve renderizar link para Cartões apontando para /credit-cards', () => {
    const fixture = TestBed.createComponent(NavBarComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector('a[href="/credit-cards"]');
    expect(link?.textContent?.trim()).toBe('Cartões');
  });

  it('deve marcar como ativo o link da rota atual', async () => {
    const fixture = TestBed.createComponent(NavBarComponent);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/categories');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const categoriesLink = compiled.querySelector('a[href="/categories"]');
    const transactionsLink = compiled.querySelector('a[href="/transactions"]');

    expect(categoriesLink?.classList.contains('nav-bar__link--active')).toBeTrue();
    expect(transactionsLink?.classList.contains('nav-bar__link--active')).toBeFalse();
  });

  it('deve renderizar um botão "Sair" visível', () => {
    const fixture = TestBed.createComponent(NavBarComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const logoutButton = compiled.querySelector<HTMLButtonElement>('.nav-bar__logout');

    expect(logoutButton).toBeTruthy();
    expect(logoutButton?.tagName).toBe('BUTTON');
    expect(logoutButton?.textContent?.trim()).toBe('Sair');
  });

  it('ao clicar em "Sair" chama AuthService.logout()', () => {
    const fixture = TestBed.createComponent(NavBarComponent);
    const authService = TestBed.inject(AuthService);
    const logoutSpy = spyOn(authService, 'logout');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const logoutButton = compiled.querySelector<HTMLButtonElement>('.nav-bar__logout');
    logoutButton?.click();

    expect(logoutSpy).toHaveBeenCalled();
  });

  it('ao clicar em "Sair" navega para /login', () => {
    const fixture = TestBed.createComponent(NavBarComponent);
    const authService = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    spyOn(authService, 'logout');
    const navigateSpy = spyOn(router, 'navigateByUrl');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const logoutButton = compiled.querySelector<HTMLButtonElement>('.nav-bar__logout');
    logoutButton?.click();

    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });
});
