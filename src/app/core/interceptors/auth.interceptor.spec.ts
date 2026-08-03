import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  function setup(token: string | null): void {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['getToken']);
    authServiceSpy.getToken.and.returnValue(token);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceSpy }
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('deve anexar Authorization: Bearer <token> quando ha token e a rota exige autenticacao', () => {
    setup('fake-jwt-token');

    httpClient.get(`${environment.apiBaseUrl}/api/transaction`).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/transaction`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer fake-jwt-token');
    req.flush({});
  });

  it('NAO deve anexar Authorization em POST /api/auth/login mesmo havendo token', () => {
    setup('fake-jwt-token');

    httpClient.post(`${environment.apiBaseUrl}/api/auth/login`, { username: 'ana', password: 'senha123' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/auth/login`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('NAO deve anexar Authorization em POST /api/user mesmo havendo token', () => {
    setup('fake-jwt-token');

    httpClient.post(`${environment.apiBaseUrl}/api/user`, { firstName: 'Ana' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/user`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('deve anexar Authorization: Bearer <token> em GET /api/user, pois so o POST /api/user (cadastro) e publico', () => {
    setup('fake-jwt-token');

    httpClient.get(`${environment.apiBaseUrl}/api/user`).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/user`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer fake-jwt-token');
    req.flush({});
  });

  it('deve anexar Authorization: Bearer <token> em GET /api/category', () => {
    setup('fake-jwt-token');

    httpClient.get(`${environment.apiBaseUrl}/api/category`).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/category`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer fake-jwt-token');
    req.flush({});
  });

  it('deve anexar Authorization: Bearer <token> em GET /api/creditcard', () => {
    setup('fake-jwt-token');

    httpClient.get(`${environment.apiBaseUrl}/api/creditcard`).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/creditcard`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer fake-jwt-token');
    req.flush({});
  });

  it('NAO deve anexar Authorization quando nao ha token (getToken retorna null)', () => {
    setup(null);

    httpClient.get(`${environment.apiBaseUrl}/api/transaction`).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/transaction`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });
});
