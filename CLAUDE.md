# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MoneyMoneyUI is the Angular frontend for **MoneyMonkey**, a personal finance app (transactions, categories, credit cards and invoices). It consumes the MoneyMonkey API (ASP.NET Core 8, separate repository) via JWT Bearer auth. Angular 19, standalone components (no NgModules), TypeScript, SCSS, RxJS, Jasmine/Karma.

## Commands

```bash
npm start                                              # ng serve — http://localhost:4200
npm run build                                          # ng build — output in dist/
npm test                                                # ng test (Karma/Chrome, interactive watch)
npx ng test --watch=false --browsers=ChromeHeadless     # run the suite once, non-interactive (used by dev-frontend/qa agents)
```

Running the app end-to-end in a browser requires the MoneyMonkey API running locally (`https://localhost:7002` by default).

## Architecture

### Environment-based API config
The API base URL comes from `src/environments/` and is swapped via Angular CLI `fileReplacements` (see `angular.json`): `environment.development.ts` (`apiBaseUrl: 'https://localhost:7002'`) is used for `ng serve`; `environment.ts` is the production default (still a placeholder until a prod host exists). Every service that calls the API must build URLs from `environment.apiBaseUrl` — never hardcode host/port. `src/app/core/services/auth.service.ts` is the reference pattern.

### Folder structure
```
src/app/
  core/                    # shared code
    interceptors/          # auth.interceptor.ts — attaches Authorization: Bearer <token>
    models/                # interfaces/types mirroring docs/api-contract.md
    services/
  features/                # one folder per feature (e.g. login/)
```

### Auth flow
`POST /api/auth/login` returns a JWT, persisted by `AuthService` (localStorage). `auth.interceptor.ts` (a functional `HttpInterceptorFn`, registered in `app.config.ts`) attaches `Authorization: Bearer <token>` to every request **except** those explicitly excluded by method+path (currently `POST /api/auth/login` and `POST /api/user`) — exclusion is by method+path pair, not path alone, since e.g. `GET /api/user` requires auth while `POST /api/user` does not.

### API contract is the source of truth
`docs/api-contract.md` defines every endpoint, DTO, and enum for the MoneyMonkey API — field names, optionality, and validation rules (e.g. `value > 0`, `transactionName` max 100 chars) must match it exactly. Enums are transmitted as **string literals**, never numbers (e.g. `TransactionType = 'Entrada' | 'Saida'`). TypeScript models in `src/app/core/models/` (one file per domain: `auth.model.ts`, `enums.model.ts`, etc.) must mirror this contract exactly — no invented/renamed/removed fields without updating the contract doc first. If the real API (Swagger) diverges from this doc, the doc gets updated first; no code is written against a stale contract.

Known blocker: the API had no CORS configured; resolved locally as of 2026-08-03 (see `docs/board.md`), still pending for other environments.

## Spec-driven development workflow

This repo follows a strict spec-driven cycle with TDD, coordinated by agents in `.claude/agents/`:

```
Backlog → [po] writes the spec (docs/specs/<ticket>.md)
        → [dev-frontend] TDD: red → green → refactor
        → [qa] validates against acceptance criteria
        → Approved → Done   |   Rejected → back to dev-frontend
```

- `orquestrador` coordinates phases and keeps `docs/board.md` (ticket status table) current. It never writes code/specs itself.
- No ticket goes to `dev-frontend` without a spec at `docs/specs/<ticket>.md` written by `po`. No ticket is marked `Done` without explicit `qa` approval.
- `po` writes specs only (never production code), always citing exact DTO/field/enum names from `docs/api-contract.md`.
- `dev-frontend` implements one ticket at a time, strict TDD (write failing test from acceptance criteria → minimal implementation → refactor), never implementing behavior beyond what the spec + API contract define.
- `qa` validates independently against the spec's acceptance criteria (not the dev's self-report), runs the full suite, and may add missing tests to expose coverage gaps — but never writes production code.
- If `docs/design/mockup.pdf` (or `docs/design/<ticket-id>.pdf`) exists, it informs layout/UX only (field order, visual hierarchy) — never data/fields, and never drives the TDD acceptance criteria themselves. See `docs/design/README.md` for the convention.

When working outside the agent-driven flow (e.g. direct requests to Claude Code), still respect the same invariants: don't invent API fields/endpoints, keep enums as string literals matching the contract, and don't mark work done with failing or missing tests.
