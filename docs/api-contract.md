# MoneyMonkey API — Contrato

> Fonte da verdade para PO, Dev e QA. Não inferir/inventar endpoints, campos ou enums fora do que está aqui.
> Se o contrato real (Swagger) divergir deste documento, este documento deve ser atualizado primeiro — nenhum código é escrito contra um contrato desatualizado.

## Ambiente

- Base URL (http): `http://localhost:5217`
- Base URL (https): `https://localhost:7002`
- Swagger: `/swagger`
- Repositório: MoneyMonkey API (ASP.NET Core 8), repositório separado deste frontend.

## Autenticação

- JWT Bearer.
- `POST /api/auth/login` retorna o token.
- Todas as rotas exigem header `Authorization: Bearer <token>`, **exceto**:
  - `POST /api/auth/login`
  - `POST /api/user` (cadastro de usuário)

## Bloqueio conhecido (dependência externa)

⚠️ A API **não tem CORS configurado** hoje. Isso impede o frontend Angular (origem diferente) de consumir a API diretamente em dev/prod até que o backend habilite CORS. Este é um item de backlog do lado do backend — **não deve ser contornado no frontend** (ex.: proxies gambiarra, disable de segurança do browser, etc.). Rastrear como dependência bloqueante no board.

---

## Auth

### `POST /api/auth/login`
Sem autenticação.

**Request** `LoginRequest`
```ts
{
  username: string;
  password: string;
}
```

**Response 200** `LoginResponse`
```ts
{
  token: string;
  expiresAt: string; // date-time
  userId: number;     // int64
  firstName: string;
  lastName: string;
  userType: UserType;
}
```

**Response 401**: credenciais inválidas (sem corpo tipado assumido — tratar como erro genérico de autenticação).

---

## Users

### `POST /api/user`
Sem autenticação. Cadastro de usuário.

**Request** `UserRequest`
```ts
{
  firstName: string;
  lastName: string;
  userType: UserType;
  username: string;
  password: string;
}
```

**Response 200** `UserResponse`
```ts
{
  userId: number;     // int64
  firstName: string;
  lastName: string;
  userType: UserType;
}
```

### `GET /api/user` [auth]

**Response 200** `UserResponseList`
```ts
{
  userResponses: UserResponse[];
}
```

---

## Categories

### `GET /api/category` [auth]

**Response 200** `CategoryResponseList`
```ts
{
  categoryResponses: CategoryResponse[];
}
```

### `POST /api/category` [auth]

**Request** `CategoryRequest`
```ts
{
  name: string;       // max 50
  type: TransactionType;
}
```

**Response 200** `CategoryResponse`
```ts
{
  categoryId: number;  // int32
  name: string;
  type: TransactionType;
}
```

---

## Transactions

### `GET /api/transaction` [auth]

**Response 200** `TransactionResponseList`
```ts
{
  transactionResponses: TransactionResponse[];
}
```

### `POST /api/transaction` [auth]

**Request** `TransactionRequest`
```ts
{
  transactionName: string;          // max 100
  value: number;                    // > 0.01
  type: TransactionType;
  paymentMethod?: PaymentMethod;
  categoryId?: number;              // int32, opcional
  transactionDate?: string;         // date, opcional
}
```

**Response 200** `TransactionResponse`
```ts
{
  transactionId: number;            // int32
  transactionName: string;
  value: number;
  type: TransactionType;
  paymentMethod?: PaymentMethod;
  categoryId?: number;              // int32
  transactionDate?: string;
}
```

**Response 400**: quando `categoryId` não pertence ao usuário autenticado.

---

## Credit Cards

> Fluxo paralelo a Transactions — compras de cartão de crédito **não** criam `Transaction`. Elas vivem em `CreditCardPurchase` / `CreditCardInstallment` e aparecem via fatura (`fatura`).

### `GET /api/creditcard` [auth]

**Response 200** `CreditCardResponseList`
```ts
{
  creditCardResponses: CreditCardResponse[];
}
```

