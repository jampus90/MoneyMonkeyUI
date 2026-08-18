# MVP-7 — Painel (Dashboard)

## História de usuário
Como usuário autenticado do MoneyMonkey, quero ver uma tela de Painel ao entrar no app, com um resumo do meu saldo, dos meus cartões e das minhas transações mais recentes, para ter uma visão geral da minha situação financeira sem precisar abrir a listagem completa de transações.

## Origem do ticket
Pedido direto do usuário ("quero fazer um dashboard, parecido com o do design do mockup"), referenciando `docs/design/mockup.pdf`, página 1 (única página do mock, tela "Painel"). Escopo de dados restrito ao que existe em `docs/api-contract.md` foi decidido explicitamente com o usuário em 2026-08-17 (ver `docs/board.md`, linha do MVP-7): **só seções com dado real**, nada de placeholder "em breve".

## Endpoints/DTOs envolvidos
Referência: `docs/api-contract.md`. **Nenhum endpoint novo, nenhum DTO novo** — os três `GET` abaixo já são consumidos hoje pelos respectivos `Service`s (`TransactionService`, `CreditCardService`, `CategoryService`); este ticket cria um novo componente que faz suas próprias chamadas a esses métodos já existentes (sem compartilhar estado com `TransactionsComponent`/`CreditCardsComponent`, mesmo padrão já aceito em UX-6 e MVP-6 para `CategoryService.getAll()`).

- **`GET /api/transaction`** `[auth]` → `TransactionResponseList { transactionResponses: TransactionResponse[] }`. Campos usados: `value` (number), `type` (`TransactionType`), `transactionDate?` (string, date, opcional), `categoryId?` (number, opcional), `transactionName` (string).
- **`GET /api/creditcard`** `[auth]` → `CreditCardResponseList { creditCardResponses: CreditCardResponse[] }`. Campos usados: `creditCardId` (number), `creditLimit?` (number, opcional).
- **`GET /api/category`** `[auth]` → `CategoryResponseList { categoryResponses: CategoryResponse[] }`. Campos usados: `categoryId` (number), `name` (string) — mesmo mapa `categoryId → name` montado localmente no novo componente, mesmo padrão de UX-2/MVP-6.
- **`TransactionType`** (enum numérico, `docs/api-contract.md`): `Entrada = 0`, `Saida = 1`. Usado apenas para o cálculo do saldo (critério 9); nenhum outro enum é lido neste ticket.
- **`LoginResponse.firstName`** (`docs/api-contract.md`, seção "Auth") — campo já definido no contrato e já retornado por `POST /api/auth/login`, mas hoje **descartado** por `AuthService` (só `token` é persistido, ver `src/app/core/services/auth.service.ts`). Este ticket estende `AuthService` para persistir esse campo já existente do contrato — não é um campo novo, é um campo do contrato atualmente não aproveitado (ver "Abordagem técnica").

Nenhum endpoint de conta corrente, poupança, orçamento, meta ou conta recorrente existe em `docs/api-contract.md` — essas seções do mock ficam fora de escopo (ver "Fora de escopo"), decisão já registrada com o usuário.

## Abordagem técnica (decisões obrigatórias, sem ambiguidade para o Dev)

### 1. Novo componente `DashboardComponent`, rota `/dashboard`
Novo componente em `src/app/features/dashboard/dashboard.component.ts` (nome de rota em inglês, consistente com as rotas já existentes — `transactions`, `categories`, `credit-cards` — em vez de "painel" em português). Rota `{ path: 'dashboard', component: DashboardComponent }` adicionada a `app.routes.ts`, **além** das rotas já existentes (não substitui `/transactions`).

### 2. `NavBarComponent` ganha o link "Painel", primeiro na lista
`nav-bar.component.html` ganha `<a class="nav-bar__link" routerLink="/dashboard" routerLinkActive="nav-bar__link--active">Painel</a>`, posicionado **antes** de "Transações" (mesma ordem do mock, e fecha explicitamente a lacuna já registrada no histórico do board em 2026-08-03: *"Não foram adicionados os demais itens do mock (Painel, Orçamentos, Metas, Contas, Relatórios...) por não existirem como funcionalidades reais no app ainda"* — Painel agora existe).

