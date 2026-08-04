# UX-4 — Extrair estilos compartilhados (card/campo de formulário/botão pill) para eliminar duplicação SCSS entre telas

## História de usuário
Como desenvolvedor(a) frontend do MoneyMonkey, quero que os blocos de estilo repetidos entre telas (card container, campo de formulário, botão pill de submit) venham de uma única fonte compartilhada, para que futuras telas (ex. Cartões de Crédito, MVP-4, ainda em Backlog) não precisem copiar o mesmo bloco de CSS de novo e para que qualquer ajuste visual futuro seja feito em um único lugar, sem risco de divergência silenciosa entre telas (como já ocorreu: `.transaction-item__avatar` existe só em Transações).

## Origem do ticket
Achado #6 (Média severidade) e recomendação #6 de `docs/design/ux-review-2026-08-03.md`: "Extrair os blocos `.card`, `.field input/select` e o botão pill para um único lugar compartilhado — ex. um mixin/placeholder SCSS (`%mm-card`, `%mm-form-field`) importado nos três `.component.scss`, ou um `CardComponent`/diretiva de classe utilitária em `src/styles.scss`."

Este é um ticket de **refactor puramente estrutural/visual, sem nenhuma mudança de comportamento funcional, de template (HTML) ou de lógica (TS)**. Os critérios de aceite não validam nenhum comportamento novo — validam a **ausência de regressão** visual/funcional após a extração e a **eliminação efetiva** da duplicação identificada. Foi agendado por último no ciclo UX (depois de UX-1/UX-2/UX-3) justamente para não colidir com as mudanças de template em andamento nesses tickets (ver `docs/board.md`, histórico de decisões).

## Endpoints/DTOs envolvidos
Nenhum. Ticket 100% de estilo (SCSS), sem nenhuma chamada HTTP, DTO, model ou service envolvido.

## Levantamento de duplicação confirmado (lido diretamente do código, não suposto)

Comparando `src/app/features/transactions/transactions.component.scss`, `src/app/features/categories/categories.component.scss` e `src/app/features/login/login.component.scss`:

1. **`.card` — byte a byte idêntico entre Transações e Categorias** (`transactions.component.scss:11-20` e `categories.component.scss:11-20`):
   ```scss
   .card {
     width: 100%;
     max-width: 480px;
     margin: 0 auto;
     background: var(--mm-color-surface);
     border-radius: var(--mm-radius-card);
     box-shadow: var(--mm-shadow-card);
     padding: 1.75rem 1.5rem;
     box-sizing: border-box;
   }
   ```
   O Login tem um equivalente conceitual, `.login-card` (`login.component.scss:11-22`), mas **não é idêntico**: usa `max-width: 380px` (não 480px), `padding: 2.5rem 2rem` (não `1.75rem 1.5rem`) e acrescenta `display: flex; flex-direction: column; gap: 1.75rem` (que `.card` não tem — no Login, o layout interno do card é feito pelo próprio `.login-card`; em Transações/Categorias, é feito pelo `form` interno). As propriedades que **são** idênticas entre os três são apenas: `background: var(--mm-color-surface)`, `border-radius: var(--mm-radius-card)`, `box-shadow: var(--mm-shadow-card)`, `box-sizing: border-box`.

2. **Contêiner do formulário — idêntico em conteúdo, com nomes de seletor diferentes**: `form { display: flex; flex-direction: column; gap: 1.125rem; }` em Transações (`:91-95`) e Categorias (`:73-77`) vs. `.login-form { display: flex; flex-direction: column; gap: 1.125rem; }` em Login (`:45-49`, mais `.login-form__title` que é específico do Login). As três propriedades são idênticas.

3. **`.field` (contêiner) e `.field label` — byte a byte idênticos nos três arquivos** (`transactions.component.scss:97-107`, `categories.component.scss:79-89`, `login.component.scss:58-68`).

