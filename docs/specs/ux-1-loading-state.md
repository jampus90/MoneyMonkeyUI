# UX-1 — Loading state em Transações e Categorias

## História de usuário
Como usuário autenticado do MoneyMonkey, quero ver um indicador claro de que a lista de transações/categorias está carregando, para que eu não confunda o carregamento inicial com uma tela travada ou com uma lista genuinamente vazia.

## Origem do ticket
Achado #1 (Alta severidade) e recomendação #1 de `docs/design/ux-review-2026-08-03.md`: `TransactionsComponent` e `CategoriesComponent` já expõem a flag `isLoadingList` (`transactions.component.ts:76`, `categories.component.ts:40`), mas os templates (`transactions.component.html:5-9`, `categories.component.html:5-8`) nunca a utilizam. Enquanto `isLoadingList === true` e o array (`transactions`/`categories`) ainda está vazio — estado real durante toda a chamada de rede inicial, disparada em `ngOnInit` via `loadTransactions()`/`loadCategories()` — nenhuma das duas condições hoje existentes (`listError` truthy; `!isLoadingList && length === 0`) é satisfeita, e o template cai no `@else`, renderizando um `<ul>` vazio sem nenhum indicador visual.

Este é um ticket puramente de UI/UX client-side. Não há nenhuma mudança de endpoint, DTO, enum ou contrato de API envolvida — `GET /api/transaction` e `GET /api/category` (`docs/api-contract.md`) continuam sendo consumidos exatamente como hoje, sem nenhum campo novo. O ticket normatiza apenas um terceiro ramo de renderização condicional nos dois templates já existentes.

## Endpoints/DTOs envolvidos
Nenhuma mudança de endpoint/DTO. Referência apenas para contexto (comportamento inalterado):
- `GET /api/transaction` `[auth]` — consumido em `TransactionsComponent.loadTransactions()` (`transactions.component.ts:93-107`).
- `GET /api/category` `[auth]` — consumido em `CategoriesComponent.loadCategories()` (`categories.component.ts:54-68`).

Este ticket não altera `transaction.service.ts` nem `category.service.ts`, nem os modelos em `src/app/core/models/`.

## Arquivos exatos envolvidos
- `src/app/features/transactions/transactions.component.html` (bloco `@if`/`@else if`/`@else` em torno das linhas 5-9)
- `src/app/features/transactions/transactions.component.ts` (flag `isLoadingList`, linha 76; atribuída em `loadTransactions()`, linhas 93-107 — não deve ser alterada por este ticket, apenas consumida pelo template)
- `src/app/features/categories/categories.component.html` (bloco `@if`/`@else if`/`@else` em torno das linhas 5-8)
- `src/app/features/categories/categories.component.ts` (flag `isLoadingList`, linha 40; atribuída em `loadCategories()`, linhas 54-68 — mesma observação)

## Critérios de aceite (Given/When/Then)

Os critérios abaixo são idênticos e devem ser implementados de forma consistente nas duas telas (Transações e Categorias), trocando apenas o texto de domínio (`transações`/`categorias`) e a variável de coleção (`transactions`/`categories`).

1. **Indicador de carregamento visível durante o carregamento inicial**
   - Given o usuário autenticado acessa a tela de transações (ou categorias)
   - When a tela dispara `loadTransactions()`/`loadCategories()` e a requisição HTTP ainda não retornou (`isLoadingList === true` e `transactions.length === 0` / `categories.length === 0`)
   - Then a UI renderiza um indicador de carregamento visível no DOM (ex.: elemento com classe `loading-state` e texto "Carregando...")
   - And não renderiza, simultaneamente, a mensagem de estado vazio nem a mensagem de erro nem nenhum item de `<ul>`.

2. **Indicador de carregamento desaparece quando a lista carrega com itens**
   - Given o indicador de carregamento estava visível (critério 1)
   - When a requisição retorna `200` com `transactionResponses`/`categoryResponses` não vazio (`isLoadingList` passa a `false`, lista passa a ter length > 0)
   - Then o indicador de carregamento não está mais presente no DOM
   - And a listagem de itens é renderizada normalmente (um `<li>` por elemento, comportamento inalterado deste ticket).

3. **Indicador de carregamento desaparece quando a lista carrega vazia (estado vazio real)**
   - Given o indicador de carregamento estava visível (critério 1)
   - When a requisição retorna `200` com `transactionResponses: []` / `categoryResponses: []` (`isLoadingList` passa a `false`, lista permanece com length 0)
   - Then o indicador de carregamento não está mais presente no DOM
   - And a mensagem de estado vazio ("Nenhuma transação cadastrada ainda" / "Nenhuma categoria cadastrada ainda") é exibida
   - And o indicador de carregamento e a mensagem de estado vazio nunca aparecem simultaneamente no DOM.