### 3. Login passa a navegar para `/dashboard` — mudança de comportamento explícita
`login.component.ts` (`onSubmit()`, hoje `this.router.navigateByUrl('/transactions')` em caso de sucesso) passa a navegar para `this.router.navigateByUrl('/dashboard')`. **Isso é uma mudança de comportamento deliberada e faz parte do escopo deste ticket** — o Painel passa a ser a tela pós-login, por ser a visão geral que o usuário pediu. Consequência direta, também em escopo: `login.component.spec.ts` tem uma asserção hoje (`criterio 1`) que verifica `expect(router.navigateByUrl).toHaveBeenCalledWith('/transactions')` — essa asserção deve ser atualizada para `'/dashboard'` como parte da implementação deste ticket (TDD: o teste vira vermelho com a mudança e deve ser atualizado, não é uma regressão a evitar). `/transactions` continua existindo como rota e continua acessível via `NavBarComponent` — não é removida nem desativada.

### 4. `AuthService` passa a persistir `LoginResponse.firstName`
`AuthService.login()` (`tap`) passa a também persistir `response.firstName` em uma nova chave de `localStorage` (ex. `auth_first_name`), da mesma forma que já persiste `token` hoje. Novo método público `getFirstName(): string | null`, espelhando `getToken()`. `logout()` passa a remover também essa chave, junto da remoção do token. Nenhum outro campo de `LoginResponse` (`expiresAt`, `userId`, `lastName`, `userType`) é persistido neste ticket — fora de escopo, não pedido.

### 5. Saudação: nome (se disponível) + dia da semana + data, 100% client-side
O cabeçalho do Painel exibe uma saudação combinando:
- `AuthService.getFirstName()` — se não-nulo, saudação inclui o nome (ex. "Olá, Ana"); se `null` (sessão antiga sem esse dado persistido, ou storage manipulado), cai no fallback genérico "Olá!" (sem nome), sem quebrar a renderização.
- Dia da semana e data atual, obtidos via `Date` do navegador (sem chamada de API) e formatados em pt-BR (locale já registrado globalmente desde UX-2) — formato exato (ex. "sexta-feira, 17 de agosto de 2026") é decisão técnica do Dev, desde que inclua nome do dia da semana por extenso e a data completa, ambos em pt-BR.

### 6. Saldo total: soma de `TransactionResponse.value` de **todas** as transações retornadas, sem filtro de período
`docs/api-contract.md` não define nenhum parâmetro de filtro de data/período nem paginação em `GET /api/transaction` — a única forma de calcular qualquer agregado é sobre o conjunto completo retornado pela chamada. **"Período" = todas as `transactionResponses` retornadas na única chamada feita**, sem nenhum filtro de data client-side. Cálculo: soma de `value` para `type === TransactionType.Entrada`, subtraída da soma de `value` para `type === TransactionType.Saida`. Resultado exibido via `{{ saldoTotal | currency:'BRL' }}` (mesmo pipe já usado em Transações/Cartões desde UX-2/UX-6) — sem lógica de sinal adicional fora do pipe, já que é um valor agregado único (não uma lista de itens com sinal individual): se o resultado for negativo, o próprio `CurrencyPipe` já formata com o sinal negativo (ex. "-R$ 50,00").

### 7. Variação percentual do saldo: **fora de escopo**, decisão explícita
O mock mostra uma variação percentual do saldo junto do valor total. `docs/api-contract.md` **não oferece nenhum dado histórico ou de período anterior** para comparação: `GET /api/transaction` não tem parâmetro de data/paginação documentado, e `transactionDate` é **opcional** em `TransactionResponse` (nem toda transação necessariamente o tem). Calcular uma variação percentual exigiria inventar uma regra de negócio não definida em nenhum lugar do contrato (que período comparar — "mês atual vs. mês anterior"? "30 dias vs. 30 dias anteriores"? — nenhuma dessas janelas é sugerida pelo contrato) e teria resultado não confiável para transações sem `transactionDate`. **Decisão: a variação percentual não é implementada neste ticket** — apenas o valor absoluto do saldo é exibido (ver critério 9). Se o produto quiser essa variação no futuro, é um ticket novo que deve primeiro resolver como definir "período" de forma não ambígua.

