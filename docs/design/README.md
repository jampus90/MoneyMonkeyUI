# Referência visual (mockups)

Coloque aqui o(s) arquivo(s) de mock/design do MoneyMoneyUI — ex.: `mockup.pdf`.

## Convenção

- Arquivo geral (cobre múltiplas telas/design system): `docs/design/mockup.pdf`.
- Se no futuro existirem mocks por ticket, use `docs/design/<ticket-id>.pdf` (ex.: `docs/design/mvp-2-dashboard-transacoes.pdf`).

## Como os agentes usam isso

- **PO** (`.claude/agents/po.md`): ao escrever a spec de um ticket, se este arquivo existir, o PO deve abrir o PDF (a ferramenta Read lê PDFs, inclusive por página — útil aqui já que o mock cobre várias telas) e identificar a(s) página(s) relevantes para o ticket. A spec deve incluir uma seção "Referência visual" citando o arquivo e o número da página, com uma descrição textual objetiva do layout esperado (campos, ordem, hierarquia visual) — sem inventar dado/campo que não esteja em `docs/api-contract.md`. O mock informa **layout e UX**, não o contrato de dados.
- **Dev** (`.claude/agents/dev-frontend.md`): ao implementar, usa a seção "Referência visual" da spec (arquivo + página) para guiar estrutura de template/HTML e estilos, mas os testes e o TDD continuam guiados pelos critérios de aceite Given/When/Then, não pelo visual.
- **QA** (`.claude/agents/qa.md`): fidelidade visual pixel-perfect não é critério de aprovação (foco em critérios de aceite funcionais); divergências grandes de layout em relação ao mock podem ser reportadas como observação, não como bloqueio, salvo se a spec listar isso como critério de aceite.

Se o PDF tiver mais de 10 páginas, lembre-se que a ferramenta de leitura exige informar o range de páginas (máx. 20 por leitura) — não tente ler o arquivo inteiro de uma vez.
