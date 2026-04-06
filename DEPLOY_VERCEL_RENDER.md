# Deploy Zenara CRM (Vercel + Render)

This project is split into:
- Frontend (Next.js): `zenara-crm-api/frontend` -> deploy to Vercel
- Backend API (Laravel): `zenara-crm-api` -> deploy to Render

## 1) Deploy API to Render

1. Push this repository to GitHub/GitLab.
2. In Render, create a new Blueprint and point it to this repo.
3. Render will read `render.yaml` and create:
   - Web service: `zenara-crm-api`
   - Postgres database: `zenara-crm-db`
   - Runtime: Docker (from `zenara-crm-api/Dockerfile`)
4. After first deploy, open Render Shell for the web service and run:

```bash
php artisan migrate --force
php artisan db:seed --force
```

5. In Render service Environment, update these values:
   - `APP_URL=https://<your-render-service>.onrender.com`
   - `CORS_ALLOWED_ORIGINS=https://<your-vercel-app>.vercel.app`
6. Redeploy the Render service.

Your API base URL will be:

```text
https://<your-render-service>.onrender.com/api
```

## 2) Deploy Frontend to Vercel

1. Import the same repo into Vercel.
2. Set **Root Directory** to:

```text
zenara-crm-api/frontend
```

3. Add Environment Variable in Vercel:
   - `NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com/api`
4. Deploy.

## 3) Final CORS Check

After Vercel gives you the final domain:
1. Copy the exact URL (for example `https://zenara-crm.vercel.app`).
2. Put that URL into Render `CORS_ALLOWED_ORIGINS`.
3. Redeploy Render one more time.

## Notes

- Frontend `build` script now uses `next build` (Vercel-compatible).
- If you still need static export for Firebase, use:

```bash
npm run build:static
```
