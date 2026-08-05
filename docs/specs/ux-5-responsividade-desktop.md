# UX-5 — Responsividade desktop e extração do page shell compartilhado

## História de usuário
Como usuário do MoneyMonkey acessando em um monitor/notebook desktop (1280-1440px de largura), quero que as telas de Transações, Categorias, Cartões de Crédito e Detalhe/Fatura do Cartão usem a largura disponível da viewport — com lista e formulário lado a lado em vez de empilhados —, para não precisar rolar a página sem necessidade nem visualizar ~400-480px de espaço vazio de cada lado do conteúdo.

## Origem do ticket
Achados #1 (Alta severidade) e #7 (Média severidade), recomendações 1 e 2 de `docs/design/ux-review-2026-08-04.md`. Aprovado pelo usuário como prioridade máxima desta rodada: a aplicação é web (desktop/tablet/mobile), não mobile-only, e hoje **zero `@media query`** existe em todo o `src/` — as 4 telas de conteúdo repetem, praticamente byte a byte, o mesmo contêiner de página (`min-height: 100vh; display:flex; flex-direction:column; padding: 2rem 1rem`) e o mesmo `.card { max-width: 480px; margin: 0 auto; }`, resultando numa única coluna estreita centralizada mesmo em telas largas.

Este é um ticket de **layout/CSS responsivo com possibilidade documentada de mudança estrutural mínima de HTML** (ver critério de aceite 7 e "Casos de borda") — diferente do UX-4 (refactor 100% CSS, zero toque em `.html`), aqui a extração para grid pode, em tese, exigir um wrapper novo se a estrutura de DOM atual não comportar `display: grid` diretamente. A investigação abaixo ("Estrutura de DOM atual") mostra que, na prática, **isso não deve ser necessário** — mas a permissão fica registrada explicitamente porque o usuário/Orquestrador pediu que ficasse clara antes da implementação.

## Endpoints/DTOs envolvidos
Nenhum. Conferido contra `docs/api-contract.md`: este ticket não adiciona, remove nem altera nenhum endpoint, DTO, campo ou enum — é puramente CSS/estrutura de apresentação sobre dados já buscados e exibidos hoje pelas 4 telas (`TransactionResponse`, `CategoryResponse`, `CreditCardResponse`, `CreditCardInvoiceResponse`/`CreditCardInstallmentResponse`, todos já consumidos desde MVP-2/MVP-3/MVP-4/MVP-5).

## Estrutura de DOM atual (confirmado lendo o código, não suposto)

Nos 4 arquivos `.html` afetados, o contêiner de página tem exatamente **dois filhos diretos**, já na ordem lista-depois-formulário (ou fatura-depois-formulário):

- `transactions.component.html`: `<div class="transactions-page">` → `<section class="transactions-list card">` (lista) e `<section class="transaction-form card">` (formulário), sem wrapper adicional.
- `categories.component.html`: `<div class="categories-page">` → `<section class="categories-list card">` e `<section class="category-form card">`.
- `credit-cards.component.html`: `<div class="credit-cards-page">` → `<section class="credit-cards-list card">` e `<section class="credit-card-form card">`.
- `credit-card-detail.component.html`: `<div class="credit-card-detail-page">` → `<section class="invoice card">` (fatura) e `<section class="purchase-form card">` (formulário de compra).

Isso significa que aplicar `display: grid` diretamente no seletor de página (`.transactions-page`, etc.) já é suficiente para colocar os dois `<section>` lado a lado como itens de grid — **nenhuma mudança de `.html` é estritamente necessária** para viabilizar o layout de duas colunas. A permissão de tocar `.html` (critério 7) existe apenas como salvaguarda caso o `dev-frontend` identifique, durante a implementação, uma razão concreta para introduzir um wrapper (ex. necessidade de um terceiro elemento não-grid entre os dois cards) — não é o caminho esperado.

## Abordagem técnica escolhida

