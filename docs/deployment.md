# Deployment

Deploy `@asex/portal` and `@asex/precifica-plus` as independent Next.js applications. Each requires its own allowed redirect URLs in Supabase. Set only:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

The current UI does not initialize Supabase until the server-side integration is added, so no credentials are required to run the visual and calculation foundation locally.
