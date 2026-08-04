import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';

import { CategoriesComponent } from './categories.component';
import { CategoryService } from '../../core/services/category.service';
import { CategoryResponse } from '../../core/models/category.model';
import { TransactionType } from '../../core/models/enums.model';

describe('CategoriesComponent', () => {
  let fixture: ComponentFixture<CategoriesComponent>;
  let component: CategoriesComponent;
  let categoryServiceSpy: jasmine.SpyObj<CategoryService>;

  const salaryCategory: CategoryResponse = {
    categoryId: 1,
    name: 'Salário',
    type: TransactionType.Entrada
  };

  const marketCategory: CategoryResponse = {
    categoryId: 2,
    name: 'Mercado',
    type: TransactionType.Saida
  };

  function setupWithList(response: CategoryResponse[]) {
    categoryServiceSpy.getAll.and.returnValue(of({ categoryResponses: response }));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    categoryServiceSpy = jasmine.createSpyObj('CategoryService', ['getAll', 'create']);
    categoryServiceSpy.getAll.and.returnValue(of({ categoryResponses: [] }));

    await TestBed.configureTestingModule({
      imports: [CategoriesComponent],
      providers: [{ provide: CategoryService, useValue: categoryServiceSpy }]
    }).compileComponents();

    fixture = TestBed.createComponent(CategoriesComponent);
    component = fixture.componentInstance;
  });

  function rowsText(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.category-item')).map(
      (el) => (el as HTMLElement).textContent ?? ''
    );
  }

  function fillRequiredFields(name: string, type: TransactionType | null): void {
    component.form.controls.name.setValue(name);
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

  it('criterio 1: listagem com sucesso renderiza uma linha por CategoryResponse com nome e indicacao de tipo', () => {
    setupWithList([salaryCategory, marketCategory]);

    expect(categoryServiceSpy.getAll).toHaveBeenCalled();
    expect(component.categories).toEqual([salaryCategory, marketCategory]);

    const rows = rowsText();
    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('Salário');
    expect(rows[0]).toContain('Entrada');
    expect(rows[1]).toContain('Mercado');
    expect(rows[1]).toContain('Saída');
  });

  it('criterio 2: estado vazio exibe mensagem dedicada, sem linhas e sem erro', () => {
    setupWithList([]);

    expect(component.categories).toEqual([]);
    expect(rowsText().length).toBe(0);
    expect(component.listError).toBeNull();

    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('Nenhuma categoria cadastrada');
  });

  it('criterio 3: erro de rede ao carregar exibe mensagem de erro distinta do estado vazio', () => {
    categoryServiceSpy.getAll.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );

    fixture.detectChanges();

    expect(component.listError).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeFalsy();
    expect(rowsText().length).toBe(0);

    const listErrorEl = fixture.nativeElement.querySelector('.list-error');
    expect(listErrorEl).toBeTruthy();
  });

  // --- UX-1: Loading state ---

  it('UX-1 criterio 1: exibe indicador de carregamento enquanto isLoadingList=true e lista vazia', () => {
    const subject = new Subject<{ categoryResponses: CategoryResponse[] }>();
    categoryServiceSpy.getAll.and.returnValue(subject);

    fixture.detectChanges();

    expect(component.isLoadingList).toBeTrue();
    expect(component.categories.length).toBe(0);

    const loadingEl = fixture.nativeElement.querySelector('.loading-state');
    expect(loadingEl).toBeTruthy();
    expect(loadingEl.textContent).toContain('Carregando');
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.list-error')).toBeFalsy();
    expect(rowsText().length).toBe(0);
  });

  it('UX-1 criterio 2: indicador de carregamento desaparece quando a lista carrega com itens', () => {
    const subject = new Subject<{ categoryResponses: CategoryResponse[] }>();
    categoryServiceSpy.getAll.and.returnValue(subject);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-state')).toBeTruthy();

    subject.next({ categoryResponses: [salaryCategory, marketCategory] });
    subject.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-state')).toBeFalsy();
    expect(rowsText().length).toBe(2);
  });

  it('UX-1 criterio 3: indicador de carregamento desaparece quando a lista carrega vazia (estado vazio real)', () => {
    const subject = new Subject<{ categoryResponses: CategoryResponse[] }>();
    categoryServiceSpy.getAll.and.returnValue(subject);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-state')).toBeTruthy();

    subject.next({ categoryResponses: [] });
    subject.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-state')).toBeFalsy();
    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
  });

  it('UX-1 criterio 4: indicador de carregamento desaparece quando ocorre erro ao carregar', () => {
    const subject = new Subject<{ categoryResponses: CategoryResponse[] }>();
    categoryServiceSpy.getAll.and.returnValue(subject);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-state')).toBeTruthy();

    subject.error(new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-state')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.list-error')).toBeTruthy();
  });

  it('UX-1 caso de borda: ordem de precedencia - loading tem prioridade sobre erro no template, mesmo que ambos estejam truthy simultaneamente', () => {
    // Este cenario nao ocorre na implementacao atual de loadCategories() (isLoadingList e listError
    // nunca sao truthy ao mesmo tempo), mas a spec exige que a ordem de checagem no template coloque
    // isLoadingList antes de listError para ser a prova de futuras mudancas no componente.
    fixture.detectChanges();

    component.isLoadingList = true;
    component.listError = 'Erro forcado para teste de precedencia';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-state')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.list-error')).toBeFalsy();
  });

  // --- Criacao ---

  it('criterio 4: criacao com sucesso envia CategoryRequest com type numerico, atualiza listagem e reseta formulario', () => {
    fixture.detectChanges();
    categoryServiceSpy.create.and.returnValue(of(salaryCategory));

    fillRequiredFields('Salário', TransactionType.Entrada);
    submitCreateForm();

    expect(categoryServiceSpy.create).toHaveBeenCalledWith({
      name: 'Salário',
      type: TransactionType.Entrada
    });
    const sentPayload = categoryServiceSpy.create.calls.mostRecent().args[0];
    expect(typeof sentPayload.type).toBe('number');

    expect(component.categories).toContain(salaryCategory);
    expect(component.createError).toBeNull();
    expect(component.form.controls.name.value).toBe('');
    expect(component.form.controls.type.value).toBeNull();
  });

  it('criterio 5: name vazio bloqueia envio e marca campo obrigatorio', () => {
    fixture.detectChanges();
    fillRequiredFields('', TransactionType.Entrada);

    submitCreateForm();

    expect(categoryServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.name.hasError('required')).toBeTrue();
  });

  it('criterio 6: name acima de 50 caracteres bloqueia envio e indica excesso de limite', () => {
    fixture.detectChanges();
    const longName = 'a'.repeat(51);
    fillRequiredFields(longName, TransactionType.Entrada);

    submitCreateForm();

    expect(categoryServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.name.hasError('maxlength')).toBeTrue();
  });

  it('criterio 7: type nao selecionado bloqueia envio e marca campo obrigatorio', () => {
    fixture.detectChanges();
    fillRequiredFields('Salário', null);

    submitCreateForm();

    expect(categoryServiceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.type.hasError('required')).toBeTrue();
  });

  it('criterio 8: erro 400 ao criar exibe mensagem generica, mantem formulario preenchido e nao adiciona a listagem', () => {
    fixture.detectChanges();
    categoryServiceSpy.create.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }))
    );

    fillRequiredFields('Salário', TransactionType.Entrada);
    submitCreateForm();

    expect(component.createError).toBeTruthy();
    expect(component.form.controls.name.value).toBe('Salário');
    expect(component.form.controls.type.value).toBe(TransactionType.Entrada);
    expect(component.categories.length).toBe(0);
  });

  it('criterio 9: erro de rede ao criar exibe mensagem de conexao distinta do erro 400 e mantem formulario', () => {
    fixture.detectChanges();
    categoryServiceSpy.create.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );

    fillRequiredFields('Salário', TransactionType.Entrada);
    submitCreateForm();
    const networkErrorMessage = component.createError;

    categoryServiceSpy.create.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }))
    );
    submitCreateForm();
    const badRequestMessage = component.createError;

    expect(networkErrorMessage).toBeTruthy();
    expect(networkErrorMessage).not.toBe(badRequestMessage);
    expect(component.form.controls.name.value).toBe('Salário');
    expect(component.categories.length).toBe(0);
  });

  it('caso de borda: campo "type" oferece exatamente os valores do contrato (Entrada=0, Saida=1), na ordem certa', () => {
    fixture.detectChanges();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#type');
    expect(select.tagName).toBe('SELECT');
    expect(component.transactionTypes).toEqual([TransactionType.Entrada, TransactionType.Saida]);

    const labels = Array.from(select.options).map((o) => o.textContent?.trim());
    expect(labels).toEqual(['Selecione', 'Entrada', 'Saída']);
  });

  it('caso de borda: categoryId e tratado como numero, nao string, no trackBy/renderizacao', () => {
    setupWithList([salaryCategory]);

    expect(typeof component.categories[0].categoryId).toBe('number');
  });
});
