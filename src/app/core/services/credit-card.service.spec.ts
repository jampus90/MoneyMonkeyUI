import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { CreditCardService } from './credit-card.service';
import {
  CreditCardInstallmentResponse,
  CreditCardInvoiceResponse,
  CreditCardPurchaseRequest,
  CreditCardRequest,
  CreditCardResponse,
  CreditCardResponseList
} from '../models/credit-card.model';
import { CardBrand } from '../models/enums.model';

describe('CreditCardService', () => {
  let service: CreditCardService;
  let httpMock: HttpTestingController;

  const creditCardResponse: CreditCardResponse = {
    creditCardId: 1,
    name: 'Nubank',
    brand: CardBrand.Mastercard,
    lastFourDigits: '1234',
    closingDay: 10,
    dueDay: 17,
    creditLimit: 5000
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(CreditCardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('criterio 1: getAll envia GET para /api/creditcard e retorna CreditCardResponseList', () => {
    const responseList: CreditCardResponseList = { creditCardResponses: [creditCardResponse] };

    service.getAll().subscribe((res) => {
      expect(res).toEqual(responseList);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/creditcard`);
    expect(req.request.method).toBe('GET');
    req.flush(responseList);
  });

  it('criterio 2: getAll retorna CreditCardResponseList vazio (estado vazio)', () => {
    const responseList: CreditCardResponseList = { creditCardResponses: [] };

    service.getAll().subscribe((res) => {
      expect(res.creditCardResponses).toEqual([]);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/creditcard`);
    req.flush(responseList);
  });

  it('criterio 3: getAll propaga erro de rede (sem status HTTP)', () => {
    service.getAll().subscribe({
      next: () => fail('nao deveria emitir sucesso'),
      error: (err) => expect(err.status).toBe(0)
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/creditcard`);
    req.error(new ProgressEvent('error'), { status: 0 });
  });

  it('criterio 4: create envia POST para /api/creditcard com CreditCardRequest, brand numerico, incluindo creditLimit', () => {
    const request: CreditCardRequest = {
      name: 'Nubank',
      brand: CardBrand.Mastercard,
      lastFourDigits: '1234',
      closingDay: 10,
      dueDay: 17,
      creditLimit: 5000
    };

    service.create(request).subscribe((res) => {
      expect(res).toEqual(creditCardResponse);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/creditcard`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect(typeof req.request.body.brand).toBe('number');
    req.flush(creditCardResponse);
  });

  it('criterio 5: create envia POST sem a chave creditLimit quando omitida do request', () => {
    const request: CreditCardRequest = {
      name: 'Nubank',
      brand: CardBrand.Visa,
      lastFourDigits: '1234',
      closingDay: 10,
      dueDay: 17
    };

    service.create(request).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/creditcard`);
    expect('creditLimit' in req.request.body).toBeFalse();
    req.flush({ ...creditCardResponse, brand: CardBrand.Visa, creditLimit: undefined });
  });

  it('criterio 13: create propaga erro 400 da API', () => {
    const request: CreditCardRequest = {
      name: 'Nubank',
      brand: CardBrand.Visa,
      lastFourDigits: '1234',
      closingDay: 10,
      dueDay: 17
    };

    service.create(request).subscribe({
      next: () => fail('nao deveria emitir sucesso'),
      error: (err) => expect(err.status).toBe(400)
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/creditcard`);
    req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });
  });

  it('criterio 14: create propaga erro de rede (sem status HTTP)', () => {
    const request: CreditCardRequest = {
      name: 'Nubank',
      brand: CardBrand.Visa,
      lastFourDigits: '1234',
      closingDay: 10,
      dueDay: 17
    };

    service.create(request).subscribe({
      next: () => fail('nao deveria emitir sucesso'),
      error: (err) => expect(err.status).toBe(0)
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/creditcard`);
    req.error(new ProgressEvent('error'), { status: 0 });
  });

  // --- Compras/Fatura (MVP-5) ---

  const installmentResponse: CreditCardInstallmentResponse = {
    creditCardInstallmentId: 10,
    description: 'Notebook',
    categoryId: 3,
    isSubscription: false,
    installmentNumber: 1,
    installmentsCount: 3,
    value: 100,
    purchaseDate: '2026-08-04'
  };

  it('MVP-5 criterio 1: createPurchase envia POST para /api/creditcard/{id}/purchases com o CreditCardPurchaseRequest informado', () => {
    const request: CreditCardPurchaseRequest = {
      description: 'Notebook',
      totalValue: 300,
      purchaseDate: '2026-08-04',
      installmentsCount: 3,
      categoryId: 3,
      isSubscription: true
    };

    service.createPurchase(1, request).subscribe((res) => {
      expect(res).toEqual(installmentResponse);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/creditcard/1/purchases`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(installmentResponse);
  });

  it('MVP-5 criterio 8: createPurchase propaga erro 400 da API', () => {
    const request: CreditCardPurchaseRequest = {
      description: 'Notebook',
      totalValue: 300,
      isSubscription: false
    };

    service.createPurchase(1, request).subscribe({
      next: () => fail('nao deveria emitir sucesso'),
      error: (err) => expect(err.status).toBe(400)
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/creditcard/1/purchases`);
    req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });
  });

  it('MVP-5 criterio 9: createPurchase propaga erro de rede (sem status HTTP)', () => {
    const request: CreditCardPurchaseRequest = {
      description: 'Notebook',
      totalValue: 300,
      isSubscription: false
    };

    service.createPurchase(1, request).subscribe({
      next: () => fail('nao deveria emitir sucesso'),
      error: (err) => expect(err.status).toBe(0)
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/creditcard/1/purchases`);
    req.error(new ProgressEvent('error'), { status: 0 });
  });

  const invoiceResponse: CreditCardInvoiceResponse = {
    creditCardId: 1,
    invoiceMonth: 8,
    invoiceYear: 2026,
    dueDate: '2026-08-17',
    totalValue: 300,
    installments: [installmentResponse]
  };

  it('MVP-5 criterio 11: getInvoice sem month/year envia GET para /api/creditcard/{id}/fatura sem query params', () => {
    service.getInvoice(1).subscribe((res) => {
      expect(res).toEqual(invoiceResponse);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/creditcard/1/fatura`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush(invoiceResponse);
  });

  it('MVP-5 criterio 14: getInvoice com month/year envia esses valores como query params numericos', () => {
    service.getInvoice(1, 12, 2025).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/creditcard/1/fatura?month=12&year=2025`);
    expect(req.request.params.get('month')).toBe('12');
    expect(req.request.params.get('year')).toBe('2025');
    req.flush({ ...invoiceResponse, invoiceMonth: 12, invoiceYear: 2025 });
  });

  it('MVP-5 criterio 13: getInvoice propaga erro de rede (sem status HTTP)', () => {
    service.getInvoice(1).subscribe({
      next: () => fail('nao deveria emitir sucesso'),
      error: (err) => expect(err.status).toBe(0)
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/creditcard/1/fatura`);
    req.error(new ProgressEvent('error'), { status: 0 });
  });
});
