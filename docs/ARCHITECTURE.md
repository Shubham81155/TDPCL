# Architecture

This document describes how the system is put together, the decisions behind it, and what is deliberately left open. It reflects the code as of the architecture review that introduced `src/app.js`, `AppError`, migrations 006-007 and the frontend data layer.

## 1. System overview

```
Browser (React SPA)
   |  HTTPS, JSON + multipart, Bearer access token
   v
Express API  ------------------------->  Local disk (uploads/)  or  S3
   |   |
   |   +--> SMTP (notification emails, best effort, never blocks a request)
   v
PostgreSQL + PostGIS   (complaints, wards, officers, users, history, audit)
```

- **Single deployable backend, single database.** A modular monolith is the right size for this domain. There is no queue or cache in the request path.
- **Three roles** (`citizen`, `officer`, `admin`) are enforced on the server by `verifyToken` + `checkRole`. The frontend route guards are a convenience, not a security boundary.

## 2. Backend

### Layering

```
routes/      HTTP only: parse input, call a service, shape the response
services/    business rules and SQL (pg-promise); throw AppError
middleware/  auth, validation, rate limiting, request id/logging, error handler
config/      env validation (env.js), database handle (database.js)
utils/       AppError, pagination, logger, uploads
```

Rules of thumb used throughout:

- **Routes are thin.** Complaint submission (validate, upload, find ward, create, auto-assign, notify) lives in `complaintSubmissionService`, not in the route. CSV and statistics queries live in `adminService`.
- **Errors are values with a status.** Services throw `AppError` (`badRequest`, `forbidden`, `notFound`, `conflict`). Handlers do not catch; `express-async-errors` forwards rejections to one central `errorHandler`, which produces `{ success: false, error, details?, requestId }`. Database constraint violations (`23xxx`) map to 400. In production the message of an unexpected 5xx is replaced by a generic one and the stack is never sent.
- **`app.js` builds the app; `index.js` runs it.** `createApp()` has no side effects (no listen, no DB connection), so tests mount it with the database mocked. `index.js` validates the environment, checks the database, listens, and shuts down gracefully on SIGTERM/SIGINT.
- **Configuration fails fast.** `config/env.js` validates every variable at boot and reports all problems at once. `JWT_SECRET` is mandatory; placeholder secrets are refused in production.

### Cross-cutting concerns

| Concern | Approach |
| --- | --- |
| AuthN | Short-lived JWT access token + longer-lived refresh token. `POST /auth/refresh` rotates both. |
| AuthZ | Role check per route, plus resource checks in services (an officer can only change complaints assigned to them; a citizen can only read their own). |
| Passwords | bcrypt. Reset tokens are random, stored as SHA-256, expire in 1 hour, single use. |
| Rate limiting | `createRateLimiter` (in-memory, expiring entries). Login/register/reset: 10 failed attempts per 15 min per IP and path; a successful login clears the counter. A generous global limiter covers `/api`. |
| CORS | Allowlist from `FRONTEND_URL`; never `*`. |
| Observability | One JSON log line per request (`requestId`, method, path, status, duration, userId); `X-Request-Id` echoed; `GET /health` (liveness) and `GET /health/ready` (checks the database). |
| Input safety | All SQL is parameterized (including PostGIS points built with `ST_MakePoint($1,$2)`); email HTML is escaped; CSV cells are escaped and formula-guarded. |
| Pagination | `parsePagination` clamps `limit`/`offset`. List endpoints return `data`, `count` (page size) and `total` (matching rows). |
| Transactions | Multi-statement writes (create/update/delete officer, status update, resolve complaint) run in `db.tx`. |

### Data model decisions

- **PostGIS** stores complaint/officer locations and ward polygons (SRID 4326). `ward_id` is persisted on each complaint at submission so reports and assignment can filter by ward without a spatial join.
- **History is append-only and outlives people.** `complaint_history.changed_by`, `audit_logs.user_id` and `complaints.assigned_officer_id` are `ON DELETE SET NULL` (migration 007), so deleting an officer never blocks on, or erases, past work.
- **Constraints carry invariants** that code also checks: unique ward per (lower(name), lower(city)), latitude/longitude ranges, confidence 0..1, reset-token expiry after creation, `updated_at` maintained by a trigger (migration 006).
- **Migrations** are plain SQL files applied once, in name order, by `npm run migrate` (tracked in `schema_migrations`). Development seed files (`002`, `003`) are skipped when `NODE_ENV=production` unless `RUN_SEED_MIGRATIONS=true`.

## 3. Frontend

- **Create React App + React Router v6.** Every page is lazy-loaded (`React.lazy` + `Suspense`); the main bundle is roughly half its former size, and chart code loads only on the admin analytics/dashboard pages.
- **Server state with react-query** (`src/hooks/`): one place for caching, retry (1) and invalidation after mutations (assign complaint, create/edit ward, status updates). The cache is cleared on login and logout so users never see each other's data.
- **One HTTP client** (`services/api.js`): attaches the token, and when several requests get a 401 at once they share a single refresh call. Token storage is isolated in `services/tokenStorage.js`, so moving to httpOnly cookies later is a one-file change.
- **Resilience:** an `ErrorBoundary` wraps the routes; pages show loading, empty and retry states via shared components in `components/common/`.

## 4. Delivery

- `docker-compose.yml` runs PostGIS, the API (migrations then server) and the SPA behind nginx. See [DEPLOYMENT.md](DEPLOYMENT.md).
- `.github/workflows/ci.yml` runs backend tests, frontend tests and the production build on every push and pull request.
- Backend unit tests need no database; the database layer is mocked.

## 5. Known limits and next steps

Ordered roughly by value:

1. **Rate limiting is per process.** It resets on restart and is not shared across replicas. Run one API replica, or move the counters to Redis, before scaling out.
2. **Access tokens live in `localStorage`.** An XSS bug would expose them. Prefer httpOnly, SameSite cookies for the refresh token.
3. **No refresh-token revocation.** A stolen refresh token is valid until it expires. A `refresh_tokens` table (hash, user, expiry, revoked) would allow logout-everywhere and rotation with reuse detection.
4. **Notifications are fire-and-forget.** Emails are sent in-process and failures are only logged. A job queue (the unused Bull/Redis dependencies were meant for this) would add retries.
5. **Auto-assignment is a single greedy query.** It runs outside the request's transaction; two simultaneous complaints can both pick the same least-loaded officer. Acceptable at this scale; use `SELECT ... FOR UPDATE SKIP LOCKED` if it matters.
6. **Soft deletes.** Hard-deleting officers/users is allowed. If an audit trail of who existed matters, add `deleted_at` instead.
7. **No integration tests in CI.** The end-to-end API and browser checks were run manually against a real database; wiring them to a Postgres service container in CI would catch regressions like a broken route pattern earlier. A unit test now guards the complaint route patterns specifically.
8. **Timestamps are `timestamp` without time zone**, and `complaint_history` status columns are `varchar` rather than the enum. Both are cheap to fix in a future migration but need a data check.
9. **The photo classifier is optional and its model file is not in the repository.**