4. **`.field input, .field select` — o bloco de estilo de campo em si é byte a byte idêntico** entre Transações (`:109-125`) e Categorias (`:91-107`), incluindo o `&:focus`. O Login usa apenas `.field input` (`:70-85`, sem `select`, pois não há nenhum `<select>` no formulário de login), mas as propriedades declaradas (`font-family`, `font-size`, `color`, `background`, `border`, `border-radius`, `padding`, `box-sizing` e o `&:focus`) são **idênticas** às dos outros dois.

5. **`.field-error, .form-error` — byte a byte idêntico nos três arquivos** (`transactions.component.scss:127-132`, `categories.component.scss:109-114`, `login.component.scss:87-92`).

6. **Botão pill de submit — idêntico em todas as propriedades, exceto o nome da classe**: `.transaction-form__submit` (`:134-155`), `.category-form__submit` (`:116-137`) e `.login-form__submit` (`:94-115`) declaram exatamente as mesmas propriedades (`margin-top`, `border`, `border-radius: var(--mm-radius-pill)`, `background: var(--mm-color-primary)`, `color: #ffffff`, `font-family`, `font-size`, `font-weight`, `padding`, `cursor`, `transition`, `&:hover`, `&:focus-visible`).

Ou seja: a duplicação real é **maior** do que os três itens citados literalmente na recomendação (`.card`, `.field input/select`, pill button) — inclui também `.field`, `.field label`, `.field-error`/`.form-error` e o contêiner de formulário. Todos os tokens usados (`--mm-color-surface`, `--mm-radius-card`, `--mm-shadow-card`, `--mm-color-input-bg`, `--mm-color-border`, `--mm-radius-field`, `--mm-color-primary`, `--mm-color-primary-dark`, `--mm-radius-pill`, `--mm-color-text`, `--mm-color-text-muted`) já existem em `src/styles.scss:4-19` — nenhum token novo é necessário para este ticket.

## Abordagem técnica escolhida

**Mixins SCSS em um novo partial compartilhado `src/styles/_shared.scss`, consumidos via `@use` + `@include` dentro de cada `*.component.scss` existente — sem introduzir nenhum componente Angular novo, sem alterar nenhum `.html`/`.ts`.**

Justificativa, com base no que foi lido:
- O projeto é 100% standalone components (sem NgModules); um `CardComponent` novo exigiria alterar os três templates (`transactions.component.html`, `categories.component.html`, `login.component.html`) para envolver o conteúdo existente em `<mm-card>` ou similar — isso violaria a restrição forte deste ticket de **não alterar nenhum seletor/estrutura exposta no DOM** e aumentaria desnecessariamente o raio de mudança (e o risco de quebrar os testes existentes de `transactions.component.spec.ts`/`categories.component.spec.ts`/`login.component.spec.ts`, que hoje fazem asserções sobre a estrutura do DOM renderizado).
- Placeholders SCSS (`%mm-card` + `@extend`) foram considerados (é a sugestão literal da recomendação), mas foram descartados em favor de **mixins** (`@mixin` + `@include`) por simplicidade de sintaxe e por não depender de nuances de namespacing de `@extend` com módulos Sass (`@use`) — mixins com `@include module.nome-do-mixin;` têm comportamento direto e previsível, reduzindo risco de erro de implementação.
- Cada `*.component.scss` continua sendo compilado isoladamente pelo Angular (view encapsulation por componente) — usar mixins mantém esse isolamento: o CSS final gerado por componente é equivalente ao atual (apenas com a *origem* do texto compartilhada, não o *output* compilado), o que preserva o comportamento de encapsulamento de estilo que já existe hoje sem exigir nenhuma mudança de `ViewEncapsulation`.
- Como as propriedades do `.card`/`.login-card` **não são 100% idênticas** (dimensões/padding/layout interno diferem), o mixin de card é dividido em dois níveis: um mixin `mm-card-base` (propriedades visuais 100% idênticas nos três: `background`, `border-radius`, `box-shadow`, `box-sizing`) incluído por `.card` (Transações/Categorias) e por `.login-card` (Login); cada seletor mantém localmente as propriedades que já divergiam antes do refactor (`width`, `max-width`, `margin`, `padding`, `display`/`flex-direction`/`gap` no caso do Login). Isso evita "forçar" uma unificação visual que não existe hoje no código real (o que seria uma mudança de comportamento, fora de escopo).

