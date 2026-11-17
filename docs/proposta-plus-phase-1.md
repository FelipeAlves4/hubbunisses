# PROPOSTA+ — Fase 1

Esta primeira entrega cria o aplicativo independente em `apps/proposta-plus`, na porta 3002, com autenticação SSR compatível com o Hub, layout responsivo, dashboard de dados reais, módulos de clientes e catálogo e editor de proposta com totalização monetária testada.

## Fundação aplicada

`supabase/migrations/20261116194659_proposta_plus_foundation.sql` foi aplicada ao projeto remoto `qqkmddtjajoffsairsul`. Ela contém:

- tabelas de clientes, catálogo, propostas e itens;
- snapshots de cliente e empresa para preservar dados comerciais históricos;
- valores `numeric` com checks de não negatividade;
- numeração concorrente por organização via trigger interno, sem RPC exposta;
- chaves compostas para impedir relações entre empresas;
- RLS para leitura por membro e alteração somente pelo criador;
- nenhum entitlement automático para `proposta-plus`.

`supabase/tests/proposta_plus_rls.sql` executa o fluxo como o papel `authenticated` e faz rollback integral. As correções de totalização aplicadas estão registradas localmente como `20261117165349_20261117170000_fix_proposal_item_total_trigger.sql` e `20261117170524_prepare_proposal_totals_before_update.sql`. A segunda calcula os totais antes da constraint quando `additional_total` ou `tax_rate` mudarem.

O entitlement `proposta-plus` é uma decisão explícita por organização. Nesta validação, ele foi habilitado apenas para `ASEX Fase 4C Teste`; o Hub e o layout servidor do aplicativo verificam esse acesso antes de exibir ou atender o PROPOSTA+.

## Escopo posterior

Prévia, os três templates PDF e o compartilhamento manual ficam para a etapa de documentos, depois da fundação de dados estar aprovada e persistindo corretamente.
