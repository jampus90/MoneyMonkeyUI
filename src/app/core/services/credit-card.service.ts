// Service de cartoes de credito, consumindo GET/POST /api/creditcard (docs/api-contract.md,
// secao "Credit Cards"). Autenticacao (Authorization: Bearer <token>) e anexada
// automaticamente pelo auth.interceptor.ts entregue no MVP-1.

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreditCardInstallmentResponse,
  CreditCardInvoiceResponse,
  CreditCardPurchaseRequest,
  CreditCardRequest,
  CreditCardResponse,
  CreditCardResponseList
} from '../models/credit-card.model';

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

  // POST /api/creditcard/{creditCardId}/purchases (docs/api-contract.md, secao "Credit
  // Cards"). Resposta e um unico CreditCardInstallmentResponse, mesmo com
  // installmentsCount > 1 (ver spec MVP-5, criterio 10) - nao deve ser tratado como lista.
  createPurchase(creditCardId: number, request: CreditCardPurchaseRequest): Observable<CreditCardInstallmentResponse> {
    return this.http.post<CreditCardInstallmentResponse>(`${CREDIT_CARDS_URL}/${creditCardId}/purchases`, request);
  }

  // GET /api/creditcard/{creditCardId}/fatura?month=&year= - month/year sao opcionais
  // (default mes/ano atual no backend quando omitidos, criterio 11 da spec MVP-5).
  getInvoice(creditCardId: number, month?: number, year?: number): Observable<CreditCardInvoiceResponse> {
    let params = new HttpParams();
    if (month != null) {
      params = params.set('month', month);
    }
    if (year != null) {
      params = params.set('year', year);
    }
    return this.http.get<CreditCardInvoiceResponse>(`${CREDIT_CARDS_URL}/${creditCardId}/fatura`, { params });
  }
}
