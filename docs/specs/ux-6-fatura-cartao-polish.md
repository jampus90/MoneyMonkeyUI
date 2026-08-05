# UX-6 — Fatura do cartão: identificação, formatação de moeda/data e hierarquia de parcelas

## História de usuário
Como usuário do MoneyMonkey que navega entre faturas de cartões diferentes (mais de um cartão cadastrado), quero identificar claramente qual cartão estou visualizando na tela de fatura, ver valores monetários e datas formatados de forma legível, e enxergar a lista de parcelas com hierarquia visual clara (colunas em desktop, destaque do valor em mobile), para confiar nos dados exibidos, não me perder entre cartões diferentes e conseguir voltar facilmente à listagem.

## Origem do ticket
Achados #2 (Alta), #3 (Alta) e #4 (Média severidade) de `docs/design/ux-review-2026-08-04.md`, recomendações 3, 4 e 5. Depende de UX-5 (`Done`) — o breakpoint `@media (min-width: 960px)` já existe em `src/styles/_shared.scss` (mixin `mm-page-shell`) e é reaproveitado aqui, não recriado.

## Endpoints/DTOs envolvidos
Nenhum endpoint/DTO novo. Referência a `docs/api-contract.md`, seção "Credit Cards" — apenas campos já existentes, reutilizados:

- **`GET /api/creditcard`** [auth] → `CreditCardResponseList { creditCardResponses: CreditCardResponse[] }`, onde `CreditCardResponse` tem `creditCardId` (number), `name` (string), `brand` (`CardBrand`), `lastFourDigits` (string), `creditLimit?` (number). **Confirmado no contrato**: não existe endpoint singular `GET /api/creditcard/{id}`, só a listagem — logo, a única forma real de obter os dados do cartão específico da rota é `getAll()` + filtro client-side por `creditCardId` (ver "Abordagem técnica" abaixo).
- **`GET /api/creditcard/{creditCardId}/fatura`** [auth] → `CreditCardInvoiceResponse { creditCardId, invoiceMonth, invoiceYear, dueDate, totalValue, installments: CreditCardInstallmentResponse[] }`. Campos usados nesta spec: `totalValue` (number), `dueDate` (string, date), `invoiceMonth`/`invoiceYear` (number, **fora do escopo de formatação por pipe** — ver critério 8).
- **`CreditCardInstallmentResponse`**: `value` (number), `purchaseDate` (string, date), `description`, `installmentNumber`, `installmentsCount`, `isSubscription` — já usados, formatação aplicada apenas a `value`/`purchaseDate`.

Nenhum campo novo é lido do contrato; nenhum enum novo (`CreditCardPurchaseRequest`/`CreditCardInstallmentResponse`/`CreditCardInvoiceResponse` continuam sem campos enum, conforme já registrado na spec do MVP-5).

## Abordagem técnica (decisões obrigatórias, sem ambiguidade para o Dev)

### 1. Identificação do cartão: `getAll()` + filtro client-side (não `getById`)
`docs/api-contract.md` não define nenhum endpoint singular de cartão por id (`GET /api/creditcard/{id}` **não existe** — só `GET /api/creditcard`, a listagem). Criar um endpoint novo está fora de cogitação (nenhum código de frontend inventa endpoint). Portanto a única abordagem tecnicamente possível é:

- `CreditCardDetailComponent` ganha um novo método `loadCreditCard()`, chamado em `ngOnInit()` junto de `loadInvoice()`/`loadCategories()` (já existentes), que chama `this.creditCardService.getAll()` (método já existente, reaproveitado de `CreditCardsComponent`/MVP-4 — **nenhum método novo em `CreditCardService`**) e faz `response.creditCardResponses.find(c => c.creditCardId === this.creditCardId)`.
- Resultado guardado em uma nova propriedade pública `creditCard: CreditCardResponse | null = null`.
- Esta é uma chamada de rede **nova e independente** da que `CreditCardsComponent` já faz na listagem — não há cache/estado compartilhado entre os dois componentes neste app (mesmo padrão já aceito para `CategoryService.getAll()`, chamado separadamente em `TransactionsComponent` e `CategoriesComponent`). Isso **não** é um problema a resolver neste ticket.
- Falha ao carregar (`getAll()` retorna erro) ou cartão não encontrado no array (`find()` retorna `undefined`) são tratados de forma **não bloqueante e silenciosa**: o título cai no fallback genérico "Fatura" (ver critérios 2/3), sem impedir fatura/formulário de compra de funcionarem.

