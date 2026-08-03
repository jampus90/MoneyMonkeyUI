# MVP-2 — Dashboard de Transações (listar + criar)

## História de usuário
Como usuário autenticado do MoneyMonkey, quero visualizar minhas transações e registrar uma nova transação (entrada ou saída), para que eu possa acompanhar minha movimentação financeira.

## Endpoints/DTOs envolvidos
Referência: `docs/api-contract.md` (seção "Transactions"). Ambos os endpoints exigem `Authorization: Bearer <token>` (rota `[auth]`) — o token já é anexado automaticamente pelo interceptor entregue no MVP-1 (`auth.interceptor.ts`); este ticket não reimplementa esse mecanismo.

- **Método/Path**: `GET /api/transaction` `[auth]`
- **Response 200** `TransactionResponseList`
  ```ts
  {
    transactionResponses: TransactionResponse[];
  }
  ```
  onde cada item é `TransactionResponse`:
  ```ts
  {
    transactionId: string;
    transactionName: string;
    value: number;
    type: TransactionType;
    paymentMethod?: PaymentMethod;
    categoryId?: string;
    transactionDate?: string; // date
  }
  ```

- **Método/Path**: `POST /api/transaction` `[auth]`
- **Request DTO** `TransactionRequest`
  ```ts
  {
    transactionName: string;          // max 100
    value: number;                    // > 0
    type: TransactionType;
    paymentMethod?: PaymentMethod;
    categoryId?: string;
    transactionDate?: string;         // date, opcional
  }
  ```
- **Response 200** `TransactionResponse` (mesmo formato descrito acima)
- **Response 400**: quando `categoryId` não pertence ao usuário autenticado (ver "Fora de escopo" — este ticket não expõe seleção de `categoryId` na UI, mas o tratamento genérico de `400` deve existir de qualquer forma, defensivamente).

- **Enums envolvidos**:
  - `TransactionType = 'Entrada' | 'Saida'` — obrigatório em `TransactionRequest.type`, transmitido como string literal.
  - `PaymentMethod = 'Pix' | 'Dinheiro' | 'CartaoCredito' | 'CartaoDebito' | 'Boleto' | 'Transferencia' | 'Outro'` — opcional em `TransactionRequest.paymentMethod`, transmitido como string literal.

## Referência visual
`docs/design/mockup.pdf`, página 1 — a única página do mock mostra a tela de **Painel/Dashboard**, que contém um widget "Transações recentes" (não uma listagem completa dedicada). Elementos desse widget que se aplicam à tela de listagem completa deste ticket:
- Cada item de transação é uma linha com: círculo/avatar à esquerda (ícone/indicador visual, sem dado adicional do contrato), nome em destaque (`transactionName`), uma linha secundária menor abaixo do nome combinando categoria e data (ex.: "Alimentação · 03/08"), e o valor alinhado à direita.
- O valor é exibido com sinal e cor: `−` em vinho/bordô para saídas, `+` em verde/oliva para entradas — mapeamento direto de `TransactionType` (`'Saida'` → negativo/vermelho, `'Entrada'` → positivo/verde), não um campo adicional do contrato.
- Um link "ver todas" no cabeçalho do widget sugere a existência de uma tela dedicada de listagem completa (a tela deste ticket); o item de navegação superior "Transações" reforça isso, mas o mock não mostra o layout dessa tela dedicada nem o do formulário de criação — apenas o botão "+ Nova transação" no topo, sem detalhar o formulário em si.
- **Ressalva sobre dado exibido no mock que não está no contrato**: a linha secundária do item mostra um **nome de categoria** (ex.: "Alimentação"). `TransactionResponse` só traz `categoryId` (um identificador), não um nome de categoria — resolver `categoryId` → nome exigiria cruzar com `GET /api/category` (ticket MVP-3, ainda em Backlog). Isso **não é um critério de aceite deste ticket** (ver "Fora de escopo"); a listagem deste ticket exibe os campos tal como retornados por `TransactionResponse`.
- Como não há mock do formulário de criação nem da tela de listagem completa, a estrutura de layout desses dois (lista vs. tabela, modal vs. tela própria, ordem exata dos campos do formulário) fica a critério técnico do Dev — os critérios de aceite abaixo definem o comportamento funcional verificável, não o layout exato.

## Critérios de aceite (Given/When/Then)

### Listagem (`GET /api/transaction`)

