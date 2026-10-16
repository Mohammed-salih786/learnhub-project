# LearnHub + Swachh-Ayush AI

A pnpm/Turborepo workspace containing two independent products:

- LearnHub, an India-first learning marketplace at `http://localhost:3000`.
- Swachh-Ayush AI, a municipal waste and public-health pilot dashboard at `http://localhost:3001`.

## Local development

### Prerequisites

- Node.js 20 or newer
- pnpm 9.15.0 (`npm install --global pnpm@9.15.0`)
- Docker Desktop, running, for local Supabase

Both apps use the same Supabase project. The checked-in schema migrations and seed data are in `supabase/`. LearnHub reads `apps/web/.env.local`; Swachh-Ayush reads `apps/swachh-ayush/.env.local`. Create the latter from `apps/swachh-ayush/.env.example`, then configure the Supabase URL, server-only service-role key, and a strong `SWACHH_INGEST_API_KEY`. Never use the service-role key in a `NEXT_PUBLIC_` variable or commit local env files.

Swachh-Ayush dashboard access uses Supabase email/password authentication and an explicit municipal role assignment. Create staff accounts in Supabase Auth, then assign each account a role in SQL:

```sql
INSERT INTO public.swachh_user_roles (user_id, role)
VALUES ('<auth-user-uuid>', 'health_officer');
```

Supported roles are `city_commissioner`, `waste_manager`, `health_officer`, and `supervisor`. Only commissioners, waste managers, and supervisors can update action status. The dashboard API verifies the Supabase access token and active role for every request.

### Start the full local stack

From the repository root, in PowerShell:

```powershell
$env:Path = "$env:APPDATA\npm;$env:Path"
pnpm install
npx supabase start
npx supabase db reset
Copy-Item apps\swachh-ayush\.env.example apps\swachh-ayush\.env.local
# Set the local Supabase URL, anon key, and service-role key printed by
# `npx supabase start`, then set a private SWACHH_INGEST_API_KEY.
pnpm dev
```

`db reset` applies all migrations and demo seed data, but **deletes existing data in the local Supabase database**. Skip it if you need to preserve local data and apply pending migrations using `npx supabase migration up` instead. With a hosted project, apply migrations using your Supabase deployment process and configure each app's `.env.local` with that project's URL and keys; do not run local reset against production.

`pnpm dev` starts both apps. Use `pnpm dev:learnhub` or `pnpm dev:swachh` to run only one. Check `/api/health` on each port to verify its database connection; health checks return HTTP 503 if the database/schema is unavailable.

Swachh-Ayush ingests only aggregate health counts and weather observations. Its telemetry, health, weather, and overdue-scan endpoints require `Authorization: Bearer <SWACHH_INGEST_API_KEY>`. Schedule `POST /api/ops/scan-overdue` with a trusted scheduler at least once per minute to detect stops that passed their collection time; a running app alone does not provide a background scheduler. Route planning currently uses a nearest-neighbour baseline with straight-line distances, not live road-network optimization. Critical-risk actions are written to the database as scheduled work items; connecting them to live truck dispatch, fogging systems, hospital feeds, Vertex AI, and a traffic-aware maps provider still requires those municipal integrations and credentials.

To stop local Supabase, run `npx supabase stop`.
