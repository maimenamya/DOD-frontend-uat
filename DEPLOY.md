# Deploy frontend to Vercel

## Environment files

| File | Purpose |
|------|---------|
| `.env.uat` | Copy `BACKEND_URL` into Vercel → **Preview** / UAT |
| `.env.prod` | Copy `BACKEND_URL` into Vercel → **Production** |

Local `npm start` does **not** use these files — it proxies `/api` to `http://127.0.0.1:3000` via `proxy.conf.json`.

Backend Railway variables: see `backend/.env.uat` / `backend/.env.prod` and `backend/RAILWAY_DEPLOY.md`.

---

## 1. Connect the repo

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import this Git repository.
2. Set **Root Directory** to `frontend`.
3. Build: `npm run build` → output `dist/frontend/browser` (from `vercel.json`).

## 2. Vercel environment variables (required)

| Name | UAT (Preview) | Production |
|------|---------------|------------|
| `BACKEND_URL` | From `frontend/.env.uat` | From `frontend/.env.prod` |

Railway URL, **no trailing slash**. Example: `https://dod-backend.up.railway.app`

Each deploy runs `scripts/generate-environment.mjs`, which sets Angular `apiBaseUrl` to  
`https://your-railway.app/api` so login calls **Railway**, not `dod-frontend.vercel.app/api`.

Ensure Railway `CORS_ORIGIN` includes your Vercel domain.

## 3. Backend CORS

Set Railway `CORS_ORIGIN` to your Vercel URL (see `backend/.env.uat` / `.env.prod`).

## 4. Deploy

```bash
cd frontend
npx vercel
```

## 5. Angular routes

`vercel.json` rewrites routes to `index.html` for client-side routing.
