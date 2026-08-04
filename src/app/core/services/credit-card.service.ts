// Service de cartoes de credito, consumindo GET/POST /api/creditcard (docs/api-contract.md,
// secao "Credit Cards"). Autenticacao (Authorization: Bearer <token>) e anexada
// automaticamente pelo auth.interceptor.ts entregue no MVP-1.

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CreditCardRequest, CreditCardResponse, CreditCardResponseList } from '../models/credit-card.model';

const CREDIT_CARDS_URL = `${environment.apiBaseUrl}/api/creditcard`;

@Injectable({ providedIn: 'root' })
export class CreditCardService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<CreditCardResponseList> {
    return this.http.get<CreditCardResponseList>(CREDIT_CARDS_URL);
  }

  create(request: CreditCardRequest): Observable<CreditCardResponse> {
    return this.http.post<CreditCardResponse>(CREDIT_CARDS_URL, request);
  }
}
