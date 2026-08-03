// Interceptor funcional (HttpInterceptorFn) que anexa Authorization: Bearer <token>
// em todas as chamadas autenticadas, conforme spec docs/specs/mvp-1-login-auth.md
// (criterio de aceite 1) e docs/api-contract.md.
//
// Rotas explicitamente excluidas (nunca exigem/recebem o header, mesmo com token
// presente no storage): POST /api/auth/login e POST /api/user (cadastro de usuario,
// publico). A exclusao e por metodo + path juntos: GET /api/user exige autenticacao
// ([auth] em docs/api-contract.md) e deve receber o header normalmente.

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from '../services/auth.service';

const UNAUTHENTICATED_ROUTES: Array<{ method: string; path: string }> = [
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/user' }
];

function isUnauthenticatedRoute(method: string, url: string): boolean {
  return UNAUTHENTICATED_ROUTES.some(
    (route) => route.method === method.toUpperCase() && url.includes(route.path)
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (!token || isUnauthenticatedRoute(req.method, req.url)) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  });

  return next(authReq);
};
