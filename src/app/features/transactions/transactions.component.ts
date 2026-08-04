// Dashboard de transacoes: listagem (GET /api/transaction) e criacao (POST /api/transaction),
// conforme docs/specs/mvp-2-dashboard-transacoes.md. Autenticacao ja e tratada pelo
// auth.interceptor.ts entregue no MVP-1.

import { Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';

import { TransactionService } from '../../core/services/transaction.service';
import { CategoryService } from '../../core/services/category.service';
import { TransactionRequest, TransactionResponse } from '../../core/models/transaction.model';
import { PaymentMethod, TransactionType } from '../../core/models/enums.model';

const LOAD_ERROR_MESSAGE = 'Não foi possível carregar as transações. Tente novamente.';
const CREATE_BAD_REQUEST_MESSAGE = 'Não foi possível salvar a transação. Verifique os dados informados.';
const CREATE_CONNECTION_ERROR_MESSAGE = 'Erro de conexão. Tente novamente.';
// Fallback estavel para categoryId presente mas nao encontrado no mapa (categoria excluida/
// inconsistencia, criterio 9) e tambem para o caso de falha ao carregar GET /api/category
// (criterio 10) - mesmo texto em ambos os casos, conforme permitido pela spec (UX-2).
const CATEGORY_NOT_FOUND_LABEL = 'Categoria não encontrada';

const TRANSACTION_TYPES: TransactionType[] = [TransactionType.Entrada, TransactionType.Saida];
const PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.Pix,
  PaymentMethod.Dinheiro,
  PaymentMethod.CartaoCredito,
  PaymentMethod.CartaoDebito,
  PaymentMethod.Boleto,
  PaymentMethod.Transferencia,
  PaymentMethod.Outro
];

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  [TransactionType.Entrada]: 'Entrada',
  [TransactionType.Saida]: 'Saída'
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.Pix]: 'Pix',
  [PaymentMethod.Dinheiro]: 'Dinheiro',
  [PaymentMethod.CartaoCredito]: 'Cartão de crédito',
  [PaymentMethod.CartaoDebito]: 'Cartão de débito',
  [PaymentMethod.Boleto]: 'Boleto',
  [PaymentMethod.Transferencia]: 'Transferência',
  [PaymentMethod.Outro]: 'Outro'
};

function positiveNumberValidator(control: AbstractControl): ValidationErrors | null {
  const raw = control.value;
  if (raw === null || raw === '') {
    return null; // campo vazio: tratado pelo Validators.required
  }
  const num = Number(raw);
  if (isNaN(num)) {
    return { notANumber: true };
  }
  if (num <= 0) {
    return { notPositive: true };
  }
  return null;
}

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe],
  templateUrl: './transactions.component.html',
  styleUrl: './transactions.component.scss'
})
export class TransactionsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly transactionService = inject(TransactionService);
  private readonly categoryService = inject(CategoryService);

  readonly TransactionType = TransactionType;
  readonly transactionTypes = TRANSACTION_TYPES;
  readonly paymentMethods = PAYMENT_METHODS;
  readonly transactionTypeLabels = TRANSACTION_TYPE_LABELS;
  readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;

  transactions: TransactionResponse[] = [];
  isLoadingList = true;
  listError: string | null = null;

  createError: string | null = null;

  // Mapeamento categoryId -> name (criterio 7), montado uma unica vez a partir de
  // GET /api/category. Permanece vazio se a chamada falhar (criterio 10), o que faz
  // toda transacao com categoryId presente cair no fallback de "nao encontrada".
  private categoryNamesById = new Map<number, string>();

  readonly form = this.fb.group({
    transactionName: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(100)]),
    value: this.fb.nonNullable.control('', [Validators.required, positiveNumberValidator]),
    type: this.fb.control<TransactionType | null>(null, Validators.required),
    paymentMethod: this.fb.control<PaymentMethod | null>(null),
    transactionDate: this.fb.nonNullable.control('')
  });

  ngOnInit(): void {
    this.loadTransactions();
    this.loadCategories();
  }

  loadTransactions(): void {
    this.isLoadingList = true;
    this.listError = null;

    this.transactionService.getAll().subscribe({
      next: (response) => {
        this.transactions = response.transactionResponses;
        this.isLoadingList = false;
      },
      error: () => {
        this.listError = LOAD_ERROR_MESSAGE;
        this.isLoadingList = false;
      }
    });
  }

  // Chamada auxiliar e silenciosa (sem estado de loading/erro dedicado, ver spec UX-2):
  // se falhar, categoryNamesById permanece vazio e a listagem de transacoes segue
  // renderizando normalmente, com fallback textual para categorias (criterio 10).
  loadCategories(): void {
    this.categoryService.getAll().subscribe({
      next: (response) => {
        this.categoryNamesById = new Map(
          response.categoryResponses.map((category) => [category.categoryId, category.name])
        );
      },
      error: () => {
        // Falha silenciosa: nao ha estado de erro dedicado a categorias nesta tela (ver spec).
      }
    });
  }

  transactionSign(transaction: TransactionResponse): string {
    return transaction.type === TransactionType.Entrada ? '+' : '−';
  }

  // Retorna o nome da categoria resolvido, um fallback estavel (categoria nao encontrada
  // ou mapa nao carregado) ou null quando a transacao nao tem categoryId (criterios 6, 8, 9, 10).
  categoryName(transaction: TransactionResponse): string | null {
    if (transaction.categoryId == null) {
      return null;
    }
    return this.categoryNamesById.get(transaction.categoryId) ?? CATEGORY_NOT_FOUND_LABEL;
  }

  onSubmit(): void {
    this.createError = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildRequest();

    this.transactionService.create(payload).subscribe({
      next: (response) => {
        this.transactions = [response, ...this.transactions];
        this.form.reset({ transactionName: '', value: '', type: null, paymentMethod: null, transactionDate: '' });
      },
      error: (err: HttpErrorResponse) => {
        this.createError = err.status === 400 ? CREATE_BAD_REQUEST_MESSAGE : CREATE_CONNECTION_ERROR_MESSAGE;
      }
    });
  }

  private buildRequest(): TransactionRequest {
    const raw = this.form.getRawValue();

    const request: TransactionRequest = {
      transactionName: raw.transactionName,
      value: Number(raw.value),
      type: raw.type as TransactionType
    };

    if (raw.paymentMethod !== null) {
      request.paymentMethod = raw.paymentMethod;
    }
    if (raw.transactionDate) {
      request.transactionDate = raw.transactionDate;
    }

    return request;
  }
}
