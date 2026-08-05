// DTOs de cartao de credito espelhando docs/api-contract.md (secao "Credit Cards").

import { CardBrand } from './enums.model';

export interface CreditCardResponse {
  creditCardId: number; // int32
  name: string;
  brand: CardBrand;
  lastFourDigits: string;
  closingDay: number;
  dueDay: number;
  creditLimit?: number;
}

export interface CreditCardResponseList {
  creditCardResponses: CreditCardResponse[];
}

export interface CreditCardRequest {
  name: string; // max 50
  brand: CardBrand;
  lastFourDigits: string; // exatamente 4 caracteres
  closingDay: number; // 1-28
  dueDay: number; // 1-28
  creditLimit?: number;
}

// DTOs de compra/fatura de cartao de credito (MVP-5), espelhando docs/api-contract.md
// (secao "Credit Cards"). Nao possuem nenhum campo enum.

export interface CreditCardPurchaseRequest {
  description: string; // max 100
  totalValue: number; // > 0.01
  purchaseDate?: string; // date, opcional
  installmentsCount?: number; // 1-48, opcional
  categoryId?: number; // int32, opcional
  isSubscription: boolean; // obrigatorio, sempre enviado explicitamente
}

export interface CreditCardInstallmentResponse {
  creditCardInstallmentId: number; // int32
  description: string;
  categoryId?: number; // int32
  isSubscription: boolean;
  installmentNumber: number;
  installmentsCount: number;
  value: number;
  purchaseDate: string; // date
}

export interface CreditCardInvoiceResponse {
  creditCardId: number; // int32
  invoiceMonth: number;
  invoiceYear: number;
  dueDate: string; // date
  totalValue: number;
  installments: CreditCardInstallmentResponse[];
}
