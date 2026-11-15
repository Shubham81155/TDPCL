# End-to-end tests (Cypress)

The E2E suite drives the real UI against a running API and database. It lives in
`smart-garbage-frontend/cypress/` and covers the citizen, officer and admin journeys.

## Run it

```bash
# 1. Start the stack (needs PostgreSQL/PostGIS, migrated)
cd smart-garbage-backend  && NODE_ENV=test npm start   # API on :5000 (test mode disables the global rate limiter,
                                                         # which the click audit would otherwise exceed)
cd smart-garbage-frontend && npm start          # UI  on :3000

# 2. Create the tagged fixtures (users + ward) and the credentials fixture
cd smart-garbage-backend  && node scripts/e2e-seed.js up

# 3. Run the specs
cd smart-garbage-frontend && npm run cy:run     # headless
cd smart-garbage-frontend && npm run cy:open    # interactive

# 4. Remove everything the run created (must report 0 leftovers)
cd smart-garbage-backend  && node scripts/e2e-seed.js down
```

Override targets with `CYPRESS_BASE_URL` and `CYPRESS_API_URL`.

## How it works

- `scripts/e2e-seed.js up` creates `e2e_admin@`, `e2e_officer@`, `e2e_citizen@example.com`,
  an officer record and a tiny ward (`e2e_city`), then writes the credentials to
  `cypress/fixtures/users.generated.json` (git-ignored). Specs never hardcode credentials.
- `cy.loginAs(role, path)` logs in through the API and seeds `localStorage`, so most specs skip
  the login form. `cy.loginViaUi(role)` is used where the form itself is under test.
- `cy.seedComplaint()` creates a complaint through the real API (the `createComplaint` task in
  `cypress.config.js`) inside the seeded ward, so it is auto-assigned to the seeded officer.
- The first `beforeEach` in `cypress/support/e2e.js` clears storage and cookies for every test.

## Cleanup and safety

Everything the suite creates is tagged and removed by `e2e-seed.js down`:

| Data       | Tag                                                   |
|------------|-------------------------------------------------------|
| users      | email `e2e_%@example.com` (also covers specs that register users) |
| wards      | city `e2e_city`                                       |
| officers   | employee id `E2E-%` or owned by a tagged user         |
| complaints | owned by a tagged user or inside a tagged ward, plus their history, notifications and upload files |

`down` exits non-zero if any tagged row remains. The script refuses to run when
`NODE_ENV=production` and never touches untagged data.

## Specs

| Spec | What it proves |
|------|----------------|
| `citizen-journey`, `officer-journey`, `admin-journey` | the main happy paths and validation per role |
| `click-audit` | every enabled button/link/summary on every page can be clicked with no uncaught exception, error boundary, console error or failed API call (destructive actions skipped) |
| `features` | behaviour the audit cannot judge: officer add/delete (and declined confirm), ward create/edit/validation, CSV export, the citizen to officer to citizen lifecycle, language and theme persistence, password-reset pages, maps, route guards, geolocation |
| `responsive` | no horizontal scroll at 360px in English and Hindi |

## Notes

- `responsive.cy.js` loads every page at 360px in English and Hindi and fails on horizontal scroll.
- Logins are cached per account in the Cypress node process (the API rate-limits `/auth/login`).
- The admin reassign test changes the officer of a complaint; it should be run against a dev
  database, not shared data.