Mixins a criar em `src/styles/_shared.scss` (nomes ilustrativos — o `dev-frontend` pode ajustar nomenclatura interna do Sass, desde que a saída visual/DOM não mude):
- `mm-card-base` — subconjunto 100% comum de `.card`/`.login-card` (`background`, `border-radius`, `box-shadow`, `box-sizing`).
- `mm-form-stack` — layout do contêiner de formulário (`display: flex; flex-direction: column; gap: 1.125rem;`), incluído por `form` (Transações/Categorias) e `.login-form` (Login).
- `mm-field-group` — `.field` (contêiner) e `.field label`, idênticos nos três.
- `mm-form-field-input` — as propriedades de `.field input`/`.field select` (incluindo `&:focus`), incluído por `.field input, .field select` (Transações/Categorias) e por `.field input` (Login, sem `select`).
- `mm-field-error` — `.field-error, .form-error`, idêntico nos três.
- `mm-pill-button` — o botão de submit, incluído por `.transaction-form__submit`, `.category-form__submit` e `.login-form__submit` (cada um mantendo seu próprio nome de classe no seletor — só o conteúdo do bloco vem do mixin).

Nenhuma classe do DOM é renomeada, removida ou adicionada em nenhum template. O único arquivo novo é `src/styles/_shared.scss`; os arquivos alterados são exclusivamente `transactions.component.scss`, `categories.component.scss` e `login.component.scss` (cada um passa a ter `@use` do partial compartilhado e `@include` dentro dos seletores já existentes).

## Arquivos exatos envolvidos
- **Novo**: `src/styles/_shared.scss` — mixins `mm-card-base`, `mm-form-stack`, `mm-field-group`, `mm-form-field-input`, `mm-field-error`, `mm-pill-button`, usando exclusivamente os tokens já existentes em `src/styles.scss:4-19` (nenhum token novo criado por este ticket).
- `src/app/features/transactions/transactions.component.scss` — `.card`, `form`, `.field`, `.field input, .field select`, `.field-error, .form-error` e `.transaction-form__submit` passam a `@include` os mixins compartilhados no lugar das propriedades duplicadas; propriedades específicas dessa tela (ex. `.transaction-item__avatar`, `.transaction-item__value--positive/negative`) permanecem intocadas.
- `src/app/features/categories/categories.component.scss` — mesma mudança, para `.card`, `form`, `.field`, `.field input, .field select`, `.field-error, .form-error` e `.category-form__submit`; propriedades específicas (`.category-item__type--positive/negative`, etc.) permanecem intocadas.
- `src/app/features/login/login.component.scss` — `.login-card` passa a incluir `mm-card-base` mantendo suas propriedades locais divergentes (`max-width: 380px`, `padding: 2.5rem 2rem`, `display: flex; flex-direction: column; gap: 1.75rem`); `.login-form`, `.field`, `.field input`, `.field-error, .form-error` e `.login-form__submit` passam a `@include` os mixins compartilhados; propriedades específicas (`.login-brand`, `.login-brand__mascot`, `.login-brand__name`, `.login-form__title`) permanecem intocadas.
- **Nenhum** arquivo `.html` ou `.ts` é alterado por este ticket (nem de componente, nem de teste).

## Critérios de aceite (Given/When/Then)

1. **Os blocos duplicados identificados vêm de uma fonte única compartilhada**
   - Given `src/styles/_shared.scss` existe com os mixins `mm-card-base`, `mm-form-stack`, `mm-field-group`, `mm-form-field-input`, `mm-field-error` e `mm-pill-button`
   - When `transactions.component.scss`, `categories.component.scss` e `login.component.scss` são inspecionados
   - Then nenhum dos seis blocos listados em "Levantamento de duplicação confirmado" (itens 1 a 6) tem seu conjunto de propriedades declarado mais de uma vez de forma literal/copiada — cada ocorrência é um `@include` do mixin correspondente (ou, no caso de `.card`/`.login-card`, do subconjunto comum `mm-card-base` mais as propriedades locais divergentes já existentes antes do refactor).

