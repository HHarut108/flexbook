# Visa Service

Lightweight Node/Express microservice that answers "do I need a visa to go from country A to country B?". Data is sourced from the open-source [`imorte/passport-index-data`](https://github.com/imorte/passport-index-data) dataset and held in memory; the JSON snapshot is bundled in the repo so the service starts instantly with no outbound network calls.

## Endpoints

| Method | Path                                          | Description                                                              |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------ |
| GET    | `/health`                                     | Service liveness + last data load timestamp.                             |
| GET    | `/visa?passport=AM&destination=FR`            | Visa requirement between two ISO-2 country codes (case-insensitive).     |
| GET    | `/countries`                                  | Sorted list of supported countries for dropdowns.                        |
| POST   | `/refresh`                                    | Re-download the dataset and hot-swap it in memory. Requires bearer token (see env). |

### `GET /visa`

```bash
curl 'http://localhost:4100/visa?passport=am&destination=fr'
```

```json
{
  "passport": "AM",
  "destination": "FR",
  "status": "visa required",
  "label": "Visa Required",
  "last_updated": "2026-05-21T12:34:56.000Z"
}
```

Possible `status` values and their labels:

| Raw status         | Label                                       |
| ------------------ | ------------------------------------------- |
| `visa free`        | Visa Free                                   |
| `visa on arrival`  | Visa on Arrival                             |
| `eta`              | Electronic Travel Authorisation (ETA)       |
| `e-visa`           | eVisa Required                              |
| `visa required`    | Visa Required                               |
| `no admission`     | No Admission                                |

When `days` is present, the label is appended:

```json
{
  "passport": "US",
  "destination": "AM",
  "status": "visa free",
  "days": 180,
  "label": "Visa Free · 180 days",
  "last_updated": "2026-05-21T12:34:56.000Z"
}
```

Errors:

- `400` — missing/invalid query params, or unknown country code.
- `404` — no record for the given pair (rare; current dataset covers all 199×199 pairs).

### `GET /countries`

```json
{
  "countries": [
    { "code": "AF", "name": "Afghanistan" },
    { "code": "AL", "name": "Albania" },
    ...
  ],
  "last_updated": "2026-05-21T12:34:56.000Z"
}
```

> The original spec showed a bare array. To honour the rule that **all** responses carry a `last_updated` timestamp, the list is wrapped in an object. Clients should read `response.countries`.

### `POST /refresh`

Re-downloads `passport-index.json` from `PASSPORT_INDEX_URL` and replaces the in-memory dataset atomically. In **production** (`NODE_ENV=production`), `REFRESH_TOKEN` must be set or the endpoint returns `503`. When the token is set, callers must send `Authorization: Bearer <token>`.

```bash
curl -X POST http://localhost:4100/refresh \
  -H "Authorization: Bearer $REFRESH_TOKEN"
```

### `GET /health`

```json
{
  "status": "ok",
  "started_at": "2026-05-21T12:30:00.000Z",
  "last_updated": "2026-05-21T12:34:56.000Z",
  "countries": 199
}
```

Returns `503` if the dataset has not loaded yet.

## Running locally

```bash
cd services/visa-service
npm install
cp .env.example .env   # edit as needed
npm run dev            # tsx watch mode
```

Production build:

```bash
npm run build
npm start
```

## Environment variables

| Var                  | Default                                                                                          | Notes                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `PORT`               | `4100`                                                                                           | HTTP port.                                                                             |
| `NODE_ENV`           | `development`                                                                                    | Set to `production` in deploy.                                                         |
| `ALLOWED_ORIGIN`     | `*`                                                                                              | CORS origin. Comma-separated list also supported.                                      |
| `AUTO_REFRESH`       | `false`                                                                                          | When `true`, refreshes the dataset every 24h via in-process timer.                     |
| `REFRESH_TOKEN`      | _(empty)_                                                                                        | Bearer token required by `POST /refresh`. Required in production.                      |
| `PASSPORT_INDEX_URL` | `https://raw.githubusercontent.com/imorte/passport-index-data/master/passport-index.json`        | Override only if you fork the dataset.                                                 |

## Updating the bundled dataset

The committed snapshot lives at `src/data/passport-index.json`. To update it without redeploying, call `POST /refresh` — the in-memory copy is replaced.

To update the on-disk bundle (so future cold starts use the fresher data):

```bash
curl -L \
  https://raw.githubusercontent.com/imorte/passport-index-data/master/passport-index.json \
  -o src/data/passport-index.json
```

Then commit the file. `last_updated` reflects when the in-memory data was loaded (or last refreshed), not the upstream commit timestamp.

## Deploying to Render

The repo ships with a [`render.yaml`](../../render.yaml) Blueprint at the root. To stand up production:

1. **Connect the repo as a Blueprint.** In Render → **New +** → **Blueprint** → pick this repo. Render reads `render.yaml` and creates the `flexbook-visa-service` web service.
2. **Set the bearer token.** The Blueprint marks `REFRESH_TOKEN` as `sync: false` so it's never committed. After the first deploy, open the service → **Environment** → add a random secret as `REFRESH_TOKEN`. Required for `POST /refresh` in production.
3. **Note the public URL** Render assigns (e.g. `https://flexbook-visa-service.onrender.com`). Hit `/health` to confirm:
   ```bash
   curl https://flexbook-visa-service.onrender.com/health
   # {"status":"ok","countries":199,...}
   ```
4. **Wire the backend.** On the Vercel backend project (and any preview environments), add:
   ```
   VISA_SERVICE_URL=https://flexbook-visa-service.onrender.com
   ```
   Redeploy the backend so it picks up the env. Visa chips should appear on the next FE page load.

### Notes

- The Blueprint uses Render's **free** plan, which spins the service down after 15 minutes of inactivity (~30s cold start on the next request). Upgrade the service to a paid instance from the dashboard when traffic warrants it — no YAML change needed.
- `AUTO_REFRESH=true` is set in the Blueprint so the in-memory dataset auto-refreshes every 24h. The bundled snapshot at `src/data/passport-index.json` still loads on every cold start, so the service is fully functional even if upstream GitHub is down at boot.
- The Blueprint pins the build to `npm ci && npm run build`. The `build` script copies `src/data/` into `dist/data/` (see [the CI fix](https://github.com/HHarut108/flexbook/pull/101)) — without that copy step the service silently fetches from GitHub on every cold start.

## Project layout

```
src/
├── index.ts                      # entry: load data, optional 24h refresh timer, listen
├── app.ts                        # Express wiring (CORS, routes, error handler)
├── config.ts                     # env parsing
├── data/passport-index.json      # bundled snapshot
├── routes/
│   ├── health.ts
│   ├── visa.ts
│   ├── countries.ts
│   └── refresh.ts
├── services/
│   ├── visaDataSource.ts         # singleton accessor / setter for tests
│   ├── passportIndexSource.ts    # the current VisaDataSource implementation
│   ├── countryNames.ts           # Intl.DisplayNames ISO-2 → name
│   └── labels.ts                 # status → human label
└── types/visa.ts                 # VisaDataSource interface
```

## Swapping the data source

The route handlers depend only on the `VisaDataSource` interface in `src/types/visa.ts`. To plug in a different backend (e.g. Sherpa), implement that interface and call `setDataSource(new MySource())` before `getDataSource().load()` in `src/index.ts`.

## Notes on the dataset

- 199 country codes, ISO 3166-1 alpha-2.
- Same-country lookups (`passport=AM&destination=AM`) return `visa free` without consulting the dataset.
- `XK` (Kosovo) and `TW` (Taiwan) are included even though their ISO-3166 status is contested.
