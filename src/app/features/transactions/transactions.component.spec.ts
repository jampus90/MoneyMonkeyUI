import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { TransactionsComponent } from './transactions.component';
import { TransactionService } from '../../core/services/transaction.service';
import { TransactionResponse } from '../../core/models/transaction.model';
import { PaymentMethod, TransactionType } from '../../core/models/enums.model';

describe('TransactionsComponent', () => {
  let fixture: ComponentFixture<TransactionsComponent>;
  let component: TransactionsComponent;
  let transactionServiceSpy: jasmine.SpyObj<TransactionService>;

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

  function setupWithList(response: TransactionResponse[]) {
    transactionServiceSpy.getAll.and.returnValue(of({ transactionResponses: response }));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    transactionServiceSpy = jasmine.createSpyObj('TransactionService', ['getAll', 'create']);
    transactionServiceSpy.getAll.and.returnValue(of({ transactionResponses: [] }));

    await TestBed.configureTestingModule({
      imports: [TransactionsComponent],
      providers: [{ provide: TransactionService, useValue: transactionServiceSpy }]
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionsComponent);
    component = fixture.componentInstance;
  });

  function rowsText(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.transaction-item')).map(
      (el) => (el as HTMLElement).textContent ?? ''
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
    expect(rows[0]).toContain('5000');
    expect(rows[0]).toContain('+');
    expect(rows[1]).toContain('Mercado');
    expect(rows[1]).toContain('150');
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