2. **Nenhum seletor/classe exposto no DOM muda (restrição forte)**
   - Given o estado de `transactions.component.html`, `categories.component.html` e `login.component.html` antes deste ticket
   - When o refactor de UX-4 é aplicado
   - Then nenhum desses três arquivos `.html` é modificado, e nenhuma classe CSS usada nos templates (`card`, `field`, `field-error`, `form-error`, `transaction-form__submit`, `category-form__submit`, `login-form__submit`, `transaction-item__avatar`, etc.) é renomeada, removida ou adicionada — a árvore de classes renderizada é idêntica, elemento a elemento, antes e depois do refactor.

3. **Suíte de testes completa permanece 100% verde, sem alteração de `.spec.ts` além do estritamente necessário**
   - Given a suíte atual (106/106 testes, conforme `docs/board.md`, estado pós-UX-3)
   - When `npx ng test --watch=false --browsers=ChromeHeadless` é executado após o refactor
   - Then a suíte continua 106/106 (nenhum teste quebra, nenhum teste é removido)
   - And nenhum arquivo `.spec.ts` existente (`transactions.component.spec.ts`, `categories.component.spec.ts`, `login.component.spec.ts`, ou qualquer outro) é alterado, salvo se um teste específico dependesse de um detalhe de implementação de CSS que este refactor necessariamente precise tocar (o que não é esperado, dado que nenhuma classe/estrutura de DOM muda) — qualquer alteração de `.spec.ts` que ocorra deve ser justificada explicitamente pelo `dev-frontend` no relato de implementação.

4. **Build de produção limpo, sem aumento inesperado de bundle**
   - Given o build de produção atual (`npm run build`) compila sem erros
   - When o build é executado após o refactor
   - Then o build continua compilando sem erros/warnings novos introduzidos pelo refactor
   - And o tamanho do bundle de estilos dos três componentes afetados (`transactions`, `categories`, `login`) não aumenta de forma inesperada — variação esperada é próxima de zero a levemente positiva (poucas dezenas/centenas de bytes), já que a extração é de *origem* (Sass) e não elimina a duplicação no *CSS compilado final* por componente (cada `*.component.scss` continua sendo compilado isoladamente pelo Angular, com view encapsulation por componente) — um aumento grande e não explicado (ex. ordens de magnitude) deve ser investigado antes de considerar o ticket concluído.

5. **Regressão visual/funcional: nenhuma mudança perceptível no resultado renderizado**
   - Given as três telas (`/login`, `/transactions`, `/categories`) renderizadas antes do refactor
   - When as mesmas telas são renderizadas após o refactor (mesmos dados de exemplo)
   - Then o resultado visual (cores, espaçamentos, raios de borda, sombras, tipografia dos elementos `.card`/`.login-card`, `.field input`/`.field select`, botões pill) é idêntico ao estado anterior — nenhuma propriedade CSS computada muda de valor para nenhum dos seletores citados em "Levantamento de duplicação confirmado".

## Casos de borda

