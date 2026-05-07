# FlexBook Admin Panel

Internal dashboard for monitoring API usage and sending reports. Completely separate from the consumer app — own build, own deploy, own URL.

## Live URL

https://flexbook-admin.vercel.app

## Stack

- React 18 + TypeScript + Vite
- React Router DOM (root-level routes)
- Axios (with Bearer token interceptor)
- Pure SVG line chart (no charting library)
- Plain CSS (`src/admin.css`) — no Tailwind

## Local development

```bash
# From repo root
npm run dev:admin

# Or from this directory
npm run dev
```

Runs on **http://localhost:5176**. Requires the backend running on port 3000.

## Environment variables

### Frontend (`admin/.env.local`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL. Defaults to `/api` (proxied to localhost:3000 in dev). Set to the Render URL in production. |

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `ADMIN_PASSWORD` | Yes | Password typed into the login form |
| `ADMIN_SESSION_SECRET` | Yes | Secret used to sign session tokens. Rotate to invalidate all active sessions. |

Generate a strong session secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Authentication flow

1. User POSTs password to `POST /admin/login`
2. Backend compares using timing-safe equality against `ADMIN_PASSWORD`
3. On success, returns a signed token: `<expiresAt>.<hmac-sha256>`
4. Token is stored in `sessionStorage` and sent as `Authorization: Bearer <token>` on every request
5. Token expires after **12 hours**
6. After **5 failed attempts** from the same IP, login is blocked for **15 minutes**
7. All `/metrics` routes reject requests without a valid token (401)

## Build & deploy

```bash
# From repo root
npm run build:admin   # builds packages/shared then admin/
```

Output goes to `admin/dist/`.

Deployed as a separate Vercel project:
- **Root Directory**: `.` (repo root)
- **Build Command**: `npm run build:admin`
- **Output Directory**: `admin/dist`
- **Env var**: `VITE_API_URL=https://flexbook-backend-db9r.onrender.com`

## Adding a new admin section

1. Create `admin/src/pages/YourPage.tsx`
2. Add a `NavLink` to `admin/src/components/Sidebar.tsx`:
   ```tsx
   { to: '/your-section', icon: <YourIcon size={18} />, label: 'Your Section' }
   ```
3. Add a `<Route>` to `admin/src/AdminApp.tsx`:
   ```tsx
   <Route path="your-section" element={<YourPage />} />
   ```

## Project structure

```
admin/
  src/
    AdminApp.tsx          # Login guard + root-level routes
    auth.ts               # Token storage (sessionStorage)
    admin.css             # All admin styles — scoped, no Tailwind
    main.tsx              # BrowserRouter entry point
    api/
      metrics.ts          # Axios client + Bearer interceptor + API calls
    components/
      Sidebar.tsx         # Dark sidebar with NavLinks
      UsageChart.tsx      # SVG line chart (per-service, responsive)
      MetricsTable.tsx    # Date × service breakdown table
    pages/
      LoginPage.tsx       # Password form → POST /admin/login
      ApiUsagePage.tsx    # Date range picker + chart + table + Send Report
  index.html
  package.json            # @fast-travel/admin — only the 5 deps it needs
  vite.config.ts          # Port 5176, /api proxy, shared types alias
  tsconfig.json
```

## API endpoints used

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/admin/login` | None | Exchange password for token |
| GET | `/metrics?date=` | Bearer | Single day call counts |
| GET | `/metrics/history?from=&to=` | Bearer | Date range call counts |
| POST | `/metrics/report` | Bearer | Trigger on-demand email report |
