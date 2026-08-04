# UX-3 — Logout na NavBar

## História de usuário
Como usuário autenticado do MoneyMonkey, quero um botão "Sair" visível na barra de navegação, para que eu consiga encerrar minha sessão de forma explícita, sem precisar apagar o token manualmente pelo devtools do navegador.

## Origem do ticket
Achado #4 (Alta severidade) e recomendação #4 de `docs/design/ux-review-2026-08-03.md`: `nav-bar.component.html:1-15` só tem a marca "MoneyMonkey" + os links "Transações"/"Categorias" (`nav-bar.component.ts`/`.html` atuais, confirmados nesta spec); `auth.service.ts:21-27` só expõe `getToken()` — não há nenhum método que remova o token de `localStorage`. Uma vez autenticado, o usuário não tem nenhum caminho na UI para encerrar a sessão.

Este é um ticket **100% client-side, sem endpoint novo**: não existe (nem é necessário) nenhum `POST /api/auth/logout` em `docs/api-contract.md` — a "sessão" no MoneyMonkey é inteiramente stateless do lado do cliente (um JWT persistido em `localStorage`), então "logout" é puramente descartar esse token localmente.

## Endpoints/DTOs envolvidos
Nenhum endpoint novo ou alterado. Referência apenas de contexto (comportamento hoje existente, para embasar os critérios de aceite):

- `POST /api/auth/login` (`docs/api-contract.md`, seção "Auth") — já implementado em `AuthService.login()` (`src/app/core/services/auth.service.ts:15-19`), persiste `LoginResponse.token` via `setToken()` (privado) na chave de storage `TOKEN_STORAGE_KEY = 'auth_token'` (`auth.service.ts:9`). Este ticket **não** altera `login()` nem o valor da chave de storage.
- Qualquer rota autenticada (ex. `GET /api/transaction`, `GET /api/category`) — o header `Authorization: Bearer <token>` é anexado por `authInterceptor` (`src/app/core/interceptors/auth.interceptor.ts`), que lê o token via `authService.getToken()` **a cada requisição** (`auth.interceptor.ts:28`), sem cache. Isso significa que, uma vez que o token deixe de existir em `localStorage`, toda chamada HTTP subsequente passa a não ter mais o header `Authorization` anexado — comportamento natural do interceptor existente, que este ticket não precisa modificar para funcionar corretamente após o logout.

Não há DTO/request/response envolvido no logout em si — é uma operação puramente local (`localStorage.removeItem`).

## Arquivos exatos envolvidos
- `src/app/core/services/auth.service.ts` — novo método público `logout()`, usando a mesma constante `TOKEN_STORAGE_KEY` já existente (linha 9) para remover o token.
- `src/app/shared/nav-bar/nav-bar.component.ts` — injeta `AuthService` e `Router`; novo método (ex. `onLogout()`) que chama `authService.logout()` e depois `router.navigateByUrl('/login')` (mesmo padrão de navegação já usado em `login.component.ts:41`, `this.router.navigateByUrl('/transactions')`).
- `src/app/shared/nav-bar/nav-bar.component.html` — novo elemento de ação "Sair" (botão, não link de rota) dentro do template existente da navbar, ao lado dos links "Transações"/"Categorias".
- `src/app/shared/nav-bar/nav-bar.component.scss` — estilo do novo botão "Sair", reaproveitando os tokens de design já usados nos demais elementos da navbar (`var(--mm-color-*)`), sem introduzir uma nova paleta.

Nenhuma mudança em `app.component.ts`/`app.component.html` (a lógica de exibição condicional da navbar, `showNav`/`HIDDEN_NAV_ROUTES`, já esconde a navbar em `/` e `/login` e permanece inalterada — ver "Casos de borda").

## Critérios de aceite (Given/When/Then)

1. **Botão "Sair" existe e é visível na navbar**
   - Given o usuário está em qualquer rota autenticada onde a navbar é exibida hoje (ex. `/transactions`, `/categories` — qualquer rota fora de `HIDDEN_NAV_ROUTES = ['/', '/login']`)
   - When a tela renderiza `NavBarComponent`
   - Then existe um elemento de botão com texto "Sair" (ou label equivalente estável, ex. `aria-label="Sair"`) visível no DOM, localizável por um seletor estável (ex. classe `nav-bar__logout` ou `data-testid`).

2. **Clique em "Sair" remove o token de `localStorage`**
   - Given o usuário está autenticado (existe um valor persistido em `localStorage` na chave usada por `AuthService`, ex. `'auth_token'`)
   - When o usuário clica no botão "Sair"
   - Then `AuthService.logout()` é chamado
   - And o valor associado à chave de storage do token (`TOKEN_STORAGE_KEY`) é removido de `localStorage` (`localStorage.getItem(TOKEN_STORAGE_KEY)` passa a retornar `null`)
   - And nenhuma chamada HTTP é feita como parte do logout em si (operação puramente local, sem requisição de rede).

3. **`AuthService.getToken()` reflete a ausência do token após `logout()`**
   - Given o token estava persistido em `localStorage`
   - When `AuthService.logout()` é chamado
   - Then uma chamada subsequente a `AuthService.getToken()` retorna `null`.

4. **Navegação para `/login` após o logout**
   - Given o usuário clica no botão "Sair"
   - When `AuthService.logout()` é executado com sucesso
   - Then a aplicação navega para a rota `/login` (ex. via `Router.navigateByUrl('/login')`), de forma análoga ao padrão já usado no fluxo de login bem-sucedido (`login.component.ts:41`).

