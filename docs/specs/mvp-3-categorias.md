# MVP-3 — Categorias (listar + criar)

## História de usuário
Como usuário autenticado do MoneyMonkey, quero visualizar minhas categorias existentes e cadastrar uma nova categoria (com nome e tipo), para que eu possa organizar minhas transações por categoria no futuro.

## Endpoints/DTOs envolvidos
Referência: `docs/api-contract.md` (seção "Categories"). Ambos os endpoints exigem `Authorization: Bearer <token>` (rota `[auth]`) — o token já é anexado automaticamente pelo interceptor entregue no MVP-1 (`auth.interceptor.ts`); este ticket não reimplementa esse mecanismo.

- **Método/Path**: `GET /api/category` `[auth]`
- **Response 200** `CategoryResponseList`
  ```ts
  {
    categoryResponses: CategoryResponse[];
  }
  ```
  onde cada item é `CategoryResponse`:
  ```ts
  {
    categoryId: number;  // int32
    name: string;
    type: TransactionType;
  }
  ```

- **Método/Path**: `POST /api/category` `[auth]`
- **Request DTO** `CategoryRequest`
  ```ts
  {
    name: string;       // max 50
    type: TransactionType;
  }
  ```
- **Response 200** `CategoryResponse` (mesmo formato descrito acima)

- **Enum envolvido**: `TransactionType`, transmitido como **número (int)**, não como string literal:
  ```ts
  enum TransactionType {
    Entrada = 0,
    Saida = 1,
  }
  ```
  Obrigatório em `CategoryRequest.type` e presente em `CategoryResponse.type`. A UI deve enviar/comparar o valor numérico (`0` ou `1`), nunca `'Entrada'`/`'Saida'` como string — ver a nota de correção de 2026-08-03 em `docs/api-contract.md`, seção "Enums", e o histórico de bug real registrado em `docs/board.md` (POST `/api/transaction` retornando 400 por enviar enum como string). Rótulos em PT-BR (ex.: "Entrada"/"Saída") são apenas texto de exibição no `<select>`/label da UI, mapeados para os valores numéricos — nunca o valor enviado/comparado no payload ou no código.
- **`categoryId`** (em `CategoryResponse`) é **número** (`int32`), não string — mesma correção de contrato; a UI não deve tratá-lo como string em comparações, chaves de `trackBy` etc.

## Referência visual
`docs/design/mockup.pdf` tem atualmente 1 página, que mostra a tela de Painel/Dashboard (mesma página já descrita nas specs do MVP-1 e MVP-2) — não há nenhuma página dedicada a uma tela de Categorias (listagem ou formulário de criação) no mock atual. Não há elementos de layout específicos de categoria (lista de categorias, formulário de nome/tipo) para extrair do mock. Como no MVP-1, o Dev deve manter consistência com o design system já extraído do mock (paleta de cores, tipografia, estilo de card/botão em `src/styles.scss`), mas a estrutura de layout desta tela (lista simples vs. tabela, modal vs. tela própria, ordem dos campos do formulário) fica a critério técnico do Dev — não é um critério de aceite verificável por teste automatizado.

## Critérios de aceite (Given/When/Then)

### Listagem (`GET /api/category`)

1. **Listagem com sucesso, categorias existentes**
   - Given o usuário autenticado acessa a tela de categorias
   - When a tela carrega
   - Then a aplicação envia `GET /api/category` com `Authorization: Bearer <token>`
   - And, ao receber `200` com `CategoryResponseList`, a UI renderiza uma linha/item por elemento de `categoryResponses`, exibindo `name` e uma indicação visual de `type` (ex.: rótulo/ícone distinguindo `Entrada` de `Saida`) para cada `CategoryResponse`.

2. **Estado vazio — nenhuma categoria cadastrada**
   - Given o usuário autenticado não possui nenhuma categoria cadastrada
   - When a tela carrega
   - Then a aplicação envia `GET /api/category` e recebe `200` com `CategoryResponseList { categoryResponses: [] }`
   - And a UI exibe uma mensagem de estado vazio (ex.: "Nenhuma categoria cadastrada ainda"), sem renderizar nenhuma linha de item e sem exibir mensagem de erro.

3. **Erro ao carregar a listagem (falha de rede/API indisponível)**
   - Given a API está indisponível ou ocorre erro de rede (sem código de status HTTP, ex.: timeout)
   - When a tela tenta carregar as categorias
   - Then a UI exibe uma mensagem de erro de carregamento (distinta da mensagem de estado vazio), sem tentar renderizar uma lista parcial ou inválida.

### Criação (`POST /api/category`)

4. **Criação com sucesso**
   - Given o usuário preenche `name` (não vazio, até 50 caracteres) e seleciona `type` (`TransactionType.Entrada` = `0` ou `TransactionType.Saida` = `1`)
   - When o usuário submete o formulário
   - Then a aplicação envia `POST /api/category` com `CategoryRequest { name, type }`, onde `type` é enviado como o valor numérico correspondente (`0` ou `1`), nunca como string
   - And, ao receber `200` com `CategoryResponse`, a UI reflete a nova categoria na listagem (seja via atualização otimista com o `CategoryResponse` recebido, seja via novo `GET /api/category`) e limpa/reseta o formulário.