4. **Indicador de carregamento desaparece quando ocorre erro ao carregar**
   - Given o indicador de carregamento estava visível (critério 1)
   - When a requisição falha (erro de rede ou API indisponível, sem código de status HTTP — mesmo cenário já coberto por MVP-2/MVP-3) e `listError` é definido (`isLoadingList` passa a `false`)
   - Then o indicador de carregamento não está mais presente no DOM
   - And a mensagem de erro de carregamento é exibida (comportamento já existente, inalterado por este ticket)
   - And o indicador de carregamento e a mensagem de erro nunca aparecem simultaneamente no DOM.

5. **Comportamento idêntico entre as duas telas**
   - Given as telas de Transações e Categorias, cada uma em seu próprio estado de carregamento inicial (`isLoadingList === true`, lista vazia)
   - When ambas exibem o indicador de carregamento
   - Then a estrutura de marcação usada é consistente entre as duas (mesmo nome de classe `loading-state`, mesmo texto "Carregando...", mesma posição no fluxo condicional: antes da checagem de erro e antes da checagem de estado vazio), de forma que um teste de DOM idêntico (a menos do seletor de componente) passe nas duas telas.

## Casos de borda
- **Ordem de precedência das quatro ramificações do template** (loading → erro → vazio → lista): a implementação deve seguir exatamente esta ordem de avaliação porque, na implementação atual, `isLoadingList` é sempre colocado em `false` antes ou junto de `listError` ser definido (`loadTransactions()`/`loadCategories()`, callback `error`) — ou seja, `isLoadingList === true` e `listError` truthy nunca coexistem na implementação atual dos componentes `.ts`; ainda assim, a ordem de checagem no template deve colocar `isLoadingList` antes de `listError` para que a spec seja explícita e à prova de futuras mudanças no componente.
- **Recarregamento com lista já preenchida** (ex.: uma futura chamada a `loadTransactions()`/`loadCategories()` disparada por um botão de atualizar, hoje inexistente): o indicador de carregamento só deve aparecer quando a lista ainda está vazia (`length === 0`) — se a lista já tinha itens de um carregamento anterior e `isLoadingList` volta a `true`, este ticket não exige ocultar a lista existente nem sobrepor um indicador (esse comportamento de "refresh com lista populada" está fora do escopo verificável aqui, pois nenhum caminho da UI atual dispara um segundo carregamento).
- **Texto exato do indicador**: "Carregando..." é o texto de referência desta spec; qualquer texto equivalente é aceitável desde que seja o mesmo nas duas telas e estável o suficiente para ser localizado por um teste de DOM (ex.: `By.css('.loading-state')` ou busca por texto).
- Este ticket não introduz nenhuma nova flag/estado no componente `.ts` — `isLoadingList`, `listError`, `transactions`/`categories` já existem e não devem ser renomeados ou ter sua lógica de atribuição alterada (`loadTransactions()`/`loadCategories()` permanecem como estão).
- Não há cenário de erro de validação client-side neste ticket — a listagem não passa por formulário, é carregamento automático em `ngOnInit`.

## Fora de escopo
- Qualquer alteração na lógica de `loadTransactions()`/`loadCategories()`, no serviço (`transaction.service.ts`/`category.service.ts`) ou no tratamento de erro `400`/`401`/erro de conexão — comportamento já coberto por MVP-2 e MVP-3, inalterado aqui.
- Indicador de carregamento para as ações de **criação** (`onSubmit()`/`POST /api/transaction`/`POST /api/category`) — este ticket cobre exclusivamente o carregamento da **listagem** (`GET`), não o estado de submissão do formulário.
- Skeleton screens, spinners animados, barras de progresso ou qualquer solução visual além de um indicador textual simples — a spec exige apenas que o estado exista e seja testável via DOM; a estética exata (ex.: usar um spinner CSS em vez de texto) fica a critério técnico do Dev, desde que a estrutura continue localizável por um seletor estável (seguindo a mesma decisão já adotada em MVP-2/MVP-3 para elementos sem especificação visual obrigatória).
- Um botão/mecanismo de "atualizar lista" (refresh manual) — não existe hoje em nenhuma das telas e não é criado por este ticket; o caso de borda "recarregamento com lista já preenchida" é apenas documentado preventivamente, não implementado.
- Qualquer outro item do documento de revisão de UX (formatação monetária, nome de categoria na listagem de transações, logout, mensagem de sucesso pós-criação, extração de estilos compartilhados, breakpoints responsivos, etc.) — cada um desses é um achado/recomendação separado em `docs/design/ux-review-2026-08-03.md` e deve virar ticket próprio; este ticket resolve exclusivamente o achado #1 (Alta severidade).

## Dependências externas / bloqueios conhecidos
Nenhuma. Este é um ticket 100% client-side, sem dependência de API, CORS ou de nenhum outro ticket em andamento — pode ser implementado e testado de forma totalmente isolada com `HttpTestingController` (mesmo padrão já usado nos testes de MVP-2 e MVP-3), sem exigir a API real disponível.
