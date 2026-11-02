# Simple Vercel Deployment

LearnHub uses one Vercel project for the Next.js website and one for its Flask API. Both are deployed from this repository.

## 1. Deploy the API

- Import the repository into Vercel and set **Root Directory** to `backend`.
- Add `MONGODB_URI`, `MONGODB_DATABASE`, `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_REGISTRATION_KEY` under Project Settings > Environment Variables.
- For a simple MongoDB Atlas connection, set Network Access to `0.0.0.0/0`. Keep the database username and password private.
- Deploy, then copy the API deployment URL.

## 2. Deploy the website

- Import the same repository as a second Vercel project and set **Root Directory** to `apps/web`.
- Enable **Include source files outside of the Root Directory** so the shared package can be built.
- Add `FLASK_API_URL` with the API URL from step 1, without a trailing slash. Add `NEXT_PUBLIC_SITE_URL` with the website's Vercel URL.
- Deploy and copy the website URL.

## 3. Finish the API settings

- Set `CORS_ORIGINS` and `WEB_APP_URL` on the API project to the website URL from step 2.
- Redeploy the API after saving those settings.
- For the first admin account, use `/admin/register` once with the configured `ADMIN_REGISTRATION_KEY`; then sign in at `/admin/login`.

Keep the existing email and password login. No extra identity provider or multi-factor setup is needed. Store credentials in Vercel Environment Variables, not in source files.

