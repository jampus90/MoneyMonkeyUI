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
