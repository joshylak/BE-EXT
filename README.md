# Wedding Seating Chart API

Plain Node.js + Express + Postgres backend for the
[wedding-sitting-planning-chart-Femi-](../wedding-sitting-planning-chart-Femi-) React app.
No build step (plain JavaScript, CommonJS) — deploy by running `npm install && npm start`.

Replaces the frontend's `localStorage` persistence with a real Postgres-backed API so the
seating chart is shared across devices/browsers instead of living on one machine.

## Stack

- Express (routing)
- `pg` (raw SQL, no ORM)
- JWT-based session after a shared-password login (mirrors the existing `PasswordGate`)
- Helmet + CORS + rate limiting on login

## Local setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, SEATING_PASSWORD, CORS_ORIGIN
npm run migrate        # creates tables + seats tables
npm run seed           # seeds the 37 venue tables (VIP/guest/couch, both sides)
npm run dev            # starts on PORT (default 4000)
```

## Environment variables (`.env`)

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `PG_SSL` | no | set `true` if your provider needs SSL but it's not in the URL |
| `JWT_SECRET` | yes | random long string, signs login tokens |
| `JWT_EXPIRES_IN` | no | default `30d` |
| `SEATING_PASSWORD` | one of these two | plain-text shared passcode (case-insensitive), e.g. `femi et fere` |
| `SEATING_PASSWORD_HASH` | one of these two | bcrypt hash instead, if you want it hashed |
| `PORT` | no | default `4000` |
| `CORS_ORIGIN` | yes in prod | comma-separated list of allowed frontend origins |

## Cheap deployment (Render + Neon)

1. **Database**: create a free Postgres on [Neon](https://neon.tech) or [Supabase](https://supabase.com) — copy the connection string into `DATABASE_URL` (set `PG_SSL=true`).
2. **API**: push this repo to GitHub, create a free "Web Service" on [Render](https://render.com):
   - Build command: `npm install`
   - Start command: `npm start`
   - Add the env vars above in Render's dashboard.
3. After first deploy, run the migration + seed once (Render Shell, or run locally pointed at the prod `DATABASE_URL`):
   ```bash
   npm run migrate
   npm run seed
   ```
4. Set `CORS_ORIGIN` to your deployed frontend's URL (e.g. the Vercel/Netlify domain).

Render's free tier spins down when idle (cold start ~30-50s on first request) — fine for a
wedding planning tool used by a handful of people.

## Endpoints

Base path: `/api`. Every route except `/auth/login`, `/health`, and `/events` (which takes the
token as a query param instead — see below) requires `Authorization: Bearer <token>` from a
successful login.

### Auth
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/auth/login` | `{ "password": string }` | `{ "token": string }` (401 if wrong) |
| GET | `/api/auth/session` | — | `{ "ok": true }` or 401 |

### Tables (static floor-plan config — 37 fixed tables: 35 seated + 2 couches)
| Method | Path | Returns |
|---|---|---|
| GET | `/api/tables` | `TableDTO[]` — mirrors `src/data/tables.ts` exactly |
| GET | `/api/tables/:id` | single `TableDTO` (e.g. `/api/tables/B1`) |

`TableDTO`: `{ id, side: "B"|"G", kind: "vip"|"guest"|"couch", capacity, shortLabel, title }`

### Seating
`SeatingState` shape: `{ [tableId]: string[] }` — one array per table, length = capacity,
`""` = open seat. `seatIndex` below is **0-indexed** (array index), matching `types.ts`.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/seating` | — | full `SeatingState` |
| PUT | `/api/seating/:tableId/:seatIndex` | `{ "name": string }` (`""` clears it) | full `SeatingState`. 400 if `tableId`/`seatIndex` invalid |
| POST | `/api/seating/move` | `{ "fromTableId", "fromSeatIndex", "toTableId" }` | full `SeatingState`. Moves the guest to the first open seat at `toTableId`, clears the source. 400 if source seat empty, 409 if destination full |
| POST | `/api/seating/clear/:tableId` | — | full `SeatingState`, with that table emptied |

### Guest list (master list, separate from seating assignments)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/guest-list` | — | `string[]` |
| PUT | `/api/guest-list` | `{ "names": string[] }` | `string[]` — full replace |

### Export
| Method | Path | Returns |
|---|---|---|
| GET | `/api/export/csv` | CSV, columns `Table,Kind,Side,Seat,Guest Name` — filled seats only |
| GET | `/api/export/backup` | `{ seating, guestList }` full JSON snapshot |

### Import
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/import/backup` | `{ seating, guestList }` | `{ seating, guestList }` — overwrites current state |

### Realtime
| Method | Path | Notes |
|---|---|---|
| GET | `/api/events` | Server-Sent Events. Sends `data: {"type":"seating"\|"guestList","at":...}` whenever seating or the guest list changes elsewhere — clients should re-`GET` on receipt. Native `EventSource` can't set an `Authorization` header, so this route **also** accepts the token as `?token=<token>` (nowhere else does). Implemented with a single in-process `EventEmitter`, so it only fans out correctly on a single server instance — fine for Render's free single-instance tier, but won't broadcast across multiple instances/dynos. |

### Health
| Method | Path | Returns |
|---|---|---|
| GET | `/api/health` | `{ "status": "ok" }` (no auth) |
