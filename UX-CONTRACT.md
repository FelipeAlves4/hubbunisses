# UX contract

## Canonical UI Map

| Capability     | Canonical owner                  | Source of truth                                    | Allowed variants                                            | Verification                          |
| -------------- | -------------------------------- | -------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------- |
| Form           | `@asex/ui`                       | `packages/ui/src/index.tsx`                        | Native input with labelled wrapper                          | Unit and browser validation           |
| Select/Listbox | Native select                    | `apps/precifica-plus/app/page.tsx`                 | Native browser popup for the small local type filter        | Browser keyboard review               |
| Date           | Native date input                | `apps/proposta-plus/app/page.tsx`                  | Browser locale picker for proposal validity                 | Browser keyboard review               |
| Toast          | `@asex/ui`                       | `packages/ui/src/index.tsx`                        | Shared live-region status line                              | Browser success state                 |
| Scrollbar      | global stylesheet                | `packages/ui/src/styles.css`                       | Document scrollbar only                                     | Browser desktop and mobile review     |
| CRUD           | `SimulationRepository`           | `apps/precifica-plus/lib/simulation-repository.ts` | Local now, Supabase later                                   | Repository tests and browser flow     |
| Proposal CRUD  | PROPOSTA+ Supabase data boundary | `apps/proposta-plus/app/page.tsx`                  | Organization-scoped client, catalog and proposal operations | Unit totals, RLS SQL and browser flow |
| Finance CRUD   | NEXO Finance Server Actions       | `apps/portal/app/financeiro/actions.ts`            | Organization-scoped categories and movements                | Unit calculations, RLS SQL and browser flow |

## First phase behavior

The portal only exposes tools granted by server-side entitlements once Supabase is configured. This initial UI uses no simulated login and does not imply authentication. The pricing calculator calculates only on explicit submission, keeps values after errors, focuses the first invalid field, and labels results as a simulation based on user inputs. Simulations and report data are saved only in the current browser, with an explicit notice and validated JSON backup. Deletion requires an app-owned confirmation; navigating away from unsaved calculator changes requires an explicit discard action.

For PROPOSTA+, successful client/catalog creation stays on its respective list and announces success. Saving a proposal creates a draft and moves to the proposal list only after both the proposal and its items are stored. When the PROPOSTA+ migration is absent, the application shows the database error rather than inventing a local or production history. Native selects and date inputs are the deliberate first-phase owner for short, locale-aware option lists and dates.

For NEXO Finance, successful saves remain on the finance workspace and announce success through its status line. A transaction is saved through a server action which validates the input, membership and entitlement before the organization-scoped RLS operation. Pending transactions are forecasts: they do not enter receita recebida, despesas pagas or saldo realizado. Overdue is derived from its due date and is never stored as a separate status.