Dois mixins novos em `src/styles/_shared.scss` (mesmo partial do UX-4, mesmo padrão `@use`/`@include`), consumidos pelos 4 arquivos `.component.scss` das telas de conteúdo. **`login.component.scss` não é tocado por este ticket** — a tela de login não está entre as 4 telas de conteúdo listadas no escopo, não tem lista+formulário lado a lado, e seu `.login-card` já diverge intencionalmente de `.card` em dimensões (decisão já registrada no UX-4, "Casos de borda").

1. **`mm-page-shell($desktop-max-width: 1180px, $desktop-breakpoint: 960px)`** — substitui o bloco `min-height: 100vh; display:flex; flex-direction:column; gap:1.5rem; padding:2rem 1rem; background: var(--mm-color-bg); box-sizing:border-box;` hoje duplicado byte a byte nos 4 arquivos, mantendo essas propriedades como caso base (mobile/tablet, abaixo do breakpoint). Acrescenta um bloco `@media (min-width: $desktop-breakpoint)` que:
   - amplia o contêiner (`max-width: $desktop-max-width; margin: 0 auto; padding: 2.5rem 2rem;`);
   - muda o layout de `flex-direction: column` para `display: grid; grid-template-columns: 1.4fr 1fr; gap: 1.5rem; align-items: start;` — colocando os dois filhos diretos (lista/fatura + formulário) lado a lado, lista/fatura ocupando a coluna mais larga (`1.4fr`).

2. **`mm-card-width($max-width: 480px, $desktop-breakpoint: 960px)`** — mixin novo e **distinto** de `mm-card-base` (não uma extensão dele), porque `mm-card-base` foi definido no UX-4 explicitamente como o subconjunto **visual, sem largura** (`background`, `border-radius`, `box-shadow`, `box-sizing`) compartilhado inclusive com `.login-card`, que tem seu próprio `max-width` divergente (380px) e não deve ser afetado por este ticket. `mm-card-width` cobre apenas `width: 100%; max-width: $max-width; margin: 0 auto;` (idêntico ao bloco hoje duplicado nos 4 `.card`) e, no mesmo breakpoint de `mm-page-shell`, relaxa o limite (`max-width: none; margin: 0;`) para que o card preencha a coluna do grid em vez de continuar travado em 480px dentro de uma coluna mais larga.

