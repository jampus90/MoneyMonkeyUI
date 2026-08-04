import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';

import { CreditCardsComponent } from './credit-cards.component';
import { CreditCardService } from '../../core/services/credit-card.service';
import { CreditCardResponse } from '../../core/models/credit-card.model';
import { CardBrand } from '../../core/models/enums.model';

describe('CreditCardsComponent', () => {
  let fixture: ComponentFixture<CreditCardsComponent>;
  let component: CreditCardsComponent;
  let creditCardServiceSpy: jasmine.SpyObj<CreditCardService>;

  const nubankCard: CreditCardResponse = {
    creditCardId: 1,
    name: 'Nubank',
    brand: CardBrand.Mastercard,
    lastFourDigits: '1234',
    closingDay: 10,
    dueDay: 17,
    creditLimit: 5000
  };

  const interCard: CreditCardResponse = {
    creditCardId: 2,
    name: 'Inter',
    brand: CardBrand.Visa,
    lastFourDigits: '5678',
    closingDay: 5,
    dueDay: 12
  };

  function setupWithList(response: CreditCardResponse[]) {
    creditCardServiceSpy.getAll.and.returnValue(of({ creditCardResponses: response }));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    creditCardServiceSpy = jasmine.createSpyObj('CreditCardService', ['getAll', 'create']);
    creditCardServiceSpy.getAll.and.returnValue(of({ creditCardResponses: [] }));

    await TestBed.configureTestingModule({
      imports: [CreditCardsComponent],
      providers: [{ provide: CreditCardService, useValue: creditCardServiceSpy }]
    }).compileComponents();

    fixture = TestBed.createComponent(CreditCardsComponent);
    component = fixture.componentInstance;
  });

  function rowsText(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.credit-card-item')).map(
      (el) => (el as HTMLElement).textContent ?? ''
    );
  }

  function fillRequiredFields(overrides: {
    name?: string;
    brand?: CardBrand | null;
    lastFourDigits?: string;
    closingDay?: string;
    dueDay?: string;
    creditLimit?: string;
  }): void {
    const {
      name = 'Nubank',
      brand = CardBrand.Mastercard,
      lastFourDigits = '1234',
      closingDay = '10',
      dueDay = '17',
      creditLimit = ''
    } = overrides;

    component.form.controls.name.setValue(name);
    component.form.controls.brand.setValue(brand);
    component.form.controls.lastFourDigits.setValue(lastFourDigits);
    component.form.controls.closingDay.setValue(closingDay);
    component.form.controls.dueDay.setValue(dueDay);
    component.form.controls.creditLimit.setValue(creditLimit);
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

  it('criterio 1: listagem com sucesso renderiza uma linha por CreditCardResponse com name, brand, lastFourDigits, closingDay, dueDay e creditLimit quando presente', () => {
    setupWithList([nubankCard, interCard]);

    expect(creditCardServiceSpy.getAll).toHaveBeenCalled();
    expect(component.creditCards).toEqual([nubankCard, interCard]);

    const rows = rowsText();
    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('Nubank');
    expect(rows[0]).toContain('Mastercard');
    expect(rows[0]).toContain('1234');
    expect(rows[0]).toContain('10');
    expect(rows[0]).toContain('17');
    expect(rows[0]).toContain('5000');

    expect(rows[1]).toContain('Inter');
    expect(rows[1]).toContain('Visa');
    expect(rows[1]).toContain('5678');
  });

  it('criterio 1 (caso de borda): creditLimit ausente na resposta nao e exibido na linha do cartao', () => {
    setupWithList([interCard]);

    const rows = rowsText();
    expect(rows.length).toBe(1);
    expect(rows[0]).not.toContain('Limite');
  });

  it('criterio 2: estado vazio exibe mensagem dedicada, sem linhas e sem erro', () => {
    setupWithList([]);

    expect(component.creditCards).toEqual([]);
    expect(rowsText().length).toBe(0);
    expect(component.listError).toBeNull();

    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('Nenhum cartão cadastrado');
  });

  it('criterio 3: erro de rede ao carregar exibe mensagem de erro distinta do estado vazio', () => {
    creditCardServiceSpy.getAll.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );

    fixture.detectChanges();

    expect(component.listError).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeFalsy();
    expect(rowsText().length).toBe(0);

    const listErrorEl = fixture.nativeElement.querySelector('.list-error');
    expect(listErrorEl).toBeTruthy();
  });

  // --- Criacao ---

  it('criterio 4: criacao com sucesso (com creditLimit) envia CreditCardRequest com brand numerico, atualiza listagem e reseta formulario', () => {
    fixture.detectChanges();
    creditCardServiceSpy.create.and.returnValue(of(nubankCard));

    fillRequiredFields({ creditLimit: '5000' });
    submitCreateForm();

    expect(creditCardServiceSpy.create).toHaveBeenCalledWith({
      name: 'Nubank',
      brand: CardBrand.Mastercard,
      lastFourDigits: '1234',
      closingDay: 10,
      dueDay: 17,
      creditLimit: 5000
    });
    const sentPayload = creditCardServiceSpy.create.calls.mostRecent().args[0];
    expect(typeof sentPayload.brand).toBe('number');
    expect(typeof sentPayload.lastFourDigits).toBe('string');

    expect(component.creditCards).toContain(nubankCard);
    expect(component.createError).toBeNull();
    expect(component.form.controls.name.value).toBe('');
    expect(component.form.controls.brand.value).toBeNull();
  });

  it('criterio 5: criacao com sucesso sem creditLimit omite a chave do payload', () => {
    fixture.detectChanges();
    creditCardServiceSpy.create.and.returnValue(of(interCard));

    fillRequiredFields({ name: 'Inter', brand: CardBrand.Visa, lastFourDigits: '5678', closingDay: '5', dueDay: '12', creditLimit: '' });
    submitCreateForm();

    expect(creditCardServiceSpy.create).toHaveBeenCalled();
    const sentPayload = creditCardServiceSpy.create.calls.mostRecent().args[0];
    expect('creditLimit' in sentPayload).toBeFalse();

    expect(component.creditCards).toContain(interCard);
    expect(component.form.controls.name.value).toBe('');
  });

  it('criterio 6: name vazio bloqueia envio e marca campo obrigatorio', () => {
    fixture.detectChanges();
    fillRequiredFields({ name: '' });

    submitCreateForm();

    expect(creditCardServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.name.hasError('required')).toBeTrue();
  });

  it('criterio 7: name acima de 50 caracteres bloqueia envio e indica excesso de limite', () => {
    fixture.detectChanges();
    fillRequiredFields({ name: 'a'.repeat(51) });

    submitCreateForm();

    expect(creditCardServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.name.hasError('maxlength')).toBeTrue();
  });

  it('criterio 8: brand nao selecionado bloqueia envio e marca campo obrigatorio', () => {
    fixture.detectChanges();
    fillRequiredFields({ brand: null });

    submitCreateForm();

    expect(creditCardServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.brand.hasError('required')).toBeTrue();
  });

  it('criterio 9: lastFourDigits vazio ou com tamanho diferente de 4 bloqueia envio', () => {
    fixture.detectChanges();

    fillRequiredFields({ lastFourDigits: '' });
    submitCreateForm();
    expect(creditCardServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.lastFourDigits.hasError('required')).toBeTrue();

    fillRequiredFields({ lastFourDigits: '123' });
    submitCreateForm();
    expect(creditCardServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.lastFourDigits.hasError('length')).toBeTrue();

    fillRequiredFields({ lastFourDigits: '12345' });
    submitCreateForm();
    expect(creditCardServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.lastFourDigits.hasError('length')).toBeTrue();
  });

  it('criterio 10: lastFourDigits com 4 caracteres mas nao numericos bloqueia envio', () => {
    fixture.detectChanges();
    fillRequiredFields({ lastFourDigits: '12a4' });

    submitCreateForm();

    expect(creditCardServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.lastFourDigits.hasError('digitsOnly')).toBeTrue();
  });

  it('criterio 11: closingDay fora do intervalo 1-28 bloqueia envio', () => {
    fixture.detectChanges();

    fillRequiredFields({ closingDay: '0' });
    submitCreateForm();
    expect(creditCardServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.closingDay.hasError('outOfRange')).toBeTrue();

    fillRequiredFields({ closingDay: '29' });
    submitCreateForm();
    expect(creditCardServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.closingDay.hasError('outOfRange')).toBeTrue();
  });

  it('criterio 12: dueDay fora do intervalo 1-28 bloqueia envio', () => {
    fixture.detectChanges();

    fillRequiredFields({ dueDay: '0' });
    submitCreateForm();
    expect(creditCardServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.dueDay.hasError('outOfRange')).toBeTrue();

    fillRequiredFields({ dueDay: '29' });
    submitCreateForm();
    expect(creditCardServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.dueDay.hasError('outOfRange')).toBeTrue();
  });

  it('criterio 13: erro 400 ao criar exibe mensagem generica, mantem formulario preenchido e nao adiciona a listagem', () => {
    fixture.detectChanges();
    creditCardServiceSpy.create.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }))
    );

    fillRequiredFields({});
    submitCreateForm();

    expect(component.createError).toBeTruthy();
    expect(component.form.controls.name.value).toBe('Nubank');
    expect(component.form.controls.brand.value).toBe(CardBrand.Mastercard);
    expect(component.creditCards.length).toBe(0);
  });

  it('criterio 14: erro de rede ao criar exibe mensagem de conexao distinta do erro 400 e mantem formulario', () => {
    fixture.detectChanges();
    creditCardServiceSpy.create.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );

    fillRequiredFields({});
    submitCreateForm();
    const networkErrorMessage = component.createError;

    creditCardServiceSpy.create.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }))
    );
    submitCreateForm();
    const badRequestMessage = component.createError;

    expect(networkErrorMessage).toBeTruthy();
    expect(networkErrorMessage).not.toBe(badRequestMessage);
    expect(component.form.controls.name.value).toBe('Nubank');
    expect(component.creditCards.length).toBe(0);
  });

  // --- Casos de borda ---

  it('caso de borda: campo "brand" oferece exatamente os 5 valores do contrato, na ordem certa, com rotulos PT-BR', () => {
    fixture.detectChanges();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#brand');
    expect(select.tagName).toBe('SELECT');
    expect(component.cardBrands).toEqual([
      CardBrand.Visa,
      CardBrand.Mastercard,
      CardBrand.Elo,
      CardBrand.Amex,
      CardBrand.Outro
    ]);

    const labels = Array.from(select.options).map((o) => o.textContent?.trim());
    expect(labels).toEqual(['Selecione', 'Visa', 'Mastercard', 'Elo', 'Amex', 'Outro']);
  });

  it('caso de borda: creditCardId e tratado como numero, nao string, no trackBy/renderizacao', () => {
    setupWithList([nubankCard]);

    expect(typeof component.creditCards[0].creditCardId).toBe('number');
  });

  it('caso de borda: brand invalido no envio (valor null) segue sendo bloqueado - nunca envia string', () => {
    fixture.detectChanges();
    fillRequiredFields({ brand: null });

    submitCreateForm();

    expect(creditCardServiceSpy.create).not.toHaveBeenCalled();
  });
});