### `POST /api/creditcard` [auth]

**Request** `CreditCardRequest`
```ts
{
  name: string;            // max 50
  brand: CardBrand;
  lastFourDigits: string;  // exatamente 4 caracteres
  closingDay: number;      // 1-28
  dueDay: number;          // 1-28
  creditLimit?: number;
}
```

**Response 200** `CreditCardResponse`
```ts
{
  creditCardId: number;  // int32
  name: string;
  brand: CardBrand;
  lastFourDigits: string;
  closingDay: number;
  dueDay: number;
  creditLimit?: number;
}
```

### `POST /api/creditcard/{creditCardId}/purchases` [auth]

**Request** `CreditCardPurchaseRequest`
```ts
{
  description: string;       // max 100
  totalValue: number;        // > 0.01
  purchaseDate?: string;     // date, opcional
  installmentsCount?: number; // 1-48, opcional
  categoryId?: number;       // int32, opcional
  isSubscription: boolean;   // default false
}
```

**Response 200** `CreditCardInstallmentResponse` (ver formato abaixo em Fatura)

**Response 400**: quando o cartão ou a categoria não pertencem ao usuário autenticado.

### `GET /api/creditcard/{creditCardId}/fatura?month=&year=` [auth]

`month` e `year` são **opcionais** — default é mês/ano atual.

**Response 200** `CreditCardInvoiceResponse`
```ts
{
  creditCardId: number;      // int32
  invoiceMonth: number;
  invoiceYear: number;
  dueDate: string;           // date
  totalValue: number;
  installments: CreditCardInstallmentResponse[];
}
```

`CreditCardInstallmentResponse`
```ts
{
  creditCardInstallmentId: number; // int32
  description: string;
  categoryId?: number;             // int32
  isSubscription: boolean;
  installmentNumber: number;
  installmentsCount: number;
  value: number;
  purchaseDate: string;      // date
}
```

---

## Enums

> **Correção 2026-08-03**: trafegam como **número (int)** no JSON, não como string — a versão anterior deste documento estava incorreta e causou uma rejeição 400 real da API (`type: "Entrada"` não é aceito, só `type: 0`). Confirmado via `/swagger/v1/swagger.json` (schemas só trazem os inteiros, sem nomes) e por chamadas reais ao endpoint. O mapeamento nome↔número abaixo segue a ordem de declaração do documento original, que corresponde à ordem padrão de enum do C# (primeiro membro = 0); `UserType.Pf = 0` foi confirmado batendo com o retorno real de `POST /api/auth/login` para um usuário pessoa física de teste.

```ts
enum TransactionType {
  Entrada = 0,
  Saida = 1,
}

enum PaymentMethod {
  Pix = 0,
  Dinheiro = 1,
  CartaoCredito = 2,
  CartaoDebito = 3,
  Boleto = 4,
  Transferencia = 5,
  Outro = 6,
}

enum CardBrand {
  Visa = 0,
  Mastercard = 1,
  Elo = 2,
  Amex = 3,
  Outro = 4,
}

enum UserType {
  Pf = 0,
  Pj = 1,
  Staff = 2,
  Admin = 3,
}
```

Todo campo `*Id` (`userId`, `categoryId`, `transactionId`, `creditCardId`, `creditCardInstallmentId`) também trafega como **número** (`int32`, exceto `userId` que é `int64`), não como string — mesma correção, mesma causa raiz (o contrato original assumiu tipos que a API real não usa).

---

## Modelos TypeScript equivalentes

Os tipos acima devem ser espelhados em `src/app/core/models/` (um arquivo por domínio: `auth.model.ts`, `user.model.ts`, `category.model.ts`, `transaction.model.ts`, `credit-card.model.ts`, `enums.model.ts`). Specs do PO referenciam este documento pelos nomes de DTO acima; o Dev implementa os `interface`/`type` exatamente com esses nomes e campos — sem adicionar, renomear ou remover campos sem atualizar este contrato primeiro.
