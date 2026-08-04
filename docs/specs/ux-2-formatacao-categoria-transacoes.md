# UX-2 — Formatação de valores monetários e exibição do nome da categoria na listagem de Transações

## História de usuário
Como usuário autenticado do MoneyMonkey, quero ver os valores das minhas transações formatados como moeda, a data em formato legível (dd/MM/yyyy) e o nome da categoria (não um número cru) na listagem de transações, para que eu consiga ler e entender minha movimentação financeira rapidamente, sem precisar decodificar valores/IDs brutos.

## Origem do ticket
Achados #2 e #3 (Alta severidade) e recomendações #2 e #3 de `docs/design/ux-review-2026-08-03.md`:

- **Achado #2**: `transactions.component.html:29` renderiza `{{ transactionSign(transaction) }}{{ transaction.value }}` cru (ex. `−187.4`), sem `CurrencyPipe`, sem separador de milhar, sem 2 casas decimais fixas e sem símbolo de moeda.
- **Achado #3**: `transactions.component.html:18-21` mostra literalmente `{{ transaction.categoryId }}` (ex. `3`) em vez do nome da categoria (ex. "Alimentação"), e `transaction.transactionDate` é exibido cru (ISO), sem `DatePipe`.

Este é um ticket **puramente client-side, sem endpoint novo**: `GET /api/category` já é consumido por `CategoryService` (implementado no MVP-3, `src/app/core/services/category.service.ts`) e será reutilizado aqui, injetado em `TransactionsComponent`. `GET /api/transaction` e `POST /api/transaction` continuam exatamente como estão hoje — nenhuma mudança de request/response, DTO ou enum.

## Endpoints/DTOs envolvidos
Referência: `docs/api-contract.md`, seções "Transactions" e "Categories". Nenhum endpoint novo é criado; ambos já são consumidos hoje em outras partes do app.

- **`GET /api/transaction`** `[auth]` — já consumido em `TransactionsComponent.loadTransactions()` (`transactions.component.ts:93-107`). Comportamento inalterado por este ticket.
  ```ts
  TransactionResponse {
    transactionId: number;      // int32
    transactionName: string;
    value: number;
    type: TransactionType;
    paymentMethod?: PaymentMethod;
    categoryId?: number;        // int32, opcional
    transactionDate?: string;   // date, opcional
  }
  ```

- **`GET /api/category`** `[auth]` — já implementado em `CategoryService.getAll()` (`src/app/core/services/category.service.ts:18-20`). Este ticket adiciona o **consumo** desse método em `TransactionsComponent` (nenhuma mudança no `CategoryService` em si).
  ```ts
  CategoryResponseList {
    categoryResponses: CategoryResponse[];
  }

  CategoryResponse {
    categoryId: number;  // int32
    name: string;
    type: TransactionType;
  }
  ```

- `TransactionResponse.categoryId` e `CategoryResponse.categoryId` são ambos `number` (`int32`) — o cruzamento entre os dois é feito por igualdade numérica direta, nunca convertendo para string para comparar.

## Referência visual
`docs/design/mockup.pdf`, página 1 — o widget "Transações recentes" do mock exibe cada item com o valor sempre formatado (`R$ 000,00`, com sinal e cor por `TransactionType`) e uma linha secundária combinando nome de categoria e data (ex. "Alimentação · 03/08"). Este ticket implementa exatamente essa formatação/cruzamento na tela de listagem completa de Transações (`transactions.component.html`), sem alterar layout, estrutura de card ou hierarquia visual além do que já existe hoje — apenas o conteúdo textual exibido nos três pontos: valor, data e categoria.

## Critérios de aceite (Given/When/Then)

### Formatação de valor monetário

1. **Valor de entrada formatado como moeda BRL**
   - Given uma transação com `type = TransactionType.Entrada` e `value = 187.4`
   - When a listagem renderiza o item
   - Then o valor é exibido usando `CurrencyPipe` com `'BRL'` (ex. `R$ 187,40`), com o sinal (`+`) mantido fora do pipe, como já ocorre hoje via `transactionSign(transaction)` (ex. `+ R$ 187,40`).

2. **Valor de saída formatado como moeda BRL**
   - Given uma transação com `type = TransactionType.Saida` e `value = 187.4`
   - When a listagem renderiza o item
   - Then o valor é exibido usando `CurrencyPipe` com `'BRL'` (ex. `R$ 187,40`), com o sinal (`−`) mantido fora do pipe (ex. `− R$ 187,40`).
   - And a classe CSS que determina a cor (`transaction-item__value--positive`/`--negative`, já existente) continua sendo aplicada da mesma forma, inalterada por este ticket.

