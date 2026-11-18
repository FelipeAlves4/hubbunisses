# NEXO Finance — roteiro de liberação controlada

Este roteiro não deve ser executado em produção sem autorização explícita. A migration do NEXO não provisiona o entitlement automaticamente.

## 1. Validar em ambiente controlado

1. Crie ou selecione um projeto/branch Supabase de homologação com backup disponível.
2. Verifique que a API expõe o schema `public` e que o papel `authenticated` consegue acessar as tabelas somente por RLS.
3. Aplique as migrations locais na ordem do repositório. A nova migration é `20261118170000_nexo_finance_mvp.sql`.
4. Rode `supabase/tests/nexo_finance_rls.sql` em uma sessão administrativa no ambiente de homologação. O arquivo abre uma transação e sempre termina com `ROLLBACK`.
5. Execute o roteiro de navegador abaixo com uma organização de teste cujo entitlement tenha sido habilitado.

## 2. Provisionar Asex Educação (somente após autorização)

Execute esta instrução uma única vez, em transação, somente depois de confirmar que há exatamente uma organização com o nome `Asex Educação`:

```sql
begin;

do $$
declare
  target_organization_id uuid;
begin
  select id into strict target_organization_id
  from public.organizations
  where name = 'Asex Educação';

  insert into public.app_entitlements (organization_id, app_key, enabled, expires_at)
  values (target_organization_id, 'nexo-finance', true, null)
  on conflict (organization_id, app_key) do update
  set enabled = true, expires_at = null;
end;
$$;

commit;
```

Se a busca não retornar exatamente uma organização, ela falha e a transação não deve ser substituída por uma aproximação de nome.

## 3. Roteiro de navegador

1. Entre com um owner ou member da Asex Educação com `nexo-finance` ativo e abra `/financeiro`.
2. Crie uma categoria de receita e outra de despesa.
3. Registre uma receita pendente e confirme que ela aparece em contas a receber, sem alterar o saldo realizado.
4. Edite a receita para `Pago`, informe a data de pagamento e confirme a atualização de receita recebida e saldo realizado.
5. Registre e exclua uma despesa; confirme que histórico e indicadores voltam ao estado anterior.
6. Filtre por período, tipo, categoria, pendente, pago e atrasado.
7. Remova o entitlement em homologação e confirme que `/financeiro` leva a acesso restrito e que consultas diretas com o token do usuário não retornam linhas das tabelas financeiras.
8. Repita pelo menos os passos 1, 3 e 5 em viewport móvel estreito.

## 4. Rollback

Não remova tabelas nem execute DDL destrutivo como resposta a uma falha de publicação: dados financeiros podem já existir.

Para interromper o acesso sem perda de dados:

```sql
update public.app_entitlements
set enabled = false
where organization_id = '<organization-id-confirmado>'
  and app_key = 'nexo-finance';
```

Depois, reverta somente o deploy da aplicação para a versão anterior. As tabelas e registros ficam preservados e inacessíveis por RLS enquanto o entitlement estiver desabilitado.
