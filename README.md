# ASEX Business

Foundation for the ASEX Business product suite: a portal plus an independent PRECIFICA+ calculator.

## Local development

```bash
pnpm install
pnpm dev
pnpm dev:precifica
pnpm typecheck
pnpm test
pnpm build
```

The portal runs at `http://localhost:3000` and PRECIFICA+ at `http://localhost:3001`.

## Current scope

- Portal application library with the three planned products.
- Product and service pricing calculators with scenarios, validated financial formulas and unit tests.
- Browser-local simulation history with editing, duplication, deletion and validated JSON backup.
- Professional PDF reports with optional company details and local logo preview.
- Initial Supabase migration for profiles, organizations, memberships, entitlements and pricing simulations.
- Architecture, security, roadmap and deployment documentation.

Authentication, Supabase synchronization, cross-domain SSO, PROPOSTA+ and NEXO Finance are intentionally not implemented. See `docs/roadmap.md`.
