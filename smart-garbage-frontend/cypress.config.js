// cypress.config.js
// E2E only. Run against already-running servers (frontend :3000, API :5000) after
// `node ../smart-garbage-backend/scripts/e2e-seed.js up`. See docs/E2E.md.
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  retries: { runMode: 1, openMode: 0 },
  video: false,
  screenshotOnRunFailure: true,
  screenshotsFolder: 'cypress/screenshots',
  downloadsFolder: 'cypress/downloads',
  trashAssetsBeforeRuns: true,
  viewportWidth: 1280,
  viewportHeight: 800,
  defaultCommandTimeout: 10000,
  requestTimeout: 15000,
  responseTimeout: 30000,
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    env: {
      apiUrl: process.env.CYPRESS_API_URL || 'http://localhost:5000/api',
    },
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    setupNodeEvents(on) {
      on('task', {
        // Creates a complaint through the real API as the given citizen (multipart, Node 18+ fetch).
        async createComplaint({ apiUrl, email, password, latitude, longitude, category = 'plastics', urgency_level = 'medium', description = 'e2e seeded complaint' }) {
          const login = await fetch(`${apiUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          if (!login.ok) throw new Error(`login failed: ${login.status}`);
          const { accessToken } = await login.json();

          const png = require('fs').readFileSync(require('path').join(__dirname, 'cypress/fixtures/complaint.png'));
          const form = new FormData();
          form.append('latitude', String(latitude));
          form.append('longitude', String(longitude));
          form.append('category', category);
          form.append('urgency_level', urgency_level);
          form.append('description', description);
          form.append('image', new Blob([png], { type: 'image/png' }), 'complaint.png');

          const res = await fetch(`${apiUrl}/complaints`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form,
          });
          const body = await res.json();
          if (!res.ok) throw new Error(`create complaint failed: ${res.status} ${JSON.stringify(body)}`);
          return body;
        },
      });
    },
  },
});