1. **Listagem com sucesso, transações existentes**
   - Given o usuário autenticado acessa a tela de transações
   - When a tela carrega
   - Then a aplicação envia `GET /api/transaction` com `Authorization: Bearer <token>`
   - And, ao receber `200` com `TransactionResponseList`, a UI renderiza uma linha/item por elemento de `transactionResponses`, exibindo `transactionName` e `value` (com sinal/indicação visual coerente com `type`: `'Entrada'` vs `'Saida'`) de cada `TransactionResponse`.

2. **Estado vazio — nenhuma transação cadastrada**
   - Given o usuário autenticado não possui nenhuma transação cadastrada
   - When a tela carrega
   - Then a aplicação envia `GET /api/transaction` e recebe `200` com `TransactionResponseList { transactionResponses: [] }`
   - And a UI exibe uma mensagem de estado vazio (ex.: "Nenhuma transação cadastrada ainda"), sem renderizar nenhuma linha de item e sem exibir mensagem de erro.

3. **Erro ao carregar a listagem (falha de rede/API indisponível)**
   - Given a API está indisponível ou ocorre erro de rede (sem código de status HTTP, ex.: timeout)
   - When a tela tenta carregar as transações
   - Then a UI exibe uma mensagem de erro de carregamento (distinta da mensagem de estado vazio), sem tentar renderizar uma lista parcial ou inválida.

### Criação (`POST /api/transaction`)

4. **Criação com sucesso — apenas campos obrigatórios**
   - Given o usuário preenche `transactionName` (não vazio, até 100 caracteres), `value` (número > 0) e `type` (`'Entrada'` ou `'Saida'`), deixando os campos opcionais (`paymentMethod`, `transactionDate`) em branco
   - When o usuário submete o formulário
   - Then a aplicação envia `POST /api/transaction` com `TransactionRequest { transactionName, value, type }` (sem `paymentMethod`, `categoryId` ou `transactionDate` no payload, já que não foram preenchidos)
   - And, ao receber `200` com `TransactionResponse`, a UI reflete a nova transação na listagem (seja via atualização otimista com o `TransactionResponse` recebido, seja via novo `GET /api/transaction`) e limpa/reseta o formulário.

5. **Criação com sucesso — incluindo campos opcionais preenchidos**
   - Given o usuário preenche `transactionName`, `value`, `type`, e adicionalmente seleciona `paymentMethod` (um dos valores literais de `PaymentMethod`) e informa `transactionDate`
   - When o usuário submete o formulário
   - Then a aplicação envia `POST /api/transaction` com `TransactionRequest { transactionName, value, type, paymentMethod, transactionDate }`
   - And, ao receber `200`, a UI reflete a nova transação na listagem com os campos opcionais preenchidos.

6. **Validação client-side — `transactionName` vazio**
   - Given o usuário deixa `transactionName` vazio e preenche `value` e `type` válidos
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio e exibe indicação de campo obrigatório em `transactionName`
   - And nenhuma chamada a `POST /api/transaction` é realizada.

7. **Validação client-side — `transactionName` acima de 100 caracteres**
   - Given o usuário informa um `transactionName` com mais de 100 caracteres
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio e exibe indicação de que o campo excede o limite de 100 caracteres
   - And nenhuma chamada a `POST /api/transaction` é realizada.

8. **Validação client-side — `value` ausente ou não numérico**
   - Given o usuário deixa `value` vazio ou informa um valor não numérico
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio e exibe indicação de campo obrigatório/inválido em `value`
   - And nenhuma chamada a `POST /api/transaction` é realizada.

9. **Validação client-side — `value` menor ou igual a zero**
   - Given o usuário informa `value = 0` ou `value` negativo
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio e exibe indicação de que o valor deve ser maior que zero
   - And nenhuma chamada a `POST /api/transaction` é realizada.

10. **Validação client-side — `type` não selecionado**
    - Given o usuário não seleciona nenhum valor para `type`
    - When o usuário tenta submeter o formulário
    - Then a UI bloqueia o envio e exibe indicação de campo obrigatório em `type`
    - And nenhuma chamada a `POST /api/transaction` é realizada.

