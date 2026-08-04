// Tela de categorias: listagem (GET /api/category) e criacao (POST /api/category),
// conforme docs/specs/mvp-3-categorias.md. Autenticacao ja e tratada pelo
// auth.interceptor.ts entregue no MVP-1.

import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { CategoryService } from '../../core/services/category.service';
import { CategoryRequest, CategoryResponse } from '../../core/models/category.model';
import { TransactionType } from '../../core/models/enums.model';

const LOAD_ERROR_MESSAGE = 'Não foi possível carregar as categorias. Tente novamente.';
const CREATE_BAD_REQUEST_MESSAGE = 'Não foi possível salvar a categoria. Verifique os dados informados.';
const CREATE_CONNECTION_ERROR_MESSAGE = 'Erro de conexão. Tente novamente.';

const TRANSACTION_TYPES: TransactionType[] = [TransactionType.Entrada, TransactionType.Saida];

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  [TransactionType.Entrada]: 'Entrada',
  [TransactionType.Saida]: 'Saída'
};

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss'
})
export class CategoriesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);

  readonly TransactionType = TransactionType;
  readonly transactionTypes = TRANSACTION_TYPES;
  readonly transactionTypeLabels = TRANSACTION_TYPE_LABELS;

  categories: CategoryResponse[] = [];
  isLoadingList = true;
  listError: string | null = null;

  createError: string | null = null;

  readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(50)]),
    type: this.fb.control<TransactionType | null>(null, Validators.required)
  });

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.isLoadingList = true;
    this.listError = null;

    this.categoryService.getAll().subscribe({
      next: (response) => {
        this.categories = response.categoryResponses;
        this.isLoadingList = false;
      },
      error: () => {
        this.listError = LOAD_ERROR_MESSAGE;
        this.isLoadingList = false;
      }
    });
  }

  categoryTypeLabel(category: CategoryResponse): string {
    return this.transactionTypeLabels[category.type];
  }

  onSubmit(): void {
    this.createError = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildRequest();

    this.categoryService.create(payload).subscribe({
      next: (response) => {
        this.categories = [response, ...this.categories];
        this.form.reset({ name: '', type: null });
      },
      error: (err: HttpErrorResponse) => {
        this.createError = err.status === 400 ? CREATE_BAD_REQUEST_MESSAGE : CREATE_CONNECTION_ERROR_MESSAGE;
      }
    });
  }

  private buildRequest(): CategoryRequest {
    const raw = this.form.getRawValue();

    return {
      name: raw.name,
      type: raw.type as TransactionType
    };
  }
}