### 2. Rótulo de bandeira (`CardBrand`) no componente de detalhe
`CreditCardDetailComponent` não tem hoje nenhum mapeamento de rótulos de `CardBrand` (isso vive em `credit-cards.component.ts`, como uma constante local `CARD_BRAND_LABELS`). Decisão: **duplicar** o mesmo mapeamento (`Visa`/`Mastercard`/`Elo`/`Amex`/`Outro`, mesmas strings PT-BR exatas de `credit-cards.component.ts`) como constante local em `credit-card-detail.component.ts`, seguindo o padrão já estabelecido no projeto de constantes de rótulo duplicadas por componente (nenhum ticket anterior — UX-4 incluso — extraiu constantes TypeScript compartilhadas entre componentes, só mixins SCSS). Extrair esse mapeamento para um local compartilhado (ex. `enums.model.ts` ou um novo arquivo de labels) é uma melhoria válida, mas fica **fora de escopo** deste ticket (ver "Fora de escopo").

### 3. Hierarquia tabular das parcelas: `display: grid` (não `<table>`)
Abordagem escolhida: **manter a estrutura `<ul class="installment-list">` / `<li class="installment-item">` já existente** (não migrar para `<table>`), acrescentando:

- Um novo elemento `<div class="installment-list__header">` (4 `<span>` com os rótulos "Descrição", "Parcela", "Valor", "Data", nesta ordem), renderizado **apenas quando `invoice.installments.length > 0`** (mesma condição que já protege a `<ul>` hoje), imediatamente antes da `<ul class="installment-list">`.
- CSS: `.installment-list__header` tem `display: none;` por padrão (mobile/tablet, < 960px) e, em `@media (min-width: 960px)`, `display: grid; grid-template-columns: <valor V>;` (`<valor V>` é uma declaração de 4 frações, ex. `2.2fr 0.9fr 1fr 1.1fr`, cabendo ao Dev escolher o valor exato — o que **não** é opcional é que `.installment-item` use **exatamente o mesmo valor** de `grid-template-columns`, não um valor divergente redeclarado).
- `.installment-item` mantém `display: flex; flex-wrap: wrap;` como caso base (< 960px, sem mudança de comportamento visual abaixo do breakpoint além do negrito do valor — ver critério 11) e, em `@media (min-width: 960px)`, passa a `display: grid; grid-template-columns: <mesmo valor V do header>;` — cada `<span>` (`__description`, `__installments`, `__value`, `__date`) ocupa a coluna correspondente ao rótulo do cabeçalho, na mesma ordem em que já aparecem no DOM hoje.

**Justificativa da escolha (grid em vez de `<table>`)**: preserva a estrutura DOM/classes já existentes e já usadas como referência textual no achado #4 (`installment-item__description`, `__installments`, `__value`, `__date`), evitando reescrever elementos testáveis sem necessidade; evita o retrabalho de fazer uma `<table>` nativa "parecer" com o layout mobile atual (linhas com wrap livre) sem overrides de `display` que quebrariam a semântica de tabela nos leitores de tela; e atende literalmente à recomendação 5 do documento de origem, que lista `display: grid` com `grid-template-columns` compartilhadas como alternativa válida a `<table>`.

**Limitação assumida explicitamente**: o cabeçalho é puramente visual (ver critério 9) — este ticket não adiciona semântica ARIA de tabela (`role="table"/"row"/"cell"/"columnheader"`) às linhas de parcela; ver "Fora de escopo".

## Casos de borda

