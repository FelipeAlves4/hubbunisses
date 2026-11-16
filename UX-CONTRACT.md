# UX contract

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- |
| Form | `@asex/ui` | `packages/ui/src/index.tsx` | Native input with labelled wrapper | Unit and browser validation |
| Select/Listbox | Native select | `apps/precifica-plus/app/page.tsx` | Native browser popup for the small local type filter | Browser keyboard review |
| Toast | `@asex/ui` | `packages/ui/src/index.tsx` | Shared live-region status line | Browser success state |
| Scrollbar | global stylesheet | `packages/ui/src/styles.css` | Document scrollbar only | Browser desktop and mobile review |
| CRUD | `SimulationRepository` | `apps/precifica-plus/lib/simulation-repository.ts` | Local now, Supabase later | Repository tests and browser flow |

## First phase behavior

The portal only exposes tools granted by server-side entitlements once Supabase is configured. This initial UI uses no simulated login and does not imply authentication. The pricing calculator calculates only on explicit submission, keeps values after errors, focuses the first invalid field, and labels results as a simulation based on user inputs. Simulations and report data are saved only in the current browser, with an explicit notice and validated JSON backup. Deletion requires an app-owned confirmation; navigating away from unsaved calculator changes requires an explicit discard action.
