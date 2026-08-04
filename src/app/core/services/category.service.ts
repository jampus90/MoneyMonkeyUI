// Service de categorias, consumindo GET/POST /api/category (docs/api-contract.md,
// secao "Categories"). Autenticacao (Authorization: Bearer <token>) e anexada
// automaticamente pelo auth.interceptor.ts entregue no MVP-1.

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CategoryRequest, CategoryResponse, CategoryResponseList } from '../models/category.model';

const CATEGORIES_URL = `${environment.apiBaseUrl}/api/category`;

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<CategoryResponseList> {
    return this.http.get<CategoryResponseList>(CATEGORIES_URL);
  }

  create(request: CategoryRequest): Observable<CategoryResponse> {
    return this.http.post<CategoryResponse>(CATEGORIES_URL, request);
  }
}