### 8. Card "Cartões": contagem de cartões + soma de `creditLimit`, não "faturas"
O mock rotula esse card como "Cartões · faturas", mas `docs/api-contract.md` não tem nenhum agregado de uso de fatura por cartão — a única forma de obter o valor de fatura de um cartão é `GET /api/creditcard/{creditCardId}/fatura`, **um endpoint por cartão**, que este ticket **não chama em loop** para montar um agregado (fora do escopo definido para este ticket no board — só `GET /api/transaction` e `GET /api/creditcard` estão listados como endpoints deste ticket). **Decisão: o card exibe apenas dado real de `GET /api/creditcard`**: quantidade de cartões cadastrados (`creditCardResponses.length`) e a soma de `creditLimit` dos cartões que o têm definido (campo opcional — cartões sem `creditLimit` contam na quantidade, mas não entram na soma). O rótulo do card no Painel reflete literalmente o que é mostrado (ex. "Cartões · limite total"), evitando o rótulo do mock, que sugeriria dado de fatura não buscado por este ticket.

### 9. Transações recentes: as 5 mais recentes por `transactionDate`, excluindo as sem data
Subconjunto fixo de **5** transações (constante do componente, decisão do PO por não haver nenhuma regra no contrato/mock que defina esse número — 5 é o tamanho padrão adotado para este widget), ordenadas de forma decrescente por `transactionDate` (convertido para `Date`). Transações cujo `transactionDate` é `undefined` (campo opcional) são **excluídas da lista de recentes** — não é possível determinar a posição de recência de uma transação sem data, e incluí-la em qualquer posição arbitrária seria enganoso; elas continuam contando normalmente no cálculo do saldo total (critério 6), que não depende de data. Nome de categoria exibido via mapa `categoryId → name` próprio do componente (mesmo padrão de `categoryName()` em `TransactionsComponent`, UX-2), com o mesmo fallback `'Categoria não encontrada'` para `categoryId` presente mas não encontrado, e ausência de texto de categoria quando `categoryId` é `undefined`. Link "ver todas" (`routerLink="/transactions"`) sempre visível nesta seção, independentemente da quantidade de transações exibidas.

## Referência visual
`docs/design/mockup.pdf`, página 1 (única página, tela "Painel"). Nota de ambiente: a leitura direta do PDF falhou nesta sessão por dependência ausente (`pdftoppm`/`poppler-utils` não instalado) — mesma limitação já registrada nas specs de UX-5 e UX-6. Layout descrito (já validado em rodadas anteriores e na descrição do pedido do usuário para este ticket): header com nav (já existente via `NavBarComponent`, não alterado em sua estrutura, só recebe o novo link "Painel"); saudação "Olá, {nome} — {dia da semana}, {data}"; saldo total em destaque; ilustração/mascote estática; 3 cards de resumo lado a lado; seção "Transações recentes" com link "ver todas". Deste layout, **só entram no escopo deste ticket**: saudação, saldo total (sem variação percentual), o card de resumo de Cartões (não os 3 do mock — Conta Corrente/Poupança não têm dado real, ver "Fora de escopo"), a ilustração/mascote estática, e a seção de Transações recentes. O layout exato (posições, espaçamentos, breakpoints) fica a critério técnico do `dev-frontend`, reaproveitando o design system e os mixins compartilhados já existentes (`src/styles/_shared.scss`, `mm-page-shell`/`mm-card-width` do UX-5) — não é critério de aceite verificável pixel a pixel, mesma granularidade já usada nas specs anteriores para aspectos puramente visuais.

## Critérios de aceite (Given/When/Then)

### Rota e navegação

1. **Nova rota `/dashboard` renderiza o Painel**
   Given o usuário autenticado acessa `/dashboard`
   When a rota é resolvida
   Then `DashboardComponent` é renderizado (rota adicionada a `app.routes.ts`, sem remover nenhuma rota existente).

2. **Link "Painel" na `NavBarComponent`**
   Given qualquer tela autenticada (nav visível, conforme `AppComponent.showNav`)
   When a nav é renderizada
   Then existe um link `routerLink="/dashboard"` com texto "Painel", posicionado antes do link "Transações", com `routerLinkActive` aplicando o mesmo estado ativo já usado nos demais links.

3. **Login navega para `/dashboard` após sucesso**
   Given o usuário submete credenciais válidas em `LoginComponent`
   When `AuthService.login()` retorna `200` com `LoginResponse`
   Then a aplicação navega para `/dashboard` (não mais `/transactions`) — `login.component.spec.ts` deve ser atualizado para refletir esse destino.

4. **`/transactions` permanece intacta e acessível**
   Given a mudança do critério 3
   When o usuário navega manualmente para `/transactions` ou clica no link "Transações" da nav
   Then `TransactionsComponent` continua sendo renderizado normalmente, sem nenhuma mudança de comportamento nessa tela.

### Saudação

