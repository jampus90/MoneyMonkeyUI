import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../core/services/auth.service';
import { TransactionService } from '../../core/services/transaction.service';
import { CreditCardService } from '../../core/services/credit-card.service';
import { CategoryService } from '../../core/services/category.service';
import { TransactionResponse } from '../../core/models/transaction.model';
import { CreditCardResponse } from '../../core/models/credit-card.model';
import { CategoryResponse } from '../../core/models/category.model';
import { TransactionType } from '../../core/models/enums.model';

registerLocaleData(localePt);

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let transactionServiceSpy: jasmine.SpyObj<TransactionService>;
  let creditCardServiceSpy: jasmine.SpyObj<CreditCardService>;
  let categoryServiceSpy: jasmine.SpyObj<CategoryService>;

  const entradaTx = (overrides: Partial<TransactionResponse> = {}): TransactionResponse => ({
    transactionId: 1,
    transactionName: 'Salário',
    value: 500,
    type: TransactionType.Entrada,
    ...overrides
  });

  const saidaTx = (overrides: Partial<TransactionResponse> = {}): TransactionResponse => ({
    transactionId: 2,
    transactionName: 'Mercado',
    value: 120,
    type: TransactionType.Saida,
    ...overrides
  });

  function setupTransactions(list: TransactionResponse[]) {
    transactionServiceSpy.getAll.and.returnValue(of({ transactionResponses: list }));
  }

  function setupCreditCards(list: CreditCardResponse[]) {
    creditCardServiceSpy.getAll.and.returnValue(of({ creditCardResponses: list }));
  }

  function setupCategories(list: CategoryResponse[]) {
    categoryServiceSpy.getAll.and.returnValue(of({ categoryResponses: list }));
  }

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getFirstName']);
    authServiceSpy.getFirstName.and.returnValue(null);

    transactionServiceSpy = jasmine.createSpyObj('TransactionService', ['getAll']);
    transactionServiceSpy.getAll.and.returnValue(of({ transactionResponses: [] }));

    creditCardServiceSpy = jasmine.createSpyObj('CreditCardService', ['getAll']);
    creditCardServiceSpy.getAll.and.returnValue(of({ creditCardResponses: [] }));

    categoryServiceSpy = jasmine.createSpyObj('CategoryService', ['getAll']);
    categoryServiceSpy.getAll.and.returnValue(of({ categoryResponses: [] }));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: TransactionService, useValue: transactionServiceSpy },
        { provide: CreditCardService, useValue: creditCardServiceSpy },
        { provide: CategoryService, useValue: categoryServiceSpy },
        { provide: LOCALE_ID, useValue: 'pt-BR' }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  // --- Saudação (criterios 5, 6, 7) ---

  it('criterio 5: saudacao com nome quando AuthService.getFirstName() esta disponivel', () => {
    authServiceSpy.getFirstName.and.returnValue('Ana');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.dashboard-greeting__hello')?.textContent).toContain('Olá, Ana');
  });

  it('criterio 6: fallback de saudacao sem nome quando AuthService.getFirstName() retorna null', () => {
    authServiceSpy.getFirstName.and.returnValue(null);

    expect(() => fixture.detectChanges()).not.toThrow();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.dashboard-greeting__hello')?.textContent?.trim()).toBe('Olá!');
  });

  it('criterio 7: dia da semana e data completa exibidos em pt-BR, sem chamada de API', () => {
    fixture.detectChanges();

    const expected = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date());

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.dashboard-greeting__date')?.textContent).toContain(expected);
  });

  // --- Saldo total (criterios 9-12) ---

  it('criterio 9: saldo total e a soma de Entrada menos Saida de todas as transacoes retornadas', () => {
    setupTransactions([entradaTx({ value: 500 }), saidaTx({ value: 120 })]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.dashboard-balance__value')?.textContent).toContain('380,00');
  });

  it('criterio 10: loading do saldo exibe indicador de carregamento sem exibir valor prematuro', () => {
    const subject = new Subject<{ transactionResponses: TransactionResponse[] }>();
    transactionServiceSpy.getAll.and.returnValue(subject);

    fixture.detectChanges();

    expect(component.isLoadingTransactions).toBeTrue();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.dashboard-balance .loading-state')).toBeTruthy();
    expect(compiled.querySelector('.dashboard-balance__value')).toBeFalsy();
  });

  it('criterio 11: erro ao carregar GET /api/transaction exibe mensagem de erro no saldo sem bloquear outras secoes', () => {
    transactionServiceSpy.getAll.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );
    setupCreditCards([{ creditCardId: 1, name: 'Nubank', brand: 0, lastFourDigits: '1234', closingDay: 1, dueDay: 10, creditLimit: 1000 } as CreditCardResponse]);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(component.transactionsError).toBeTruthy();
    expect(compiled.querySelector('.dashboard-balance .loading-state')).toBeFalsy();
    expect(compiled.querySelector('.dashboard-balance__value')).toBeFalsy();

    // Cartões continua funcionando de forma independente
    expect(component.cardsError).toBeNull();
    expect(compiled.querySelector('.dashboard-cards__count')?.textContent).toContain('1');
  });

  it('criterio 12: lista de transacoes vazia exibe saldo R$ 0,00 sem erro', () => {
    setupTransactions([]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(component.transactionsError).toBeNull();
    expect(compiled.querySelector('.dashboard-balance__value')?.textContent).toContain('0,00');
  });

  // --- Card "Cartões" (criterios 13-17) ---

  it('criterio 13: card de cartoes exibe quantidade e soma de creditLimit', () => {
    setupCreditCards([
      { creditCardId: 1, name: 'A', brand: 0, lastFourDigits: '1111', closingDay: 1, dueDay: 10, creditLimit: 1000 } as CreditCardResponse,
      { creditCardId: 2, name: 'B', brand: 0, lastFourDigits: '2222', closingDay: 1, dueDay: 10, creditLimit: 2500 } as CreditCardResponse
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.dashboard-cards__count')?.textContent).toContain('2');
    expect(compiled.querySelector('.dashboard-cards__limit')?.textContent).toContain('3.500,00');
  });

  it('criterio 14: cartao sem creditLimit conta na quantidade mas nao na soma', () => {
    setupCreditCards([
      { creditCardId: 1, name: 'A', brand: 0, lastFourDigits: '1111', closingDay: 1, dueDay: 10, creditLimit: 1000 } as CreditCardResponse,
      { creditCardId: 2, name: 'B', brand: 0, lastFourDigits: '2222', closingDay: 1, dueDay: 10 } as CreditCardResponse
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.dashboard-cards__count')?.textContent).toContain('2');
    expect(compiled.querySelector('.dashboard-cards__limit')?.textContent).toContain('1.000,00');
  });

  it('criterio 15: loading do card de cartoes independente das outras secoes', () => {
    const subject = new Subject<{ creditCardResponses: CreditCardResponse[] }>();
    creditCardServiceSpy.getAll.and.returnValue(subject);
    setupTransactions([entradaTx()]);

    fixture.detectChanges();

    expect(component.isLoadingCards).toBeTrue();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.dashboard-cards .loading-state')).toBeTruthy();
    // saldo ja carregou, nao fica preso no loading do card de cartoes
    expect(compiled.querySelector('.dashboard-balance__value')).toBeTruthy();
  });

  it('criterio 16: erro ao carregar GET /api/creditcard exibe mensagem de erro no card sem bloquear saldo/recentes', () => {
    creditCardServiceSpy.getAll.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );
    setupTransactions([entradaTx()]);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(component.cardsError).toBeTruthy();
    expect(compiled.querySelector('.dashboard-cards .loading-state')).toBeFalsy();
    expect(compiled.querySelector('.dashboard-cards__count')).toBeFalsy();
    expect(component.transactionsError).toBeNull();
    expect(compiled.querySelector('.dashboard-balance__value')).toBeTruthy();
  });

  it('criterio 17: nenhum cartao cadastrado exibe quantidade 0 e soma R$ 0,00 sem erro', () => {
    setupCreditCards([]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(component.cardsError).toBeNull();
    expect(compiled.querySelector('.dashboard-cards__count')?.textContent).toContain('0');
    expect(compiled.querySelector('.dashboard-cards__limit')?.textContent).toContain('0,00');
  });

  // --- Transações recentes (criterios 18-26) ---

  function recentRowsText(): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.dashboard-recent__item')).map(
      (el) => (el as HTMLElement).textContent ?? ''
    );
  }

  it('criterio 18: exibe exatamente as 5 transacoes mais recentes por transactionDate, ordem decrescente', () => {
    const list: TransactionResponse[] = [
      entradaTx({ transactionId: 1, transactionName: 'T1', transactionDate: '2026-08-01' }),
      entradaTx({ transactionId: 2, transactionName: 'T2', transactionDate: '2026-08-02' }),
      entradaTx({ transactionId: 3, transactionName: 'T3', transactionDate: '2026-08-03' }),
      entradaTx({ transactionId: 4, transactionName: 'T4', transactionDate: '2026-08-04' }),
      entradaTx({ transactionId: 5, transactionName: 'T5', transactionDate: '2026-08-05' }),
      entradaTx({ transactionId: 6, transactionName: 'T6', transactionDate: '2026-08-06' }),
      entradaTx({ transactionId: 7, transactionName: 'T7', transactionDate: '2026-08-07' })
    ];
    setupTransactions(list);
    fixture.detectChanges();

    expect(component.recentTransactions.map((t: TransactionResponse) => t.transactionName)).toEqual([
      'T7',
      'T6',
      'T5',
      'T4',
      'T3'
    ]);

    const rows = recentRowsText();
    expect(rows.length).toBe(5);
  });

  it('criterio 19: transacoes sem transactionDate sao excluidas dos recentes mas somadas no saldo', () => {
    setupTransactions([
      entradaTx({ transactionId: 1, transactionName: 'Com data', value: 100, transactionDate: '2026-08-01' }),
      entradaTx({ transactionId: 2, transactionName: 'Sem data', value: 50 })
    ]);
    fixture.detectChanges();

    expect(component.recentTransactions.map((t: TransactionResponse) => t.transactionName)).toEqual(['Com data']);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.dashboard-balance__value')?.textContent).toContain('150,00');
  });

  it('criterio 20: menos de 5 transacoes elegiveis exibe todas sem preenchimento artificial', () => {
    setupTransactions([
      entradaTx({ transactionId: 1, transactionName: 'T1', transactionDate: '2026-08-01' }),
      entradaTx({ transactionId: 2, transactionName: 'T2', transactionDate: '2026-08-02' }),
      entradaTx({ transactionId: 3, transactionName: 'T3', transactionDate: '2026-08-03' })
    ]);
    fixture.detectChanges();

    expect(component.recentTransactions.length).toBe(3);
    expect(recentRowsText().length).toBe(3);
  });

  it('criterio 21: categoryId presente mas nao encontrado usa fallback "Categoria não encontrada"; sem categoryId nao exibe texto de categoria', () => {
    setupCategories([{ categoryId: 3, name: 'Alimentação', type: TransactionType.Saida }]);
    setupTransactions([
      saidaTx({ transactionId: 1, transactionName: 'Sem match', categoryId: 99, transactionDate: '2026-08-01' }),
      entradaTx({ transactionId: 2, transactionName: 'Sem categoria', transactionDate: '2026-08-02' })
    ]);
    fixture.detectChanges();

    const rows = recentRowsText();
    const semMatchRow = rows.find((r) => r.includes('Sem match'));
    const semCategoriaRow = rows.find((r) => r.includes('Sem categoria'));

    expect(semMatchRow).toContain('Categoria não encontrada');
    expect(semCategoriaRow).not.toContain('Categoria não encontrada');
  });

  it('criterio 22: falha ao carregar GET /api/category nao bloqueia recentes, usa fallback estavel', () => {
    categoryServiceSpy.getAll.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );
    setupTransactions([saidaTx({ transactionId: 1, categoryId: 3, transactionDate: '2026-08-01' })]);

    fixture.detectChanges();

    const rows = recentRowsText();
    expect(rows.length).toBe(1);
    expect(rows[0]).toContain('Categoria não encontrada');
  });

  it('criterio 23: link "ver todas" aponta para /transactions e esta sempre presente', () => {
    setupTransactions([]);
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a.dashboard-recent__link');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/transactions');
  });

  it('criterio 24: loading da secao Transações recentes independente das outras', () => {
    const subject = new Subject<{ transactionResponses: TransactionResponse[] }>();
    transactionServiceSpy.getAll.and.returnValue(subject);
    setupCreditCards([]);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.dashboard-recent .loading-state')).toBeTruthy();
    expect(compiled.querySelector('.dashboard-cards__count')).toBeTruthy();
  });

  it('criterio 25: erro ao carregar transacoes recentes exibe mensagem de erro sem bloquear card de cartoes', () => {
    transactionServiceSpy.getAll.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );
    setupCreditCards([]);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.dashboard-recent__error')).toBeTruthy();
    expect(compiled.querySelector('.dashboard-cards__count')).toBeTruthy();
  });

  it('criterio 26: nenhuma transacao cadastrada exibe estado vazio sem quebrar o link "ver todas"', () => {
    setupTransactions([]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const emptyState = compiled.querySelector('.dashboard-recent .empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState?.textContent).toContain('Nenhuma transação recente');

    const link = compiled.querySelector('a.dashboard-recent__link');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/transactions');
  });

  // --- Casos de borda: chamadas proprias, tipos numericos ---

  it('caso de borda: as tres chamadas sao proprias do componente, cada uma feita uma unica vez', () => {
    fixture.detectChanges();

    expect(transactionServiceSpy.getAll).toHaveBeenCalledTimes(1);
    expect(creditCardServiceSpy.getAll).toHaveBeenCalledTimes(1);
    expect(categoryServiceSpy.getAll).toHaveBeenCalledTimes(1);
  });

  it('caso de borda: type e categoryId sao tratados como number, nunca string', () => {
    setupCategories([{ categoryId: 3, name: 'Alimentação', type: TransactionType.Saida }]);
    setupTransactions([saidaTx({ transactionId: 1, categoryId: 3, transactionDate: '2026-08-01', value: 50 })]);
    fixture.detectChanges();

    expect(typeof component.transactions[0].categoryId).toBe('number');
    expect(typeof component.transactions[0].type).toBe('number');
    expect(component.saldoTotal).toBe(-50);
  });
});
