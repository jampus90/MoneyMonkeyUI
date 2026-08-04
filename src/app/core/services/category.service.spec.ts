import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { CategoryService } from './category.service';
import { CategoryRequest, CategoryResponse, CategoryResponseList } from '../models/category.model';
import { TransactionType } from '../models/enums.model';

describe('CategoryService', () => {
  let service: CategoryService;
  let httpMock: HttpTestingController;

  const categoryResponse: CategoryResponse = {
    categoryId: 1,
    name: 'Salário',
    type: TransactionType.Entrada
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(CategoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('criterio 1: getAll envia GET para /api/category e retorna CategoryResponseList', () => {
    const responseList: CategoryResponseList = { categoryResponses: [categoryResponse] };

    service.getAll().subscribe((res) => {
      expect(res).toEqual(responseList);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/category`);
    expect(req.request.method).toBe('GET');
    req.flush(responseList);
  });

  it('criterio 2: getAll retorna CategoryResponseList vazio (estado vazio)', () => {
    const responseList: CategoryResponseList = { categoryResponses: [] };

    service.getAll().subscribe((res) => {
      expect(res.categoryResponses).toEqual([]);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/category`);
    req.flush(responseList);
  });

  it('criterio 3: getAll propaga erro de rede (sem status HTTP)', () => {
    service.getAll().subscribe({
      next: () => fail('nao deveria emitir sucesso'),
      error: (err) => expect(err.status).toBe(0)
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/category`);
    req.error(new ProgressEvent('error'), { status: 0 });
  });

  it('criterio 4: create envia POST para /api/category com o CategoryRequest informado, com type numerico', () => {
    const request: CategoryRequest = { name: 'Salário', type: TransactionType.Entrada };

    service.create(request).subscribe((res) => {
      expect(res).toEqual(categoryResponse);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/category`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect(typeof req.request.body.type).toBe('number');
    req.flush(categoryResponse);
  });

  it('criterio 8: create propaga erro 400 da API', () => {
    const request: CategoryRequest = { name: 'Salário', type: TransactionType.Entrada };

    service.create(request).subscribe({
      next: () => fail('nao deveria emitir sucesso'),
      error: (err) => expect(err.status).toBe(400)
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/category`);
    req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });
  });

  it('criterio 9: create propaga erro de rede (sem status HTTP)', () => {
    const request: CategoryRequest = { name: 'Salário', type: TransactionType.Entrada };

    service.create(request).subscribe({
      next: () => fail('nao deveria emitir sucesso'),
      error: (err) => expect(err.status).toBe(0)
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/category`);
    req.error(new ProgressEvent('error'), { status: 0 });
  });
});
