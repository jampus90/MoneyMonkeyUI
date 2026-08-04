import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { CreditCardService } from './credit-card.service';
import { CreditCardRequest, CreditCardResponse, CreditCardResponseList } from '../models/credit-card.model';
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
});
