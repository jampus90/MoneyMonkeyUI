import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { of, throwError, Subject } from 'rxjs';

import { CreditCardDetailComponent } from './credit-card-detail.component';
import { CreditCardService } from '../../core/services/credit-card.service';
import { CategoryService } from '../../core/services/category.service';
import {
  CreditCardInstallmentResponse,
  CreditCardInvoiceResponse,
  CreditCardPurchaseRequest,
  CreditCardResponse,
  CreditCardResponseList
} from '../../core/models/credit-card.model';
import { CategoryResponse, CategoryResponseList } from '../../core/models/category.model';
import { CardBrand, TransactionType } from '../../core/models/enums.model';

registerLocaleData(localePt);

describe('CreditCardDetailComponent', () => {
  let fixture: ComponentFixture<CreditCardDetailComponent>;
  let component: CreditCardDetailComponent;
  let creditCardServiceSpy: jasmine.SpyObj<CreditCardService>;
  let categoryServiceSpy: jasmine.SpyObj<CategoryService>;

  const notebookInstallment: CreditCardInstallmentResponse = {
    creditCardInstallmentId: 10,
    description: 'Notebook',
    categoryId: 3,
    isSubscription: false,
    installmentNumber: 1,
    installmentsCount: 3,
    value: 100,
    purchaseDate: '2026-08-04'
  };

  const netflixInstallment: CreditCardInstallmentResponse = {
    creditCardInstallmentId: 11,
    description: 'Netflix',
    isSubscription: true,
    installmentNumber: 1,
    installmentsCount: 1,
    value: 39.9,
    purchaseDate: '2026-08-02'
  };

  const augustInvoice: CreditCardInvoiceResponse = {
    creditCardId: 1,
    invoiceMonth: 8,
    invoiceYear: 2026,
    dueDate: '2026-08-17',
    totalValue: 139.9,
    installments: [notebookInstallment, netflixInstallment]
  };

  const alimentacaoCategory: CategoryResponse = {
    categoryId: 3,
    name: 'Alimentação',
    type: TransactionType.Saida
  };

  const visaCard: CreditCardResponse = {
    creditCardId: 1,
    name: 'Meu Cartão',
    brand: CardBrand.Visa,
    lastFourDigits: '1234',
    closingDay: 5,
    dueDay: 15
  };

  function setupWithInvoice(invoice: CreditCardInvoiceResponse) {
    creditCardServiceSpy.getInvoice.and.returnValue(of(invoice));
    fixture.detectChanges();
  }

  function setupWithCategories(response: CategoryResponse[]) {
    categoryServiceSpy.getAll.and.returnValue(of({ categoryResponses: response } as CategoryResponseList));
  }

  beforeEach(async () => {
    creditCardServiceSpy = jasmine.createSpyObj('CreditCardService', ['getInvoice', 'createPurchase', 'getAll']);
    creditCardServiceSpy.getInvoice.and.returnValue(of({ ...augustInvoice, installments: [] }));
    creditCardServiceSpy.getAll.and.returnValue(of({ creditCardResponses: [] } as CreditCardResponseList));

    categoryServiceSpy = jasmine.createSpyObj('CategoryService', ['getAll']);
    categoryServiceSpy.getAll.and.returnValue(of({ categoryResponses: [] } as CategoryResponseList));

    await TestBed.configureTestingModule({
      imports: [CreditCardDetailComponent],
      providers: [
        { provide: CreditCardService, useValue: creditCardServiceSpy },
        { provide: CategoryService, useValue: categoryServiceSpy },
        { provide: LOCALE_ID, useValue: 'pt-BR' },
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ creditCardId: '1' }) } }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CreditCardDetailComponent);
    component = fixture.componentInstance;
  });

  function rowsText(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.installment-item')).map(
      (el) => (el as HTMLElement).textContent ?? ''
    );
  }

  function fillPurchaseForm(overrides: {
    description?: string;
    totalValue?: string;
    purchaseDate?: string;
    installmentsCount?: string;
    categoryId?: number | null;
    isSubscription?: boolean;
  }): void {
    const {
      description = 'Notebook',
      totalValue = '300',
      purchaseDate = '',
      installmentsCount = '',
      categoryId = null,
      isSubscription = false
    } = overrides;

    component.form.controls.description.setValue(description);
    component.form.controls.totalValue.setValue(totalValue);
    component.form.controls.purchaseDate.setValue(purchaseDate);
    component.form.controls.installmentsCount.setValue(installmentsCount);
    component.form.controls.categoryId.setValue(categoryId);
    component.form.controls.isSubscription.setValue(isSubscription);
  }

  function submitPurchaseForm(): void {
    component.onSubmit();
    fixture.detectChanges();
  }

  it('deve criar o componente e converter creditCardId da rota para number', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component.creditCardId).toBe(1);
    expect(typeof component.creditCardId).toBe('number');
  });

  // --- Compra (POST /api/creditcard/{creditCardId}/purchases) ---

  it('criterio 1: criacao com sucesso (todos os campos) envia CreditCardPurchaseRequest completo, com isSubscription:true, reseta o formulario e recarrega a fatura com o mesmo month/year exibido', () => {
    setupWithInvoice(augustInvoice);
    creditCardServiceSpy.createPurchase.and.returnValue(of(notebookInstallment));

    fillPurchaseForm({
      description: 'Notebook',
      totalValue: '300',
      purchaseDate: '2026-08-04',
      installmentsCount: '3',
      categoryId: 3,
      isSubscription: true
    });
    submitPurchaseForm();

    const expectedRequest: CreditCardPurchaseRequest = {
      description: 'Notebook',
      totalValue: 300,
      purchaseDate: '2026-08-04',
      installmentsCount: 3,
      categoryId: 3,
      isSubscription: true
    };
    expect(creditCardServiceSpy.createPurchase).toHaveBeenCalledWith(1, expectedRequest);
    const sentRequest = creditCardServiceSpy.createPurchase.calls.mostRecent().args[1];
    expect(typeof sentRequest.totalValue).toBe('number');
    expect(typeof sentRequest.installmentsCount).toBe('number');
    expect(typeof sentRequest.categoryId).toBe('number');

    expect(component.createError).toBeNull();
    expect(component.form.controls.description.value).toBe('');

    // fatura recarregada com o mesmo month/year exibido (invoiceMonth/invoiceYear da ultima resposta)
    expect(creditCardServiceSpy.getInvoice).toHaveBeenCalledWith(1, 8, 2026);
  });

  it('criterio 2: criacao com sucesso somente com campos obrigatorios omite purchaseDate/installmentsCount/categoryId do payload', () => {
    setupWithInvoice(augustInvoice);
    creditCardServiceSpy.createPurchase.and.returnValue(of(notebookInstallment));

    fillPurchaseForm({ description: 'Notebook', totalValue: '300' });
    submitPurchaseForm();

    expect(creditCardServiceSpy.createPurchase).toHaveBeenCalled();
    const sentRequest = creditCardServiceSpy.createPurchase.calls.mostRecent().args[1];
    expect('purchaseDate' in sentRequest).toBeFalse();
    expect('installmentsCount' in sentRequest).toBeFalse();
    expect('categoryId' in sentRequest).toBeFalse();
    expect(sentRequest.isSubscription).toBeFalse();

    expect(component.form.controls.description.value).toBe('');
  });

  it('criterio 3: isSubscription e sempre enviado explicitamente (false quando o usuario nao interage com o campo)', () => {
    setupWithInvoice(augustInvoice);
    creditCardServiceSpy.createPurchase.and.returnValue(of(notebookInstallment));

    fillPurchaseForm({ description: 'Notebook', totalValue: '300' });
    submitPurchaseForm();

    const sentRequest = creditCardServiceSpy.createPurchase.calls.mostRecent().args[1];
    expect('isSubscription' in sentRequest).toBeTrue();
    expect(sentRequest.isSubscription).toBe(false);
  });

  it('criterio 4: description vazia bloqueia envio e marca campo obrigatorio', () => {
    fixture.detectChanges();
    fillPurchaseForm({ description: '' });

    submitPurchaseForm();

    expect(creditCardServiceSpy.createPurchase).not.toHaveBeenCalled();
    expect(component.form.controls.description.hasError('required')).toBeTrue();
  });

  it('criterio 5: description acima de 100 caracteres bloqueia envio', () => {
    fixture.detectChanges();
    fillPurchaseForm({ description: 'a'.repeat(101) });

    submitPurchaseForm();

    expect(creditCardServiceSpy.createPurchase).not.toHaveBeenCalled();
    expect(component.form.controls.description.hasError('maxlength')).toBeTrue();
  });

  it('criterio 6: totalValue ausente, zero ou negativo bloqueia envio', () => {
    fixture.detectChanges();

    fillPurchaseForm({ totalValue: '' });
    submitPurchaseForm();
    expect(creditCardServiceSpy.createPurchase).not.toHaveBeenCalled();
    expect(component.form.controls.totalValue.hasError('required')).toBeTrue();

    fillPurchaseForm({ totalValue: '0' });
    submitPurchaseForm();
    expect(creditCardServiceSpy.createPurchase).not.toHaveBeenCalled();
    expect(component.form.controls.totalValue.hasError('notPositive')).toBeTrue();

    fillPurchaseForm({ totalValue: '-10' });
    submitPurchaseForm();
    expect(creditCardServiceSpy.createPurchase).not.toHaveBeenCalled();
    expect(component.form.controls.totalValue.hasError('notPositive')).toBeTrue();
  });

  it('criterio 7: installmentsCount fora do intervalo 1-48 bloqueia envio', () => {
    fixture.detectChanges();

    fillPurchaseForm({ installmentsCount: '0' });
    submitPurchaseForm();
    expect(creditCardServiceSpy.createPurchase).not.toHaveBeenCalled();
    expect(component.form.controls.installmentsCount.hasError('outOfRange')).toBeTrue();

    fillPurchaseForm({ installmentsCount: '49' });
    submitPurchaseForm();
    expect(creditCardServiceSpy.createPurchase).not.toHaveBeenCalled();
    expect(component.form.controls.installmentsCount.hasError('outOfRange')).toBeTrue();
  });

  it('criterio 8: erro 400 ao criar exibe mensagem generica, mantem formulario preenchido e nao recarrega a fatura', () => {
    setupWithInvoice(augustInvoice);
    creditCardServiceSpy.getInvoice.calls.reset();
    creditCardServiceSpy.createPurchase.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }))
    );

    fillPurchaseForm({ description: 'Notebook', totalValue: '300' });
    submitPurchaseForm();

    expect(component.createError).toBeTruthy();
    expect(component.form.controls.description.value).toBe('Notebook');
    expect(creditCardServiceSpy.getInvoice).not.toHaveBeenCalled();
  });

  it('criterio 9: erro de rede ao criar exibe mensagem de conexao distinta do erro 400 e mantem formulario', () => {
    setupWithInvoice(augustInvoice);
    creditCardServiceSpy.createPurchase.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );

    fillPurchaseForm({ description: 'Notebook', totalValue: '300' });
    submitPurchaseForm();
    const networkErrorMessage = component.createError;

    creditCardServiceSpy.createPurchase.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }))
    );
    submitPurchaseForm();
    const badRequestMessage = component.createError;

    expect(networkErrorMessage).toBeTruthy();
    expect(networkErrorMessage).not.toBe(badRequestMessage);
    expect(component.form.controls.description.value).toBe('Notebook');
  });

  it('criterio 10: resposta unica do POST nao e usada como retrato completo da compra - a lista exibida vem apenas do proximo GET da fatura', () => {
    setupWithInvoice({ ...augustInvoice, installments: [] });
    creditCardServiceSpy.createPurchase.and.returnValue(of(notebookInstallment));
    creditCardServiceSpy.getInvoice.and.returnValue(of(augustInvoice));

    fillPurchaseForm({ description: 'Notebook', totalValue: '1200', installmentsCount: '12' });
    submitPurchaseForm();

    expect(component.invoice).toEqual(augustInvoice);
    expect(component.invoice?.installments.length).toBe(2);
  });

  // --- Fatura (GET /api/creditcard/{creditCardId}/fatura) ---

  it('criterio 11: carregamento inicial com sucesso e parcelas envia GET sem month/year e exibe cabecalho + uma linha por parcela', () => {
    setupWithInvoice(augustInvoice);

    expect(creditCardServiceSpy.getInvoice).toHaveBeenCalledWith(1, undefined, undefined);

    const rows = rowsText();
    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('Notebook');
    expect(rows[0]).toContain('1/3');
    expect(rows[1]).toContain('Netflix');
    expect(rows[1]).toContain('1/1');

    const header = fixture.nativeElement.textContent as string;
    expect(header).toContain('139,90');
    expect(header).toContain('17/08/2026');
  });

  it('criterio 11 (caso de borda): indicacao de isSubscription exibida apenas na parcela com isSubscription true', () => {
    setupWithInvoice(augustInvoice);

    const rows = rowsText();
    expect(rows[0]).not.toContain('Assinatura');
    expect(rows[1]).toContain('Assinatura');
  });

  it('criterio 12: fatura sem parcelas exibe estado vazio, sem linhas e sem erro, mantendo cabecalho', () => {
    setupWithInvoice({ ...augustInvoice, installments: [] });

    expect(component.invoiceError).toBeNull();
    expect(rowsText().length).toBe(0);

    const emptyState = fixture.nativeElement.querySelector('.invoice-empty');
    expect(emptyState).toBeTruthy();

    const header = fixture.nativeElement.textContent as string;
    expect(header).toContain('17/08/2026');
  });

  it('criterio 13: erro de rede ao carregar a fatura exibe mensagem de erro distinta do estado vazio, sem renderizar fatura parcial', () => {
    creditCardServiceSpy.getInvoice.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );

    fixture.detectChanges();

    expect(component.invoiceError).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.invoice-empty')).toBeFalsy();
    expect(rowsText().length).toBe(0);

    const errorEl = fixture.nativeElement.querySelector('.invoice-error');
    expect(errorEl).toBeTruthy();
  });

  it('criterio 14: navegacao para o mes anterior envia month/year do mes anterior, com rollover de ano quando invoiceMonth e janeiro', () => {
    setupWithInvoice({ ...augustInvoice, invoiceMonth: 1, invoiceYear: 2026 });
    creditCardServiceSpy.getInvoice.and.returnValue(of({ ...augustInvoice, invoiceMonth: 12, invoiceYear: 2025 }));

    component.previousMonth();
    fixture.detectChanges();

    expect(creditCardServiceSpy.getInvoice).toHaveBeenCalledWith(1, 12, 2025);
    expect(component.invoice?.invoiceMonth).toBe(12);
    expect(component.invoice?.invoiceYear).toBe(2025);
  });

  it('criterio 14 (sem rollover): navegacao para o mes anterior em mes diferente de janeiro', () => {
    setupWithInvoice(augustInvoice);
    creditCardServiceSpy.getInvoice.and.returnValue(of({ ...augustInvoice, invoiceMonth: 7 }));

    component.previousMonth();

    expect(creditCardServiceSpy.getInvoice).toHaveBeenCalledWith(1, 7, 2026);
  });

  it('criterio 15: navegacao para o proximo mes envia month/year do proximo mes, com rollover de ano quando invoiceMonth e dezembro', () => {
    setupWithInvoice({ ...augustInvoice, invoiceMonth: 12, invoiceYear: 2026 });
    creditCardServiceSpy.getInvoice.and.returnValue(of({ ...augustInvoice, invoiceMonth: 1, invoiceYear: 2027 }));

    component.nextMonth();
    fixture.detectChanges();

    expect(creditCardServiceSpy.getInvoice).toHaveBeenCalledWith(1, 1, 2027);
    expect(component.invoice?.invoiceMonth).toBe(1);
    expect(component.invoice?.invoiceYear).toBe(2027);
  });

  it('criterio 15 (sem rollover): navegacao para o proximo mes em mes diferente de dezembro', () => {
    setupWithInvoice(augustInvoice);
    creditCardServiceSpy.getInvoice.and.returnValue(of({ ...augustInvoice, invoiceMonth: 9 }));

    component.nextMonth();

    expect(creditCardServiceSpy.getInvoice).toHaveBeenCalledWith(1, 9, 2026);
  });

  it('criterio 15 (caso de borda): se a navegacao falhar, a fatura anterior continua como referencia para a proxima tentativa', () => {
    setupWithInvoice(augustInvoice);
    creditCardServiceSpy.getInvoice.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );

    component.nextMonth();
    fixture.detectChanges();

    expect(component.invoiceError).toBeTruthy();

    creditCardServiceSpy.getInvoice.and.returnValue(of({ ...augustInvoice, invoiceMonth: 9 }));
    component.nextMonth();

    expect(creditCardServiceSpy.getInvoice).toHaveBeenCalledWith(1, 9, 2026);
  });

  it('criterio 16: erro 401 ao carregar a fatura e tratado como erro generico (mesma mensagem de erro de carregamento)', () => {
    creditCardServiceSpy.getInvoice.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }))
    );

    fixture.detectChanges();
    const message401 = component.invoiceError;

    creditCardServiceSpy.getInvoice.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );
    component.loadInvoice();
    const messageNetwork = component.invoiceError;

    expect(message401).toBeTruthy();
    expect(message401).toBe(messageNetwork);
  });

  it('criterio 16: erro 401 ao criar compra e tratado como erro generico (mesma mensagem de erro de conexao)', () => {
    setupWithInvoice(augustInvoice);
    creditCardServiceSpy.createPurchase.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }))
    );

    fillPurchaseForm({ description: 'Notebook', totalValue: '300' });
    submitPurchaseForm();
    const message401 = component.createError;

    creditCardServiceSpy.createPurchase.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );
    submitPurchaseForm();
    const messageNetwork = component.createError;

    expect(message401).toBeTruthy();
    expect(message401).toBe(messageNetwork);
  });

  // --- categoryId opcional (select de categoria) ---

  it('caso de borda: select de categoria oferece "Nenhuma" como opcao padrao (null) e demais opcoes com categoryId numerico', () => {
    setupWithCategories([alimentacaoCategory]);
    setupWithInvoice({ ...augustInvoice, installments: [] });

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#purchase-category');
    expect(select).toBeTruthy();
    const options = Array.from(select.options).map((o) => o.textContent?.trim());
    expect(options[0]).toContain('Nenhuma');

    expect(component.categories).toEqual([alimentacaoCategory]);
  });

  // --- UX-6: identificacao do cartao + link de volta (achado #2) ---

  it('UX-6 criterio 1: cartao encontrado exibe nome, bandeira e ultimos 4 digitos no titulo', () => {
    creditCardServiceSpy.getAll.and.returnValue(of({ creditCardResponses: [visaCard] } as CreditCardResponseList));
    setupWithInvoice(augustInvoice);

    expect(creditCardServiceSpy.getAll).toHaveBeenCalled();
    expect(component.creditCard).toEqual(visaCard);

    const title = fixture.nativeElement.querySelector('.invoice__title').textContent as string;
    expect(title).toContain('Meu Cartão');
    expect(title).toContain('Visa');
    expect(title).toContain('1234');
  });

  it('UX-6 criterio 2: cartao nao encontrado na lista exibe titulo generico "Fatura", sem bloquear a fatura', () => {
    creditCardServiceSpy.getAll.and.returnValue(
      of({ creditCardResponses: [{ ...visaCard, creditCardId: 999 }] } as CreditCardResponseList)
    );
    setupWithInvoice(augustInvoice);

    expect(component.creditCard).toBeNull();
    const title = (fixture.nativeElement.querySelector('.invoice__title').textContent as string).trim();
    expect(title).toBe('Fatura');
    expect(rowsText().length).toBe(2);
  });

  it('UX-6 criterio 3: falha ao carregar a lista de cartoes cai no fallback "Fatura", sem bloquear fatura/formulario', () => {
    creditCardServiceSpy.getAll.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );
    setupWithInvoice(augustInvoice);

    expect(component.creditCard).toBeNull();
    const title = (fixture.nativeElement.querySelector('.invoice__title').textContent as string).trim();
    expect(title).toBe('Fatura');
    expect(component.invoiceError).toBeNull();
    expect(rowsText().length).toBe(2);
  });

  it('UX-6 criterio 4: link de volta para /credit-cards esta sempre presente no DOM, independente do estado', () => {
    creditCardServiceSpy.getInvoice.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a[routerLink="/credit-cards"]');
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('cartões');
  });

  // --- UX-6: CurrencyPipe/DatePipe (achado #3) ---

  it('UX-6 criterio 5: total e vencimento da fatura sao exibidos via currency/date pipe, nunca crus', () => {
    setupWithInvoice(augustInvoice);

    const summaryText = fixture.nativeElement.querySelector('.invoice__summary').textContent as string;
    expect(summaryText).not.toContain('139.9');
    expect(summaryText).not.toContain('2026-08-17');
    expect(summaryText).toContain('139,90');
    expect(summaryText).toContain('17/08/2026');
  });

  it('UX-6 criterio 6: valor e data de cada parcela sao exibidos via currency/date pipe', () => {
    setupWithInvoice(augustInvoice);

    const rows = rowsText();
    expect(rows[0]).not.toContain('2026-08-04');
    expect(rows[0]).toContain('04/08/2026');
    expect(rows[0]).toContain('R$');
    expect(rows[0]).toContain('100,00');

    expect(rows[1]).not.toContain('2026-08-02');
    expect(rows[1]).toContain('02/08/2026');
    expect(rows[1]).toContain('39,90');
  });

  it('UX-6 criterio 8: invoiceMonth/invoiceYear permanecem sem formatacao de data (fora de escopo)', () => {
    setupWithInvoice(augustInvoice);

    const summaryText = fixture.nativeElement.querySelector('.invoice__summary').textContent as string;
    expect(summaryText).toContain('8/2026');
  });

  // --- UX-6: hierarquia tabular das parcelas (achado #4) ---

  it('UX-6 criterio 9: cabecalho de colunas precede a lista, com os 4 rotulos na ordem esperada, quando ha parcelas', () => {
    setupWithInvoice(augustInvoice);

    const header = fixture.nativeElement.querySelector('.installment-list__header');
    expect(header).toBeTruthy();

    const labels = Array.from(header.querySelectorAll('span') as NodeListOf<HTMLElement>).map((s) => s.textContent?.trim());
    expect(labels).toEqual(['Descrição', 'Parcela', 'Valor', 'Data']);

    const list = fixture.nativeElement.querySelector('.installment-list');
    expect(header.nextElementSibling).toBe(list);
  });

  it('UX-6 criterio 10: cabecalho de colunas fica oculto na viewport padrao dos testes (< 960px)', () => {
    setupWithInvoice(augustInvoice);

    const header: HTMLElement = fixture.nativeElement.querySelector('.installment-list__header');
    expect(getComputedStyle(header).display).toBe('none');
  });

  it('UX-6 criterio 11: valor da parcela (.installment-item__value) tem font-weight 700', () => {
    setupWithInvoice(augustInvoice);

    const valueEl: HTMLElement = fixture.nativeElement.querySelector('.installment-item__value');
    expect(getComputedStyle(valueEl).fontWeight).toBe('700');
  });

  it('UX-6 criterio 13: estado vazio nao renderiza cabecalho nem lista de parcelas', () => {
    setupWithInvoice({ ...augustInvoice, installments: [] });

    expect(fixture.nativeElement.querySelector('.installment-list__header')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.installment-list')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.invoice-empty')).toBeTruthy();
  });

  // --- UX-6: achado #5 agrupado ---

  it('UX-6 criterio 14: .invoice__nav tem flex-wrap: wrap', () => {
    fixture.detectChanges();

    const nav: HTMLElement = fixture.nativeElement.querySelector('.invoice__nav');
    expect(getComputedStyle(nav).flexWrap).toBe('wrap');
  });
});
