# AGENDA+ MVP

O AGENDA+ usa a sessão do Hub. A rota interna é `/agenda` e a página pública é `/agendar/[slug]`. A identidade Calm Precision usa verde-sálvia para escolhas e dias ativos, papel claro para o calendário e lavanda para atendimentos em andamento e políticas. A tipografia serifada destaca datas e períodos, enquanto os formulários e eventos usam a fonte de interface.

## Banco e acesso

- `agenda_settings` define fuso IANA, slug, contato, janela de reserva e confirmação.
- `agenda_services`, `agenda_professionals` e `agenda_professional_services` modelam serviços e habilitações. Profissionais podem ter vínculo opcional com um membro.
- `agenda_working_hours` guarda turnos semanais e exceções por data. `agenda_time_off` guarda bloqueios e folgas. Turnos separados representam pausas.
- `agenda_appointments` guarda instantes, cliente opcional do CLIENTA+, origem e status. O histórico em `agenda_appointment_events` é gravado por trigger e omite contatos.
- O PostgreSQL valida a disponibilidade antes de gravar e usa exclusão GiST sobre intervalos `[início, fim)` por organização e profissional. Cancelamentos liberam a faixa. Reservas e alterações de configuração da mesma organização compartilham um lock transacional.
- Membros ativos com entitlement podem consultar a agenda da organização e criar reservas internas. Apenas autores ou administradores alteram reservas. Owners e admins configuram o produto e administram solicitações públicas.
- A API pública retorna catálogo, horários e o recibo da própria solicitação. Nome e um contato ficam separados de `proposal_clients` até vínculo explícito. Os limites são persistidos no PostgreSQL e compartilhados entre instâncias, com 240 leituras e 12 tentativas de reserva por organização a cada minuto. O limite é coletivo e um pico pode afetar outros visitantes da mesma agenda. O MVP não envia notificações ou lembretes.

## Validação piloto

1. Em Supabase de teste, aplicar o histórico e a migration `20261121013000_agenda_plus_mvp.sql`. Confirmar que a migration é a única pendência antes de qualquer implantação em outro ambiente.
2. Em autorização separada, habilitar `agenda-plus` para uma organização de teste. A migration só registra a chave.
3. Como administrador, configurar o fuso, cadastrar serviço e profissional, vincular os dois e cadastrar turnos. Testar uma pausa e um bloqueio no mesmo dia.
4. Criar um cliente interno sem CPF/CNPJ, reservar, reagendar e acompanhar o histórico. Como membro comum, conferir o acesso e a restrição de autoria.
5. Ativar o slug público e reservar em uma sessão anônima. Conferir o contato privado e a associação manual ao cliente compartilhado. Revogar o entitlement e confirmar o bloqueio das duas rotas.
6. Executar `pnpm typecheck`, `pnpm test`, `pnpm build` e `supabase/tests/agenda_plus_rls.sql` em PostgreSQL de teste. O SQL funcional roda em transação com rollback.
7. Para verificar concorrência, usar um banco local descartável chamado `agenda_test` com as migrations aplicadas e o cliente Node `pg`. Executar `node supabase/tests/agenda_concurrency.mjs` com `AGENDA_TEST_DATABASE_URL` apontando para o banco local. Se `pg` estiver instalado fora do repositório, usar `AGENDA_PG_CLIENT_MODULE` com o caminho do módulo. Esse teste persiste uma reserva de fixture para provar o resultado após commit e deve rodar em um banco descartável.
