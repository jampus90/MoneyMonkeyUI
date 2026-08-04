# MVP-4 — Cartões de Crédito (listar + criar)

## História de usuário
Como usuário autenticado do MoneyMonkey, quero visualizar meus cartões de crédito cadastrados e cadastrar um novo cartão (nome, bandeira, últimos 4 dígitos, dia de fechamento, dia de vencimento e, opcionalmente, limite de crédito), para que eu possa, em um ticket futuro (MVP-5), lançar compras no cartão e consultar a fatura.

## Endpoints/DTOs envolvidos
Referência: `docs/api-contract.md` (seção "Credit Cards"). Ambos os endpoints exigem `Authorization: Bearer <token>` (rota `[auth]`) — o token já é anexado automaticamente pelo interceptor entregue no MVP-1 (`auth.interceptor.ts`); este ticket não reimplementa esse mecanismo.

- **Método/Path**: `GET /api/creditcard` `[auth]`
- **Response 200** `CreditCardResponseList`
  ```ts
  {
    creditCardResponses: CreditCardResponse[];
  }
  ```
  onde cada item é `CreditCardResponse`:
  ```ts
  {
    creditCardId: number;   // int32
    name: string;
    brand: CardBrand;
    lastFourDigits: string;
    closingDay: number;
    dueDay: number;
    creditLimit?: number;
  }
  ```

- **Método/Path**: `POST /api/creditcard` `[auth]`
- **Request DTO** `CreditCardRequest`
  ```ts
  {
    name: string;            // max 50
    brand: CardBrand;
    lastFourDigits: string;  // exatamente 4 caracteres
    closingDay: number;      // 1-28
    dueDay: number;          // 1-28
    creditLimit?: number;
  }
  ```
- **Response 200** `CreditCardResponse` (mesmo formato descrito acima)

- **Enum envolvido**: `CardBrand`, transmitido como **número (int)**, não como string literal:
  ```ts
  enum CardBrand {
    Visa = 0,
    Mastercard = 1,
    Elo = 2,
    Amex = 3,
    Outro = 4,
  }
  ```
  Obrigatório em `CreditCardRequest.brand` e presente em `CreditCardResponse.brand`. A UI deve enviar/comparar o valor numérico (`0` a `4`), nunca `'Visa'`/`'Mastercard'`/etc. como string — ver a nota de correção de 2026-08-03 em `docs/api-contract.md`, seção "Enums", e o histórico de bug real registrado em `docs/board.md` (POST `/api/transaction` retornando 400 por enviar enum como string). Rótulos em PT-BR (ex.: "Visa", "Mastercard", "Elo", "Amex", "Outro") são apenas texto de exibição no `<select>`/label da UI, mapeados para os valores numéricos — nunca o valor enviado/comparado no payload ou no código.
- **`creditCardId`** (em `CreditCardResponse`) é **número** (`int32`), não string — mesma correção de contrato; a UI não deve tratá-lo como string em comparações, chaves de `trackBy` etc.
- **`lastFourDigits`** é `string` (não número), mas com validação de tamanho: o contrato exige exatamente 4 caracteres. Ver critérios de aceite e casos de borda abaixo para a regra de validação client-side.
- **`creditLimit`** é o único campo opcional de `CreditCardRequest`/`CreditCardResponse` — segue o mesmo padrão já resolvido em `transactions.component.ts` (MVP-2) para `transactionDate`/`categoryId`: quando não preenchido pelo usuário, o campo deve ser **omitido do payload** (não enviado como `null`, `undefined` explícito ou string vazia).

