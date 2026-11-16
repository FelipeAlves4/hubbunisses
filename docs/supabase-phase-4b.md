# Supabase — Fase 4B

## Sessão compartilhada entre aplicativos

Em desenvolvimento, portal (`localhost:3000`) e PRECIFICA+ (`localhost:3001`) usam o mesmo projeto Supabase. Cookies são vinculados ao host, não à porta, portanto a sessão funciona nos dois aplicativos quando ambos usam a mesma URL e chave publicável.

Em produção, ambos devem ficar sob o mesmo domínio registrável (por exemplo, `hub.exemplo.com` e `precifica.exemplo.com`) e receber `NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN=.exemplo.com`. Não há tokens em URLs, `localStorage` compartilhado ou confiança no portal para autorizar dados: o PRECIFICA+ renova a sessão e o banco aplica RLS.

## Teste controlado de RLS

Após aplicar as migrations em um ambiente descartável, execute `supabase/tests/rls_multi_tenant.sql` pelo SQL Editor ou cliente PostgreSQL autorizado. O script cria dois usuários temporários, comprova que cada um enxerga apenas a própria organização e faz rollback completo.

## Importação local

Quando uma sessão e organização estiverem ativas no PRECIFICA+, a tela de histórico detecta os registros existentes no navegador e apresenta a contagem. A confirmação importa somente IDs ainda inexistentes; qualquer falha informa a quantidade parcial e nunca remove o `localStorage`. O backup JSON continua disponível para recuperação.
