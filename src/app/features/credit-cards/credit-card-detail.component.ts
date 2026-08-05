// Tela de detalhe de um cartao de credito: compra (POST /api/creditcard/{id}/purchases)
// e fatura (GET /api/creditcard/{id}/fatura), conforme
// docs/specs/mvp-5-compras-cartao-fatura.md. Autenticacao ja e tratada pelo
// auth.interceptor.ts entregue no MVP-1. Acessada via link "Ver fatura" adicionado
// a cada item da listagem em credit-cards.component.html (rota credit-cards/:creditCardId).

import { Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CurrencyPipe, DatePipe } from '@angular/common';

import { CreditCardService } from '../../core/services/credit-card.service';
import { CategoryService } from '../../core/services/category.service';
import {
  CreditCardInstallmentResponse,
  CreditCardInvoiceResponse,
  CreditCardPurchaseRequest,
  CreditCardResponse
} from '../../core/models/credit-card.model';
import { CategoryResponse } from '../../core/models/category.model';
import { CardBrand } from '../../core/models/enums.model';

const LOAD_INVOICE_ERROR_MESSAGE = 'Não foi possível carregar a fatura. Tente novamente.';
const CREATE_BAD_REQUEST_MESSAGE = 'Não foi possível registrar a compra. Verifique os dados informados.';
const CREATE_CONNECTION_ERROR_MESSAGE = 'Erro de conexão. Tente novamente.';

const MIN_INSTALLMENTS = 1;
const MAX_INSTALLMENTS = 48;

// Mesmo mapeamento (strings PT-BR exatas) ja existente em credit-cards.component.ts -
// duplicado aqui deliberadamente (ver spec UX-6, "Abordagem tecnica", item 2: nenhum
// ticket anterior extraiu constantes TS compartilhadas entre componentes).
const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  [CardBrand.Visa]: 'Visa',
  [CardBrand.Mastercard]: 'Mastercard',
  [CardBrand.Elo]: 'Elo',
  [CardBrand.Amex]: 'Amex',
  [CardBrand.Outro]: 'Outro'
};

// Valida totalValue > 0 (criterio 6). Controle vazio e responsabilidade do Validators.required.
function positiveValueValidator(control: AbstractControl): ValidationErrors | null {
  const raw = control.value;
  if (raw === null || raw === '') {
    return null;
  }
  const num = Number(raw);
  if (isNaN(num)) {
    return { notANumber: true };
  }
  if (num <= 0) {
    return { notPositive: true };
  }
  return null;
}

// Valida installmentsCount entre 1 e 48 quando preenchido (criterio 7). Campo e opcional -
// vazio nao e erro, ja que nao ha Validators.required neste controle.
function installmentsCountRangeValidator(control: AbstractControl): ValidationErrors | null {
  const raw = control.value;
  if (raw === null || raw === '') {
    return null;
  }
  const num = Number(raw);
  if (isNaN(num)) {
    return { notANumber: true };
  }
  if (num < MIN_INSTALLMENTS || num > MAX_INSTALLMENTS) {
    return { outOfRange: true };
  }
  return null;
}

