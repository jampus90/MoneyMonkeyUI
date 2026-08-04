# MVP-6 — Seleção de categoria na criação de Transações

## História de usuário
Como usuário autenticado do MoneyMonkey, quero escolher a categoria de uma transação ao lançá-la (ex.: "comprei uma calça no pix, R$300, categoria: roupa"; "comprei uma carne no débito, R$50, categoria: mercado"), para que minhas transações fiquem categorizadas desde a criação, sem depender de edição posterior (que o contrato nem oferece).

## Origem do ticket
Lacuna deixada de propósito no MVP-2: o formulário de criação de transação (`src/app/features/transactions/`) foi implementado sem seleção de `categoryId` porque, na época, o MVP-3 (Categorias) ainda estava em `Backlog` (ver `docs/specs/mvp-2-dashboard-transacoes.md`, seção "Fora de escopo"). O MVP-3 está `Done`. A UX-2 adicionou `CategoryService` a `TransactionsComponent` e passou a **exibir** o nome da categoria na listagem (mapa `categoryId → name`, montado em `loadCategories()`), mas explicitamente deixou a **seleção** de categoria no formulário de criação fora de escopo (ver `docs/specs/ux-2-formatacao-categoria-transacoes.md`, seção "Fora de escopo": *"Seleção de `categoryId` no formulário de criação de transação (dropdown de categorias) — não faz parte deste ticket"*). Este ticket fecha essa lacuna.

## Endpoints/DTOs envolvidos
Referência: `docs/api-contract.md`, seções "Transactions" e "Categories". **Nenhum endpoint novo** — ambos já são consumidos hoje em `TransactionsComponent` (`GET /api/category` desde a UX-2, `POST /api/transaction` desde o MVP-2).

- **`GET /api/category`** `[auth]` — já consumido em `TransactionsComponent.loadCategories()` (chamado em `ngOnInit`, junto com `loadTransactions()`). Este ticket reutiliza essa mesma chamada para popular o `<select>` de categoria do formulário de criação — **não introduz uma segunda chamada** a `GET /api/category`.
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

- **`POST /api/transaction`** `[auth]` — já consumido em `TransactionsComponent.onSubmit()`/`buildRequest()`. Este ticket passa a incluir `categoryId` no `TransactionRequest` quando uma categoria for selecionada no formulário.
  ```ts
  TransactionRequest {
    transactionName: string;          // max 100
    value: number;                    // > 0.01
    type: TransactionType;
    paymentMethod?: PaymentMethod;
    categoryId?: number;              // int32, opcional
    transactionDate?: string;         // date, opcional
  }
  ```
  **Response 400**: quando `categoryId` não pertence ao usuário autenticado (contrato, seção "Transactions"). Esse caminho de erro já é tratado de forma genérica em `TransactionsComponent` desde o MVP-2 (mensagem `CREATE_BAD_REQUEST_MESSAGE`); este ticket não altera esse tratamento, apenas o torna alcançável de fato via UI (antes só era alcançável defensivamente, sem campo exposto).

- `TransactionRequest.categoryId` e `CategoryResponse.categoryId` são ambos `number` (`int32`) — o `<select>` deve usar `[ngValue]` numérico (`category.categoryId`), nunca `value` string, mesmo padrão já usado nos `<select>` de `type`/`paymentMethod` em `transactions.component.html` e de `type` em `categories.component.html`. Não reintroduzir o bug crítico de contrato já documentado em `docs/board.md` (enums/`*Id` como string em vez de número).

## Decisão de escopo: `categoryId` é opcional no formulário
`docs/api-contract.md` define `TransactionRequest.categoryId?: number` como **opcional** — o contrato permite criar uma transação sem categoria. Este ticket **mantém `categoryId` opcional no formulário** (sem `Validators.required` no novo campo), pelos seguintes motivos:
- Não há nenhuma regra no contrato que torne `categoryId` obrigatório; adicionar uma obrigatoriedade client-side além do que o contrato exige seria inventar uma regra de negócio não documentada.
- O padrão já existente no formulário para outro campo opcional do mesmo DTO (`paymentMethod`) segue a mesma lógica: `<select>` com opção padrão representando "não selecionado", omitido do payload quando não preenchido. O novo campo de categoria segue esse mesmo padrão, por consistência.
- Os exemplos de uso citados pelo usuário mostram intenção de categorizar, mas isso é uma preferência de UX, não uma obrigatoriedade do contrato — se o usuário quiser tornar obrigatório no futuro, isso é uma decisão de produto separada, a ser ticketada explicitamente (não implícita aqui).

## Referência visual
`docs/design/mockup.pdf`, página 1 — como já registrado em `docs/specs/mvp-2-dashboard-transacoes.md`, a única página do mock mostra o widget "Transações recentes" do Painel/Dashboard, não o formulário de criação de transação em si (não há mock do formulário, nem da posição exata de um campo de categoria dentro dele). A posição do novo `<select>` de categoria no formulário (`transactions.component.html`) fica a critério técnico do Dev — os critérios de aceite abaixo definem o comportamento funcional verificável, não o layout exato.

