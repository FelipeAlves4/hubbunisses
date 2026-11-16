# Architecture

ASEX Business is a pnpm workspace. `apps/portal` is the identity and application-library surface; `apps/precifica-plus` is an independently runnable calculation application. `packages/ui` contains shared primitives and tokens; `packages/pricing` owns pure pricing rules and unit tests.

The applications are intentionally separate deployments. A Supabase-backed identity integration will use their server environments; no access or refresh token is passed in a URL. Cross-subdomain SSO requires a Supabase-compatible OAuth/OIDC design and must be validated against the actual hosting domains before enabling it.

PRECIFICA+ exposes a `SimulationRepository` boundary inside its application. The current `LocalSimulationRepository` keeps versioned simulation inputs in browser localStorage, recalculates results with the current compatible engine and supports validated JSON backup. A future Supabase implementation must satisfy the same interface; no browser Supabase client is introduced in this phase.
