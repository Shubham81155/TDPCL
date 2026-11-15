// cypress/e2e/officer-journey.cy.js
describe('Officer journey', () => {
  before(() => {
    // Complaints inside the seeded ward are auto-assigned to the seeded officer.
    cy.seedComplaint({ description: 'e2e: officer seed' });
  });

  describe('Dashboard', () => {
    beforeEach(() => cy.loginAs('officer', '/officer/dashboard'));

    it('shows the officer dashboard with workload counts', () => {
      cy.contains('Officer Dashboard').should('be.visible');
      cy.contains('Welcome, E2E Officer!').should('be.visible');
      ['Pending', 'In Progress', 'Resolved'].forEach((l) => cy.contains(l).should('be.visible'));
    });

    it('navigates to assigned work and the profile', () => {
      cy.contains('a', 'View All Assignments').click();
      cy.url().should('include', '/officer/complaints');
      cy.visit('/officer/profile');
      cy.contains('Officer Profile').should('be.visible');
      cy.contains('E2E-0001').should('be.visible');
    });
  });

  describe('Assigned complaints', () => {
    beforeEach(() => cy.loginAs('officer', '/officer/complaints'));

    it('lists the assigned complaints', () => {
      cy.contains('h2', 'Assigned Complaints').should('be.visible');
      cy.get('tbody tr').should('have.length.greaterThan', 0);
    });

    it('updates a complaint status through the modal', () => {
      cy.intercept('PATCH', '**/api/complaints/*/status').as('status');
      cy.get('tbody tr').first().contains('button', 'Update').click();
      cy.get('.modal').within(() => {
        cy.contains('Update Complaint Status').should('be.visible');
        cy.get('select').select('in_progress');
        cy.contains('button', 'Update Status').click();
      });
      cy.wait('@status').its('response.statusCode').should('eq', 200);
      cy.contains('Status updated successfully').should('be.visible');
    });
  });

  describe('Access control', () => {
    it('keeps officers out of admin pages', () => {
      cy.loginAs('officer', '/admin/dashboard');
      cy.url().should('not.include', '/admin/dashboard');
    });
  });
});