5. **Validação client-side — `name` vazio**
   - Given o usuário deixa `name` vazio e seleciona um `type` válido
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio e exibe indicação de campo obrigatório em `name`
   - And nenhuma chamada a `POST /api/category` é realizada.

6. **Validação client-side — `name` acima de 50 caracteres**
   - Given o usuário informa um `name` com mais de 50 caracteres
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio e exibe indicação de que o campo excede o limite de 50 caracteres
   - And nenhuma chamada a `POST /api/category` é realizada.

7. **Validação client-side — `type` não selecionado**
   - Given o usuário não seleciona nenhum valor para `type`
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio e exibe indicação de campo obrigatório em `type`
   - And nenhuma chamada a `POST /api/category` é realizada.

8. **Erro `400` da API ao criar**
   - Given o formulário passou na validação client-side, mas a API retorna `400`
   - When a aplicação envia `POST /api/category`
   - Then a UI exibe uma mensagem de erro genérica de requisição inválida (sem inventar corpo de erro estruturado, pois o contrato não define um para este endpoint), mantendo os dados preenchidos no formulário para o usuário corrigir
   - And nenhuma categoria é adicionada à listagem local.

9. **Erro de rede/API indisponível ao criar**
   - Given a API está indisponível ou ocorre erro de rede ao submeter o formulário (sem código de status HTTP)
   - When a aplicação envia `POST /api/category`
   - Then a UI exibe mensagem de erro de conexão/indisponibilidade, distinta da mensagem de erro de validação `400`
   - And o formulário permanece preenchido e nenhuma categoria é adicionada à listagem local.

## Casos de borda
- `type` só aceita os valores literais numéricos definidos em `TransactionType` (`Entrada = 0`, `Saida = 1`) — a UI deve oferecer exatamente essas duas opções (ex.: `<select>`/toggle com `[ngValue]` numérico, seguindo o mesmo padrão já adotado em `transactions.component` no MVP-2), nunca texto livre nem outros valores. Rótulos em PT-BR são apenas exibição; o valor comparado/enviado é sempre o número.
- `CategoryRequest` não possui nenhum campo opcional — tanto `name` quanto `type` são obrigatórios no payload; não há cenário de "campo opcional ausente" a omitir.
- `CategoryResponse.categoryId` é número (`int32`) — não deve ser tratado como string em nenhuma comparação, `trackBy` de lista ou chave de formulário.
- Resposta `401` em `GET /api/category` ou `POST /api/category` (token ausente/expirado): tratar como erro de autenticação genérico; este ticket não define lógica de redirecionamento automático para a tela de login nesse cenário (mesma decisão do MVP-1 e MVP-2).
- `CategoryResponseList.categoryResponses` vazio (`[]`) é diferente de erro — ver critério de aceite 2 (estado vazio).
- O contrato não define nenhuma regra de unicidade de `name` por usuário nem de limite de quantidade de categorias — este ticket não deve inventar essas validações; se a API rejeitar por regra de negócio não documentada, isso cai no tratamento genérico de erro `400` (critério de aceite 8).

## Fora de escopo
- Edição e exclusão de categorias — não há endpoints `PUT`/`DELETE` para `Category` no contrato.
- Integração de `categoryId` na tela/formulário de Transações (MVP-2) — decisão já registrada em `docs/board.md` (histórico de 2026-08-03, "Spec do MVP-2"): a seleção de categoria em transações ficou fora daquele ticket por depender deste (MVP-3). Este ticket entrega a listagem/criação de categorias de forma autocontida; conectar `categoryId` ao formulário de transação (dropdown de categorias) e exibir nome de categoria na listagem de transações é trabalho de um ticket futuro, não deste.
- Filtros, ordenação, busca ou paginação da listagem de categorias — não há parâmetros de query documentados em `GET /api/category` no contrato.
- Redirecionamento automático para login em caso de `401` — mecanismo de sessão/expiração não definido neste ticket (mesma decisão do MVP-1 e MVP-2).
- Qualquer relação entre categoria e limite/orçamento (ex.: "Orçamentos" mostrado no mock de Dashboard) — não há endpoint no contrato para isso.

## Dependências externas / bloqueios conhecidos
- CORS já habilitado localmente (`https://localhost:7002`), conforme `docs/board.md` — não bloqueia este ticket em ambiente de desenvolvimento local. Segue pendente para outros ambientes (staging/produção), fora do controle do frontend.
- Como registrado em `docs/board.md` (histórico de 2026-08-03, bug crítico de contrato de enums/IDs), a API real ainda não está disponível para o `qa` automatizado validar de ponta a ponta (specs usam mocks/`HttpTestingController`) — o Dev deve conferir o payload real de `POST /api/category` contra `/swagger/v1/swagger.json` (ou chamada real) antes de fechar o ticket, para confirmar que `type` é aceito como número e não reintroduzir o bug de string literal já corrigido em MVP-2.
