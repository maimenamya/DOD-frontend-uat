# Deploy frontend to Vercel

## Environment files

| File | Purpose |
|------|---------|
| `.env.uat` | Copy `BACKEND_URL` into Vercel project **`dod-frontend-uat`** (Production env) |
| `.env.prod` | Copy `BACKEND_URL` into Vercel project **`dod-frontend`** (Production env) |

Local `npm start` does **not** use these files — it uses `environment.ts` with `apiUrl: '/api'` and `proxy.conf.json`.

### UAT vs Production repos

| Environment | GitHub repo | Branch | Vercel project |
|-------------|-------------|--------|----------------|
| **FE UAT** | `maimenamya/DOD-frontend-uat` | `main` | `dod-frontend-uat` |
| **FE Prod** | `maimenamya/DOD-frontend` | `main` | `dod-frontend` |
| **BE UAT** | `maimenamya/DOD-backend` | `uat` | Railway UAT service |
| **BE Prod** | `maimenamya/DOD-backend` | `main` | Railway prod service |

After frontend changes on `DOD-frontend`, **also push to UAT repo**:

```bash
cd frontend
git checkout main
git push uat-origin main
```

(`uat-origin` → `https://github.com/maimenamya/DOD-frontend-uat.git`)

Backend: merge/push `uat` for UAT Railway, `main` for prod Railway.

---

## 1. Connect the repo

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import `DOD-frontend`.
2. **Root Directory:** `frontend` (if the repo is the monorepo root, set Root Directory to `frontend`).
3. Build uses `vercel.json`: `npm run build` → `set-env.js` then `ng build --configuration production`.

## 2. Vercel environment variable (required)

| Name | UAT (`dod-frontend-uat`) | Production (`dod-frontend`) |
|------|---------------------------|----------------------------|
| `BACKEND_URL` | Railway UAT/public URL | Railway production URL |

Example: `https://dod-backend-production.up.railway.app` — **no trailing slash**.

During build, `set-env.js` writes `src/environments/environment.prod.ts` with:

```typescript
apiUrl: 'https://your-railway.app/api'
```

The browser calls Railway **directly** (no `/api` proxy on Vercel).

## 3. Backend CORS (required)

On Railway, set `CORS_ORIGIN` to your Vercel frontend URL only:

- UAT backend: `https://dod-frontend-uat.vercel.app`
- Production backend: `https://dod-frontend.vercel.app`

(`cors.ts` also allowlists both URLs; set `CORS_ORIGIN` on Railway UAT to the UAT frontend.)

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
