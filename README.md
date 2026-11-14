# Smart Garbage Reporting & Municipality Automation System

Citizens report garbage problems with a photo and location. The system finds the ward, assigns the complaint to an officer, and lets everyone track it through to resolution. Administrators get dashboards, analytics and CSV reports.

| Role | What they can do |
| --- | --- |
| **Citizen** | Register, report an issue (photo, location, category, description, urgency), track complaints and their timeline |
| **Officer** | See assigned complaints on a list and a map, update status, resolve with a note |
| **Admin** | Dashboard and analytics, manage complaints (assign / reassign), officers and wards, export reports as CSV |

## Tech stack

- **Backend:** Node.js, Express, PostgreSQL + PostGIS (`pg-promise`), JWT auth, Joi, Multer, Nodemailer
- **Frontend:** React 18 (Create React App), React Router, React Bootstrap, Chart.js, Leaflet (map, loaded from a CDN)
- **Tests:** Jest and Supertest (backend), Jest and Testing Library (frontend), Cypress journeys in `smart-garbage-frontend/cypress`

## Repository layout

```
smart-garbage-backend/    Express API (src/), SQL migrations (database/migrations/), tests (tests/)
smart-garbage-frontend/   React app (src/), Cypress journeys (cypress/)
docs/                     SRS, ER diagram, API documentation, testing guide
```

## Prerequisites

- Node.js 16 or newer and npm
- PostgreSQL 13 or newer with the **PostGIS** extension
- Optional: an SMTP account for emails; Python for the photo classifier (see [Optional features](#optional-features))

## Setup

### 1. Database

```bash
createdb -U postgres smart_garbage_db
psql -U postgres -d smart_garbage_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### 2. Backend

```bash
cd smart-garbage-backend
npm install
cp .env.example .env        # then edit .env (see below)
npm run migrate             # applies database/migrations/*.sql once each
npm run dev                 # http://localhost:5000  (use `npm start` without auto-reload)
```

Check it is up: `curl http://localhost:5000/health`

Edit `.env` before starting:

| Variable | Notes |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Your PostgreSQL connection |
| `JWT_SECRET` | **Required.** The server refuses to start without it. In production it must not start with `your_`. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `FRONTEND_URL` | Used in email links (default `http://localhost:3000`) |
| `STORAGE_PROVIDER` | `local` (default) saves photos to `smart-garbage-backend/uploads/` and serves them from `/uploads`. Use S3 by setting the `AWS_*` variables |
| `EMAIL_*`, `SENDGRID_API_KEY` | Needed only for emails, including password-reset links |

`npm run migrate` records each applied file in a `schema_migrations` table, so it is safe to run again. If your database already has the schema from before the runner existed, files `001`–`004` are recorded as already applied.

### 3. Frontend

```bash
cd smart-garbage-frontend
npm install
npm start                   # http://localhost:3000
```

The app calls `http://localhost:5000/api` by default. Set `REACT_APP_API_URL` to change it.

## Sample accounts

`002_sample_data.sql` and `003_test_users.sql` create development users (`admin@example.com`, `officer@example.com`, `citizen@example.com`). Their passwords are stored only as bcrypt hashes. **Create your own admin and change or remove these accounts before any real deployment.**

Citizens self-register through the app. Self-registration always creates a **citizen**; officers are created by an admin (**Officers** page) and admins directly in the database.

## Running the tests

```bash
# Backend (no database needed: it is mocked)
cd smart-garbage-backend && npm test

# Frontend unit tests
cd smart-garbage-frontend && CI=true npm test -- --watchAll=false
```

The Cypress journeys in `smart-garbage-frontend/cypress/e2e` need both servers running and valid logins; see [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md).

## Main API routes

All routes are under `/api` and use `Authorization: Bearer <accessToken>` except where noted. Full details are in [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md).

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password` (no token needed); `GET/PUT /auth/profile`, `POST /auth/change-password` |
| Complaints | `POST /complaints` (citizen, multipart with `image`), `GET /complaints`, `GET /complaints/:id`, `GET /complaints/:id/timeline`, `GET /complaints/officer/assigned`, `PATCH /complaints/:id/status`, `POST /complaints/:id/resolve` (assigned officer only) |
| Officers | `GET/POST /officers` (admin), `GET /officers/me`, `GET /officers/me/metrics`, `PUT /officers/:id` |
| Wards | `GET /wards`, `POST /wards`, `PUT /wards/:id` (admin) |
| Assignments | `POST /assignments/assign/:complaintId` (admin), `/assignments/auto-assign/:complaintId`, `/assignments/ward-by-location` |
| Admin | `GET /admin/stats/*`, `GET /admin/complaints`, `GET /admin/report/export` (CSV) |

## Security notes

- Roles are enforced on the server. Only the officer a complaint is assigned to can change or resolve it.
- Login and register are limited to 10 failed attempts per 15 minutes per IP. The counter lives in memory, so it resets when the server restarts and is not shared between server instances.
- Reset tokens are stored hashed, expire after one hour and work once. The forgot-password response is the same whether or not the email exists.
- Access tokens are kept in the browser's `localStorage`, so an XSS bug would expose them. Move them to httpOnly cookies if this goes to production.

## Optional features

- **Emails** (submission, assignment, status updates, password reset) need SMTP settings in `.env`. Without them, sending fails quietly and the rest of the app keeps working.
- **Photo classifier:** the code supports a Python/TensorFlow model (`scripts/requirements.txt`, `GARBAGE_MODEL_PATH`). The model file `garbage_classifier.h5` is **not** in this repository, and complaint categories are currently chosen by the citizen.
- **Redis / Bull / Twilio** are listed as dependencies and in `.env.example` but are not used by the current code.

## Known limitations

- The ward duplicate-name check is application-level, so two simultaneous requests could both pass it.
- Wards are created from a bounding box or pasted GeoJSON; there is no map drawing tool.
- Officers can be created, but there is no screen to assign an officer to a ward.

## Documentation

- [docs/SRS.md](docs/SRS.md): requirements
- [docs/ER_DIAGRAM.md](docs/ER_DIAGRAM.md): database design
- [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md): API reference
- [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md): testing guide
