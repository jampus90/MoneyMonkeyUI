// DTOs de autenticacao espelhando docs/api-contract.md (secao "Auth").

import { UserType } from './enums.model';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string; // date-time
  userId: number; // int64
  firstName: string;
  lastName: string;
  userType: UserType;
}
