import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { LoginResponse } from '../models/auth.model';
import { UserType } from '../models/enums.model';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const loginResponse: LoginResponse = {
    token: 'fake-jwt-token',
    expiresAt: '2026-08-10T00:00:00Z',
    userId: 1,
    firstName: 'Ana',
    lastName: 'Silva',
    userType: UserType.Pf
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('deve enviar POST para /api/auth/login com o LoginRequest informado', () => {
    service.login({ username: 'ana', password: 'senha123' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'ana', password: 'senha123' });
    req.flush(loginResponse);
  });

  it('deve persistir o token ao receber 200 com LoginResponse', () => {
    service.login({ username: 'ana', password: 'senha123' }).subscribe((res) => {
      expect(res).toEqual(loginResponse);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/auth/login`);
    req.flush(loginResponse);

    expect(service.getToken()).toBe('fake-jwt-token');
  });

  it('nao deve persistir token quando a API responde 401', () => {
    service.login({ username: 'ana', password: 'errada' }).subscribe({
      next: () => fail('nao deveria emitir sucesso'),
      error: (err) => expect(err.status).toBe(401)
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/auth/login`);
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(service.getToken()).toBeNull();
  });

  it('nao deve persistir token em falha de rede (sem status HTTP)', () => {
    service.login({ username: 'ana', password: 'senha123' }).subscribe({
      next: () => fail('nao deveria emitir sucesso'),
      error: (err) => expect(err.status).toBe(0)
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/auth/login`);
    req.error(new ProgressEvent('error'), { status: 0 });

    expect(service.getToken()).toBeNull();
  });

  it('getToken retorna null quando nenhum login foi realizado', () => {
    expect(service.getToken()).toBeNull();
  });

  it('logout remove o token de localStorage e getToken passa a retornar null', () => {
    service.login({ username: 'ana', password: 'senha123' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/auth/login`);
    req.flush(loginResponse);

    expect(service.getToken()).toBe('fake-jwt-token');

    service.logout();

    expect(service.getToken()).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('logout chamado quando nao ha token nao lanca erro (idempotente)', () => {
    expect(() => service.logout()).not.toThrow();
    expect(service.getToken()).toBeNull();
  });
});
