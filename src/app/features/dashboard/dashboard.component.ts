// Painel (Dashboard): tela pos-login com saudacao, saldo total, resumo de cartoes e
// transacoes recentes, conforme docs/specs/mvp-7-painel-dashboard.md. Faz suas proprias
// chamadas a TransactionService/CreditCardService/CategoryService.getAll() (ja existentes),
// sem estado compartilhado com TransactionsComponent/CreditCardsComponent/CategoriesComponent
// (mesmo padrao ja aceito em UX-6/MVP-6).

import { Component, OnInit, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { TransactionService } from '../../core/services/transaction.service';
import { CreditCardService } from '../../core/services/credit-card.service';
import { CategoryService } from '../../core/services/category.service';
import { TransactionResponse } from '../../core/models/transaction.model';
import { CreditCardResponse } from '../../core/models/credit-card.model';
import { TransactionType } from '../../core/models/enums.model';

const TRANSACTIONS_LOAD_ERROR_MESSAGE = 'Não foi possível carregar suas transações. Tente novamente.';
const CREDIT_CARDS_LOAD_ERROR_MESSAGE = 'Não foi possível carregar seus cartões. Tente novamente.';
// Mesmo fallback estavel de UX-2/MVP-6 para categoryId presente mas nao encontrado no mapa
// (categoria excluida/inconsistente) e para falha ao carregar GET /api/category (criterio 22).
const CATEGORY_NOT_FOUND_LABEL = 'Categoria não encontrada';
// Tamanho fixo do widget de recentes (criterio 9 da spec, "Abordagem tecnica") - constante
// de produto, sem regra no contrato que a defina.
const RECENT_TRANSACTIONS_LIMIT = 5;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly transactionService = inject(TransactionService);
  private readonly creditCardService = inject(CreditCardService);
  private readonly categoryService = inject(CategoryService);

  readonly TransactionType = TransactionType;

  // Estado da chamada GET /api/transaction, compartilhado entre o card de saldo e a secao
  // de Transações recentes (criterio 25: ambos dependem da mesma chamada).
  transactions: TransactionResponse[] = [];
  isLoadingTransactions = true;
  transactionsError: string | null = null;

  // Estado da chamada GET /api/creditcard, independente das demais.
  creditCards: CreditCardResponse[] = [];
  isLoadingCards = true;
  cardsError: string | null = null;

  // Mapa categoryId -> name (criterio 9, mesmo padrao de categoryName() em
  // TransactionsComponent/UX-2). Falha ao carregar GET /api/category e silenciosa
  // (sem estado de loading/erro dedicado, criterio 22) - o mapa permanece vazio e
  // toda transacao recente com categoryId cai no fallback estavel.
  private categoryNamesById = new Map<number, string>();

  ngOnInit(): void {
    this.loadTransactions();
    this.loadCreditCards();
    this.loadCategories();
  }

  // Saudacao (criterios 5-7): nome via AuthService.getFirstName() com fallback "Olá!"
  // quando null, e dia da semana + data completa via Date do navegador, sem chamada de API.
  get greetingText(): string {
    const firstName = this.authService.getFirstName();
    return firstName ? `Olá, ${firstName}` : 'Olá!';
  }

  get formattedDate(): string {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
  }

  // Saldo total (criterio 9): soma de value para Entrada, subtraida da soma de value para
  // Saida, sobre todas as transactionResponses retornadas, sem filtro de data (criterio 6
  // da "Abordagem tecnica" - "período" = todo o conjunto retornado pela unica chamada).
  get saldoTotal(): number {
    return this.transactions.reduce(
      (sum, transaction) =>
        sum + (transaction.type === TransactionType.Entrada ? transaction.value : -transaction.value),
      0
    );
  }

  // Card "Cartões" (criterios 13-14): contagem de cartoes + soma de creditLimit dos que o
  // tem definido (campo opcional - cartoes sem creditLimit contam na quantidade, nao na soma).
  get cardsCount(): number {
    return this.creditCards.length;
  }

  get cardsLimitTotal(): number {
    return this.creditCards.reduce((sum, card) => sum + (card.creditLimit ?? 0), 0);
  }

  // Transações recentes (criterios 18-20): as 5 mais recentes por transactionDate
  // decrescente, excluindo transacoes sem transactionDate (criterio 19) - ordenacao
  // sempre client-side, sem assumir ordem de retorno da API.
  get recentTransactions(): TransactionResponse[] {
    return this.transactions
      .filter((transaction) => transaction.transactionDate != null)
      .slice()
      .sort((a, b) => new Date(b.transactionDate!).getTime() - new Date(a.transactionDate!).getTime())
      .slice(0, RECENT_TRANSACTIONS_LIMIT);
  }

  // Nome da categoria resolvido, fallback estavel, ou null quando a transacao nao tem
  // categoryId (criterio 21, mesmo padrao de categoryName() em TransactionsComponent).
  categoryName(transaction: TransactionResponse): string | null {
    if (transaction.categoryId == null) {
      return null;
    }
    return this.categoryNamesById.get(transaction.categoryId) ?? CATEGORY_NOT_FOUND_LABEL;
  }

  private loadTransactions(): void {
    this.isLoadingTransactions = true;
    this.transactionsError = null;

    this.transactionService.getAll().subscribe({
      next: (response) => {
        this.transactions = response.transactionResponses;
        this.isLoadingTransactions = false;
      },
      error: () => {
        this.transactionsError = TRANSACTIONS_LOAD_ERROR_MESSAGE;
        this.isLoadingTransactions = false;
      }
    });
  }

  private loadCreditCards(): void {
    this.isLoadingCards = true;
    this.cardsError = null;

    this.creditCardService.getAll().subscribe({
      next: (response) => {
        this.creditCards = response.creditCardResponses;
        this.isLoadingCards = false;
      },
      error: () => {
        this.cardsError = CREDIT_CARDS_LOAD_ERROR_MESSAGE;
        this.isLoadingCards = false;
      }
    });
  }

  private loadCategories(): void {
    this.categoryService.getAll().subscribe({
      next: (response) => {
        this.categoryNamesById = new Map(
          response.categoryResponses.map((category) => [category.categoryId, category.name])
        );
      },
      error: () => {
        // Falha silenciosa (mesmo padrao de UX-2/MVP-6): sem estado de erro dedicado,
        // o mapa permanece vazio e o fallback de categoria cobre o caso (criterio 22).
      }
    });
  }
}
