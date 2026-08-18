import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse } from '../models/auth.model';

const LOGIN_URL = `${environment.apiBaseUrl}/api/auth/login`;
const TOKEN_STORAGE_KEY = 'auth_token';
const FIRST_NAME_STORAGE_KEY = 'auth_first_name';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(LOGIN_URL, request).pipe(
      tap((response) => {
        this.setToken(response.token);
        this.setFirstName(response.firstName);
      })
    );
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  // Espelha getToken(): retorna null tanto para sessao sem login quanto para uma
  // sessao autenticada anterior a este ticket (token ja existente, sem essa chave
  // ainda persistida) - caso de borda esperado, tratado pelo fallback de saudacao.
  getFirstName(): string | null {
    return localStorage.getItem(FIRST_NAME_STORAGE_KEY);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(FIRST_NAME_STORAGE_KEY);
  }

  private setToken(token: string): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  private setFirstName(firstName: string): void {
    localStorage.setItem(FIRST_NAME_STORAGE_KEY, firstName);
  }
}