3. **Valor com casas decimais e separador de milhar**
   - Given uma transação com `value = 1234.5`
   - When a listagem renderiza o item
   - Then o valor exibido tem exatamente 2 casas decimais e separador de milhar conforme a formatação padrão de `CurrencyPipe` para `'BRL'` (ex. `R$ 1.234,50`), não o número cru (`1234.5`).

### Formatação de data

4. **`transactionDate` presente é formatado como dd/MM/yyyy**
   - Given uma transação com `transactionDate` presente (ex. `'2026-08-03'`)
   - When a listagem renderiza o item
   - Then a data é exibida usando `DatePipe` com o formato `'dd/MM/yyyy'` (ex. `03/08/2026`), nunca a string ISO crua.

5. **`transactionDate` ausente não quebra a renderização**
   - Given uma transação sem `transactionDate` (campo ausente/`undefined`, conforme contrato — campo opcional)
   - When a listagem renderiza o item
   - Then nenhuma data é exibida (nem `undefined`, nem `null`, nem string vazia visível) e a linha de metadado (categoria/data) permanece legível, sem separador (`·`) sobrando quando não há data para combinar com a categoria.

### Nome da categoria em vez de `categoryId` cru

6. **`categoryId` de uma transação corresponde a uma categoria existente**
   - Given `GET /api/category` retornou `200` com `CategoryResponseList { categoryResponses: [{ categoryId: 3, name: 'Alimentação', type: TransactionType.Saida }, ...] }`
   - And uma transação na listagem tem `categoryId = 3`
   - When a listagem renderiza o item dessa transação
   - Then a UI exibe o texto `'Alimentação'` (o `name` da categoria correspondente), nunca o número `3` cru.

7. **Categorias carregadas uma única vez ao iniciar a tela**
   - Given o usuário acessa a tela de transações
   - When a tela carrega
   - Then a aplicação envia `GET /api/category` (com `Authorization: Bearer <token>`, anexado automaticamente pelo interceptor) uma única vez durante a inicialização do componente (ex. em `ngOnInit`, junto com `loadTransactions()`), independentemente de quantas transações existam na listagem
   - And o resultado é usado para montar um mapeamento `categoryId → name` (ex. `Map<number, string>` ou equivalente) consultado na renderização de cada item da lista de transações.

8. **`categoryId` ausente na transação (campo opcional)**
   - Given uma transação sem `categoryId` (campo ausente/`undefined`, conforme contrato — campo opcional em `TransactionResponse`)
   - When a listagem renderiza o item
   - Then nenhum nome de categoria é exibido para esse item (nem `undefined`, nem `null`, nem um fallback de "categoria não encontrada" — a ausência de `categoryId` é um caso distinto de um `categoryId` presente mas não localizado, ver critério 9), e a linha de metadado permanece legível sem separador sobrando quando não há categoria para combinar com a data.

9. **`categoryId` presente mas não encontrado no mapa de categorias (categoria excluída/inconsistência)**
   - Given uma transação tem `categoryId = 99`
   - And `GET /api/category` retornou `200`, mas nenhuma `CategoryResponse` no `categoryResponses` tem `categoryId = 99` (categoria não existe mais para o usuário, ou qualquer outra inconsistência de dados)
   - When a listagem renderiza o item dessa transação
   - Then a UI exibe um texto de fallback claro e estável (ex. "Categoria não encontrada"), nunca quebra a renderização do item, nunca exibe `undefined`/`null`, e nunca volta a exibir o número cru do `categoryId` como se fosse um nome válido.

10. **Falha ao carregar `GET /api/category` (erro de rede ou API indisponível)**
    - Given a chamada a `GET /api/category` falha (erro de rede/timeout ou API indisponível, sem código de status HTTP tratável)
    - When a tela de transações carrega
    - Then a listagem de transações **continua sendo renderizada normalmente** a partir de `GET /api/transaction` (que segue sendo uma chamada independente) — a falha em carregar categorias não bloqueia, não trava e não impede a listagem de transações de aparecer
    - And, para toda transação com `categoryId` presente, a UI exibe um fallback textual (ex. o próprio `categoryId` numérico, ou um texto genérico como "Categoria indisponível" — a spec exige apenas que seja um fallback estável e não `undefined`/`null`/renderização quebrada; a escolha exata entre exibir o número ou um texto genérico fica a critério técnico do Dev, desde que consistente com o fallback do critério 9)
    - And nenhuma mensagem de erro relativa a categorias é exibida na tela de transações (esta tela não tem um estado de erro dedicado a "falha ao carregar categorias" — o erro de listagem de transações, `listError`, permanece exclusivo do carregamento de `GET /api/transaction`, comportamento já existente e inalterado).

