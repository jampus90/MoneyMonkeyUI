// DTOs de categoria espelhando docs/api-contract.md (secao "Categories").

import { TransactionType } from './enums.model';

export interface CategoryResponse {
  categoryId: number; // int32
  name: string;
  type: TransactionType;
}

export interface CategoryResponseList {
  categoryResponses: CategoryResponse[];
}

export interface CategoryRequest {
  name: string; // max 50
  type: TransactionType;
}
