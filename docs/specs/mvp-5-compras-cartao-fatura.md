# MVP-5 — Compras no cartão + Fatura

## História de usuário
Como usuário autenticado do MoneyMonkey, quero registrar uma compra em um dos meus cartões de crédito (com valor, descrição, parcelamento opcional e categoria opcional) e consultar a fatura de um cartão (total do mês e a lista de parcelas que a compõem), para que eu possa acompanhar meus gastos no cartão de crédito separadamente das transações comuns.

## Endpoints/DTOs envolvidos
Referência: `docs/api-contract.md` (seção "Credit Cards"). Ambos os endpoints exigem `Authorization: Bearer <token>` (rota `[auth]`) — o token já é anexado automaticamente pelo interceptor entregue no MVP-1 (`auth.interceptor.ts`); este ticket não reimplementa esse mecanismo.

> Nota explícita do contrato (linha 169 de `docs/api-contract.md`): compras de cartão de crédito **não** criam `Transaction`. Elas vivem em `CreditCardPurchase`/`CreditCardInstallment` e só aparecem via fatura. Este ticket não deve, em nenhuma hipótese, chamar `POST /api/transaction` nem exibir uma compra de cartão na tela de Transações (MVP-2).

### `POST /api/creditcard/{creditCardId}/purchases` [auth]

**Request** `CreditCardPurchaseRequest`
```ts
{
  description: string;        // max 100
  totalValue: number;         // > 0.01
  purchaseDate?: string;      // date, opcional
  installmentsCount?: number; // 1-48, opcional
  categoryId?: number;        // int32, opcional
  isSubscription: boolean;    // default false — sem "?", campo obrigatório no payload
}
```

**Response 200** `CreditCardInstallmentResponse` (formato abaixo, mesmo usado dentro da fatura). **Importante**: mesmo quando `installmentsCount` é maior que 1 (compra parcelada em N vezes, criando N registros de `CreditCardInstallment` no backend), a resposta desta chamada é **um único objeto** `CreditCardInstallmentResponse`, não um array — o contrato não define qual das N parcelas é retornada. A UI não deve assumir que esse único objeto representa a compra inteira (ver critério de aceite 10 e caso de borda correspondente).

**Response 400**: quando o cartão (`{creditCardId}` da URL) ou a categoria (`categoryId` do corpo) não pertencem ao usuário autenticado.

### `GET /api/creditcard/{creditCardId}/fatura?month=&year=` [auth]

`month` e `year` são **opcionais** — default é mês/ano atual quando omitidos.

