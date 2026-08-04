import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { of, throwError, Subject } from 'rxjs';

import { TransactionsComponent } from './transactions.component';
import { TransactionService } from '../../core/services/transaction.service';
import { CategoryService } from '../../core/services/category.service';
import { TransactionResponse } from '../../core/models/transaction.model';
import { CategoryResponse, CategoryResponseList } from '../../core/models/category.model';
import { PaymentMethod, TransactionType } from '../../core/models/enums.model';

registerLocaleData(localePt);

describe('TransactionsComponent', () => {
  let fixture: ComponentFixture<TransactionsComponent>;
  let component: TransactionsComponent;
  let transactionServiceSpy: jasmine.SpyObj<TransactionService>;
  let categoryServiceSpy: jasmine.SpyObj<CategoryService>;

  const salaryTx: TransactionResponse = {
    transactionId: 1,
    transactionName: 'Salário',
    value: 5000,
    type: TransactionType.Entrada
  };

  const marketTx: TransactionResponse = {
    transactionId: 2,
    transactionName: 'Mercado',
    value: 150,
    type: TransactionType.Saida,
    paymentMethod: PaymentMethod.Pix,
    categoryId: 10,
    transactionDate: '2026-08-03'
  };

  const alimentacaoCategory: CategoryResponse = {
    categoryId: 3,
    name: 'Alimentação',
    type: TransactionType.Saida
  };

  function setupWithList(response: TransactionResponse[]) {
    transactionServiceSpy.getAll.and.returnValue(of({ transactionResponses: response }));
    fixture.detectChanges();
  }

  function setupWithCategories(response: CategoryResponse[]) {
    categoryServiceSpy.getAll.and.returnValue(of({ categoryResponses: response }));
  }

  beforeEach(async () => {
    transactionServiceSpy = jasmine.createSpyObj('TransactionService', ['getAll', 'create']);
    transactionServiceSpy.getAll.and.returnValue(of({ transactionResponses: [] }));

    categoryServiceSpy = jasmine.createSpyObj('CategoryService', ['getAll']);
    categoryServiceSpy.getAll.and.returnValue(of({ categoryResponses: [] } as CategoryResponseList));

    await TestBed.configureTestingModule({
      imports: [TransactionsComponent],
      providers: [
        { provide: TransactionService, useValue: transactionServiceSpy },
        { provide: CategoryService, useValue: categoryServiceSpy },
        { provide: LOCALE_ID, useValue: 'pt-BR' }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionsComponent);
    component = fixture.componentInstance;
  });

  function rowsText(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.transaction-item')).map(
      (el) => ((el as HTMLElement).textContent ?? '').replace(/ /g, ' ')
    );
  }

  function fillRequiredFields(name: string, value: string, type: TransactionType | null): void {
    component.form.controls.transactionName.setValue(name);
    component.form.controls.value.setValue(value);
    component.form.controls.type.setValue(type);
  }

  function submitCreateForm(): void {
    component.onSubmit();
    fixture.detectChanges();
  }

  it('deve criar o componente', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  // --- Listagem ---

  it('criterio 1: listagem com sucesso renderiza uma linha por TransactionResponse com nome e valor/sinal', () => {
    setupWithList([salaryTx, marketTx]);

    expect(transactionServiceSpy.getAll).toHaveBeenCalled();
    expect(component.transactions).toEqual([salaryTx, marketTx]);

    const rows = rowsText();
    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('Salário');
    expect(rows[0]).toContain('5.000,00');
    expect(rows[0]).toContain('+');
    expect(rows[1]).toContain('Mercado');
    expect(rows[1]).toContain('150,00');
    expect(rows[1]).toContain('−');
  });

  it('criterio 2: estado vazio exibe mensagem dedicada, sem linhas e sem erro', () => {
    setupWithList([]);

    expect(component.transactions).toEqual([]);
    expect(rowsText().length).toBe(0);
    expect(component.listError).toBeNull();

    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('Nenhuma transação cadastrada');
  });

  it('criterio 3: erro de rede ao carregar exibe mensagem de erro distinta do estado vazio', () => {
    transactionServiceSpy.getAll.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );

    fixture.detectChanges();

    expect(component.listError).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeFalsy();
    expect(rowsText().length).toBe(0);

    const listErrorEl = fixture.nativeElement.querySelector('.list-error');
    expect(listErrorEl).toBeTruthy();
  });

  // --- UX-2: Formatacao de valores monetarios e categoria ---

  it('UX-2 criterio 1: valor de entrada e formatado como moeda BRL com sinal fora do pipe', () => {
    setupWithCategories([]);
    setupWithList([{ ...salaryTx, value: 187.4, type: TransactionType.Entrada }]);

    const rows = rowsText();
    expect(rows[0]).toContain('+');
    expect(rows[0]).toContain('R$ 187,40');
  });

  it('UX-2 criterio 2: valor de saida e formatado como moeda BRL com sinal fora do pipe e classe negativa mantida', () => {
    setupWithCategories([]);
    setupWithList([{ ...salaryTx, value: 187.4, type: TransactionType.Saida }]);

    const rows = rowsText();
    expect(rows[0]).toContain('−');
    expect(rows[0]).toContain('R$ 187,40');

    const valueEl = fixture.nativeElement.querySelector('.transaction-item__value--negative');
    expect(valueEl).toBeTruthy();
  });

  it('UX-2 criterio 3: valor com casas decimais e separador de milhar (nao o numero cru)', () => {
    setupWithCategories([]);
    setupWithList([{ ...salaryTx, value: 1234.5, type: TransactionType.Entrada }]);

    const rows = rowsText();
    expect(rows[0]).toContain('R$ 1.234,50');
    expect(rows[0]).not.toContain('1234.5');
  });

  it('UX-2 criterio 4: transactionDate presente e formatada como dd/MM/yyyy, nunca a string ISO crua', () => {
    setupWithCategories([]);
    setupWithList([{ ...salaryTx, transactionDate: '2026-08-03' }]);

    const rows = rowsText();
    expect(rows[0]).toContain('03/08/2026');
    expect(rows[0]).not.toContain('2026-08-03');
  });

  it('UX-2 criterio 5: transactionDate ausente nao quebra a renderizacao e nao deixa separador sobrando', () => {
    setupWithCategories([]);
    setupWithList([{ ...salaryTx }]); // sem transactionDate, sem categoryId

    const rows = rowsText();
    expect(rows[0]).not.toContain('undefined');
    expect(rows[0]).not.toContain('null');

    const metaEl = fixture.nativeElement.querySelector('.transaction-item__meta');
    expect(metaEl).toBeFalsy();
  });

  it('UX-2 criterio 6: categoryId com correspondencia exibe o nome da categoria, nunca o numero cru', () => {
    setupWithCategories([alimentacaoCategory]);
    setupWithList([{ ...salaryTx, categoryId: 3 }]);

    const rows = rowsText();
    expect(rows[0]).toContain('Alimentação');
    expect(rows[0]).not.toContain('3');
  });

  it('UX-2 criterio 7: GET /api/category e chamado uma unica vez na inicializacao, independente do numero de transacoes', () => {
    setupWithCategories([alimentacaoCategory]);
    setupWithList([{ ...salaryTx, categoryId: 3 }, { ...marketTx, categoryId: 3 }]);

    expect(categoryServiceSpy.getAll).toHaveBeenCalledTimes(1);
  });

  it('UX-2 criterio 8: categoryId ausente nao exibe nome de categoria nem fallback', () => {
    setupWithCategories([alimentacaoCategory]);
    setupWithList([{ ...salaryTx }]); // sem categoryId

    const rows = rowsText();
    expect(rows[0]).not.toContain('Alimentação');
    expect(rows[0]).not.toContain('Categoria não encontrada');
    expect(rows[0]).not.toContain('undefined');
    expect(rows[0]).not.toContain('null');
  });

  it('UX-2 criterio 9: categoryId presente mas nao encontrado no mapa exibe fallback estavel, nunca o numero cru', () => {
    setupWithCategories([alimentacaoCategory]);
    setupWithList([{ ...salaryTx, categoryId: 99 }]);

    const rows = rowsText();
    expect(rows[0]).toContain('Categoria não encontrada');
    expect(rows[0]).not.toContain('99');
  });

  it('UX-2 criterio 10: falha ao carregar GET /api/category nao bloqueia a listagem de transacoes e usa fallback estavel', () => {
    categoryServiceSpy.getAll.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );
    setupWithList([{ ...salaryTx, categoryId: 3 }]);

    expect(component.listError).toBeNull();
    const rows = rowsText();
    expect(rows.length).toBe(1);
    expect(rows[0]).not.toContain('undefined');
    expect(rows[0]).not.toContain('null');
    expect(fixture.nativeElement.querySelector('.list-error')).toBeFalsy();
  });

  // --- UX-2: casos de borda do separador ' · ' (secao "Casos de borda" da spec) ---
  // A spec exige que o separador so aparece quando AMBOS os valores (categoria e data)
  // estiverem presentes - nao deve sobrar um ' · ' solto quando so um dos dois existir.

  it('UX-2 caso de borda: apenas categoryId presente (sem transactionDate) nao deixa separador solto', () => {
    setupWithCategories([alimentacaoCategory]);
    setupWithList([{ ...salaryTx, categoryId: 3 }]); // sem transactionDate

    const metaEl = fixture.nativeElement.querySelector('.transaction-item__meta');
    expect(metaEl).toBeTruthy();
    expect((metaEl.textContent ?? '').trim()).toBe('Alimentação');
    expect(metaEl.textContent).not.toContain('·');
  });

  it('UX-2 caso de borda: apenas transactionDate presente (sem categoryId) nao deixa separador solto', () => {
    setupWithCategories([alimentacaoCategory]);
    setupWithList([{ ...salaryTx, transactionDate: '2026-08-03' }]); // sem categoryId

    const metaEl = fixture.nativeElement.querySelector('.transaction-item__meta');
    expect(metaEl).toBeTruthy();
    expect((metaEl.textContent ?? '').trim()).toBe('03/08/2026');
    expect(metaEl.textContent).not.toContain('·');
  });

  it('UX-2 caso de borda: categoria e data presentes exibem ambos combinados pelo separador " · "', () => {
    setupWithCategories([alimentacaoCategory]);
    setupWithList([{ ...salaryTx, categoryId: 3, transactionDate: '2026-08-03' }]);

    const metaEl = fixture.nativeElement.querySelector('.transaction-item__meta');
    expect(metaEl).toBeTruthy();
    expect((metaEl.textContent ?? '').trim()).toBe('Alimentação · 03/08/2026');
  });

  it('UX-2 caso de borda: fallback de categoria nao encontrada combinado com data tambem usa o separador', () => {
    setupWithCategories([alimentacaoCategory]);
    setupWithList([{ ...salaryTx, categoryId: 99, transactionDate: '2026-08-03' }]);

    const metaEl = fixture.nativeElement.querySelector('.transaction-item__meta');
    expect(metaEl).toBeTruthy();
    expect((metaEl.textContent ?? '').trim()).toBe('Categoria não encontrada · 03/08/2026');
  });

  // --- UX-1: Loading state ---

  it('UX-1 criterio 1: exibe indicador de carregamento enquanto isLoadingList=true e lista vazia', () => {
    const subject = new Subject<{ transactionResponses: TransactionResponse[] }>();
    transactionServiceSpy.getAll.and.returnValue(subject);

    fixture.detectChanges();

    expect(component.isLoadingList).toBeTrue();
    expect(component.transactions.length).toBe(0);

    const loadingEl = fixture.nativeElement.querySelector('.loading-state');
    expect(loadingEl).toBeTruthy();
    expect(loadingEl.textContent).toContain('Carregando');
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.list-error')).toBeFalsy();
    expect(rowsText().length).toBe(0);
  });

  it('UX-1 criterio 2: indicador de carregamento desaparece quando a lista carrega com itens', () => {
    const subject = new Subject<{ transactionResponses: TransactionResponse[] }>();
    transactionServiceSpy.getAll.and.returnValue(subject);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-state')).toBeTruthy();

    subject.next({ transactionResponses: [salaryTx, marketTx] });
    subject.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-state')).toBeFalsy();
    expect(rowsText().length).toBe(2);
  });

  it('UX-1 criterio 3: indicador de carregamento desaparece quando a lista carrega vazia (estado vazio real)', () => {
    const subject = new Subject<{ transactionResponses: TransactionResponse[] }>();
    transactionServiceSpy.getAll.and.returnValue(subject);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-state')).toBeTruthy();

    subject.next({ transactionResponses: [] });
    subject.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-state')).toBeFalsy();
    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
  });

  it('UX-1 criterio 4: indicador de carregamento desaparece quando ocorre erro ao carregar', () => {
    const subject = new Subject<{ transactionResponses: TransactionResponse[] }>();
    transactionServiceSpy.getAll.and.returnValue(subject);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-state')).toBeTruthy();

    subject.error(new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-state')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.list-error')).toBeTruthy();
  });

  it('UX-1 caso de borda: ordem de precedencia - loading tem prioridade sobre erro no template, mesmo que ambos estejam truthy simultaneamente', () => {
    // Este cenario nao ocorre na implementacao atual de loadTransactions() (isLoadingList e listError
    // nunca sao truthy ao mesmo tempo), mas a spec exige que a ordem de checagem no template coloque
    // isLoadingList antes de listError para ser a prova de futuras mudancas no componente.
    fixture.detectChanges();

    component.isLoadingList = true;
    component.listError = 'Erro forcado para teste de precedencia';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-state')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.list-error')).toBeFalsy();
  });

  it('caso de borda: transacao sem campos opcionais nao quebra a renderizacao (sem "undefined")', () => {
    setupWithList([salaryTx]);

    const rows = rowsText();
    expect(rows[0]).not.toContain('undefined');
  });

  // --- Criacao ---

  it('criterio 4: criacao com sucesso apenas com campos obrigatorios envia payload minimo e atualiza a listagem', () => {
    fixture.detectChanges();
    transactionServiceSpy.create.and.returnValue(of(salaryTx));

    fillRequiredFields('Salário', '5000', TransactionType.Entrada);
    submitCreateForm();

    expect(transactionServiceSpy.create).toHaveBeenCalledWith({
      transactionName: 'Salário',
      value: 5000,
      type: TransactionType.Entrada
    });
    expect(component.transactions).toContain(salaryTx);
    expect(component.createError).toBeNull();
    expect(component.form.controls.transactionName.value).toBe('');
  });

  it('criterio 5: criacao com sucesso incluindo campos opcionais envia payload completo', () => {
    fixture.detectChanges();
    transactionServiceSpy.create.and.returnValue(of(marketTx));

    fillRequiredFields('Mercado', '150', TransactionType.Saida);
    component.form.controls.paymentMethod.setValue(PaymentMethod.Pix);
    component.form.controls.transactionDate.setValue('2026-08-03');
    submitCreateForm();

    expect(transactionServiceSpy.create).toHaveBeenCalledWith({
      transactionName: 'Mercado',
      value: 150,
      type: TransactionType.Saida,
      paymentMethod: PaymentMethod.Pix,
      transactionDate: '2026-08-03'
    });
    expect(component.transactions).toContain(marketTx);
  });

  it('criterio 6: transactionName vazio bloqueia envio e marca campo obrigatorio', () => {
    fixture.detectChanges();
    fillRequiredFields('', '100', TransactionType.Entrada);

    submitCreateForm();

    expect(transactionServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.transactionName.hasError('required')).toBeTrue();
  });

  it('criterio 7: transactionName acima de 100 caracteres bloqueia envio e indica excesso de limite', () => {
    fixture.detectChanges();
    const longName = 'a'.repeat(101);
    fillRequiredFields(longName, '100', TransactionType.Entrada);

    submitCreateForm();

    expect(transactionServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.transactionName.hasError('maxlength')).toBeTrue();
  });

  it('criterio 8: value ausente bloqueia envio e marca campo obrigatorio', () => {
    fixture.detectChanges();
    fillRequiredFields('Salário', '', TransactionType.Entrada);

    submitCreateForm();

    expect(transactionServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.value.hasError('required')).toBeTrue();
  });

  it('criterio 8: value nao numerico bloqueia envio e marca campo invalido', () => {
    fixture.detectChanges();
    fillRequiredFields('Salário', 'abc', TransactionType.Entrada);

    submitCreateForm();

    expect(transactionServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.value.invalid).toBeTrue();
  });

  it('criterio 9: value igual a zero bloqueia envio e indica que deve ser maior que zero', () => {
    fixture.detectChanges();
    fillRequiredFields('Salário', '0', TransactionType.Entrada);

    submitCreateForm();

    expect(transactionServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.value.hasError('notPositive')).toBeTrue();
  });

  it('criterio 9: value negativo bloqueia envio e indica que deve ser maior que zero', () => {
    fixture.detectChanges();
    fillRequiredFields('Salário', '-10', TransactionType.Entrada);

    submitCreateForm();

    expect(transactionServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.value.hasError('notPositive')).toBeTrue();
  });

  it('criterio 10: type nao selecionado bloqueia envio e marca campo obrigatorio', () => {
    fixture.detectChanges();
    fillRequiredFields('Salário', '100', null);

    submitCreateForm();

    expect(transactionServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.type.hasError('required')).toBeTrue();
  });

  it('criterio 11: erro 400 ao criar exibe mensagem generica, mantem formulario preenchido e nao adiciona a listagem', () => {
    fixture.detectChanges();
    transactionServiceSpy.create.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }))
    );

    fillRequiredFields('Salário', '100', TransactionType.Entrada);
    submitCreateForm();

    expect(component.createError).toBeTruthy();
    expect(component.form.controls.transactionName.value).toBe('Salário');
    expect(component.form.controls.value.value).toBe('100');
    expect(component.transactions.length).toBe(0);
  });

  it('criterio 12: erro de rede ao criar exibe mensagem de conexao distinta do erro 400 e mantem formulario', () => {
    fixture.detectChanges();
    transactionServiceSpy.create.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );

    fillRequiredFields('Salário', '100', TransactionType.Entrada);
    submitCreateForm();
    const networkErrorMessage = component.createError;

    transactionServiceSpy.create.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }))
    );
    submitCreateForm();
    const badRequestMessage = component.createError;

    expect(networkErrorMessage).toBeTruthy();
    expect(networkErrorMessage).not.toBe(badRequestMessage);
    expect(component.form.controls.transactionName.value).toBe('Salário');
    expect(component.transactions.length).toBe(0);
  });

  it('caso de borda: campo "type" oferece exatamente os valores do contrato (Entrada=0, Saida=1), na ordem certa', () => {
    fixture.detectChanges();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#type');
    expect(select.tagName).toBe('SELECT');
    expect(component.transactionTypes).toEqual([TransactionType.Entrada, TransactionType.Saida]);

    const labels = Array.from(select.options).map((o) => o.textContent?.trim());
    expect(labels).toEqual(['Selecione', 'Entrada', 'Saída']);
  });

  it('caso de borda: campo "paymentMethod" oferece exatamente os valores do contrato, na ordem certa', () => {
    fixture.detectChanges();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#paymentMethod');
    expect(select.tagName).toBe('SELECT');
    expect(component.paymentMethods).toEqual([
      PaymentMethod.Pix,
      PaymentMethod.Dinheiro,
      PaymentMethod.CartaoCredito,
      PaymentMethod.CartaoDebito,
      PaymentMethod.Boleto,
      PaymentMethod.Transferencia,
      PaymentMethod.Outro
    ]);

    const labels = Array.from(select.options).map((o) => o.textContent?.trim());
    expect(labels).toEqual([
      'Não informado',
      'Pix',
      'Dinheiro',
      'Cartão de crédito',
      'Cartão de débito',
      'Boleto',
      'Transferência',
      'Outro'
    ]);
  });

  it('caso de borda: campos opcionais nao preenchidos nao sao enviados com valores inventados', () => {
    fixture.detectChanges();
    transactionServiceSpy.create.and.returnValue(of(salaryTx));

    fillRequiredFields('Salário', '5000', TransactionType.Entrada);
    submitCreateForm();

    const sentPayload = transactionServiceSpy.create.calls.mostRecent().args[0];
    expect(sentPayload.paymentMethod).toBeUndefined();
    expect(sentPayload.categoryId).toBeUndefined();
    expect(sentPayload.transactionDate).toBeUndefined();
    expect('paymentMethod' in sentPayload).toBeFalse();
    expect('transactionDate' in sentPayload).toBeFalse();
  });
});