- **`.login-card` não deve ser forçado a ter as mesmas dimensões de `.card`**: `max-width` (380px vs 480px) e `padding` (2.5rem 2rem vs 1.75rem 1.5rem) são propriedades que já divergiam entre Login e as outras duas telas antes deste ticket — o refactor não deve unificá-las, pois isso seria uma mudança visual nova, fora de escopo (ver "Fora de escopo"). Apenas as propriedades que já eram idênticas nos três (`background`, `border-radius`, `box-shadow`, `box-sizing`) migram para o mixin compartilhado `mm-card-base`.
- **`.field input, .field select` (Transações/Categorias) vs. `.field input` (Login, sem `select`)**: o mixin `mm-form-field-input` deve ser inclusível tanto por um seletor com `select` quanto por um sem — a ausência de `<select>` no formulário de Login não deve levar à criação de um estilo de `select` não utilizado nem à necessidade de duplicar o mixin em duas variantes.
- **Ordem de precedência de `@include` vs. propriedades locais**: onde uma tela precisa de uma propriedade adicional não coberta pelo mixin (ex. `.login-card` com `display: flex; flex-direction: column; gap: 1.75rem`), essa propriedade continua declarada localmente no próprio seletor, fora do mixin — o mixin nunca deve tentar cobrir propriedades que hoje divergem entre telas.
- **Nenhum novo token CSS (`--mm-*`) deve ser criado por este ticket**: todos os mixins usam exclusivamente os tokens já existentes em `src/styles.scss:4-19`. Se o `dev-frontend` identificar necessidade de um token novo durante a implementação, isso é sinal de que o escopo está extrapolando o refactor puro e deve ser sinalizado, não criado silenciosamente.
- **Testes de snapshot/estrutura de DOM que hoje passam devem continuar passando sem edição**: se algum teste hoje afirma a presença de uma classe (ex. `fixture.nativeElement.querySelector('.card')`), ele deve continuar encontrando o elemento exatamente da mesma forma, já que nenhuma classe é renomeada.

## Fora de escopo

- **Qualquer mudança visual ou comportamental nova** — este ticket não é uma tela nova nem uma correção de UX; é puramente uma reorganização de onde o CSS mora. Nenhuma cor, espaçamento, raio, sombra ou comportamento de foco deve mudar de valor computado.
- **Unificar `.card` e `.login-card` para terem exatamente as mesmas dimensões/padding** — as divergências de `max-width`/`padding`/layout interno já existiam antes deste ticket e não são tratadas aqui (ver "Casos de borda").
- **Extração de tokens de tipografia/espaçamento** (achado #10 de `docs/design/ux-review-2026-08-03.md`, ex. `--mm-font-size-label`, `--mm-space-sm/md`, reset global `box-sizing`) — candidato a ticket futuro, não criado ainda, e não faz parte de UX-4.
- **Breakpoints responsivos** (achado #7 de `docs/design/ux-review-2026-08-03.md`, ex. `@media (min-width: 960px)` para lado a lado lista/formulário) — candidato a ticket futuro, não criado ainda, e não faz parte de UX-4.
- **Criação de um componente Angular de UI reutilizável** (ex. `CardComponent`, `FormFieldComponent`) — descartado nesta spec em favor de mixins SCSS (ver "Abordagem técnica escolhida"); se o Orquestrador/usuário quiser revisitar essa decisão, é um ticket/discussão separado, não uma alteração deste ticket já em andamento.
- **Aplicar os mixins compartilhados a telas ainda não implementadas** (ex. Cartões de Crédito, MVP-4, ainda em Backlog) — este ticket só toca os três `.component.scss` já existentes (`transactions`, `categories`, `login`). Telas futuras devem consumir `src/styles/_shared.scss` desde o início (reduzindo o risco do achado #10 se repetir), mas isso é responsabilidade do ticket que implementar essa tela, não deste.
- **Qualquer outro achado do documento de revisão** (mensagem de sucesso pós-criação, cor do avatar por tipo, opção "Selecione" desabilitada, etc.) — não fazem parte deste ticket.

## Dependências externas / bloqueios conhecidos

Nenhuma. Ticket 100% client-side, sem dependência de API, CORS ou de nenhum endpoint novo — pode ser implementado e validado inteiramente por inspeção visual/DOM e pela suíte de testes existente (Jasmine/Karma), sem exigir a API real disponível. Depende apenas de UX-1, UX-2 e UX-3 já estarem `Done` (conforme `docs/board.md`) para não colidir com as mudanças de template desses tickets — todos já concluídos no momento em que esta spec foi escrita.
