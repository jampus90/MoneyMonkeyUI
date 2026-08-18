import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthService } from '../../core/services/auth.service';
import { LoginResponse } from '../../core/models/auth.model';
import { UserType } from '../../core/models/enums.model';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let router: Router;

  const loginResponse: LoginResponse = {
    token: 'fake-jwt-token',
    expiresAt: '2026-08-10T00:00:00Z',
    userId: 1,
    firstName: 'Ana',
    lastName: 'Silva',
    userType: UserType.Pf
  };

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['login']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [{ provide: AuthService, useValue: authServiceSpy }]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture.detectChanges();
  });

  function setFieldValues(username: string, password: string): void {
    component.form.controls.username.setValue(username);
    component.form.controls.password.setValue(password);
  }

  function submit(): void {
    component.onSubmit();
    fixture.detectChanges();
  }

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('criterio 1: login com sucesso envia LoginRequest, persiste via AuthService e redireciona (MVP-7: destino /dashboard)', () => {
    authServiceSpy.login.and.returnValue(of(loginResponse));
    setFieldValues('ana', 'senha123');

    submit();

    expect(authServiceSpy.login).toHaveBeenCalledWith({ username: 'ana', password: 'senha123' });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    expect(component.errorMessage).toBeNull();
  });

  it('criterio 2: credenciais invalidas (401) exibe mensagem generica e nao redireciona', () => {
    authServiceSpy.login.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }))
    );
    setFieldValues('ana', 'errada');

    submit();

    expect(component.errorMessage).toBe('Usuário ou senha inválidos');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('criterio 3: username vazio bloqueia envio e marca campo obrigatorio', () => {
    setFieldValues('', 'senha123');

    submit();

    expect(authServiceSpy.login).not.toHaveBeenCalled();
    expect(component.form.controls.username.hasError('required')).toBeTrue();
  });

  it('criterio 4: password vazio bloqueia envio e marca campo obrigatorio', () => {
    setFieldValues('ana', '');

    submit();

    expect(authServiceSpy.login).not.toHaveBeenCalled();
    expect(component.form.controls.password.hasError('required')).toBeTrue();
  });

  it('criterio 5: ambos vazios bloqueia envio e marca os dois campos obrigatorios', () => {
    setFieldValues('', '');

    submit();

    expect(authServiceSpy.login).not.toHaveBeenCalled();
    expect(component.form.controls.username.hasError('required')).toBeTrue();
    expect(component.form.controls.password.hasError('required')).toBeTrue();
  });

  it('caso de borda: nao impoe limite de tamanho para username/password (apenas contrato define obrigatoriedade)', () => {
    authServiceSpy.login.and.returnValue(of(loginResponse));
    const longValue = 'a'.repeat(300);
    setFieldValues(longValue, longValue);

    submit();

    expect(component.form.valid).toBeTrue();
    expect(authServiceSpy.login).toHaveBeenCalledWith({ username: longValue, password: longValue });
  });

  it('caso de borda: falha de rede (sem status 401) exibe mensagem de conexao distinta', () => {
    authServiceSpy.login.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );
    setFieldValues('ana', 'senha123');

    submit();

    expect(component.errorMessage).toBe('Erro de conexão. Tente novamente.');
    expect(component.errorMessage).not.toBe('Usuário ou senha inválidos');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