## Critérios de aceite (Given/When/Then)

### Populando o `<select>` de categoria

1. **Select exibe as opções de categoria retornadas por `GET /api/category`**
   - Given `GET /api/category` (chamada já existente em `ngOnInit`, feita uma única vez) retorna `200` com `CategoryResponseList { categoryResponses: [{ categoryId: 3, name: 'Roupa', type: TransactionType.Saida }, { categoryId: 7, name: 'Mercado', type: TransactionType.Saida }] }`
   - When o formulário de criação de transação é renderizado
   - Then o `<select>` de categoria exibe uma `<option>` para cada `CategoryResponse`, com `[ngValue]` igual ao `categoryId` numérico (nunca `value` string) e o texto visível incluindo pelo menos `name` (ex. `'Roupa'`, `'Mercado'`)
   - And existe uma opção adicional representando "nenhuma categoria selecionada" (ex. `[ngValue]="null"`, rótulo tipo "Nenhuma"), selecionada por padrão.

2. **Nenhuma chamada adicional a `GET /api/category` é feita para popular o select**
   - Given a tela de transações carrega normalmente
   - When o formulário de criação é renderizado com o `<select>` de categoria populado
   - Then apenas uma chamada a `GET /api/category` ocorre no total durante o ciclo de vida do componente (a mesma já feita em `ngOnInit` para montar o mapa `categoryId → name` da listagem, reaproveitada para o select) — nenhuma segunda chamada é disparada especificamente para o formulário.

3. **Lista de categorias vazia**
   - Given `GET /api/category` retorna `200` com `CategoryResponseList { categoryResponses: [] }`
   - When o formulário de criação é renderizado
   - Then o `<select>` de categoria exibe apenas a opção padrão de "nenhuma categoria selecionada", sem nenhuma outra `<option>`
   - And o formulário permanece totalmente funcional: o usuário consegue submeter uma transação sem selecionar categoria (ver critério 6).

4. **Falha ao carregar `GET /api/category` (erro de rede/API indisponível)**
   - Given a chamada a `GET /api/category` falha (erro de rede/timeout ou API indisponível, sem código de status HTTP tratável)
   - When o formulário de criação de transação é renderizado
   - Then o `<select>` de categoria exibe apenas a opção padrão de "nenhuma categoria selecionada" (nenhuma opção de categoria real, já que a lista não foi carregada), sem quebrar a renderização do formulário
   - And o restante do formulário de criação de transação permanece funcional — o usuário consegue preencher e submeter uma transação sem categoria (a falha em carregar categorias não bloqueia nem trava a criação de transação)
   - And nenhum novo estado de erro dedicado a "falha ao carregar categorias" é introduzido nesta tela (mesma decisão já tomada na UX-2: a falha é silenciosa para fins de UI de erro, distinta apenas no efeito sobre o `<select>`, que fica sem opções de categoria).

### Envio de `categoryId` no payload

5. **Categoria selecionada é incluída no payload**
   - Given o usuário preenche `transactionName`, `value`, `type` válidos e seleciona uma categoria no `<select>` (ex. `categoryId = 3`)
   - When o usuário submete o formulário
   - Then a aplicação envia `POST /api/transaction` com `TransactionRequest` incluindo `categoryId: 3` (número, nunca string), além dos demais campos preenchidos
   - And, ao receber `200` com `TransactionResponse`, a UI reflete a nova transação na listagem e reseta o formulário, incluindo o `<select>` de categoria voltando à opção padrão de "nenhuma categoria selecionada".

6. **Nenhuma categoria selecionada — `categoryId` omitido do payload**
   - Given o usuário preenche `transactionName`, `value`, `type` válidos e deixa o `<select>` de categoria na opção padrão ("nenhuma categoria selecionada")
   - When o usuário submete o formulário
   - Then a aplicação envia `POST /api/transaction` com `TransactionRequest` **sem** a propriedade `categoryId` (omitida, não enviada como `null` nem `0`)
   - And, ao receber `200`, a transação é criada e refletida normalmente na listagem (mesmo comportamento já validado no MVP-2 para os demais campos opcionais).

7. **Erro `400` da API ao criar com `categoryId` inválido/não pertencente ao usuário**
   - Given o formulário passou na validação client-side e uma categoria foi selecionada, mas a API retorna `400` (ex. `categoryId` não pertence ao usuário autenticado, conforme contrato)
   - When a aplicação envia `POST /api/transaction`
   - Then a UI exibe a mesma mensagem genérica de erro de requisição inválida já usada para outros erros `400` de criação de transação (comportamento já existente desde o MVP-2, agora efetivamente alcançável via UI através deste campo)
   - And o formulário permanece preenchido (incluindo a categoria selecionada), para o usuário corrigir, e nenhuma transação é adicionada à listagem local.