@Component({
  selector: 'app-credit-card-detail',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './credit-card-detail.component.html',
  styleUrl: './credit-card-detail.component.scss'
})
export class CreditCardDetailComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly creditCardService = inject(CreditCardService);
  private readonly categoryService = inject(CategoryService);

  // creditCardId vem de um parametro de rota Angular (sempre string) - convertido
  // explicitamente para number aqui, nunca deixado como string bruta (ver spec, casos de borda).
  readonly creditCardId = Number(this.route.snapshot.paramMap.get('creditCardId'));

  readonly cardBrandLabels = CARD_BRAND_LABELS;

  // Identificacao do cartao exibida no titulo (UX-6, achado #2). Obtida via getAll()
  // (nao existe endpoint singular no contrato) + filtro client-side por creditCardId -
  // ver loadCreditCard(). Permanece null se nao encontrado ou se a chamada falhar
  // (fallback silencioso para o titulo generico "Fatura").
  creditCard: CreditCardResponse | null = null;

  invoice: CreditCardInvoiceResponse | null = null;
  isLoadingInvoice = true;
  invoiceError: string | null = null;

  createError: string | null = null;

  categories: CategoryResponse[] = [];

  readonly form = this.fb.group({
    description: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(100)]),
    totalValue: this.fb.nonNullable.control('', [Validators.required, positiveValueValidator]),
    purchaseDate: this.fb.nonNullable.control(''),
    installmentsCount: this.fb.nonNullable.control('', installmentsCountRangeValidator),
    categoryId: this.fb.control<number | null>(null),
    isSubscription: this.fb.nonNullable.control(false)
  });

  ngOnInit(): void {
    this.loadInvoice();
    this.loadCategories();
    this.loadCreditCard();
  }

  // Chamada de rede independente da listagem de CreditCardsComponent (sem cache/estado
  // compartilhado, mesmo padrao ja aceito para CategoryService.getAll() - ver spec UX-6).
  // Falha ou cartao nao encontrado (find() retorna undefined) sao tratados de forma nao
  // bloqueante e silenciosa: creditCard permanece null e o titulo cai no fallback generico.
  loadCreditCard(): void {
    this.creditCardService.getAll().subscribe({
      next: (response) => {
        this.creditCard = response.creditCardResponses.find((c) => c.creditCardId === this.creditCardId) ?? null;
      },
      error: () => {
        // Falha silenciosa, ver comentario acima.
      }
    });
  }

  brandLabel(creditCard: CreditCardResponse): string {
    return this.cardBrandLabels[creditCard.brand];
  }

  // Sem month/year, o backend usa o default (mes/ano atual) - criterio 11. Com month/year
  // explicitos, substitui a fatura exibida (navegacao - criterios 14/15) ou a recarrega
  // apos uma compra (criterios 1/2).
  loadInvoice(month?: number, year?: number): void {
    this.isLoadingInvoice = true;
    this.invoiceError = null;

    this.creditCardService.getInvoice(this.creditCardId, month, year).subscribe({
      next: (response) => {
        this.invoice = response;
        this.isLoadingInvoice = false;
      },
      error: () => {
        // 401/erro de rede/qualquer falha: mesma mensagem generica de carregamento
        // (criterio 13/16) - a fatura anterior (se houver) continua sendo a referencia
        // para a proxima tentativa de navegacao (caso de borda).
        this.invoiceError = LOAD_INVOICE_ERROR_MESSAGE;
        this.isLoadingInvoice = false;
      }
    });
  }

  // Falha silenciosa (sem estado de erro dedicado): se GET /api/category falhar, o select
  // de categoria do formulario de compra fica apenas sem opcoes, sem travar a tela
  // (mesmo padrao ja adotado em transactions.component.ts, MVP-6).
  loadCategories(): void {
    this.categoryService.getAll().subscribe({
      next: (response) => {
        this.categories = response.categoryResponses;
      },
      error: () => {
        // Falha silenciosa, ver comentario acima.
      }
    });
  }

  previousMonth(): void {
    if (!this.invoice) {
      return;
    }
    const { month, year } = this.shiftMonth(this.invoice.invoiceMonth, this.invoice.invoiceYear, -1);
    this.loadInvoice(month, year);
  }

  nextMonth(): void {
    if (!this.invoice) {
      return;
    }
    const { month, year } = this.shiftMonth(this.invoice.invoiceMonth, this.invoice.invoiceYear, 1);
    this.loadInvoice(month, year);
  }

  // Calcula o mes/ano seguinte (delta=1) ou anterior (delta=-1) a partir de invoiceMonth/
  // invoiceYear da ultima resposta, com rollover de ano (criterios 14/15).
  private shiftMonth(month: number, year: number, delta: number): { month: number; year: number } {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    return { month: newMonth, year: newYear };
  }

  // Notacao "installmentNumber/installmentsCount" (ex.: "3/12") para cada linha da fatura
  // (decisao de escopo 2) - sem agrupamento de parcelas da mesma compra.
  installmentLabel(installment: CreditCardInstallmentResponse): string {
    return `${installment.installmentNumber}/${installment.installmentsCount}`;
  }

  onSubmit(): void {
    this.createError = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildRequest();

    this.creditCardService.createPurchase(this.creditCardId, payload).subscribe({
      next: () => {
        // Resposta e um unico CreditCardInstallmentResponse (mesmo com installmentsCount
        // > 1) - nunca usada como lista completa das parcelas criadas (criterio 10). A
        // lista exibida vem exclusivamente do proximo GET da fatura abaixo.
        this.form.reset({
          description: '',
          totalValue: '',
          purchaseDate: '',
          installmentsCount: '',
          categoryId: null,
          isSubscription: false
        });
        this.loadInvoice(this.invoice?.invoiceMonth, this.invoice?.invoiceYear);
      },
      error: (err: HttpErrorResponse) => {
        // 401/erro de rede caem no mesmo ramo que 400≠status (criterio 16) - so 400 tem
        // mensagem propria (criterio 8), o resto usa a mensagem generica de conexao (criterio 9).
        this.createError = err.status === 400 ? CREATE_BAD_REQUEST_MESSAGE : CREATE_CONNECTION_ERROR_MESSAGE;
      }
    });
  }

  private buildRequest(): CreditCardPurchaseRequest {
    const raw = this.form.getRawValue();

    const request: CreditCardPurchaseRequest = {
      description: raw.description,
      totalValue: Number(raw.totalValue),
      isSubscription: raw.isSubscription
    };

    if (raw.purchaseDate) {
      request.purchaseDate = raw.purchaseDate;
    }
    if (raw.installmentsCount) {
      request.installmentsCount = Number(raw.installmentsCount);
    }
    if (raw.categoryId !== null) {
      request.categoryId = raw.categoryId;
    }

    return request;
  }
}
