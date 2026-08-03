# Board — MoneyMoneyUI

Estado do backlog, mantido pelo agente `orquestrador`. Fases: `Backlog` → `Spec` → `Em Dev (TDD)` → `Em QA` → `Done` (ou `Rejeitado` → volta para `Em Dev (TDD)`).

| Ticket | Título | Endpoints | Status | Observações |
|---|---|---|---|---|
| MVP-1 | Login/Auth | `POST /api/auth/login` | Done | Spec em `docs/specs/mvp-1-login-auth.md`. Aprovado pelo QA (16/16 testes). Pré-requisito para todos os outros tickets (token Bearer) |
| MVP-2 | Dashboard de Transações (listar + criar) | `GET/POST /api/transaction` | Backlog | Depende de MVP-1 |
| MVP-3 | Categorias (listar + criar) | `GET/POST /api/category` | Backlog | Depende de MVP-1 |
| MVP-4 | Cartões de Crédito (listar + criar) | `GET/POST /api/creditcard` | Backlog | Depende de MVP-1 |
| MVP-5 | Compras no cartão + Fatura | `POST /api/creditcard/{id}/purchases`, `GET /api/creditcard/{id}/fatura` | Backlog | Depende de MVP-1 e MVP-4 |

## Bloqueios / dependências externas

- ~~**CORS não configurado na MoneyMonkey API.**~~ **Resolvido localmente em 2026-08-03** — CORS habilitado no backend em ambiente local (`https://localhost:7002`). Segue sendo uma dependência do time de backend garantir CORS habilitado em outros ambientes (staging/produção) conforme forem criados.

## Configuração de ambiente

- `src/environments/environment.ts` (default/produção — `apiBaseUrl` ainda placeholder, atualizar quando existir host de produção) e `environment.development.ts` (`apiBaseUrl: 'https://localhost:7002'`), trocados via `fileReplacements` no `angular.json` conforme padrão do Angular CLI (`ng generate environments`).
- `AuthService` consome `environment.apiBaseUrl` para montar a URL de `POST /api/auth/login`. Próximos serviços (categoria, transação, cartão) devem seguir o mesmo padrão em vez de hardcoded paths.

## Histórico de decisões

- 2026-08-03: Projeto Angular 19 gerado (`ng new`, standalone components, routing, SCSS, Jasmine/Karma) para viabilizar o ciclo TDD dos tickets.
- 2026-08-03: `environments/` criado e `AuthService` atualizado para usar `apiBaseUrl` (`https://localhost:7002` local) após CORS ser habilitado no backend localmente. Suíte (16/16) e build de produção confirmados verdes após a mudança.
- 2026-08-03: `docs/design/mockup.pdf` adicionado (1 página, tela de Dashboard/Painel — não é mock de login). Spec do MVP-1 atualizada: rota raiz `/` agora também renderiza `LoginComponent` (tela inicial temporária do MVP, critério de aceite 6) e a tela de login foi restylizada extraindo o design system do mock (cores, logo/mascote, tipografia, estilo de card/botão — tokens em `src/styles.scss`). Reaprovado pelo QA — 18/18 testes, build limpo.
- 2026-08-03: Bug encontrado pelo usuário testando no navegador — `app.component.html` tinha `<router-outlet />` enterrado depois de ~300 linhas de marketing padrão do `ng new`, escondendo a tela de login. Corrigido (template agora só `<router-outlet />`); teste de regressão com asserção negativa adicionado. QA reaprovou — 17/17.
- 2026-08-03: Interceptor `src/app/core/interceptors/auth.interceptor.ts` implementado, fechando o critério de aceite 1 (anexação automática de `Authorization: Bearer <token>` nas rotas autenticadas). Uma primeira versão excluía indevidamente `GET /api/user` (só `POST /api/user` é público) — corrigido para exclusão por método+path. QA aprovou — 24/24 testes, build limpo. **MVP-1 agora está completo end-to-end** (rota, visual, e anexação real do token).
