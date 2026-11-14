# Deployment (Docker Compose)

## Run

```
cp .env.docker.example .env      # then edit: at least DB_PASSWORD and JWT_SECRET
docker compose up --build -d
```

- Frontend: http://localhost:3000 (nginx serving the React build)
- API: http://localhost:5000 (health: `/health`)

The backend container applies pending SQL migrations on every start, then launches the API.
Note: the migrations folder includes sample data and test users (002, 003). Remove or replace these
for a real deployment. The optional Python classifier is not part of the image.

Stop: `docker compose down` (add `-v` only if you want to DELETE the database and uploads).

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DB_PASSWORD` | yes | Postgres password; compose fails if unset |
| `JWT_SECRET` | yes | compose fails if unset |
| `DB_NAME`, `DB_USER` | no | defaults `smart_garbage`, `postgres` |
| `FRONTEND_URL` | no | allowed CORS origin and link base in emails |
| `PUBLIC_FILE_BASE_URL` | no | public base URL of the API for uploaded files |
| `REACT_APP_API_URL` | no | build-time; rebuild the frontend after changing |
| `STORAGE_PROVIDER` | no | `local` (uploads volume) |
| `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASSWORD` | no | SMTP for password reset mails |
| `FRONTEND_PORT`, `BACKEND_PORT` | no | host ports |

## Production checklist

- Strong `JWT_SECRET` (48+ random bytes) and a strong `DB_PASSWORD`; keep the real `.env` out of git.
- Configure SMTP (`EMAIL_*`) so password reset works.
- Terminate HTTPS in front (reverse proxy / load balancer); set `FRONTEND_URL`, `PUBLIC_FILE_BASE_URL`
  and `REACT_APP_API_URL` to the public https URLs (CORS depends on `FRONTEND_URL` matching exactly).
- The Postgres port is not published by compose; keep it that way.
- Back up the `pgdata` volume (prefer `pg_dump`) and the `uploads` volume regularly; test restores.
- Run a single backend replica: rate limiting is per-process, so scaling out requires moving it to Redis first.
- Remove sample/test users created by migrations 002 and 003.