**Response 200** `CreditCardInvoiceResponse`
```ts
{
  creditCardId: number;      // int32
  invoiceMonth: number;
  invoiceYear: number;
  dueDate: string;            // date
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

- **`creditCardId`, `categoryId`, `creditCardInstallmentId`, `installmentNumber`, `installmentsCount`, `invoiceMonth`, `invoiceYear`** são todos **número**, nunca string — mesma correção de contrato registrada em `docs/api-contract.md` (seção "Enums", nota de 2026-08-03) e no histórico de bug real do `docs/board.md`. O `creditCardId` usado para montar a URL (`{creditCardId}`) vem da rota/seleção do cartão e deve ser tratado como `number` em todo o componente (parse explícito, nunca deixado como `string` bruta de parâmetro de rota em comparações ou nos payloads).
- Este DTO **não tem nenhum campo enum** (`CreditCardPurchaseRequest`/`CreditCardInstallmentResponse`/`CreditCardInvoiceResponse` não usam `TransactionType`, `PaymentMethod` nem `CardBrand`) — não há `<select>` de enum a validar neste ticket.
- **`isSubscription`** é `boolean` **obrigatório** no request (sem `?` no contrato, ainda que o comentário diga "default false") — a UI deve sempre enviar `true` ou `false` explicitamente no payload, nunca omitir essa chave.
- **`purchaseDate`, `installmentsCount`, `categoryId`** (em `CreditCardPurchaseRequest`) são os únicos campos opcionais — seguem o mesmo padrão já resolvido em `transactions.component.ts` (MVP-2) e `credit-cards.component.ts` (MVP-4): quando não preenchidos pelo usuário, devem ser **omitidos do payload**, nunca enviados como `null`/`undefined`/string vazia.

### Cartão de origem da compra/fatura (dependência do MVP-4)
Este ticket depende de um `creditCardId` de um cartão já existente, obtido a partir da listagem entregue no MVP-4 (`CreditCardsComponent`, `GET /api/creditcard`). Nenhum novo endpoint de listagem de cartões é criado aqui — reutiliza-se `CreditCardService.getAll()` já existente.

## Decisões de escopo desta tela

1. **Onde a UI vive**: nova rota `credit-cards/:creditCardId` (novo componente, ex. `CreditCardDetailComponent`), acessada a partir de um link/botão ("Ver fatura") adicionado a cada item da listagem existente em `credit-cards.component.html` (MVP-4). A listagem de cartões em si (`CreditCardsComponent`) não muda de comportamento — ganha apenas esse link de navegação por cartão. Justificativa: compra + fatura têm estado próprio (mês/ano selecionado, formulário de compra, lista de parcelas) que não cabe bem dentro do card resumido da listagem, e mantém a listagem do MVP-4 estável sem retrabalho nela.
2. **`installmentsCount`/parcelamento na exibição**: no formulário de compra, é um campo numérico opcional (1-48); quando preenchido fora desse intervalo, bloqueio client-side (mesmo padrão de `closingDay`/`dueDay` do MVP-4). Na fatura, cada parcela (`CreditCardInstallmentResponse`) é exibida com a notação `installmentNumber/installmentsCount` (ex.: "3/12") ao lado da descrição — não há agrupamento de parcelas da mesma compra em uma única linha (o contrato não fornece um identificador de "compra" compartilhado entre parcelas, apenas `creditCardInstallmentId` por parcela), então cada parcela retornada em `installments[]` é renderizada como uma linha independente.
3. **`categoryId` opcional na compra**: reutiliza `CategoryService`/`GET /api/category` (já consumido desde UX-2/MVP-6) para popular um `<select>` de categoria no formulário de compra, seguindo exatamente o padrão já estabelecido em `transactions.component.ts` (MVP-6): opção padrão `[ngValue]="null"` ("Nenhuma"), demais opções com `[ngValue]` numérico (`category.categoryId`), sem `Validators.required`. Nenhuma segunda fonte de categorias é criada.
4. **Navegação por mês/ano da fatura**: **dentro do escopo**, mas limitada a navegação sequencial (botões "Mês anterior" / "Próximo mês"), não um seletor livre de data. Ao entrar na tela, a fatura é carregada sem `month`/`year` (usa o default do backend — mês/ano atual). Os botões de navegação then passam a enviar `month`/`year` explícitos, calculados a partir de `invoiceMonth`/`invoiceYear` da última resposta recebida (com rollover de ano: dezembro → janeiro do ano seguinte e vice-versa). Um seletor arbitrário de mês/ano (ex.: dropdown de todos os meses/anos) fica fora de escopo desta rodada.
5. **Estados de loading/erro/vazio**: seguem o mesmo padrão já estabelecido em Transações/Categorias/Cartões (UX-1 e MVP-2/3/4) — indicador de carregamento enquanto a chamada está pendente e a lista/fatura ainda não tem dados, mensagem de erro distinta para falha de rede/API, estado vazio distinto de erro quando a resposta é `200` mas sem itens.

## Referência visual
`docs/design/mockup.pdf` continua com 1 página (a mesma tela de Painel/Dashboard já descrita nas specs do MVP-1 a MVP-4) — não há nenhuma página dedicada a compra em cartão ou fatura. Como no MVP-4, o Dev deve manter consistência com o design system já extraído do mock (paleta de cores, tipografia, estilo de card/botão em `src/styles.scss`, mixins compartilhados em `src/styles/_shared.scss` do UX-4), mas a estrutura de layout desta tela (lista simples vs. tabela para as parcelas, posição do formulário de compra em relação à fatura, forma dos botões de navegação de mês) fica a critério técnico do Dev — não é critério de aceite verificável por teste automatizado.

## Critérios de aceite (Given/When/Then)

### Compra (`POST /api/creditcard/{creditCardId}/purchases`)

1. **Criação com sucesso — todos os campos, incluindo opcionais**
   - Given o usuário está na tela de detalhe de um cartão existente (`creditCardId` conhecido) e preenche `description` (não vazia, até 100 caracteres), `totalValue` (> 0,01), `purchaseDate`, `installmentsCount` (entre 1 e 48) e seleciona uma `categoryId`, e marca a opção de assinatura (`isSubscription`)
   - When o usuário submete o formulário de compra
   - Then a aplicação envia `POST /api/creditcard/{creditCardId}/purchases` com `CreditCardPurchaseRequest { description, totalValue, purchaseDate, installmentsCount, categoryId, isSubscription: true }`, todos os campos `*Id`/numéricos como número
   - And, ao receber `200` com `CreditCardInstallmentResponse`, o formulário é limpo/resetado e a fatura atualmente exibida é recarregada (novo `GET /api/creditcard/{creditCardId}/fatura` com o mesmo `month`/`year` em exibição no momento, conforme decisão de escopo 4 acima).

2. **Criação com sucesso — apenas campos obrigatórios (`purchaseDate`, `installmentsCount`, `categoryId` omitidos)**
   - Given o usuário preenche apenas `description` e `totalValue`, deixa `purchaseDate`, `installmentsCount` e a categoria em branco, e não marca a opção de assinatura
   - When o usuário submete o formulário
   - Then a aplicação envia `POST /api/creditcard/{creditCardId}/purchases` com `CreditCardPurchaseRequest` contendo **apenas** `description`, `totalValue` e `isSubscription: false` — sem as chaves `purchaseDate`, `installmentsCount` e `categoryId` no payload (nunca `null`/`undefined` explícito)
   - And, ao receber `200`, o formulário é limpo e a fatura é recarregada.

3. **`isSubscription` sempre enviado explicitamente**
   - Given o usuário não interage com o campo/checkbox de assinatura
   - When o usuário submete o formulário (com os demais campos obrigatórios válidos)
   - Then o payload enviado contém `isSubscription: false` (valor padrão do controle), nunca omitindo essa chave.

4. **Validação client-side — `description` vazia**
   - Given o usuário deixa `description` vazia
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio e exibe indicação de campo obrigatório em `description`
   - And nenhuma chamada a `POST /api/creditcard/{creditCardId}/purchases` é realizada.

5. **Validação client-side — `description` acima de 100 caracteres**
   - Given o usuário informa uma `description` com mais de 100 caracteres
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio e exibe indicação de que o campo excede o limite de 100 caracteres
   - And nenhuma chamada a `POST /api/creditcard/{creditCardId}/purchases` é realizada.

6. **Validação client-side — `totalValue` ausente, zero ou negativo**
   - Given o usuário deixa `totalValue` vazio, ou informa `0` ou um valor negativo
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio e exibe indicação de que o valor deve ser maior que zero
   - And nenhuma chamada a `POST /api/creditcard/{creditCardId}/purchases` é realizada.

7. **Validação client-side — `installmentsCount` fora do intervalo 1-48 (quando preenchido)**
   - Given o usuário preenche `installmentsCount` com um valor menor que 1 ou maior que 48
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio e exibe indicação de que o valor deve estar entre 1 e 48
   - And nenhuma chamada a `POST /api/creditcard/{creditCardId}/purchases` é realizada.

8. **Erro `400` da API ao criar compra (cartão ou categoria não pertencem ao usuário)**
   - Given o formulário passou na validação client-side, mas a API retorna `400`
   - When a aplicação envia `POST /api/creditcard/{creditCardId}/purchases`
   - Then a UI exibe uma mensagem de erro genérica de requisição inválida (sem inventar corpo de erro estruturado, pois o contrato não define um para este endpoint), mantendo os dados preenchidos no formulário para o usuário corrigir
   - And a fatura exibida não é recarregada/alterada.

9. **Erro de rede/API indisponível ao criar compra**
   - Given a API está indisponível ou ocorre erro de rede ao submeter o formulário (sem código de status HTTP)
   - When a aplicação envia `POST /api/creditcard/{creditCardId}/purchases`
   - Then a UI exibe mensagem de erro de conexão/indisponibilidade, distinta da mensagem de erro `400`
   - And o formulário permanece preenchido e a fatura exibida não é alterada.

10. **Resposta de criação não é usada como retrato completo da compra**
    - Given o usuário cria uma compra com `installmentsCount` maior que 1 (ex.: `12`)
    - When a API responde `200` com um único `CreditCardInstallmentResponse`
    - Then a UI não tenta renderizar esse único objeto retornado como se fosse a lista completa das 12 parcelas criadas — a lista de parcelas exibida na tela vem exclusivamente do próximo `GET /api/creditcard/{creditCardId}/fatura` (critério 1/2), nunca de uma composição client-side a partir da resposta do `POST`.

### Fatura (`GET /api/creditcard/{creditCardId}/fatura`)

11. **Carregamento inicial da fatura — sucesso, com parcelas**
    - Given o usuário acessa a tela de detalhe de um cartão existente
    - When a tela carrega
    - Then a aplicação envia `GET /api/creditcard/{creditCardId}/fatura` **sem** os parâmetros `month`/`year` (usa o default do backend)
    - And, ao receber `200` com `CreditCardInvoiceResponse` cujo `installments` não é vazio, a UI exibe `invoiceMonth`, `invoiceYear`, `dueDate`, `totalValue`, e uma linha por elemento de `installments`, cada uma mostrando ao menos `description`, `value`, `purchaseDate`, a notação `installmentNumber/installmentsCount` e uma indicação de `isSubscription` quando `true`.

12. **Estado vazio — fatura sem parcelas no mês**
    - Given a fatura do mês corrente não possui nenhuma compra/parcela
    - When a tela carrega e recebe `200` com `CreditCardInvoiceResponse { ..., installments: [] }`
    - Then a UI exibe uma mensagem de estado vazio (ex.: "Nenhuma compra nesta fatura"), sem renderizar nenhuma linha de parcela e sem exibir mensagem de erro; `invoiceMonth`/`invoiceYear`/`dueDate`/`totalValue` continuam sendo exibidos normalmente (o objeto de fatura em si não é um erro).

13. **Erro ao carregar a fatura (falha de rede/API indisponível)**
    - Given a API está indisponível ou ocorre erro de rede ao carregar a fatura (sem código de status HTTP)
    - When a tela tenta carregar a fatura
    - Then a UI exibe uma mensagem de erro de carregamento (distinta da mensagem de estado vazio), sem tentar renderizar uma fatura parcial ou inválida.

14. **Navegação para o mês anterior**
    - Given a fatura atualmente exibida tem `invoiceMonth`/`invoiceYear` conhecidos (de uma resposta `200` anterior)
    - When o usuário clica no controle de navegação "mês anterior"
    - Then a aplicação envia `GET /api/creditcard/{creditCardId}/fatura?month=&year=` com `month`/`year` numéricos correspondentes ao mês imediatamente anterior ao exibido (com rollover de ano quando `invoiceMonth` é janeiro: `month=12`, `year=invoiceYear - 1`)
    - And, ao receber `200`, a UI substitui a fatura exibida pela nova resposta, seguindo os mesmos critérios 11/12/13 para os novos dados.

15. **Navegação para o próximo mês**
    - Given a fatura atualmente exibida tem `invoiceMonth`/`invoiceYear` conhecidos
    - When o usuário clica no controle de navegação "próximo mês"
    - Then a aplicação envia `GET /api/creditcard/{creditCardId}/fatura?month=&year=` com `month`/`year` numéricos correspondentes ao mês imediatamente seguinte ao exibido (com rollover de ano quando `invoiceMonth` é dezembro: `month=1`, `year=invoiceYear + 1`)
    - And, ao receber `200`, a UI substitui a fatura exibida pela nova resposta.

16. **Erro `401` ao carregar cartão/fatura (token ausente ou expirado)**
    - Given o token está ausente/expirado
    - When a aplicação envia `GET /api/creditcard/{creditCardId}/fatura` (ou `POST .../purchases`) e recebe `401`
    - Then a UI trata como erro de autenticação genérico (mesma mensagem de erro de carregamento/criação já definida acima para os respectivos fluxos), sem lógica de redirecionamento automático para a tela de login (mesma decisão dos MVPs anteriores).

## Casos de borda
- `installmentsCount`, `categoryId` e `purchaseDate` são os únicos campos opcionais de `CreditCardPurchaseRequest` — `description`, `totalValue` e `isSubscription` são sempre obrigatórios no payload (ver critério 3 para `isSubscription`).
- `totalValue` só é validado client-side como "> 0" (bom senso, mesmo padrão adotado para `value` em `transactions.component.ts` no MVP-2); o contrato define `> 0.01` — qualquer rejeição por casas decimais/precisão não coberta pela validação client-side cai no tratamento genérico de erro `400` (critério 8).
- `CreditCardPurchaseRequest`/`CreditCardInstallmentResponse` não possuem nenhum campo enum — não há `<select>` de `TransactionType`/`PaymentMethod`/`CardBrand` neste ticket, ao contrário de MVP-2/MVP-3/MVP-4/MVP-6.
- `categoryId` (em `CreditCardPurchaseRequest`) é opcional e, quando presente, é número (`int32`) — mesmo padrão de `TransactionRequest.categoryId` do MVP-2/MVP-6, nunca string.
- `creditCardId` da URL (tanto no `POST .../purchases` quanto no `GET .../fatura`) vem de um parâmetro de rota Angular — como todo parâmetro de rota chega como `string`, a UI deve convertê-lo explicitamente para `number` antes de usá-lo em comparações/chamadas de serviço (mesmo cuidado já aplicado a `categoryId`/`creditCardId` em specs anteriores para não reintroduzir o bug de contrato registrado em `docs/board.md`).
- `installments: []` (fatura sem compras no mês) é um `200` válido, diferente de erro — ver critério 12.
- O contrato não define uma forma de "compra" agrupando múltiplas parcelas (`CreditCardInstallmentResponse` não tem um campo tipo `purchaseId` compartilhado entre parcelas da mesma compra) — a UI não deve inventar esse agrupamento; cada parcela em `installments[]` é uma linha própria, mesmo que `description`/`purchaseDate` sejam idênticos entre parcelas da mesma compra original.
- O contrato não define nenhum campo de "limite disponível" ou "percentual do limite usado" combinando `CreditCardResponse.creditLimit` (MVP-4) com `CreditCardInvoiceResponse.totalValue` — esse cálculo client-side não é um dado do contrato e fica fora de escopo (ver "Fora de escopo").
- `month`/`year` na navegação (critérios 14/15) são sempre calculados a partir da última resposta `200` recebida (`invoiceMonth`/`invoiceYear`), nunca a partir de estado local não sincronizado com a API — se uma navegação falhar (erro 13), a fatura anterior continua sendo a referência para a próxima tentativa de navegação (não avança "no vazio").
- Resposta `401` em qualquer um dos dois endpoints: tratar como erro de autenticação genérico (critério 16); este ticket não define lógica de redirecionamento automático para login (mesma decisão dos MVPs anteriores).
- O contrato não define regra de unicidade nem limite de compras por cartão/mês — este ticket não deve inventar essas validações; qualquer rejeição por regra de negócio não documentada cai no tratamento genérico de erro `400` (critério 8).

## Fora de escopo
- Edição e exclusão de compra/parcela — não há endpoints `PUT`/`DELETE` para `CreditCardPurchase`/`CreditCardInstallment` no contrato.
- Edição e exclusão de cartão — já fora de escopo desde o MVP-4 (sem `PUT`/`DELETE` para `CreditCard`).
- Seletor livre de mês/ano (dropdown de todos os meses/anos, calendário, etc.) na fatura — apenas navegação sequencial mês anterior/próximo mês (critérios 14/15) está em escopo nesta rodada.
- Qualquer cálculo/exibição de "limite disponível" ou percentual de uso do `creditLimit` combinando dados de MVP-4 e MVP-5 — não é um campo do contrato.
- Agrupamento visual de parcelas da mesma compra original em uma única linha/cartão — o contrato não fornece um identificador de compra compartilhado entre parcelas (ver caso de borda correspondente).
- Filtros, ordenação, busca ou paginação da lista de parcelas da fatura, além da navegação por mês/ano já descrita — não há outros parâmetros de query documentados em `GET /api/creditcard/{creditCardId}/fatura`.
- Qualquer vínculo entre compra de cartão e a tela de Transações (MVP-2) — o contrato é explícito que compras de cartão não criam `Transaction` (ver nota no início da seção "Endpoints/DTOs envolvidos").
- Mensagem de sucesso tipo "toast" após criar a compra — mesmo padrão já adotado (ou melhor, já não adotado) em MVP-2/MVP-3/MVP-4/MVP-6: o feedback de sucesso é o reset do formulário e a atualização da fatura exibida, sem toast dedicado (item já registrado como candidato futuro de backlog em `docs/design/ux-review-2026-08-03.md`, não ticketado).
- Redirecionamento automático para login em caso de `401` — mecanismo de sessão/expiração não definido neste ticket (mesma decisão dos MVPs anteriores).

## Dependências externas / bloqueios conhecidos
- Depende de MVP-1 (Login/Auth, `Done`) e MVP-4 (Cartões de Crédito, `Done`) — este ticket reutiliza `CreditCardService.getAll()` (listagem de cartões, para obter/selecionar o `creditCardId`) e não reimplementa autenticação.
- CORS já habilitado localmente (`https://localhost:7002`), conforme `docs/board.md` — não bloqueia este ticket em ambiente de desenvolvimento local. Segue pendente para outros ambientes (staging/produção), fora do controle do frontend.
- Como registrado em `docs/board.md` (histórico de bug crítico de contrato de enums/IDs, 2026-08-03), a API real segue com disponibilidade intermitente para o `qa` automatizado validar de ponta a ponta (specs usam mocks/`HttpTestingController`) — o Dev deve conferir o payload real de `POST /api/creditcard/{creditCardId}/purchases` e `GET /api/creditcard/{creditCardId}/fatura` contra `/swagger/v1/swagger.json` (ou chamada real) antes de fechar o ticket, com atenção especial a dois pontos deste contrato que ainda não foram exercitados por nenhum ticket anterior: (1) confirmar que a resposta de `POST .../purchases` é de fato um único `CreditCardInstallmentResponse` mesmo com `installmentsCount > 1`, e (2) confirmar que `month`/`year` realmente aceitam omissão simultânea (default mês/ano atual) e aceitam serem enviados juntos como inteiros na query string.