5. **Requisição HTTP feita após o logout não anexa mais o header `Authorization`**
   - Given o usuário efetuou logout (token removido de `localStorage`, conforme critério 2)
   - When qualquer requisição HTTP passar por `authInterceptor` em seguida (ex. uma nova chamada a uma rota autenticada)
   - Then a requisição interceptada **não** contém o header `Authorization`, pois `authService.getToken()` retorna `null` e `auth.interceptor.ts:30` (`if (!token || ...) { return next(req); }`) já cobre esse caso sem exigir nenhuma alteração no interceptor.
   - Nota: este critério valida o comportamento **já existente** do interceptor após a remoção do token — não introduz nenhuma mudança em `auth.interceptor.ts`.

6. **Botão "Sair" não aparece nas rotas onde a navbar já não é exibida hoje**
   - Given o usuário está em `/` ou `/login` (rotas em `HIDDEN_NAV_ROUTES`, onde `AppComponent.showNav` já é `false`)
   - When a tela renderiza
   - Then `NavBarComponent` (e, por consequência, o botão "Sair") não está presente no DOM — comportamento herdado do `@if (showNav)` já existente em `app.component.html`, inalterado por este ticket.

## Casos de borda

- **Múltiplos cliques em "Sair"**: clicar no botão "Sair" quando o token já foi removido (ex. duplo clique, ou clique após uma aba já ter feito logout) não deve lançar erro — `localStorage.removeItem()` é idempotente (remover uma chave inexistente não lança exceção), e `logout()` deve simplesmente ser chamado normalmente novamente, seguido da mesma navegação para `/login`.
- **Ausência de guard de rota protegida (limitação conhecida, não implementada por este ticket)**: hoje não existe nenhum `CanActivate`/guard de rota em `app.routes.ts` impedindo acesso direto a `/transactions` ou `/categories` sem token válido (ex. digitando a URL manualmente após o logout). Este ticket **não** cria esse guard — ver "Fora de escopo". O critério de aceite 4 garante apenas que **o próprio fluxo de clicar em "Sair"** navega para `/login`; ele não impede que o usuário digite `/transactions` na barra de endereço em seguida e veja a tela renderizar (ela renderizaria vazia/com erro de listagem, já que as chamadas subsequentes não teriam mais `Authorization`, conforme critério 5 — mas a tela em si não seria bloqueada por rota).
- **Chave de storage usada por `logout()` deve ser exatamente a mesma usada por `login()`**: `logout()` deve reutilizar a constante `TOKEN_STORAGE_KEY` já existente em `auth.service.ts` (não deve haver uma segunda constante ou uma string duplicada/divergente para a mesma chave).
- **Botão "Sair" é uma ação (`<button>`), não uma rota de navegação (`<a routerLink>`)**: diferente dos links "Transações"/"Categorias" (que usam `RouterLink`/`RouterLinkActive`), "Sair" dispara uma ação client-side (`logout()`) antes de navegar — não deve ser modelado como `routerLink` direto para `/login`, pois isso pularia a chamada a `AuthService.logout()`.
- **Nenhuma confirmação modal exigida**: a spec não exige um diálogo de confirmação ("Tem certeza que deseja sair?") antes do logout — o clique único no botão já executa a ação, salvo decisão em contrário do usuário/Orquestrador em ticket futuro.

## Fora de escopo

- **Exibir o nome do usuário logado na navbar** (ex. "Olá, {firstName}", usando `LoginResponse.firstName`/`lastName`) — mencionado no documento de revisão (`docs/design/ux-review-2026-08-03.md`, seção "Fora de escopo") como nota separada para avaliação futura, **não faz parte deste ticket**. Isso implicaria persistir `firstName`/`lastName` em algum estado de sessão (hoje `AuthService.login()` descarta esses campos, guardando apenas o `token`) — decisão de design de estado a ser tratada em ticket próprio, se solicitado.
- **Guard de rota protegida (`CanActivate` ou equivalente) em `app.routes.ts`** — não existe hoje e não é criado por este ticket, mesmo sendo tecnicamente relacionado ao tema "sessão". Ver "Casos de borda" para a limitação conhecida decorrente disso.
- **Endpoint de logout no backend** (ex. `POST /api/auth/logout`, invalidação de token no servidor) — não existe em `docs/api-contract.md`; o JWT é stateless e o "logout" é inteiramente uma operação client-side de descarte do token local, sem chamada de rede.
- **Refresh token / expiração automática de sessão** — já fora de escopo desde MVP-1 (`LoginResponse.expiresAt` não é usado para lógica de expiração); este ticket não introduz nenhuma lógica de expiração automática, apenas o logout manual disparado pelo clique do usuário.
- **Diálogo de confirmação antes do logout** — ver "Casos de borda"; não exigido pela spec.
- **Sincronização de logout entre múltiplas abas** (ex. `storage` event do navegador para deslogar automaticamente outras abas abertas quando uma faz logout) — não coberto; cada aba mantém seu próprio ciclo de vida de leitura de `localStorage`.
- **Qualquer outro achado do documento de revisão** (mensagem de sucesso pós-criação, extração de estilos compartilhados, breakpoints responsivos, cor do avatar, etc.) — cada um é um achado/ticket separado (UX-4 e demais candidatos registrados em `docs/board.md`); este ticket resolve exclusivamente o achado #4 (Alta severidade).

## Dependências externas / bloqueios conhecidos

Nenhuma. Ticket 100% client-side, sem dependência de API, CORS ou de nenhum endpoint novo — pode ser implementado e testado de forma totalmente isolada (ex. `TestBed` + espiar `localStorage`/`Router.navigateByUrl`, mesmo padrão já usado nos testes de `AuthService`/`LoginComponent` dos tickets anteriores), sem exigir a API real disponível. Depende apenas de MVP-1 (`AuthService`, `authInterceptor`), já `Done` conforme `docs/board.md`.
