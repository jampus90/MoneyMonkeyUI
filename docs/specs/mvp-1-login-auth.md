# MVP-1 — Login/Auth

## História de usuário
Como usuário do MoneyMonkey, quero fazer login com meu usuário e senha, para que eu possa acessar as funcionalidades autenticadas do sistema (transações, categorias, cartões de crédito e faturas), que exigem um token Bearer válido.

## Endpoints/DTOs envolvidos
Referência: `docs/api-contract.md` (seção "Auth").

- **Método/Path**: `POST /api/auth/login` — sem autenticação (não exige `Authorization: Bearer <token>`).
- **Request DTO**: `LoginRequest`
  ```ts
  {
    username: string;
    password: string;
  }
  ```
- **Response 200** `LoginResponse`
  ```ts
  {
    token: string;
    expiresAt: string; // date-time
    userId: string;
    firstName: string;
    lastName: string;
    userType: UserType;
  }
  ```
- **Response 401**: credenciais inválidas. Sem corpo tipado assumido — a API contract trata como erro genérico de autenticação.
- **Enum envolvido**: `UserType = 'Pf' | 'Pj' | 'Staff' | 'Admin'` (recebido em `LoginResponse.userType`, apenas persistido/exibido — este ticket não define regras de negócio por `userType`).

## Referência visual

`docs/design/mockup.pdf` tem atualmente **1 página**, que mostra a tela de **Painel/Dashboard** (saudação "Olá, Ana — terça, 3 de agosto", saldo consolidado em destaque, cards de "Conta Corrente"/"Poupança"/"Cartões · faturas", ilustração do mascote MoneyMonkey, seções de Orçamentos, Metas, Contas recorrentes e Transações recentes, barra de navegação superior com "+ Nova transação"). **Não há, no mock atual, nenhuma página dedicada à tela de Login.**

Elementos de identidade visual observáveis nessa página (fundo bege claro; acento vinho/bordô em valores negativos e no botão primário; dourado/oliva em destaques e ilustrações; logo "MoneyMonkey" com mascote circular; tipografia com números grandes em destaque; cards brancos com cantos arredondados e sombra leve; botão primário arredondado em vinho) **não constituem referência de layout para a tela de login** — nenhum campo, ordem de campos ou hierarquia visual específica de login pode ser extraída deste mock, pois ele não mostra uma tela de login.

**Decisão do usuário**: como não existe mock dedicado de login, o Dev deve **extrair o design system** desta página (paleta de cores, logo/mascote, tipografia, estilo de card e de botão listados acima) e aplicá-lo à tela de login — o layout do formulário em si (arranjo dos campos, card centralizado, etc.) fica a critério técnico do Dev, mantendo consistência visual com o Dashboard mostrado no mock. Isso é uma diretriz de estilo (CSS/SCSS), não um critério de aceite funcional verificável por teste automatizado — o QA não deve rejeitar por fidelidade visual, apenas registrar divergências grosseiras como observação.

## Critérios de aceite (Given/When/Then)

1. **Login com sucesso**
   - Given o usuário está na tela de login e informa `username` e `password` válidos e cadastrados na API
   - When o usuário submete o formulário
   - Then a aplicação envia `POST /api/auth/login` com `LoginRequest { username, password }`
   - And, ao receber `200` com `LoginResponse`, a aplicação persiste `LoginResponse.token` (ex.: em storage local do navegador) para reutilização entre sessões da aba/app
   - And todas as chamadas subsequentes a rotas autenticadas (ex.: `GET /api/transaction`, `GET /api/category`, `GET /api/creditcard`) devem anexar o header `Authorization: Bearer <LoginResponse.token>`
   - And o usuário é redirecionado para a área autenticada da aplicação (fora de escopo detalhar a tela de destino neste ticket).

2. **Login com credenciais inválidas**
   - Given o usuário informa `username` e/ou `password` incorretos
   - When o usuário submete o formulário
   - Then a aplicação envia `POST /api/auth/login` e recebe `401`
   - And a UI exibe uma mensagem de erro genérica de autenticação (ex.: "Usuário ou senha inválidos"), sem expor detalhes técnicos da resposta
   - And nenhum token é persistido, nem o usuário é redirecionado para a área autenticada.

3. **Campo `username` não preenchido**
   - Given o usuário deixa `username` vazio e preenche `password`
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio da requisição (validação client-side) e exibe indicação de campo obrigatório em `username`
   - And nenhuma chamada a `POST /api/auth/login` é realizada.