5. **Saudação com nome quando `AuthService.getFirstName()` está disponível**
   Given `AuthService.getFirstName()` retorna `'Ana'` (persistido desde o login, critério 8)
   When o Painel é renderizado
   Then a saudação exibida inclui o nome (ex. "Olá, Ana").

6. **Fallback de saudação sem nome**
   Given `AuthService.getFirstName()` retorna `null`
   When o Painel é renderizado
   Then a saudação é exibida em um formato genérico sem nome (ex. "Olá!"), sem lançar erro nem quebrar a renderização do restante da tela.

7. **Dia da semana e data exibidos, sem chamada de API**
   Given o Painel é renderizado em qualquer data
   When a saudação é montada
   Then o dia da semana por extenso e a data completa são exibidos em pt-BR, calculados a partir de `Date` do navegador — nenhuma chamada de rede é feita para obter essa informação.

8. **`AuthService` persiste e remove `firstName` nos mesmos pontos que o token**
   Given `AuthService.login()` recebe `200` com `LoginResponse { firstName: 'Ana', ... }`
   When o login é bem-sucedido
   Then `AuthService.getFirstName()` passa a retornar `'Ana'`
   And, quando `AuthService.logout()` é chamado, `AuthService.getFirstName()` volta a retornar `null` (mesmo comportamento já existente para `getToken()`/token, UX-3).

### Saldo total

9. **Cálculo do saldo — soma de todas as transações retornadas**
   Given `GET /api/transaction` retorna `200` com `TransactionResponseList { transactionResponses: [{ value: 500, type: TransactionType.Entrada, ... }, { value: 120, type: TransactionType.Saida, ... }] }`
   When o Painel calcula o saldo total
   Then o valor exibido é `380` (500 - 120), via `{{ saldoTotal | currency:'BRL' }}`, sem nenhum filtro de data aplicado (critério 6) e sem exibir nenhuma variação percentual (critério 7, fora de escopo).

10. **Loading do saldo**
    Given `GET /api/transaction` ainda não respondeu
    When o Painel é renderizado
    Then um indicador de carregamento é exibido no lugar do saldo (mesmo padrão de `.loading-state` já usado em Transações/Categorias desde UX-1), sem exibir um valor de saldo incorreto/zerado prematuramente.

11. **Erro ao carregar `GET /api/transaction`**
    Given `GET /api/transaction` falha (erro de rede ou qualquer status não-2xx)
    When o Painel tenta calcular o saldo
    Then uma mensagem de erro é exibida no lugar do saldo (texto definido pelo Dev, distinto do estado de sucesso/loading/vazio), e as demais seções do Painel (Cartões, Transações recentes) continuam funcionando de forma independente — a falha nesta chamada não bloqueia as outras.

12. **Lista de transações vazia**
    Given `GET /api/transaction` retorna `200` com `transactionResponses: []`
    When o Painel calcula o saldo
    Then o saldo exibido é `0` (`R$ 0,00` via `CurrencyPipe`), sem erro.

### Card "Cartões"

13. **Cálculo do card — contagem e soma de `creditLimit`**
    Given `GET /api/creditcard` retorna `200` com `creditCardResponses: [{ creditCardId: 1, creditLimit: 1000 }, { creditCardId: 2, creditLimit: 2500 }]`
    When o Painel renderiza o card de Cartões
    Then a quantidade exibida é `2` e a soma de limite exibida é `3500` via `{{ | currency:'BRL' }}`.

14. **Cartão sem `creditLimit` conta na quantidade, não na soma**
    Given `GET /api/creditcard` retorna `200` com `creditCardResponses: [{ creditCardId: 1, creditLimit: 1000 }, { creditCardId: 2 }]` (segundo item sem `creditLimit`)
    When o Painel renderiza o card de Cartões
    Then a quantidade exibida é `2` e a soma de limite exibida é `1000` (apenas o cartão com `creditLimit` definido entra na soma).

15. **Loading do card de Cartões**
    Given `GET /api/creditcard` ainda não respondeu
    When o Painel é renderizado
    Then um indicador de carregamento é exibido no card de Cartões, independente do estado das outras seções.

16. **Erro ao carregar `GET /api/creditcard`**
    Given `GET /api/creditcard` falha (erro de rede ou status não-2xx)
    When o Painel tenta renderizar o card de Cartões
    Then uma mensagem de erro é exibida nesse card, sem bloquear saldo/transações recentes.

