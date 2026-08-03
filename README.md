# MoneyMoneyUI

Frontend Angular do **MoneyMonkey** — app de finanças pessoais (transações, categorias, cartões de crédito e faturas). Consome a MoneyMonkey API (ASP.NET Core, repositório separado) via JWT Bearer.

## Stack

- Angular 19 (standalone components, sem NgModules)
- TypeScript, SCSS
- RxJS
- Jasmine + Karma (testes unitários)

## Pré-requisitos

- Node.js compatível com Angular CLI 19
- MoneyMonkey API rodando localmente (`https://localhost:7002` por padrão) para testar o app de ponta a ponta no navegador

## Como rodar

```bash
npm install
npm start        # ng serve — http://localhost:4200
```

```bash
npm test          # ng test (Karma/Chrome)
npm run build      # ng build — saída em dist/
```

## Configuração de ambiente

A URL base da API vem de `src/environments/`, trocada via `fileReplacements` (padrão Angular CLI):

- `environment.development.ts` → `apiBaseUrl: 'https://localhost:7002'` (usado em `ng serve`)
- `environment.ts` → produção (`apiBaseUrl` ainda placeholder até existir um host de produção)

Serviços que chamam a API devem sempre montar a URL a partir de `environment.apiBaseUrl` — nunca hardcode host/porta. Veja `src/app/core/services/auth.service.ts` como referência.

## Estrutura do projeto

```
src/app/
  core/            # código compartilhado: services, interceptors, models
    interceptors/  # ex.: auth.interceptor.ts — anexa Authorization: Bearer <token>
    models/        # interfaces/types espelhando docs/api-contract.md
    services/
  features/        # uma pasta por feature (ex.: login/)
```

Autenticação: o token JWT retornado por `POST /api/auth/login` é persistido pelo `AuthService` e anexado automaticamente como `Authorization: Bearer <token>` pelo `auth.interceptor.ts` em toda rota autenticada.

## Documentação

- [`docs/api-contract.md`](docs/api-contract.md) — contrato de endpoints/DTOs da MoneyMonkey API. Fonte da verdade: nenhum código é escrito contra um contrato desatualizado.
- [`docs/board.md`](docs/board.md) — backlog de tickets do MVP e status atual.
- [`docs/specs/`](docs/specs/) — spec de critérios de aceite (Given/When/Then) de cada ticket.
- [`docs/design/`](docs/design/) — mockups de referência visual.

## Fluxo de desenvolvimento

Este repo segue um ciclo spec-driven com TDD estrito, coordenado por agentes definidos em `.claude/agents/`:

```
Backlog → [po] escreve a spec (docs/specs/<ticket>.md)
        → [dev-frontend] TDD: red → green → refactor
        → [qa] valida contra os critérios de aceite
        → Aprovado → Done   |   Rejeitado → volta pro dev-frontend
```

O `orquestrador` coordena as fases e mantém `docs/board.md` atualizado. Nenhum ticket avança para desenvolvimento sem spec, e nenhum é marcado `Done` sem aprovação do QA.

## Recursos adicionais do Angular CLI

Para scaffolding, comandos e referência geral do Angular CLI, veja [angular.dev/tools/cli](https://angular.dev/tools/cli).
