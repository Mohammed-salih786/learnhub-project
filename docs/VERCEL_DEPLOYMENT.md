# Vercel Deployment

LearnHub deploys as two Vercel projects from this repository.

## Frontend

- Root Directory: `apps/web`
- Framework: Next.js
- Install Command: `corepack pnpm install --frozen-lockfile`
- Build Command: `corepack pnpm build`
- Node.js: `22.x`
- Enable source files outside the Root Directory because `apps/web` uses `@learnhub/shared`.

Set `FLASK_API_URL` to the deployed backend URL, for example:

```env
FLASK_API_URL=https://learnhub-api.vercel.app
```

## Backend

- Root Directory: `backend`
- Framework: Other/Python
- Install Command: `pip install -r requirements.txt`
- Entry point: `app.py`

Set `MONGODB_URI`, `MONGODB_DATABASE`, `JWT_SECRET`, `ADMIN_EMAIL`,
`ADMIN_REGISTRATION_KEY`, `CORS_ORIGINS`, and `WEB_APP_URL` in the backend
project's Vercel environment settings. Never commit these values to Git.

## Verification

Run these checks before deployment:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm --dir apps/web typecheck
corepack pnpm --dir apps/web build
python -m py_compile backend/app.py
```

After deployment, verify the backend health endpoint, login, registration,
course images, YouTube lesson embeds, and mobile layouts.