17. **Nenhum cartão cadastrado**
    Given `GET /api/creditcard` retorna `200` com `creditCardResponses: []`
    When o Painel renderiza o card de Cartões
    Then a quantidade exibida é `0` e a soma de limite exibida é `R$ 0,00`, sem erro.

### Transações recentes

18. **Até 5 transações mais recentes, ordenadas por `transactionDate` decrescente**
    Given `GET /api/transaction` retorna `200` com 7 transações com `transactionDate` distintas
    When a seção "Transações recentes" é renderizada
    Then exatamente as 5 transações com `transactionDate` mais recente são exibidas, na ordem decrescente (mais recente primeiro).

19. **Transações sem `transactionDate` excluídas da lista de recentes**
    Given `GET /api/transaction` retorna transações onde algumas têm `transactionDate` `undefined`
    When a seção "Transações recentes" é montada
    Then essas transações sem `transactionDate` não aparecem na lista de recentes (mesmo que estejam entre as mais "novas" por ordem de retorno da API), mas continuam somadas normalmente no saldo total (critério 9).

20. **Menos de 5 transações elegíveis (com data)**
    Given `GET /api/transaction` retorna 3 transações, todas com `transactionDate`
    When a seção "Transações recentes" é renderizada
    Then as 3 são exibidas (não há preenchimento artificial até 5), sem erro.

21. **Nome de categoria exibido com o mesmo padrão de fallback da UX-2**
    Given uma transação recente com `categoryId` presente que **não** está no mapa `categoryId → name` do Painel (categoria excluída/inconsistente)
    When a transação é renderizada na lista de recentes
    Then o texto exibido é o mesmo fallback já usado em `TransactionsComponent` (`'Categoria não encontrada'`)
    And uma transação recente sem `categoryId` não exibe nenhum texto de categoria.

22. **Falha ao carregar `GET /api/category` não bloqueia Transações recentes**
    Given `GET /api/category` falha (erro de rede ou status não-2xx)
    When a seção "Transações recentes" é renderizada
    Then a lista de transações continua sendo exibida normalmente, com toda transação que tem `categoryId` caindo no fallback `'Categoria não encontrada'` (mesmo padrão silencioso já adotado em UX-2/MVP-6 — sem estado de erro dedicado para essa chamada).

23. **Link "ver todas" aponta para `/transactions`**
    Given a seção "Transações recentes" é renderizada, com ou sem transações
    When o usuário clica em "ver todas"
    Then a navegação ocorre para `/transactions` (`routerLink="/transactions"`), sempre presente no DOM desta seção.

24. **Loading da seção "Transações recentes"**
    Given `GET /api/transaction` ainda não respondeu
    When o Painel é renderizado
    Then um indicador de carregamento é exibido nesta seção, independente do estado das outras (saldo, card de Cartões).

25. **Erro ao carregar transações recentes**
    Given `GET /api/transaction` falha
    When a seção "Transações recentes" tenta renderizar
    Then uma mensagem de erro é exibida nesta seção (pode reaproveitar o mesmo estado de erro do saldo, já que ambos dependem da mesma chamada — decisão técnica do Dev), sem bloquear o card de Cartões.

26. **Nenhuma transação cadastrada**
    Given `GET /api/transaction` retorna `200` com `transactionResponses: []`
    When a seção "Transações recentes" é renderizada
    Then uma mensagem de estado vazio é exibida (ex. "Nenhuma transação recente"), sem quebrar o link "ver todas" (continua presente e funcional).

## Casos de borda
- `GET /api/transaction`, `GET /api/creditcard` e `GET /api/category` são chamadas **próprias** de `DashboardComponent`, independentes das já existentes em `TransactionsComponent`/`CreditCardsComponent`/`CategoriesComponent` — sem cache/estado compartilhado entre telas, mesmo padrão já aceito no projeto desde UX-6/MVP-6 (não é um problema a resolver neste ticket).
- `creditLimit`, `value`, `transactionDate`, `categoryId` seguem exatamente os tipos do contrato (`number`/`string`/`number`, todos opcionais onde marcado com `?`) — nenhuma comparação trata `categoryId`/`creditCardId` como string (mesmo cuidado já reforçado em todas as specs anteriores, por conta do bug crítico de contrato de 2026-08-03).
- `TransactionType` usado no cálculo do saldo é sempre comparado como número (`TransactionType.Entrada`/`TransactionType.Saida`), nunca string.
- Falhas independentes: uma falha em `GET /api/creditcard` não deve impedir o saldo ou as transações recentes de carregarem, e vice-versa — as três chamadas são independentes entre si (nenhuma depende do sucesso da outra para dispor seu próprio estado de loading/erro/dado).
- `AuthService.getFirstName()` retornando `null` para uma sessão autenticada antes deste ticket (token já existente no `localStorage`, mas sem a chave nova de `firstName`, já que ela só passa a ser gravada a partir deste ticket) é um caso esperado, coberto pelo fallback do critério 6 — não é tratado como erro.
- Nenhum redirecionamento automático em caso de `401` em qualquer uma das três chamadas — mesma decisão já adotada em todos os tickets anteriores (MVP-1 a UX-6): tratamento genérico de erro, sem lógica de redirecionamento para login.
- Ordem de retorno de `GET /api/transaction` não é definida pelo contrato — a ordenação por `transactionDate` decrescente (critério 18) é feita inteiramente client-side, sem assumir que a API já retorna ordenado.