- **Cartão não encontrado na listagem** (`creditCardId` da rota não bate com nenhum item de `GET /api/creditcard`, ex.: cartão de outro usuário ou id inexistente): título cai no fallback genérico "Fatura" (critério 2); não é tratado como erro, não bloqueia fatura/formulário.
- **Falha ao carregar `GET /api/creditcard`** (rede, 401): mesmo fallback do item acima (critério 3), falha silenciosa — mesmo padrão já usado para `loadCategories()` no MVP-5, sem mensagem de erro dedicada para essa chamada específica.
- **`invoiceMonth`/`invoiceYear` permanecem sem `DatePipe`**: são dois números separados (não uma string de data/timestamp), então `DatePipe` não pode ser aplicado diretamente a eles sem construir um `Date` derivado (`new Date(invoiceYear, invoiceMonth - 1, 1)`) — isso é uma transformação nova, não a simples aplicação de um pipe já decidida em escopo, por isso o achado #8 (nome do mês por extenso) fica deliberadamente fora deste ticket (ver critério 8 e "Fora de escopo").
- **`CardBrand` label duplicado**: ver "Abordagem técnica", item 2 — string exata deve bater com `credit-cards.component.ts` (`Visa`, `Mastercard`, `Elo`, `Amex`, `Outro`), para não divergir entre as duas telas.
- **`lastFourDigits` no título**: exibido com um prefixo indicando dígitos ocultos (ex. `•••• 1234`, mesmo padrão textual já usado em `credit-cards.component.html:18`, `**** {{ creditCard.lastFourDigits }}`) — a pontuação/separador exatos entre nome, bandeira e dígitos no título ficam a critério visual do `dev-frontend`, não são critério de aceite verificável byte a byte (mesma decisão de granularidade já usada nas specs do MVP-4/MVP-5 para detalhes puramente estéticos).
- **Descrição de parcela longa** (`description` até 100 caracteres, conforme `CreditCardPurchaseRequest`): em desktop, dentro da coluna de grid, o texto pode quebrar em múltiplas linhas — nenhuma regra de truncamento/`ellipsis` é exigida por este ticket.
- **Sem "sinal" de valor na fatura**: ao contrário de Transações (UX-2, `Entrada`/`Saida`), `CreditCardInstallmentResponse.value`/`CreditCardInvoiceResponse.totalValue` não têm noção de sinal positivo/negativo — o `CurrencyPipe` é aplicado diretamente ao número, sem lógica de sinal fora do pipe (essa lógica é específica de Transações, não se aplica aqui).
- **Locale `pt-BR`** já registrado globalmente em `app.config.ts` desde a UX-2 — nenhum registro novo de locale é necessário para o `CurrencyPipe`/`DatePipe` funcionarem aqui.
- **`creditCardId` da rota**: continua convertido explicitamente para `number` (`Number(this.route.snapshot.paramMap.get('creditCardId'))`, já existente desde o MVP-5) — usado também na comparação `find(c => c.creditCardId === this.creditCardId)`; nenhuma regressão do bug histórico de `*Id`-como-string.

## Critérios de aceite (Given/When/Then)

### Identificação do cartão + link de volta (achado #2)

1. **Identificação do cartão carregada com sucesso**
   Given o usuário acessa `/credit-cards/:creditCardId` de um cartão existente e pertencente a ele
   When a tela carrega
   Then a aplicação chama `GET /api/creditcard` (via `CreditCardService.getAll()`, já existente) e localiza, em `creditCardResponses`, o item cujo `creditCardId` é igual ao parâmetro de rota (`number`)
   And o título da tela (`<h1 class="invoice__title">`) passa a exibir `creditCard.name`, o rótulo PT-BR de `creditCard.brand` e `creditCard.lastFourDigits`, no lugar do texto fixo "Fatura" isolado.

2. **Cartão não encontrado na lista**
   Given `GET /api/creditcard` retorna `200` com `creditCardResponses` sem nenhum item cujo `creditCardId` bata com o da rota
   When a tela carrega
   Then o título exibe apenas o texto genérico "Fatura" (sem nome/bandeira/dígitos)
   And a fatura (`GET .../fatura`) continua sendo carregada e exibida normalmente, sem qualquer bloqueio.

3. **Falha ao carregar a lista de cartões**
   Given `GET /api/creditcard` falha (erro de rede ou `401`)
   When a tela carrega
   Then o título cai no mesmo fallback genérico "Fatura" do critério 2, sem exibir mensagem de erro dedicada para essa falha específica (falha silenciosa)
   And a fatura e o formulário de nova compra continuam funcionando normalmente, sem depender do sucesso desta chamada.

4. **Link de volta para a listagem de cartões**
   Given qualquer estado da tela de detalhe (carregando, erro, sucesso, com ou sem `creditCard` identificado)
   When a tela é renderizada
   Then existe um link (`routerLink="/credit-cards"`) com texto indicando retorno à listagem (ex. "← Voltar aos cartões"), sempre presente no DOM independentemente do estado de carregamento do cartão/fatura.

### `CurrencyPipe`/`DatePipe` (achado #3)

5. **Total e vencimento da fatura formatados**
   Given a fatura carregou com sucesso (`invoice` presente)
   When o resumo da fatura é renderizado
   Then `invoice.totalValue` é exibido via `{{ invoice.totalValue | currency:'BRL' }}` e `invoice.dueDate` via `{{ invoice.dueDate | date:'dd/MM/yyyy' }}`
   And nenhum dos dois valores é renderizado cru no DOM (ex. nunca aparece literalmente `"1240.75"` nem `"2026-08-10"`).

