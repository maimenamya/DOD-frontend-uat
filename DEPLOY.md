# Deploy frontend to Vercel

## Environment files

| File | Purpose |
|------|---------|
| `.env.uat` | Copy `BACKEND_URL` into Vercel project **`dod-frontend-uat`** (Production env) |
| `.env.prod` | Copy `BACKEND_URL` into Vercel project **`dod-frontend`** (Production env) |

Local `npm start` does **not** use these files — it uses `environment.ts` with `apiUrl: '/api'` and `proxy.conf.json`.

### UAT vs git branch `uat`

| Name | What it is |
|------|------------|
| **UAT (สำหรับทดสอบ)** | Vercel project **`dod-frontend-uat`** → deploy จาก branch **`main`** |
| **Production** | Vercel project **`dod-frontend`** → deploy จาก branch **`main`** |
| Git branch `uat` | แค่ branch ทำงานใน repo — **ไม่ใช่** URL UAT โดยอัตโนมัติ |

Push ขึ้น **`main`** แล้วทั้ง `dod-frontend-uat` และ `dod-frontend` จะ build ใหม่ (ถ้าทั้งสอง project ผูก repo เดียวกัน + branch `main`).

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
