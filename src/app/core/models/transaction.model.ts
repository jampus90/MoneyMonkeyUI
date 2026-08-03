// DTOs de transacao espelhando docs/api-contract.md (secao "Transactions").

import { PaymentMethod, TransactionType } from './enums.model';

export interface TransactionResponse {
  transactionId: number; // int32
  transactionName: string;
  value: number;
  type: TransactionType;
  paymentMethod?: PaymentMethod;
  categoryId?: number; // int32
  transactionDate?: string; // date
}

export interface TransactionResponseList {
  transactionResponses: TransactionResponse[];
}

export interface TransactionRequest {
  transactionName: string; // max 100
  value: number; // > 0.01
  type: TransactionType;
  paymentMethod?: PaymentMethod;
  categoryId?: number; // int32
  transactionDate?: string; // date, opcional
}