## Referência visual
`docs/design/mockup.pdf` tem atualmente 1 página, que mostra a tela de Painel/Dashboard (mesma página já descrita nas specs do MVP-1, MVP-2 e MVP-3). Não há nenhuma página dedicada a uma tela de Cartões de Crédito (listagem ou formulário de criação) no mock atual — o item de menu "Contas" citado no cabeçalho do mock (ver histórico de 2026-08-03 em `docs/board.md`, decisão da NavBar) não corresponde a uma tela de cartões detalhada, e nenhuma outra página do PDF cobre esse fluxo. Como no MVP-3, o Dev deve manter consistência com o design system já extraído do mock (paleta de cores, tipografia, estilo de card/botão em `src/styles.scss`, mixins compartilhados em `src/styles/_shared.scss` entregues no UX-4), mas a estrutura de layout desta tela (lista simples vs. tabela, modal vs. tela própria, ordem dos campos do formulário) fica a critério técnico do Dev — não é um critério de aceite verificável por teste automatizado.

## Critérios de aceite (Given/When/Then)

### Listagem (`GET /api/creditcard`)

1. **Listagem com sucesso, cartões existentes**
   - Given o usuário autenticado acessa a tela de cartões de crédito
   - When a tela carrega
   - Then a aplicação envia `GET /api/creditcard` com `Authorization: Bearer <token>`
   - And, ao receber `200` com `CreditCardResponseList`, a UI renderiza uma linha/item por elemento de `creditCardResponses`, exibindo pelo menos `name`, uma indicação visual de `brand` (rótulo em PT-BR mapeado do valor numérico de `CardBrand`), `lastFourDigits`, `closingDay`, `dueDay` e, quando presente, `creditLimit`, para cada `CreditCardResponse`.

2. **Estado vazio — nenhum cartão cadastrado**
   - Given o usuário autenticado não possui nenhum cartão de crédito cadastrado
   - When a tela carrega
   - Then a aplicação envia `GET /api/creditcard` e recebe `200` com `CreditCardResponseList { creditCardResponses: [] }`
   - And a UI exibe uma mensagem de estado vazio (ex.: "Nenhum cartão cadastrado ainda"), sem renderizar nenhuma linha de item e sem exibir mensagem de erro.

3. **Erro ao carregar a listagem (falha de rede/API indisponível)**
   - Given a API está indisponível ou ocorre erro de rede (sem código de status HTTP, ex.: timeout)
   - When a tela tenta carregar os cartões
   - Then a UI exibe uma mensagem de erro de carregamento (distinta da mensagem de estado vazio), sem tentar renderizar uma lista parcial ou inválida.

### Criação (`POST /api/creditcard`)

4. **Criação com sucesso — todos os campos, incluindo `creditLimit`**
   - Given o usuário preenche `name` (não vazio, até 50 caracteres), seleciona `brand` (um dos 5 valores de `CardBrand`), preenche `lastFourDigits` com exatamente 4 caracteres, `closingDay` e `dueDay` entre 1 e 28, e informa `creditLimit`
   - When o usuário submete o formulário
   - Then a aplicação envia `POST /api/creditcard` com `CreditCardRequest { name, brand, lastFourDigits, closingDay, dueDay, creditLimit }`, onde `brand` é enviado como o valor numérico correspondente (`0` a `4`), nunca como string
   - And, ao receber `200` com `CreditCardResponse`, a UI reflete o novo cartão na listagem (seja via atualização otimista com o `CreditCardResponse` recebido, seja via novo `GET /api/creditcard`) e limpa/reseta o formulário.

5. **Criação com sucesso — sem `creditLimit` (campo opcional omitido)**
   - Given o usuário preenche todos os campos obrigatórios (`name`, `brand`, `lastFourDigits`, `closingDay`, `dueDay`) e deixa `creditLimit` em branco
   - When o usuário submete o formulário
   - Then a aplicação envia `POST /api/creditcard` com `CreditCardRequest` **sem a chave `creditLimit`** no payload (não `creditLimit: null` nem `creditLimit: undefined` explícito)
   - And, ao receber `200` com `CreditCardResponse`, a UI reflete o novo cartão na listagem e limpa/reseta o formulário.

6. **Validação client-side — `name` vazio**
   - Given o usuário deixa `name` vazio
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio e exibe indicação de campo obrigatório em `name`
   - And nenhuma chamada a `POST /api/creditcard` é realizada.

