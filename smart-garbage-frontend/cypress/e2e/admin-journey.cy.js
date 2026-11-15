// cypress/e2e/admin-journey.cy.js
describe('Admin journey', () => {
  before(() => {
    cy.seedComplaint({ description: 'e2e: admin seed' });
  });

  describe('Dashboard', () => {
    beforeEach(() => cy.loginAs('admin', '/admin/dashboard'));

    it('shows statistics', () => {
      cy.contains('Admin Dashboard').should('be.visible');
      cy.contains('Total').should('be.visible');
    });

    it('navigates via quick actions', () => {
      cy.get('a[href="/admin/complaints"]').first().click();
      cy.url().should('include', '/admin/complaints');
    });
  });

  describe('Complaints', () => {
    beforeEach(() => cy.loginAs('admin', '/admin/complaints'));

    it('lists complaints with status chips', () => {
      cy.contains('h2', 'All Complaints').should('be.visible');
      cy.get('[role="group"][aria-label="Filter by status"] button').should('have.length.greaterThan', 1);
      cy.get('tbody tr').should('have.length.greaterThan', 0);
    });

    it('filters by search text', () => {
      cy.get('input[aria-label="Search complaints by ID, area or citizen"]').type('zzz-no-such-complaint');
      cy.get('tbody tr').should('have.length', 0);
    });

    it('(re)assigns a complaint to an officer', () => {
      cy.get('button[aria-label*="complaint"]').first().click();
      cy.get('.modal').within(() => {
        cy.get('select[aria-label="Select officer"] option').its('length').should('be.greaterThan', 1);
        cy.get('select[aria-label="Select officer"]').select(1);
        cy.get('button[type="submit"]').click();
      });
      cy.get('.modal').should('not.exist');
    });
  });

  describe('Other admin pages', () => {
    it('opens officers and validates the add-officer form', () => {
      cy.loginAs('admin', '/admin/officers');
      cy.contains('Officer Management').should('be.visible');
      cy.contains('button', 'Add Officer').click();
      cy.get('.modal input[name="email"]').type('not-an-email');
      cy.get('.modal button[type="submit"]').click();
      cy.get('.modal .invalid-feedback').should('exist');
    });

    it('opens wards and shows the seeded ward', () => {
      cy.loginAs('admin', '/admin/wards');
      cy.get('input[aria-label="Search wards"]').type('e2e_ward_seed');
      cy.contains('td', 'e2e_ward_seed').should('be.visible');
    });

    it('opens reports and analytics', () => {
      cy.loginAs('admin', '/admin/reports');
      cy.contains('button', /Export/i).should('be.visible');
      cy.visit('/admin/analytics');
      cy.url().should('include', '/admin/analytics');
    });
  });

  describe('Access control', () => {
    it('keeps citizens out of admin pages', () => {
      cy.loginAs('citizen', '/admin/dashboard');
      cy.url().should('not.include', '/admin/dashboard');
    });
  });
});