## Casos de borda
- `value` é sempre um `number` no contrato (`TransactionResponse.value`) — não há cenário de valor ausente/opcional a tratar; `CurrencyPipe` deve ser aplicado a todo item da lista, sem condicional de presença.
- O sinal (`+`/`−`) continua sendo produzido por `transactionSign(transaction)` (lógica já existente em `transactions.component.ts:109-111`, baseada em `TransactionType.Entrada`/`TransactionType.Saida`) — este ticket não deve mover essa lógica para dentro do `CurrencyPipe` nem tentar formatar o sinal negativo via `CurrencyPipe` (ex. não usar `value * -1` para saídas), pois o contrato não define `value` como negativo para saídas; `value` é sempre um número positivo em `TransactionResponse`.
- `transactionDate`, quando presente, é uma string de data (`// date` no contrato, sem hora) — a formatação via `DatePipe` deve tratar corretamente uma string de data pura (ex. `'2026-08-03'`), sem assumir fuso horário ou componente de hora não documentado no contrato.
- O mapa `categoryId → name` deve ser construído a partir de `CategoryResponseList.categoryResponses` completo (todas as categorias do usuário, sem filtro por `type`) — `TransactionResponse.categoryId` não carrega informação de `TransactionType` de categoria que restrinja a busca.
- Este ticket **não** adiciona um segundo estado de carregamento (`isLoadingCategories` ou similar) nem um segundo indicador visual de "Carregando categorias..." na tela — o carregamento de categorias é uma chamada auxiliar e silenciosa para popular o mapa de nomes; o único indicador de carregamento visível da tela continua sendo o de `isLoadingList` (transações), já resolvido em UX-1, inalterado aqui.
- O separador `' · '` entre categoria e data (já existente em `transactions.component.html:20`) só deve aparecer quando **ambos** os valores (nome de categoria resolvido/fallback e data formatada) estiverem presentes para o item — não deve sobrar um `' · '` solto quando só um dos dois existir (mesma regra condicional já aplicada hoje a `categoryId`/`transactionDate`, adaptada ao novo conteúdo textual).
- Enums (`TransactionType`) não são afetados por este ticket — nenhuma mudança na forma como `type` é lido, comparado ou exibido.

## Fora de escopo
- Mensagem de sucesso pós-criação de transação (achado #5, média severidade, de `docs/design/ux-review-2026-08-03.md`) — ticket separado.
- Breakpoint/media query responsivo para a tela de Transações (achado #7) — ticket separado.
- Cor do avatar/dot por `TransactionType` na lista (achado #9, baixa severidade) — ticket separado; o avatar continua sendo o círculo decorativo sólido já existente (`transaction-item__avatar`), inalterado aqui.
- Extração de estilos compartilhados (`.card`, `.field`, botão pill) entre `transactions.component.scss` e `categories.component.scss` (achado #6) — ticket separado.
- Seleção de `categoryId` no formulário de criação de transação (dropdown de categorias no `POST /api/transaction`) — não faz parte deste ticket, que cobre exclusivamente a **listagem**. O formulário de criação (`transactions.component.html:37-100`) permanece inalterado.
- Edição/exclusão de transações ou categorias — sem endpoints correspondentes no contrato (mesma decisão do MVP-2/MVP-3).
- Qualquer alteração em `CategoryService`, `category.model.ts` ou nos DTOs de categoria/transação — este ticket apenas **consome** o que já existe; nenhum campo novo é adicionado a nenhum modelo.
- Indicador de carregamento dedicado para a chamada de categorias — ver "Casos de borda"; não há um segundo estado de loading visível nesta tela.
- Filtros, ordenação, busca ou paginação — não há parâmetros de query documentados em `GET /api/transaction` nem `GET /api/category` no contrato (mesma decisão do MVP-2/MVP-3).
- Redirecionamento automático para login em caso de `401` em `GET /api/category` — mesma decisão já adotada em MVP-1/MVP-2/MVP-3 (tratamento genérico de erro, sem lógica de sessão/expiração).

## Dependências externas / bloqueios conhecidos
- Depende funcionalmente de `CategoryService` (MVP-3, já `Done` conforme `docs/board.md`) estar disponível e implementado exatamente como está hoje em `src/app/core/services/category.service.ts` — este ticket não modifica esse serviço, apenas o injeta em `TransactionsComponent`.
- CORS já habilitado localmente (`https://localhost:7002`), conforme `docs/board.md` — não bloqueia este ticket em ambiente de desenvolvimento local. Segue pendente para outros ambientes (staging/produção), fora do controle do frontend.
- `CurrencyPipe` e `DatePipe` são pipes nativos do Angular (`@angular/common`) — nenhuma dependência externa nova é introduzida; a localidade (`locale`) usada para `CurrencyPipe`/`DatePipe` deve ser compatível com o formato `BRL`/`dd/MM/yyyy` esperado pelos critérios de aceite (ajuste de `LOCALE_ID`/registro de locale, se necessário, é detalhe de implementação do Dev, não um novo endpoint ou dependência de API).
