# Deploy frontend to Vercel

## 1. Connect the repo

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import this Git repository.
2. Set **Root Directory** to `frontend` (important for a monorepo).
3. Vercel should detect settings from `vercel.json` automatically:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist/frontend/browser`

## 2. Environment variables

In **Project Settings → Environment Variables**, add:

| Name          | Value                                      | Environments      |
|---------------|--------------------------------------------|-------------------|
| `BACKEND_URL` | Your API base URL (no trailing slash)      | Production, Preview |

Example: `https://dod-api.railway.app`

The app calls `/api/...` in the browser. Vercel routes those requests to `api/[...path].js`, which proxies to `BACKEND_URL`.

## 3. Backend CORS

Allow your Vercel URL on the Express server, for example:

- `https://your-app.vercel.app`
- Preview URLs if you use them

## 4. Deploy

Push to the connected branch or run locally:

```bash
cd frontend
npx vercel
```

## 5. Angular routes

`vercel.json` rewrites all non-file routes to `index.html` so client-side routing (`/dashboard`, `/login`, etc.) works on refresh.
