import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { TransactionService } from './transaction.service';
import { TransactionRequest, TransactionResponse, TransactionResponseList } from '../models/transaction.model';
import { PaymentMethod, TransactionType } from '../models/enums.model';

describe('TransactionService', () => {
  let service: TransactionService;
  let httpMock: HttpTestingController;

  const transactionResponse: TransactionResponse = {
    transactionId: 1,
    transactionName: 'Salário',
    value: 5000,
    type: TransactionType.Entrada
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(TransactionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('criterio 1: getAll envia GET para /api/transaction e retorna TransactionResponseList', () => {
    const responseList: TransactionResponseList = { transactionResponses: [transactionResponse] };

    service.getAll().subscribe((res) => {
      expect(res).toEqual(responseList);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/transaction`);
    expect(req.request.method).toBe('GET');
    req.flush(responseList);
  });

  it('criterio 2: getAll retorna TransactionResponseList vazio (estado vazio)', () => {
    const responseList: TransactionResponseList = { transactionResponses: [] };

    service.getAll().subscribe((res) => {
      expect(res.transactionResponses).toEqual([]);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/transaction`);
    req.flush(responseList);
  });

  it('criterio 3: getAll propaga erro de rede (sem status HTTP)', () => {
    service.getAll().subscribe({
      next: () => fail('nao deveria emitir sucesso'),
      error: (err) => expect(err.status).toBe(0)
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/transaction`);
    req.error(new ProgressEvent('error'), { status: 0 });
  });

  it('criterio 4: create envia POST para /api/transaction com o TransactionRequest informado (somente obrigatorios)', () => {
    const request: TransactionRequest = { transactionName: 'Salário', value: 5000, type: TransactionType.Entrada };

    service.create(request).subscribe((res) => {
      expect(res).toEqual(transactionResponse);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/transaction`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(transactionResponse);
  });

  it('criterio 5: create envia POST com campos opcionais quando informados', () => {
    const request: TransactionRequest = {
      transactionName: 'Mercado',
      value: 150,
      type: TransactionType.Saida,
      paymentMethod: PaymentMethod.Pix,
      transactionDate: '2026-08-03'
    };

    service.create(request).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/transaction`);
    expect(req.request.body).toEqual(request);
    req.flush({ ...transactionResponse, ...request });
  });

  it('criterio 11: create propaga erro 400 da API', () => {
    const request: TransactionRequest = { transactionName: 'Salário', value: 5000, type: TransactionType.Entrada };

    service.create(request).subscribe({
      next: () => fail('nao deveria emitir sucesso'),
      error: (err) => expect(err.status).toBe(400)
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/transaction`);
    req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });
  });

  it('criterio 12: create propaga erro de rede (sem status HTTP)', () => {
    const request: TransactionRequest = { transactionName: 'Salário', value: 5000, type: TransactionType.Entrada };

    service.create(request).subscribe({
      next: () => fail('nao deveria emitir sucesso'),
      error: (err) => expect(err.status).toBe(0)
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/transaction`);
    req.error(new ProgressEvent('error'), { status: 0 });
  });
});
