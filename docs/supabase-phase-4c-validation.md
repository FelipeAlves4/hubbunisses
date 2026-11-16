# Supabase — Fase 4C: validação final

Data da validação: 16 de novembro de 2026. Projeto remoto: `qqkmddtjajoffsairsul`.

## Resultado da validação real

| Fluxo | Resultado | Evidência |
| --- | --- | --- |
| Login, logout e nova sessão | Aprovado | Uma conta de teste confirmada entrou no portal, saiu e voltou a entrar com a mesma sessão Supabase. |
| Onboarding e papel `owner` | Aprovado | A organização de teste recebeu uma associação `owner` e a permissão do PRECIFICA+ no mesmo fluxo transacional. |
| Portal → PRECIFICA+ | Aprovado | A navegação em `localhost:3000` para `localhost:3001` preservou a sessão, sem token na URL. |
| Simulação na nuvem e recuperação | Aprovado | Uma simulação foi salva, a sessão foi encerrada e, no novo login, o histórico foi recuperado da organização correta. |
| Importação do histórico local | Aprovado | Um registro do navegador foi migrado para a organização sem apagar o histórico local. |
| Deduplicação da importação | Aprovado | A segunda tentativa manteve uma única cópia do registro remoto. |
| Isolamento RLS entre organizações | Aprovado | `supabase/tests/rls_multi_tenant.sql` foi executado contra o projeto remoto e fez rollback ao final. |

O PRECIFICA+ agora mostra “Conectando à organização…” e um estado de sincronização enquanto carrega o histórico remoto. Isso evita apresentar o estado vazio/local durante a troca do repositório para Supabase.

## Configuração manual pendente no painel do Supabase

As variáveis locais não foram gravadas neste repositório. Cada aplicação precisa de `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; a lista completa está nos respectivos `.env.example`.

No painel do Supabase, em **Authentication → URL Configuration**, configure antes de liberar cadastro e recuperação de senha para usuários reais:

- **Site URL**: a URL canônica de produção do portal. Durante desenvolvimento local, use `http://localhost:3000`.
- **Redirect URLs**: `http://localhost:3000/auth/confirm` e a contraparte de produção. Acrescente URLs de preview apenas quando forem necessárias.
- Mantenha a **confirmação de e-mail** habilitada para produção. A validação do e-mail de teste foi feita com uma conta de teste já confirmada, pois a configuração atual exige confirmação.
- Configure SMTP próprio e remetente verificado. O SMTP padrão do Supabase tem limite baixo e só atende endereços autorizados do time; por isso não é apropriado para validar ou operar cadastro/recuperação de senha em produção.
- Em **Authentication → Password Security**, ative **Leaked password protection**. A auditoria remota indicou que esse recurso ainda está desabilitado.

Enquanto Site URL, Redirect URLs e SMTP não forem definidos, os fluxos que dependem de link enviado por e-mail — confirmação de cadastro e recuperação de senha — continuam pendentes de validação ponta a ponta.

## Segurança e sessão

- A sessão é validada novamente pelo PRECIFICA+; não há token de autorização em query string.
- Em desenvolvimento, cookies são compartilhados por host entre as portas 3000 e 3001. Em produção, defina `NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN` para o domínio registrável comum, por exemplo `.exemplo.com`, quando portal e aplicativo estiverem em subdomínios diferentes.
- A auditoria remota não encontrou tabelas acessíveis pelo papel `anon`. Restam dois avisos esperados para funções `SECURITY DEFINER` chamadas por usuários autenticados: `create_organization` e `is_organization_member`. Ambas verificam o usuário autenticado e são necessárias, respectivamente, para o onboarding atômico e as políticas RLS. O único aviso acionável restante é a proteção contra senhas vazadas, listada acima.

## Dados de teste

Foram preservados dados explicitamente identificados como teste de Fase 4C, incluindo uma organização e duas simulações. Nenhum usuário ou dado real foi alterado. A limpeza desses dados deve ser feita apenas com autorização explícita.