### Validação client-side

8. **Sem `Validators.required` em categoria — submissão sem categoria é válida**
   - Given o usuário não seleciona nenhuma categoria (opção padrão mantida)
   - When o usuário tenta submeter o formulário com os demais campos obrigatórios válidos (`transactionName`, `value`, `type`)
   - Then o formulário é considerado válido e a submissão ocorre normalmente (ver critério 6) — a ausência de categoria **não** bloqueia o envio, por decisão explícita de manter o campo opcional (ver seção "Decisão de escopo").

## Casos de borda
- `CategoryResponse.name` pode se repetir entre categorias de `type` diferentes (o contrato não impede duplicidade de `name` em `CategoryResponse` — não há restrição de unicidade documentada) — recomenda-se (não é critério de aceite obrigatório testável de forma fechada) que o rótulo da `<option>` inclua alguma indicação do `type` para desambiguar visualmente categorias homônimas (ex. "Roupa (Saída)"); a formatação exata do rótulo é decisão técnica do Dev, desde que não invente campos além de `name`/`type` já existentes em `CategoryResponse`.
- O `<select>` de categoria **não filtra** as opções pelo `type` (`TransactionType`) selecionado no campo `type` da própria transação — o contrato não define nenhuma regra de compatibilidade entre `TransactionType` da transação e `TransactionType` da categoria (`CategoryResponse.type`) em `POST /api/transaction`; portanto, todas as categorias retornadas por `GET /api/category` aparecem no select, independentemente do `type` escolhido para a transação. Não inventar essa regra de filtro.
- `categoryId`, quando selecionado, é sempre um `number` (`int32`) — a comparação/atribuição no formulário reativo (`FormControl<number | null>`) nunca deve tratar `categoryId` como string, mesmo padrão já usado para `type`/`paymentMethod` no mesmo formulário.
- O reset do formulário pós-criação bem-sucedida (já existente desde o MVP-2, via `form.reset(...)`) deve incluir o novo controle de categoria voltando ao valor padrão (`null`), consistente com o reset de `type`/`paymentMethod`.
- Reordenação/ordenação das opções de categoria no select não é definida pelo contrato (não há parâmetro de ordenação em `GET /api/category`) — a ordem exibida é a ordem de retorno de `categoryResponses`, sem regra adicional inventada (mesmo tratamento já aplicado à listagem de categorias no MVP-3).
- Resposta `401` em `GET /api/category` ou `POST /api/transaction` (token ausente/expirado): tratamento genérico de erro, sem lógica de redirecionamento automático para login — mesma decisão já adotada em MVP-1/MVP-2/MVP-3/UX-2, inalterada por este ticket.

## Fora de escopo
- Criar uma nova categoria a partir do formulário de criação de transação (ex. um botão "+ nova categoria" inline) — não há esse fluxo documentado no contrato nem foi pedido; criar categoria continua exclusivo da tela de Categorias (`POST /api/category`, MVP-3).
- Editar ou excluir categoria — sem endpoints `PUT`/`DELETE` para `Category` no contrato (mesma decisão do MVP-3).
- Qualquer mudança na tela de Categorias em si (`src/app/features/categories/`) — este ticket toca exclusivamente o formulário de criação de transação em `src/app/features/transactions/`.
- Tornar `categoryId` obrigatório no formulário — decisão explícita de manter opcional, conforme contrato (ver seção "Decisão de escopo"). Se o produto decidir por obrigatoriedade no futuro, é um ticket novo.
- Filtrar as opções do select de categoria pelo `type` da transação — o contrato não define essa regra (ver "Casos de borda"); não inventar.
- Alterar o mapa `categoryId → name` da listagem ou qualquer comportamento de exibição já entregue na UX-2 — este ticket reutiliza a mesma chamada/dados, mas não modifica `categoryName()` nem a renderização da listagem.
- Redirecionamento automático para login em caso de `401` — mesma decisão já adotada nos tickets anteriores.

## Dependências externas / bloqueios conhecidos
- Depende funcionalmente de MVP-2 (Dashboard de Transações), MVP-3 (Categorias) e UX-2 (exibição de nome de categoria), todos já `Done` conforme `docs/board.md` — em especial, depende de `CategoryService` e da chamada já existente a `loadCategories()` em `TransactionsComponent` (UX-2), que este ticket reutiliza sem modificar sua lógica de montagem do mapa `categoryId → name`.
- CORS já habilitado localmente (`https://localhost:7002`), conforme `docs/board.md` — não bloqueia este ticket em ambiente de desenvolvimento local. Segue pendente para outros ambientes (staging/produção), fora do controle do frontend.
- Risco residual já registrado no histórico do board: a API real (`/swagger/v1/swagger.json`) nem sempre está disponível para validação do QA; qualquer implementação deste ticket deve, se possível, ser conferida contra o swagger real antes de fechar, especialmente por envolver `categoryId` numérico (mesmo campo do bug crítico de contrato já documentado).
