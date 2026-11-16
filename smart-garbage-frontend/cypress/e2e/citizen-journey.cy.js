// cypress/e2e/citizen-journey.cy.js
// Needs: frontend :3000, API :5000, and `node smart-garbage-backend/scripts/e2e-seed.js up`.
const uniqueEmail = () => `e2e_reg_${Date.now()}@example.com`; // matches the seed cleanup tag

describe('Citizen journey', () => {
  describe('Authentication', () => {
    it('registers a new citizen and lands on the dashboard', () => {
      cy.visit('/register');
      cy.get('input[name="email"]').type(uniqueEmail());
      cy.get('input[name="password"]').type('E2e!Passw0rd#2026', { log: false });
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/citizen/dashboard');
      cy.contains('Welcome').should('be.visible');
    });

    it('logs in through the form', () => {
      cy.loginViaUi('citizen');
      cy.url().should('include', '/citizen/dashboard');
      cy.contains('Welcome, E2E Citizen!').should('be.visible');
    });

    it('shows validation errors on an empty login', () => {
      cy.visit('/login');
      cy.get('button[type="submit"]').click();
      cy.contains('Email is required').should('be.visible');
      cy.contains('Password is required').should('be.visible');
    });

    it('rejects a wrong password and stays on /login', () => {
      cy.users().then((u) => {
        cy.visit('/login');
        cy.get('input[type="email"]').type(u.citizen.email);
        cy.get('input[type="password"]').type('definitely-wrong');
        cy.get('button[type="submit"]').click();
        cy.get('.alert-danger').should('be.visible');
        cy.url().should('include', '/login');
      });
    });

    it('redirects anonymous visitors away from protected pages', () => {
      cy.visit('/citizen/complaints');
      cy.url().should('include', '/login');
    });

    it('logs out and clears the session', () => {
      cy.loginAs('citizen', '/citizen/dashboard');
      cy.get('#user-dropdown').click();
      cy.contains('.dropdown-item, button', 'Logout').click();
      cy.url().should('include', '/login');
      cy.window().then((win) => expect(win.localStorage.getItem('accessToken')).to.be.null);
    });
  });

  describe('Report an issue', () => {
    beforeEach(() => cy.loginAs('citizen', '/citizen/complaint/new'));

    it('blocks an empty submit and shows the required-field errors', () => {
      cy.contains('button', 'Submit Complaint').click();
      cy.contains('Image is required').should('be.visible');
      cy.contains('Category is required').should('be.visible');
    });

    it('rejects a non-image file', () => {
      cy.get('input[type="file"]').selectFile(
        { contents: Cypress.Buffer.from('not an image'), fileName: 'note.txt', mimeType: 'text/plain' },
        { force: true }
      );
      cy.contains('Only JPEG, PNG, and GIF are allowed').should('be.visible');
    });

    it('submits a complaint with a photo, coordinates and category', () => {
      cy.users().then((u) => {
        cy.get('input[type="file"]').selectFile('cypress/fixtures/complaint.png', { force: true });
        cy.get('img[alt="Preview of the issue"]').should('be.visible');

        cy.contains('summary', 'Adjust coordinates manually').click();
        cy.get('input[name="latitude"]').clear().type(String(u.ward.latitude));
        cy.get('input[name="longitude"]').clear().type(String(u.ward.longitude));
        cy.get('select[name="category"]').select('plastics');
        cy.get('select[name="urgency_level"]').select('high');
        cy.get('textarea[name="description"]').type('e2e: overflowing bin near the gate');

        cy.intercept('POST', '**/api/complaints').as('create');
        cy.contains('button', 'Submit Complaint').click();
        cy.wait('@create').its('response.statusCode').should('eq', 201);

        cy.url().should('include', '/citizen/complaints');
        cy.contains('Complaint submitted successfully').should('be.visible');
      });
    });
  });

  describe('Track complaints', () => {
    before(() => {
      cy.seedComplaint({ description: 'e2e: tracker seed' });
    });
    beforeEach(() => cy.loginAs('citizen', '/citizen/complaints'));

    it('lists my complaints', () => {
      cy.contains('h1', 'My Complaints').should('be.visible');
      cy.get('tbody tr').should('have.length.greaterThan', 0);
    });

    it('shows an empty-filter state for a status with no complaints', () => {
      cy.get('tbody tr').should('have.length.greaterThan', 0);
      cy.contains('label', 'Filter by Status').parent().find('select').select('rejected');
      cy.contains('No complaints found').should('be.visible');
      cy.contains('button, a', 'Clear filters').click();
      cy.get('tbody tr').should('have.length.greaterThan', 0);
    });

    it('opens a complaint and shows its timeline', () => {
      cy.get('tbody tr').first().contains('button', 'View').click();
      cy.contains(/Complaint #\d+/).should('be.visible');
      cy.contains('Activity Timeline').should('be.visible');
    });
  });
});
