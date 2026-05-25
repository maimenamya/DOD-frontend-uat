# Deploy frontend to Vercel

## Environment files

| File | Purpose |
|------|---------|
| `.env.uat` | Copy `BACKEND_URL` into Vercel → **Preview** / UAT |
| `.env.prod` | Copy `BACKEND_URL` into Vercel → **Production** |

Local `npm start` does **not** use these files — it uses `environment.ts` with `apiUrl: '/api'` and `proxy.conf.json`.

---

## 1. Connect the repo

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import `DOD-frontend`.
2. **Root Directory:** `frontend` (if the repo is the monorepo root, set Root Directory to `frontend`).
3. Build uses `vercel.json`: `npm run build` → `set-env.js` then `ng build --configuration production`.

## 2. Vercel environment variable (required)

| Name | UAT (Preview) | Production |
|------|---------------|------------|
| `BACKEND_URL` | Railway UAT/public URL | Railway production URL |

Example: `https://dod-backend-production.up.railway.app` — **no trailing slash**.

During build, `set-env.js` writes `src/environments/environment.prod.ts` with:

```typescript
apiUrl: 'https://your-railway.app/api'
```

The browser calls Railway **directly** (no `/api` proxy on Vercel).

## 3. Backend CORS (required)

On Railway, set `CORS_ORIGIN` to your Vercel frontend URL only:

- Production: `https://dod-frontend.vercel.app`
- Preview: your preview URL if needed

Do **not** put the Railway backend URL in `CORS_ORIGIN`.

## 4. Deploy

Push to `main` → Vercel auto-deploys. Or:

```bash
cd frontend
npx vercel --prod
```

## 5. Verify

After deploy, open DevTools → Network → login request should go to:

`https://<your-railway-host>/api/auth/login`

not `dod-frontend.vercel.app/api/...`.