## Fora de escopo
- **Conta Corrente, Poupança, Orçamentos, Metas, Contas recorrentes** — nenhuma dessas seções do mock tem endpoint correspondente em `docs/api-contract.md`. Decisão explícita do usuário (2026-08-17): não implementar nem como placeholder "em breve" — essas seções simplesmente não existem na tela entregue por este ticket.
- **Variação percentual do saldo** — avaliada e descartada explicitamente (ver "Abordagem técnica", item 7): o contrato não define nenhuma noção de período anterior/histórico para comparação, e `transactionDate` opcional tornaria o cálculo não confiável. Só o valor absoluto do saldo é exibido.
- **Uso real de fatura no card "Cartões"** — exigiria chamar `GET /api/creditcard/{creditCardId}/fatura` por cartão (endpoint não listado como parte deste ticket no board); o card mostra apenas quantidade de cartões e soma de `creditLimit`, dados de `GET /api/creditcard`.
- **Persistência de `expiresAt`, `userId`, `lastName`, `userType`** de `LoginResponse` — só `firstName` passa a ser persistido, por ser o único campo necessário para a saudação deste ticket.
- **Edição do próprio link "Transações"/comportamento de `TransactionsComponent`** além do necessário — a única mudança tocando essa tela é a navegação pós-login (login redireciona para `/dashboard`, não mais para `/transactions`); a tela em si não é alterada.
- **Guard de rota protegida para `/dashboard`** (ex. redirecionar não-autenticados) — limitação já conhecida e aceita desde UX-3, não reaberta aqui.
- **Filtro de período configurável pelo usuário** (ex. seletor "este mês"/"últimos 30 dias") para o saldo ou para as transações recentes — não pedido, e o contrato não oferece parâmetro de data em `GET /api/transaction` para sustentar isso de forma eficiente (o filtro teria que ser 100% client-side sobre a lista completa, o que é uma funcionalidade nova não pedida).
- **Alterar o número fixo de 5 transações recentes** para um valor configurável — decisão de produto separada, não pedida.
- **Qualquer elemento interativo na ilustração/mascote** (a imagem é puramente estática, sem dado dinâmico, mesmo espírito do mascote já usado em `login.component`).

## Dependências externas / bloqueios conhecidos
- Depende de MVP-1 (Login/Auth), MVP-2 (Transações), MVP-3 (Categorias) e MVP-4 (Cartões de Crédito), todos `Done` — reaproveita `TransactionService.getAll()`, `CreditCardService.getAll()` e `CategoryService.getAll()` já existentes, sem endpoint/método novo em nenhum desses services.
- CORS já habilitado localmente (`https://localhost:7002`), conforme `docs/board.md` — não bloqueia este ticket em ambiente de desenvolvimento local. Segue pendente para outros ambientes (staging/produção), fora do controle do frontend.
- Leitura direta de `docs/design/mockup.pdf` indisponível nesta sessão (`pdftoppm`/`poppler-utils` ausente) — mesma limitação de ambiente já registrada nas specs de UX-5 e UX-6; a spec se apoia na descrição de layout já fornecida pelo pedido do usuário e pelo histórico do board (entrada de 2026-08-03, quando o mock foi originalmente descrito pelo `designer`).
- Risco residual já registrado no histórico do board: a API real (`/swagger/v1/swagger.json`) nem sempre está disponível para validação do QA; a implementação deste ticket deve, se possível, ser conferida contra o swagger real antes de fechar, especialmente por reaproveitar três chamadas GET simultâneas em uma única tela (risco de regressão cruzada entre as três, mesmo sendo independentes por design).