7. **Validação client-side — `name` acima de 50 caracteres**
   - Given o usuário informa um `name` com mais de 50 caracteres
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio e exibe indicação de que o campo excede o limite de 50 caracteres
   - And nenhuma chamada a `POST /api/creditcard` é realizada.

8. **Validação client-side — `brand` não selecionado**
   - Given o usuário não seleciona nenhum valor para `brand`
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio e exibe indicação de campo obrigatório em `brand`
   - And nenhuma chamada a `POST /api/creditcard` é realizada.

9. **Validação client-side — `lastFourDigits` vazio ou com tamanho diferente de 4**
   - Given o usuário deixa `lastFourDigits` vazio, ou preenche com menos de 4 caracteres, ou com mais de 4 caracteres
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio e exibe indicação de que o campo deve ter exatamente 4 caracteres
   - And nenhuma chamada a `POST /api/creditcard` é realizada.

10. **Validação client-side — `lastFourDigits` com caracteres não numéricos (regra adicional do frontend)**
    - Given o usuário preenche `lastFourDigits` com exatamente 4 caracteres, mas contendo pelo menos um caractere não numérico (ex.: `"12a4"`)
    - When o usuário tenta submeter o formulário
    - Then a UI bloqueia o envio e exibe indicação de que o campo deve conter apenas dígitos
    - And nenhuma chamada a `POST /api/creditcard` é realizada.
    - **Nota**: `docs/api-contract.md` define `lastFourDigits` apenas como `string` com exatamente 4 caracteres, sem especificar formato numérico-only. A exigência de "somente dígitos" é uma regra adicional deste ticket (justificada por `lastFourDigits` representar os últimos 4 dígitos do número do cartão), **não uma regra literal da API** — o Dev não deve confundir isso com validação de contrato, e o QA não deve reportar como divergência de contrato caso o dev opte por não bloquear no client e deixar a validação totalmente a cargo da API (nesse caso, tratar como o critério 13 abaixo, erro 400 genérico).

11. **Validação client-side — `closingDay` fora do intervalo 1-28**
    - Given o usuário informa `closingDay` menor que 1 ou maior que 28
    - When o usuário tenta submeter o formulário
    - Then a UI bloqueia o envio e exibe indicação de que o valor deve estar entre 1 e 28
    - And nenhuma chamada a `POST /api/creditcard` é realizada.

12. **Validação client-side — `dueDay` fora do intervalo 1-28**
    - Given o usuário informa `dueDay` menor que 1 ou maior que 28
    - When o usuário tenta submeter o formulário
    - Then a UI bloqueia o envio e exibe indicação de que o valor deve estar entre 1 e 28
    - And nenhuma chamada a `POST /api/creditcard` é realizada.

13. **Erro `400` da API ao criar**
    - Given o formulário passou na validação client-side, mas a API retorna `400`
    - When a aplicação envia `POST /api/creditcard`
    - Then a UI exibe uma mensagem de erro genérica de requisição inválida (sem inventar corpo de erro estruturado, pois o contrato não define um para este endpoint), mantendo os dados preenchidos no formulário para o usuário corrigir
    - And nenhum cartão é adicionado à listagem local.

14. **Erro de rede/API indisponível ao criar**
    - Given a API está indisponível ou ocorre erro de rede ao submeter o formulário (sem código de status HTTP)
    - When a aplicação envia `POST /api/creditcard`
    - Then a UI exibe mensagem de erro de conexão/indisponibilidade, distinta da mensagem de erro de validação `400`
    - And o formulário permanece preenchido e nenhum cartão é adicionado à listagem local.