Cada `.component.scss` das 4 telas passa a ter:
```scss
.xxx-page {
  @include shared.mm-page-shell;
}

.card {
  @include shared.mm-card-base;
  @include shared.mm-card-width;
  padding: 1.75rem 1.5rem;
}
```
(`padding: 1.75rem 1.5rem` permanece declarado localmente, fora dos mixins — não estava listado no achado #1/#7 como duplicação a resolver neste ticket, e alterá-lo seria mudança visual não pedida.)

## Arquivos exatos envolvidos
- **`src/styles/_shared.scss`** (já existe, criado no UX-4) — ganha os mixins `mm-page-shell` e `mm-card-width`, usando exclusivamente tokens já existentes em `src/styles.scss` (nenhum token `--mm-*` novo).
- `src/app/features/transactions/transactions.component.scss` — `.transactions-page` passa a `@include shared.mm-page-shell;`; `.card` ganha `@include shared.mm-card-width;` no lugar de `width/max-width/margin` declarados literalmente.
- `src/app/features/categories/categories.component.scss` — mesma mudança para `.categories-page`/`.card`.
- `src/app/features/credit-cards/credit-cards.component.scss` — mesma mudança para `.credit-cards-page`/`.card`.
- `src/app/features/credit-cards/credit-card-detail.component.scss` — mesma mudança para `.credit-card-detail-page`/`.card`.
- **Nenhum `.html` alterado por padrão** (ver "Estrutura de DOM atual"). Se o `dev-frontend` precisar alterar algum dos 4 `.html`, isso é permitido nos termos do critério de aceite 7, e deve ser reportado explicitamente (não silenciosamente) no relato de implementação.
- `src/app/features/login/login.component.scss` — **não alterado** (fora de escopo, ver "Abordagem técnica escolhida").

## Critérios de aceite (Given/When/Then)

1. **Contêiner de página vem de fonte única (`mm-page-shell`)**
   Given `src/styles/_shared.scss` define o mixin `mm-page-shell`
   When `transactions.component.scss`, `categories.component.scss`, `credit-cards.component.scss` e `credit-card-detail.component.scss` são inspecionados
   Then nenhum dos 4 arquivos declara mais o bloco `min-height: 100vh; display:flex; flex-direction:column; gap:1.5rem; padding:2rem 1rem; background: var(--mm-color-bg); box-sizing:border-box;` de forma literal — cada `.xxx-page` inclui o mixin compartilhado.

2. **`max-width` do `.card` vem de fonte única (`mm-card-width`)**
   Given `src/styles/_shared.scss` define o mixin `mm-card-width`
   When os mesmos 4 arquivos são inspecionados
   Then nenhum declara mais `width: 100%; max-width: 480px; margin: 0 auto;` de forma literal no seletor `.card` — cada um inclui o mixin compartilhado. `login.component.scss` não é alterado (mantém seu `.login-card` com `max-width: 380px` local, como já era desde o UX-4).

3. **Breakpoint de desktop concreto, em `min-width: 960px`, nas 4 telas**
   Given uma viewport com largura ≥ 960px
   When qualquer uma das 4 telas é renderizada
   Then a regra `@media (min-width: 960px)` de `mm-page-shell` (herdada pelas 4 telas via `@include`) está ativa, alterando o contêiner de página conforme o critério 4.

4. **Layout mobile/tablet preservado como caso base, sem nenhuma mudança de propriedade abaixo do breakpoint**
   Given uma viewport com largura < 960px
   When qualquer uma das 4 telas é renderizada
   Then o comportamento é idêntico ao estado anterior a este ticket: `.xxx-page` com `display: flex; flex-direction: column;` (lista/fatura empilhada acima do formulário, na mesma ordem do DOM já existente) e `.card` com `max-width: 480px; margin: 0 auto;` — nenhuma propriedade computada muda de valor para nenhum dos 4 seletores de página/card abaixo do breakpoint.

5. **Lista e formulário lado a lado em desktop — Transações, Categorias e Cartões de Crédito**
   Given uma viewport ≥ 960px
   When `transactions.component.html`, `categories.component.html` ou `credit-cards.component.html` são renderizados
   Then o contêiner de página (`.transactions-page`/`.categories-page`/`.credit-cards-page`) aplica `display: grid; grid-template-columns: 1.4fr 1fr; gap: 1.5rem;`, posicionando a seção de lista (`*-list.card`, primeiro filho direto) e a seção de formulário (`*-form.card`, segundo filho direto) como itens lado a lado do grid, na mesma ordem de leitura já existente no DOM (lista à esquerda/coluna maior, formulário à direita/coluna menor) — não mais empilhados verticalmente.

6. **Fatura e formulário de nova compra lado a lado em desktop — Detalhe do Cartão**
   Given uma viewport ≥ 960px
   When `credit-card-detail.component.html` é renderizado
   Then `.credit-card-detail-page` aplica a mesma regra de grid do critério 5, posicionando `.invoice.card` (fatura, primeiro filho direto, coluna `1.4fr`) e `.purchase-form.card` (formulário de compra, segundo filho direto, coluna `1fr`) lado a lado.

7. **`.card` não permanece limitado a 480px dentro da coluna do grid em desktop**
   Given uma viewport ≥ 960px, onde o contêiner de página já está em modo grid (critérios 5/6)
   When o `.card` de qualquer uma das 4 telas é inspecionado
   Then seu `max-width` deixa de ser `480px` (via `mm-card-width` no breakpoint) — o card ocupa a largura disponível da coluna do grid em vez de ficar travado numa faixa estreita centralizada dentro dela.

8. **Zero regressão de estrutura de DOM / classes testadas — mudança de `.html` só permitida com justificativa explícita**
   Given a suíte de testes atual (172/172, conforme `docs/board.md`, estado pós-MVP-5) e a estrutura de DOM descrita em "Estrutura de DOM atual" (2 filhos diretos por página, já na ordem lista/fatura → formulário)
   When este ticket é implementado
   Then, por padrão, **nenhum** dos 4 arquivos `.html` é alterado, pois `display: grid` aplicado ao contêiner de página já é suficiente para o layout dos critérios 5/6
   And nenhuma classe hoje usada em asserção de teste (`.card`, `.transactions-list`, `.transaction-form`, `.categories-list`, `.category-form`, `.credit-cards-list`, `.credit-card-form`, `.invoice`, `.purchase-form`, e as classes internas de item/linha de cada lista) é renomeada ou removida
   And **se**, excepcionalmente, o `dev-frontend` precisar alterar algum `.html` para viabilizar o grid (ex. introduzir um elemento wrapper novo), isso só é aceito se: (a) nenhuma classe testada hoje for renomeada/removida, (b) a mudança for reportada explicitamente no relato de implementação (não silenciosa), e (c) a suíte completa continuar 172/172 sem exigir edição de nenhum `.spec.ts` além do estritamente necessário para refletir a estrutura nova.

9. **Suíte e build permanecem verdes**
   Given a suíte atual (172/172) e o build de produção limpo
   When `npx ng test --watch=false --browsers=ChromeHeadless` e `npm run build` são executados após a implementação
   Then a suíte continua 172/172 (nenhum teste quebra, nenhum é removido) e o build compila sem erros/warnings novos introduzidos por este ticket.

10. **`login.component.scss` não é tocado**
    Given `login.component.scss` já usa `mm-card-base` (UX-4) com seu próprio `max-width: 380px` local
    When este ticket é implementado
    Then `git diff` não mostra nenhuma alteração em `login.component.scss` nem em `login.component.html` — a tela de login permanece fora de escopo, sem breakpoint novo.

## Casos de borda

- **Wrapper de HTML só se estritamente necessário** (ver critério 8): a expectativa documentada é que **não** seja necessário nenhum wrapper novo, já que os dois `<section class="... card">` de cada tela já são filhos diretos do contêiner de página. Se o `dev-frontend` concluir o contrário durante a implementação, a mudança é permitida nos termos exatos do critério 8 — não deve ser feita "por conveniência" se o CSS puro já resolver.
- **Ordem visual em desktop segue a ordem do DOM já existente**: como o CSS Grid por padrão preserva a ordem dos itens conforme a ordem no DOM (sem `order` customizado), a coluna esquerda/maior (`1.4fr`) sempre corresponde ao primeiro filho (lista/fatura) e a direita/menor (`1fr`) ao segundo (formulário) — nenhuma reordenação via `order` é necessária ou esperada.
- **`credit-card-detail` tem uma estrutura de conteúdo mais complexa dentro do `.card` de fatura** (nav de mês, resumo, lista de parcelas) do que os outros 3 — este ticket não altera nada dentro do `.card` de fatura além do próprio `max-width` (via `mm-card-width`); a hierarquia visual da lista de parcelas (achado #4 do documento de origem) é explicitamente **fora de escopo** (ver abaixo, vira UX-6).
- **`mm-card-width` e `mm-page-shell` não devem ser usados por `login.component.scss`**: ainda que tecnicamente possível de incluir, isso está fora de escopo (ver critério 10) — a tela de login não tem lista+formulário lado a lado nem faz parte dos 4 achados citados na origem deste ticket.
- **`.field--checkbox` e demais estilos internos de formulário (mixins do UX-4)** não são tocados por este ticket — só os dois blocos de contêiner de página / largura do card são extraídos aqui.
- **Nenhum token CSS (`--mm-*`) novo é criado**: os valores `960px` (breakpoint) e `1180px` (largura máxima desktop) são parâmetros dos mixins novos (`$desktop-breakpoint`/`$desktop-max-width`), não tokens globais — não há justificativa para torná-los `--mm-*` neste ticket (candidato a revisão futura se um 5º breakpoint surgir).

## Fora de escopo

- **Achados #2, #3 e #4 de `docs/design/ux-review-2026-08-04.md`** (identificação do cartão/breadcrumb na tela de fatura, `CurrencyPipe`/`DatePipe` na fatura e no limite do cartão, hierarquia tabular/colunas da lista de parcelas) — ficam para o ticket **UX-6**, a ser especificado em seguida.
- **Achados #6, #9 e #10** (mensagem de sucesso pós-criação, opção "Selecione" desabilitada, indicador de cor por bandeira do cartão) — menor prioridade, não pedidos pelo usuário nesta rodada, seguem apenas registrados no documento de revisão.
- **Achado #5** (`.invoice__nav` sem `flex-wrap: wrap` em telas muito estreitas, ~320-360px) — é um ajuste de *mobile* estreito, não de desktop; não faz parte do escopo deste ticket (que trata do breakpoint de desktop), mesmo sendo uma correção de baixo custo. Candidato a ticket futuro ou a ser resolvido junto do UX-6 se o Orquestrador decidir agrupar.
- **`login.component.scss`/`login.component.html`** — fora de escopo (ver critério 10 e "Abordagem técnica escolhida").
- **Qualquer breakpoint intermediário adicional** (ex. tablet dedicado entre 480px e 960px) — a spec define um único breakpoint (`960px`), conforme a sugestão concreta do documento de origem; múltiplos breakpoints não foram pedidos.
- **Alteração de proporção/valores exatos do grid além dos definidos aqui** (`1.4fr 1fr`, `gap: 1.5rem`, `max-width desktop: 1180px`) por motivos puramente estéticos não documentados — qualquer ajuste fino de proporção após implementação é feedback visual a ser tratado como novo ticket, não retrabalho automático deste.
- **Criação de um componente Angular de layout reutilizável** (ex. `PageShellComponent`) — descartado em favor de mixins SCSS, mesmo racional já registrado no UX-4 (não altera `.html`, mantém encapsulamento de estilo por componente).

## Dependências externas / bloqueios conhecidos

Nenhuma. Ticket 100% client-side (CSS/SCSS, possivelmente HTML se o critério 8 exigir), sem dependência de API, CORS ou endpoint novo — validável inteiramente por inspeção de código/DOM e pela suíte de testes existente (Jasmine/Karma), sem exigir a API real disponível. Depende apenas de MVP-2, MVP-3, MVP-4 e MVP-5 já estarem `Done` (todos já concluídos conforme `docs/board.md`) e do UX-4 já ter criado `src/styles/_shared.scss` (também `Done`).

## Referência visual
`docs/design/mockup.pdf`, página 1 ("Painel") — citado indiretamente via `docs/design/ux-review-2026-08-04.md` (seção "Escopo analisado"), que já registrou o que essa página evidencia sobre uso de largura em desktop: grid multi-coluna, cards lado a lado ocupando a largura útil da viewport, em vez de uma coluna única centralizada. Nota de ambiente: a leitura direta do PDF nesta sessão falhou por dependência ausente no ambiente (`pdftoppm`/`poppler-utils` não instalado), então esta spec se apoia na descrição textual já validada pelo `designer` na revisão de origem, não numa nova inspeção pixel a pixel do mock. Reforço do mesmo aviso do `designer`: o mock não cobre as telas de Cartões/Fatura especificamente (não é mock literal dessas telas) — serve apenas como evidência da intenção de layout em desktop (grid, colunas lado a lado), não como fonte de campos/dados (esses continuam vindo exclusivamente de `docs/api-contract.md`).
