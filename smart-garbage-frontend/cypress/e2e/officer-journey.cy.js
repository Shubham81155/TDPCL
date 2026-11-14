// cypress/e2e/officer-journey.cy.js
describe('Officer User Journey', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.clearLocalStorage();
    cy.clearCookies();

    // Login as officer
    cy.visit('/login');
    cy.get('input[type="email"]').type('officer@example.com');
    cy.get('input[type="password"]').type('officerPassword123');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/officer/dashboard');
  });

  describe('Officer Dashboard', () => {
    it('should display officer dashboard', () => {
      cy.contains('Officer Dashboard').should('be.visible');
      cy.contains('Pending').should('be.visible');
      cy.contains('In Progress').should('be.visible');
      cy.contains('Resolved').should('be.visible');
    });

    it('should show workload statistics', () => {
      cy.get('h3').should('have.length.greaterThan', 0);
      // Check for stat numbers
      cy.get('.text-warning').should('be.visible');
      cy.get('.text-info').should('be.visible');
    });

    it('should navigate to assigned complaints', () => {
      cy.contains('View All Assignments').click();
      cy.url().should('include', '/officer/complaints');
    });
  });

  describe('Assigned Complaints Management', () => {
    it('should display assigned complaints', () => {
      cy.visit('/officer/complaints');

      cy.contains('Assigned Complaints').should('be.visible');
      cy.get('table').should('be.visible');
    });

    it('should filter complaints by status', () => {
      cy.visit('/officer/complaints');

      cy.get('select[name="status"]').select('in_progress');

      cy.get('tbody tr').each(($row) => {
        cy.wrap($row).contains('IN PROGRESS');
      });
    });

    it('should update complaint status', () => {
      cy.visit('/officer/complaints');

      cy.get('tbody tr').first().within(() => {
        cy.get('button').contains('Update').click();
      });

      // Modal should open
      cy.get('.modal-title').contains('Update Complaint Status').should('be.visible');

      cy.get('select').select('resolved');
      cy.get('button').contains('Update Status').click();

      cy.contains('Status updated successfully').should('be.visible');
    });
  });

  describe('Officer Map View', () => {
    it('should display map view', () => {
      cy.visit('/officer/map');

      cy.contains('Complaints Map').should('be.visible');
      // Map component would be tested here
    });
  });

  describe('Officer Profile', () => {
    it('should display officer profile', () => {
      cy.visit('/officer/profile');

      cy.contains('Officer Profile').should('be.visible');
      cy.contains('Performance Metrics').should('be.visible');
    });

    it('should show performance metrics', () => {
      cy.visit('/officer/profile');

      cy.contains('Total Complaints').should('be.visible');
      cy.contains('Resolved').should('be.visible');
      cy.contains('In Progress').should('be.visible');
      cy.contains('Avg Resolution Time').should('be.visible');
    });

    it('should display resolution rate progress', () => {
      cy.visit('/officer/profile');

      cy.get('.progress').should('be.visible');
      cy.get('.progress-bar').should('be.visible');
    });
  });

  describe('Officer Logout', () => {
    it('should logout officer', () => {
      cy.contains('Logout').click();

      cy.url().should('include', '/login');
      cy.window().then((win) => {
        expect(win.localStorage.getItem('accessToken')).to.be.null;
      });
    });
  });
});