11. **Erro `400` da API ao criar**
    - Given o formulário passou na validação client-side, mas a API retorna `400` (ex.: cenário de `categoryId` inválido, caso este campo venha a ser habilitado no futuro)
    - When a aplicação envia `POST /api/transaction`
    - Then a UI exibe uma mensagem de erro genérica de requisição inválida (sem inventar corpo de erro estruturado, pois o contrato não define um), mantendo os dados preenchidos no formulário para o usuário corrigir
    - And nenhuma transação é adicionada à listagem local.

12. **Erro de rede/API indisponível ao criar**
    - Given a API está indisponível ou ocorre erro de rede ao submeter o formulário (sem código de status HTTP)
    - When a aplicação envia `POST /api/transaction`
    - Then a UI exibe mensagem de erro de conexão/indisponibilidade, distinta da mensagem de erro de validação `400`
    - And o formulário permanece preenchido e nenhuma transação é adicionada à listagem local.

## Casos de borda
- `paymentMethod`, `categoryId` e `transactionDate` são opcionais em `TransactionRequest` — quando não preenchidos pelo usuário, não devem ser enviados no payload com valores inventados (`null`, string vazia, etc.); omitir o campo.
- `type` só aceita os valores literais `'Entrada'` ou `'Saida'` — a UI deve oferecer exatamente essas duas opções (ex.: seleção/toggle), nunca texto livre nem outros valores.
- `paymentMethod`, quando exposto, só aceita os valores literais `'Pix' | 'Dinheiro' | 'CartaoCredito' | 'CartaoDebito' | 'Boleto' | 'Transferencia' | 'Outro'` — dropdown/seleção fechada, nunca texto livre.
- `transactionDate` não tem formato de exibição definido no contrato além de "date" — a UI deve enviar no formato aceito por um campo de data padrão (ex.: `<input type="date">`), sem regra de negócio adicional (ex.: não há validação documentada de data futura/passada no contrato — não inventar essa regra).
- `TransactionResponse.paymentMethod`, `.categoryId` e `.transactionDate` podem estar ausentes na resposta — a listagem não deve quebrar/exibir "undefined" quando esses campos não vierem; tratar como ausentes/omitidos visualmente.
- Resposta `401` em `GET /api/transaction` ou `POST /api/transaction` (token ausente/expirado): tratar como erro de autenticação genérico; este ticket não define lógica de redirecionamento automático para a tela de login nesse cenário (ver "Fora de escopo").
- `TransactionResponseList.transactionResponses` vazio (`[]`) é diferente de erro — ver critério de aceite 2 (estado vazio).

## Fora de escopo
- Edição e exclusão de transações — não há endpoints `PUT`/`DELETE` para `Transaction` no contrato.
- Seleção de `categoryId` no formulário de criação (ex.: dropdown de categorias) — depende de `GET /api/category` (ticket MVP-3, ainda em Backlog); este ticket não expõe esse campo na UI. O tratamento defensivo de `400` (critério 11) continua existindo, mas não é um caminho alcançável via UI neste ticket.
- Exibição do **nome** da categoria na listagem (o mock mostra um nome de categoria, mas `TransactionResponse` só retorna `categoryId`) — resolver isso depende de `GET /api/category` (MVP-3); fora de escopo aqui.
- Filtros, ordenação, busca ou paginação da listagem de transações — não há parâmetros de query documentados em `GET /api/transaction` no contrato.
- Widgets de "Painel" mostrados no mock que não são transações (saldo consolidado, orçamentos, metas, contas recorrentes, relatórios) — não fazem parte deste ticket nem têm endpoint correspondente no contrato atual.
- Compras em cartão de crédito (`POST /api/creditcard/{id}/purchases`) — fluxo paralelo, não cria `Transaction` (ver contrato, seção "Credit Cards"); coberto pelo ticket MVP-5.
- Redirecionamento automático para login em caso de `401` — mecanismo de sessão/expiração não definido neste ticket (mesma decisão do MVP-1).

## Dependências externas / bloqueios conhecidos
- CORS já habilitado localmente (`https://localhost:7002`), conforme `docs/board.md` — não bloqueia este ticket em ambiente de desenvolvimento local. Segue pendente para outros ambientes (staging/produção), fora do controle do frontend.
- Exibição de nome de categoria e seleção de `categoryId` na criação dependem funcionalmente de MVP-3 (Categorias) estar `Done` — hoje esse ticket está em `Backlog`; até lá, este ticket trabalha apenas com os campos literais de `TransactionResponse`/`TransactionRequest` conforme o contrato, sem `categoryId` exposto na UI.
