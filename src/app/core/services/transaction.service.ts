// Service de transacoes, consumindo GET/POST /api/transaction (docs/api-contract.md,
// secao "Transactions"). Autenticacao (Authorization: Bearer <token>) e anexada
// automaticamente pelo auth.interceptor.ts entregue no MVP-1.

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TransactionRequest, TransactionResponse, TransactionResponseList } from '../models/transaction.model';

const TRANSACTIONS_URL = `${environment.apiBaseUrl}/api/transaction`;

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<TransactionResponseList> {
    return this.http.get<TransactionResponseList>(TRANSACTIONS_URL);
  }

  create(request: TransactionRequest): Observable<TransactionResponse> {
    return this.http.post<TransactionResponse>(TRANSACTIONS_URL, request);
  }
}