6. **Valor e data de cada parcela formatados**
   Given a fatura tem ao menos uma parcela
   When a lista de parcelas é renderizada
   Then cada `installment.value` é exibido via `| currency:'BRL'` e cada `installment.purchaseDate` via `| date:'dd/MM/yyyy'`, mesmo padrão do critério 5, para todas as linhas.

7. **Limite de crédito formatado na listagem de cartões**
   Given um item de `credit-cards.component.html` cujo `creditCard.creditLimit` não é `null`/`undefined`
   When o item é renderizado
   Then o valor é exibido via `{{ creditCard.creditLimit | currency:'BRL' }}`, mantendo inalterada a condição já existente (`@if (creditCard.creditLimit != null)`).

8. **`invoiceMonth`/`invoiceYear` permanecem fora do escopo de formatação**
   Given a decisão de escopo documentada acima
   When o resumo da fatura é renderizado
   Then `invoice.invoiceMonth`/`invoice.invoiceYear` continuam exibidos no mesmo formato numérico já usado hoje (ex. "8/2026", sem nome de mês por extenso) — qualquer alteração desse formato específico (achado #8) é explicitamente **fora de escopo** deste ticket.

### Hierarquia tabular das parcelas (achado #4)

9. **Cabeçalho de colunas visível a partir de 960px**
   Given uma viewport ≥ 960px e `invoice.installments.length > 0`
   When a lista de parcelas é renderizada
   Then um elemento `.installment-list__header` precede a `<ul class="installment-list">`, contendo 4 rótulos na ordem "Descrição", "Parcela", "Valor", "Data", com `display: grid` e uma declaração `grid-template-columns` de 4 frações.

10. **Cabeçalho ausente/oculto abaixo de 960px**
    Given uma viewport < 960px
    When a lista de parcelas é renderizada
    Then `.installment-list__header` não é visível (`display: none` ou equivalente), preservando o layout mobile atual (ver critério 11).

11. **Destaque do valor da parcela em mobile (mínimo exigido pelo achado #4)**
    Given uma viewport < 960px
    When uma parcela (`.installment-item`) é renderizada
    Then `.installment-item__value` tem `font-weight: 700` (mesmo tratamento já usado em `.transaction-item__value`, `transactions.component.scss`), distinguindo-o visualmente dos demais campos da linha, que hoje compartilham o mesmo `font-size`/cor.

12. **Colunas alinhadas entre cabeçalho e linha em desktop**
    Given uma viewport ≥ 960px
    When uma parcela (`.installment-item`) é renderizada
    Then `.installment-item` também usa `display: grid` com **exatamente a mesma** declaração `grid-template-columns` usada por `.installment-list__header` (critério 9) — não um valor redeclarado divergente — posicionando `__description`, `__installments`, `__value` e `__date` sob os respectivos rótulos de coluna, na mesma ordem em que já aparecem no DOM.

13. **Estado vazio não exibe cabeçalho de coluna**
    Given `invoice.installments.length === 0`
    When a fatura é renderizada
    Then nem `.installment-list__header` nem `.installment-list`/`.installment-item` são renderizados — apenas a mensagem de estado vazio já existente ("Nenhuma compra nesta fatura"), sem regressão do critério 12 da spec do MVP-5.

### Agrupado por decisão do `po` — achado #5 (baixo custo, já cotado como candidato na spec do UX-5)

14. **`.invoice__nav` com `flex-wrap: wrap`**
    Given `.invoice__nav` hoje usa `display: flex; justify-content: space-between; gap: 0.75rem;` sem `flex-wrap`
    When `.invoice__nav` é inspecionado após a implementação
    Then a regra `flex-wrap: wrap` está presente, mesmo padrão já usado em `.nav-bar`/`.nav-bar__links` (`nav-bar.component.scss`), evitando sobreposição dos dois botões de navegação de mês + título em viewports muito estreitas (~320-360px).
    **Decisão explícita do `po`**: incluído nesta rodada por ser uma alteração de uma linha de CSS, já registrada como candidato a "resolver junto do UX-6 se o Orquestrador decidir agrupar" na spec do UX-5 ("Fora de escopo").

## Fora de escopo

- **Achado #6** (mensagem de sucesso transiente pós-compra) — menor prioridade, não pedido pelo usuário nesta rodada; segue apenas registrado no documento de revisão.
- **Achado #8** (nome do mês por extenso em `invoiceMonth`/`invoiceYear`, ex. "Agosto/2026") — avaliado explicitamente acima ("Casos de borda"): **não** é resolvido de graça pela aplicação de `CurrencyPipe`/`DatePipe` já decidida em escopo, pois exigiria construir um `Date` derivado de dois números separados (transformação nova, não pipe direto sobre campo existente); fica fora desta rodada.
- **Achado #9** (opção "Selecione" não desabilitada nos `<select>`) — não pedido pelo usuário nesta rodada.
- **Achado #10** (cor/indicador por bandeira na listagem de cartões) — não pedido pelo usuário nesta rodada.
- **Semântica ARIA completa de tabela** (`role="table"/"row"/"cell"/"columnheader"`) para o cabeçalho/linhas de parcela — a abordagem escolhida (grid sobre `<ul>/<li>` já existente) não inclui essa camada de acessibilidade; é uma melhoria válida para um ticket futuro dedicado a acessibilidade, não implícita aqui.
- **Extração de `CARD_BRAND_LABELS`/mapeamentos de rótulo de enum para um local TypeScript compartilhado** entre `credit-cards.component.ts` e `credit-card-detail.component.ts` — decisão documentada de duplicar (ver "Abordagem técnica", item 2), consistente com o padrão já aceito no projeto (nenhum ticket anterior, incluindo UX-4, compartilhou constantes TS entre componentes, só mixins SCSS).
- **Endpoint singular `GET /api/creditcard/{id}`** — não existe no contrato; não deve ser proposto/inventado nem no frontend nem como pedido ao backend dentro deste ticket.
- **Qualquer mudança na listagem de Transações/Categorias** — este ticket toca exclusivamente `credit-card-detail.component.*` e, pontualmente, o `creditLimit` de `credit-cards.component.html` (critério 7).
- **Qualquer breakpoint intermediário adicional** além do `960px` já existente (UX-5) — não é reaberto aqui.
- **Cache/compartilhamento de estado entre `CreditCardsComponent` e `CreditCardDetailComponent`** para evitar a segunda chamada a `GET /api/creditcard` — ver "Abordagem técnica", item 1; não é um problema a resolver neste ticket, mesmo padrão já aceito para `CategoryService.getAll()`.
- **Achado #1/#7 (breakpoint de desktop, page shell compartilhado)** — já resolvidos no UX-5 (`Done`); este ticket apenas reaproveita o breakpoint `min-width: 960px` já existente, sem alterá-lo.

## Dependências externas / bloqueios conhecidos

- Depende de **UX-5** (`Done`) — o breakpoint `min-width: 960px` (mixin `mm-page-shell`, `src/styles/_shared.scss`) já existe e é reaproveitado diretamente pelas regras de grid da lista de parcelas (critérios 9/12), sem necessidade de criar um breakpoint novo.
- Depende de **MVP-4** (Cartões de Crédito, `Done`) e **MVP-5** (Compras no cartão + Fatura, `Done`) — reutiliza `CreditCardService.getAll()`/`getInvoice()` já existentes, sem endpoint novo.
- CORS já habilitado localmente (`https://localhost:7002`), conforme `docs/board.md` — não bloqueia este ticket em ambiente de desenvolvimento local.
- Nenhuma dependência de backend nova — ticket 100% de apresentação (TypeScript/HTML/SCSS) sobre dados já existentes no contrato.

## Referência visual
`docs/design/mockup.pdf` tem 1 página ("Painel"/Dashboard) e, como já registrado nas specs do MVP-4, MVP-5 e UX-5, **não cobre** as telas de Cartões/Fatura especificamente — não é mock literal desta tela. A única evidência de layout já extraída dele (grid multi-coluna em desktop) foi endereçada no UX-5, fora do escopo deste ticket. Nota de ambiente: a leitura direta do PDF nesta sessão voltou a falhar por dependência ausente (`pdftoppm`/`poppler-utils` não instalado), mesma limitação já registrada na spec do UX-5 — não há, de qualquer forma, página nova a inspecionar além da já descrita nas specs anteriores. A estrutura de layout dos elementos abordados aqui (posição do título, do link de volta, formatação exata do cabeçalho de colunas) fica a critério técnico do `dev-frontend`, seguindo o design system já extraído do mock em `src/styles.scss`/`src/styles/_shared.scss` — não é critério de aceite verificável pixel a pixel.
