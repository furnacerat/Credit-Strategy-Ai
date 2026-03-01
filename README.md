# Credit Repair Website

Monorepo layout for:

- Web app (Vercel): Next.js (App Router) + TypeScript
- DB/Auth/Storage: Supabase
- Worker (Render): Python PDF parsing + OCR fallback + dispute letter generation

## Repo layout

- `apps/web/` - Next.js app (what Vercel deploys)
- `apps/worker/` - Python worker service (what Render runs)
- `supabase/` - migrations/policies (we'll add as we build)
- `packages/shared/` - optional shared schemas/types later

Legacy static prototype (kept for reference):

- `src/` - initial static HTML/CSS scaffold
- `docs/` - copy/SEO/legal notes