## Casos de borda
- `brand` só aceita os valores literais numéricos definidos em `CardBrand` (`Visa = 0`, `Mastercard = 1`, `Elo = 2`, `Amex = 3`, `Outro = 4`) — a UI deve oferecer exatamente essas cinco opções (ex.: `<select>` com `[ngValue]` numérico, seguindo o mesmo padrão já adotado em `transactions.component`/`categories.component`), nunca texto livre nem outros valores. Rótulos em PT-BR são apenas exibição; o valor comparado/enviado é sempre o número.
- `creditLimit` é o único campo opcional de `CreditCardRequest`/`CreditCardResponse` — todos os demais (`name`, `brand`, `lastFourDigits`, `closingDay`, `dueDay`) são obrigatórios no payload de criação.
- `CreditCardResponse.creditCardId` é número (`int32`) — não deve ser tratado como string em nenhuma comparação, `trackBy` de lista ou chave de formulário.
- O contrato não define uma validação numérica explícita de formato para `creditLimit` além de ser opcional; se preenchido, este ticket assume que deve ser um número positivo pela natureza do campo (limite de crédito), mas o contrato não define um mínimo/máximo — não inventar regra de "> 0" como bloqueio client-side além do bom senso de não aceitar valor negativo; qualquer rejeição de valor por regra de negócio não documentada cai no tratamento genérico de erro `400` (critério de aceite 13).
- `lastFourDigits` sendo `string`: mesmo que a UI valide "somente dígitos" (critério 10, regra adicional do frontend), o campo continua sendo enviado como `string` no payload (ex.: `"1234"`), nunca convertido para `number`, pois o contrato define o tipo como `string`.
- Resposta `401` em `GET /api/creditcard` ou `POST /api/creditcard` (token ausente/expirado): tratar como erro de autenticação genérico; este ticket não define lógica de redirecionamento automático para a tela de login nesse cenário (mesma decisão dos MVPs anteriores).
- `CreditCardResponseList.creditCardResponses` vazio (`[]`) é diferente de erro — ver critério de aceite 2 (estado vazio).
- O contrato não define nenhuma regra de unicidade de `lastFourDigits`/`name` por usuário nem de limite de quantidade de cartões cadastrados — este ticket não deve inventar essas validações; se a API rejeitar por regra de negócio não documentada, isso cai no tratamento genérico de erro `400` (critério de aceite 13).

## Fora de escopo
- Compras no cartão (`POST /api/creditcard/{creditCardId}/purchases`) e consulta de fatura (`GET /api/creditcard/{creditCardId}/fatura`) — isso é o MVP-5, que depende deste ticket (precisa de um `creditCardId` existente) e ainda está em `Backlog`.
- Edição e exclusão de cartões — não há endpoints `PUT`/`DELETE` para `CreditCard` no contrato.
- Qualquer vínculo com categoria (`categoryId`) neste ticket — `CreditCardRequest`/`CreditCardResponse` não possuem esse campo no contrato; a associação de compras de cartão com categoria é assunto do MVP-5 (`CreditCardPurchaseRequest.categoryId`), não deste.
- Filtros, ordenação, busca ou paginação da listagem de cartões — não há parâmetros de query documentados em `GET /api/creditcard` no contrato.
- Redirecionamento automático para login em caso de `401` — mecanismo de sessão/expiração não definido neste ticket (mesma decisão dos MVPs anteriores).
- Qualquer exibição de fatura, gasto atual, ou percentual de uso do `creditLimit` na tela de cartões — esses dados dependem do endpoint de fatura (MVP-5), não deste ticket.

## Dependências externas / bloqueios conhecidos
- CORS já habilitado localmente (`https://localhost:7002`), conforme `docs/board.md` — não bloqueia este ticket em ambiente de desenvolvimento local. Segue pendente para outros ambientes (staging/produção), fora do controle do frontend.
- Como registrado em `docs/board.md` (histórico de 2026-08-03, bug crítico de contrato de enums/IDs), a API real ainda não está disponível para o `qa` automatizado validar de ponta a ponta (specs usam mocks/`HttpTestingController`) — o Dev deve conferir o payload real de `POST /api/creditcard` contra `/swagger/v1/swagger.json` (ou chamada real) antes de fechar o ticket, para confirmar que `brand` é aceito como número e que `creditLimit` de fato pode ser omitido do payload sem erro, seguindo a mesma prática já adotada em MVP-2/MVP-3.