4. **Campo `password` não preenchido**
   - Given o usuário deixa `password` vazio e preenche `username`
   - When o usuário tenta submeter o formulário
   - Then a UI bloqueia o envio da requisição (validação client-side) e exibe indicação de campo obrigatório em `password`
   - And nenhuma chamada a `POST /api/auth/login` é realizada.

5. **Ambos os campos vazios**
   - Given `username` e `password` estão ambos vazios
   - When o usuário tenta submeter o formulário
   - Then a UI exibe indicação de campo obrigatório em ambos os campos e não realiza a chamada à API.

6. **Rota raiz (`/`) exibe a tela de login — tela inicial temporária do MVP**
   - Given a aplicação ainda não possui uma área autenticada real implementada (ver "Fora de escopo")
   - When o usuário acessa a rota raiz `/` (path vazio) da aplicação
   - Then a aplicação renderiza a tela de login (o mesmo componente/tela acessível também em `/login`)
   - And esse comportamento vale independentemente de existir ou não um token persistido de uma sessão anterior — este ticket **não** implementa nenhuma lógica de redirecionamento condicional baseada em autenticação a partir de `/` (ver "Fora de escopo")
   - And este é o comportamento **temporário/MVP** da tela inicial: enquanto não existir uma área autenticada real na aplicação, `/` deve renderizar a tela de login; quando essa área existir (fora de escopo deste ticket), este critério é candidato a ser revisto (ex.: usuário já autenticado sendo redirecionado para longe de `/`).

## Casos de borda
- `LoginRequest.username` e `LoginRequest.password` não têm limite de tamanho documentado em `docs/api-contract.md` — este ticket não deve impor limites de caracteres que não estejam no contrato; apenas validar preenchimento (obrigatoriedade).
- Resposta `401`: tratar de forma genérica — o contrato não define um corpo de erro tipado, então a UI não deve tentar parsear/exibir mensagens específicas vindas do corpo da resposta.
- Falha de rede / API indisponível (sem código de status HTTP, ex.: timeout, erro de conexão): distinta de `401`; a UI deve exibir mensagem de erro de conexão/indisponibilidade, não a mensagem de credenciais inválidas.
- `LoginResponse.expiresAt` é retornado pela API — este ticket cobre apenas a persistência do `token` para uso como Bearer; regras de expiração/renovação automática de sessão ficam fora de escopo (ver "Fora de escopo").
- `LoginResponse.userType` deve ser um dos valores literais definidos em `UserType` (`'Pf' | 'Pj' | 'Staff' | 'Admin'`) — a UI apenas armazena/exibe o valor recebido, sem inventar outros valores.

## Fora de escopo
- Tela/fluxo de cadastro de usuário (`POST /api/user`) — ticket separado.
- Lógica de expiração de sessão baseada em `LoginResponse.expiresAt` (ex.: logout automático, refresh de token) — não há endpoint de refresh no contrato.
- Fluxo de "esqueci minha senha" ou recuperação de conta — não existe endpoint no contrato para isso.
- Regras de autorização/permissão por `UserType` (ex.: telas exclusivas para `Admin`/`Staff`) — não definidas neste ticket.
- Interceptor global de anexação automática do header `Authorization` em todas as chamadas HTTP da aplicação — este ticket define o requisito (token deve ser enviado como Bearer nas chamadas autenticadas), mas o desenho técnico do mecanismo (guard/interceptor) é responsabilidade do Dev, não da spec.
- Logout explícito (limpeza de token/redirecionamento) — não coberto por este ticket.
- Redirecionamento condicional a partir da rota raiz (`/`) baseado em estado de autenticação (ex.: usuário já autenticado/com token persistido pular a tela de login e ir direto para a área autenticada) — **não** implementado neste ticket. `/` sempre renderiza a tela de login neste momento do MVP, consistente com o item acima ("área autenticada" não detalhada/não existente ainda).

## Dependências externas / bloqueios conhecidos
- ⚠️ **CORS não configurado na API** (ver `docs/api-contract.md`, seção "Bloqueio conhecido"): isso bloqueia testes manuais end-to-end reais do fluxo de login contra a API rodando em outra origem (ex.: validar no navegador com a API em `http://localhost:5217` / `https://localhost:7002`). Não é responsabilidade do frontend contornar isso (sem proxies improvisados ou desabilitar segurança do navegador). Não bloqueia o desenvolvimento nem os testes automatizados do frontend (unitários/integração com mocks), apenas a verificação manual real contra a API. Este é um item de backlog do backend a ser rastreado separadamente.
