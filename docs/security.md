# Security notes

- `service_role` credentials never belong in `NEXT_PUBLIC_*` variables or browser code.
- Every organization-scoped table is RLS-enabled. Client mutation of memberships and entitlements is prohibited by design.
- The initial migration grants members only organization-isolated access to simulations they own.
- Management of members, entitlements and any global administrative privilege needs audited server-side endpoints and an explicit policy before it is exposed.
- Apply migrations only through the Supabase CLI to the selected project after review; no remote migration has been executed by this repository.
- Review retention, deletion and export requirements with the business owner before storing personal data or generating reports.
