// Tela de cartoes de credito: listagem (GET /api/creditcard) e criacao (POST /api/creditcard),
// conforme docs/specs/mvp-4-cartoes-credito.md. Autenticacao ja e tratada pelo
// auth.interceptor.ts entregue no MVP-1.

import { Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { CreditCardService } from '../../core/services/credit-card.service';
import { CreditCardRequest, CreditCardResponse } from '../../core/models/credit-card.model';
import { CardBrand } from '../../core/models/enums.model';

const LOAD_ERROR_MESSAGE = 'Não foi possível carregar os cartões de crédito. Tente novamente.';
const CREATE_BAD_REQUEST_MESSAGE = 'Não foi possível salvar o cartão. Verifique os dados informados.';
const CREATE_CONNECTION_ERROR_MESSAGE = 'Erro de conexão. Tente novamente.';

const CARD_BRANDS: CardBrand[] = [
  CardBrand.Visa,
  CardBrand.Mastercard,
  CardBrand.Elo,
  CardBrand.Amex,
  CardBrand.Outro
];

const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  [CardBrand.Visa]: 'Visa',
  [CardBrand.Mastercard]: 'Mastercard',
  [CardBrand.Elo]: 'Elo',
  [CardBrand.Amex]: 'Amex',
  [CardBrand.Outro]: 'Outro'
};

const MIN_DAY = 1;
const MAX_DAY = 28;
const LAST_FOUR_DIGITS_LENGTH = 4;

// Valida que lastFourDigits tem exatamente 4 caracteres (criterio 9) e, quando esse
// tamanho e atingido, que contem somente digitos (criterio 10 - regra adicional do
// frontend, ver spec). Controle vazio e responsabilidade do Validators.required.
function lastFourDigitsValidator(control: AbstractControl): ValidationErrors | null {
  const raw: string = control.value;
  if (!raw) {
    return null;
  }
  if (raw.length !== LAST_FOUR_DIGITS_LENGTH) {
    return { length: true };
  }
  if (!/^\d{4}$/.test(raw)) {
    return { digitsOnly: true };
  }
  return null;
}

// Valida closingDay/dueDay entre 1 e 28 (criterios 11 e 12). Controle vazio e
// responsabilidade do Validators.required.
function dayRangeValidator(control: AbstractControl): ValidationErrors | null {
  const raw = control.value;
  if (raw === null || raw === '') {
    return null;
  }
  const num = Number(raw);
  if (isNaN(num)) {
    return { notANumber: true };
  }
  if (num < MIN_DAY || num > MAX_DAY) {
    return { outOfRange: true };
  }
  return null;
}

@Component({
  selector: 'app-credit-cards',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './credit-cards.component.html',
  styleUrl: './credit-cards.component.scss'
})
export class CreditCardsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly creditCardService = inject(CreditCardService);

  readonly cardBrands = CARD_BRANDS;
  readonly cardBrandLabels = CARD_BRAND_LABELS;

  creditCards: CreditCardResponse[] = [];
  isLoadingList = true;
  listError: string | null = null;

  createError: string | null = null;

  readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(50)]),
    brand: this.fb.control<CardBrand | null>(null, Validators.required),
    lastFourDigits: this.fb.nonNullable.control('', [Validators.required, lastFourDigitsValidator]),
    closingDay: this.fb.nonNullable.control('', [Validators.required, dayRangeValidator]),
    dueDay: this.fb.nonNullable.control('', [Validators.required, dayRangeValidator]),
    creditLimit: this.fb.nonNullable.control('')
  });

  ngOnInit(): void {
    this.loadCreditCards();
  }

  loadCreditCards(): void {
    this.isLoadingList = true;
    this.listError = null;

    this.creditCardService.getAll().subscribe({
      next: (response) => {
        this.creditCards = response.creditCardResponses;
        this.isLoadingList = false;
      },
      error: () => {
        this.listError = LOAD_ERROR_MESSAGE;
        this.isLoadingList = false;
      }
    });
  }

  brandLabel(creditCard: CreditCardResponse): string {
    return this.cardBrandLabels[creditCard.brand];
  }

  onSubmit(): void {
    this.createError = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildRequest();

    this.creditCardService.create(payload).subscribe({
      next: (response) => {
        this.creditCards = [response, ...this.creditCards];
        this.form.reset({ name: '', brand: null, lastFourDigits: '', closingDay: '', dueDay: '', creditLimit: '' });
      },
      error: (err: HttpErrorResponse) => {
        this.createError = err.status === 400 ? CREATE_BAD_REQUEST_MESSAGE : CREATE_CONNECTION_ERROR_MESSAGE;
      }
    });
  }

  private buildRequest(): CreditCardRequest {
    const raw = this.form.getRawValue();

    const request: CreditCardRequest = {
      name: raw.name,
      brand: raw.brand as CardBrand,
      lastFourDigits: raw.lastFourDigits,
      closingDay: Number(raw.closingDay),
      dueDay: Number(raw.dueDay)
    };

    if (raw.creditLimit) {
      request.creditLimit = Number(raw.creditLimit);
    }

    return request;
  }
}
