# Zenara CRM Frontend

Simple Next.js frontend to list CRM entries pulled from the Laravel API.

Quick start

1. Install dependencies

```powershell
cd frontend
npm install
```

2. Start dev server

```powershell
npm run dev
```

3. Make sure the Laravel API is running (default `http://localhost:8000`) and has run migrations & seeders.

Environment

Copy `.env.local.sample` to `.env.local` and update `NEXT_PUBLIC_API_URL` if your API runs on another host/port.

Deploying to Firebase Hosting (optional)

1. Install and login Firebase CLI if you haven't already:

```powershell
npm install -g firebase-tools
firebase login
```

2. In the `frontend` folder, set your Firebase project id in `.firebaserc` (replace `your-firebase-project-id`).

3. Build and export the static site, then deploy:

```powershell
# from frontend/
npm run build
firebase deploy --only hosting --project your-firebase-project-id
```

The site will be served from the project hosting URL provided by Firebase after deployment.

Notes:
- This uses a static export (Next.js `next export`) so the frontend must be client-rendered (no server-only APIs). Our current page fetches the Laravel API client-side and is compatible with static export.
- Ensure your Laravel API allows requests from your Firebase hosting domain (update CORS in `config/cors.php`).

