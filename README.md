# LearnHub

LearnHub is a Next.js frontend backed by a Python Flask API and MongoDB Atlas.

- Frontend: `http://localhost:3000`
- Flask API: `http://localhost:5000`

The frontend rewrites `/api/*` requests to Flask. Flask handles authentication, authorization, validation, and database access.

## Requirements

- Node.js 20 or newer and pnpm 9.15.0
- Python 3.11 or newer
- A MongoDB Atlas cluster and database user

## Configure MongoDB Atlas

1. Create an Atlas cluster and database user.
2. Add your development machine's public IP to the Atlas network access list.
3. Copy `.env.example` to `.env` and set `MONGODB_URI`, `MONGODB_DATABASE`, and a random `JWT_SECRET` of at least 32 characters.
4. Set `ADMIN_EMAIL` and a private `ADMIN_REGISTRATION_KEY` of at least 32 characters. Use the key once at `/admin/register` to set up the configured administrator.

Keep `.env` and the Atlas URI private. Use a database user limited to this database.

## Run locally

From the repository root in PowerShell:

```powershell
Copy-Item .env.example .env
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
py backend\seed.py
py backend\create_admin.py
```

`create_admin.py` prompts for the configured LearnHub administrator's password.

Start Flask in one terminal:

```powershell
py backend\app.py
```

Install and start the frontend in another terminal:

```powershell
pnpm install
pnpm dev
```

The Next.js frontend proxies requests through `FLASK_API_URL`, which defaults to `http://127.0.0.1:5000`. Check `http://localhost:3000/api/health` (or `http://localhost:5000/api/learnhub/health`) for database connectivity.

## Deploy

This repository needs two Vercel projects connected to the same GitHub repository:

1. Create the Flask API project first and set **Root Directory** to `backend`. Vercel detects `app.py` as a Flask app and uses `backend/requirements.txt` for Python dependencies.
2. Add these backend environment variables in Vercel: `MONGODB_URI`, `MONGODB_DATABASE`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_REGISTRATION_KEY`, `CORS_ORIGINS`, and `WEB_APP_URL`. Set `CORS_ORIGINS` and `WEB_APP_URL` to the exact production frontend origin, such as `https://your-app.vercel.app`.
3. Deploy the API and copy its Vercel URL.
4. Create another Vercel project from the same GitHub repository and set **Root Directory** to `apps/web`. Enable **Include source files outside of the Root Directory** so the `packages/shared` workspace package is available. Set `FLASK_API_URL` to the API URL from step 3, with no trailing slash, before deploying.
5. Set the API project's `CORS_ORIGINS` to the final frontend origin and redeploy if it changed. Configure MongoDB Atlas Network Access for the backend's outbound IP addresses. Vercel uses dynamic outbound IPs by default; if Atlas requires a fixed allow-list, use Vercel Static IPs or host the API on a service with static egress.

Set secrets in Vercel's Environment Variables; never commit `.env`. Redeploy after changing environment variables. Vercel runs Flask as a Python Function, not as a long-running Gunicorn server.

Razorpay checkout and durable video/file storage require their provider credentials and further integration before production use. Vercel Functions limit request bodies to 4.5 MB; large media must upload directly to an object-storage provider instead of passing through the Flask function.
