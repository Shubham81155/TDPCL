// cypress/support/e2e.js
// Shared helpers for the E2E suite. Credentials come from the fixture written by
// `node smart-garbage-backend/scripts/e2e-seed.js up` (never hardcode them in specs).

const API = () => Cypress.env('apiUrl');

Cypress.Commands.add('users', () => cy.fixture('users.generated.json'));

// Logs in through the API and seeds localStorage before the app boots (fast, no UI flake).
// Use cy.loginViaUi in the specs that actually test the login form.
Cypress.Commands.add('loginAs', (role, path) => {
  cy.users().then((users) => {
    const { email, password } = users[role];
    cy.request('POST', `${API()}/auth/login`, { email, password }).then(({ body }) => {
      const user = { user_id: body.user_id, name: body.name, email: body.email, role: body.role };
      cy.wrap(body.accessToken, { log: false }).as('accessToken');
      cy.visit(path, {
        onBeforeLoad(win) {
          win.localStorage.setItem('accessToken', body.accessToken);
          win.localStorage.setItem('refreshToken', body.refreshToken);
          win.localStorage.setItem('user', JSON.stringify(user));
        },
      });
    });
  });
});

Cypress.Commands.add('loginViaUi', (role) => {
  cy.users().then((users) => {
    cy.visit('/login');
    cy.get('input[type="email"]').type(users[role].email);
    cy.get('input[type="password"]').type(users[role].password, { log: false });
    cy.get('button[type="submit"]').click();
  });
});

// Creates a complaint as the seeded citizen (inside the seeded ward) and yields the API body.
Cypress.Commands.add('seedComplaint', (overrides = {}) =>
  cy.users().then((users) =>
    cy.task('createComplaint', {
      apiUrl: API(),
      email: users.citizen.email,
      password: users.citizen.password,
      latitude: users.ward.latitude,
      longitude: users.ward.longitude,
      ...overrides,
    })
  )
);

beforeEach(() => {
  cy.clearAllLocalStorage();
  cy.clearAllCookies();
});
