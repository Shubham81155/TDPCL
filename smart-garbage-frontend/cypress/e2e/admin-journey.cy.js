// cypress/e2e/admin-journey.cy.js
describe('Admin User Journey', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.clearLocalStorage();
    cy.clearCookies();

    // Login as admin
    cy.visit('/login');
    cy.get('input[type="email"]').type('admin@example.com');
    cy.get('input[type="password"]').type('adminPassword123');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/admin/dashboard');
  });

  describe('Admin Dashboard', () => {
    it('should display admin dashboard with statistics', () => {
      cy.contains('Admin Dashboard').should('be.visible');
      cy.contains('Total Complaints').should('be.visible');
      cy.contains('New').should('be.visible');
      cy.contains('In Progress').should('be.visible');
      cy.contains('Resolved').should('be.visible');
    });

    it('should show quick action links', () => {
      cy.contains('Manage Complaints').should('be.visible');
      cy.contains('Manage Officers').should('be.visible');
      cy.contains('View Analytics').should('be.visible');
      cy.contains('Generate Reports').should('be.visible');
    });

    it('should navigate to complaints', () => {
      cy.contains('Manage Complaints').click();
      cy.url().should('include', '/admin/complaints');
    });
  });

  describe('Admin Complaints Management', () => {
    it('should display all complaints', () => {
      cy.visit('/admin/complaints');

      cy.contains('All Complaints').should('be.visible');
      // Complaints table should be visible
    });

    it('should filter complaints by various criteria', () => {
      cy.visit('/admin/complaints');

      cy.get('select[name="status"]').select('resolved');
      // Should show only resolved complaints
    });
  });

  describe('Officer Management', () => {
    it('should display officer management page', () => {
      cy.visit('/admin/officers');

      cy.contains('Officer Management').should('be.visible');
    });
  });

  describe('Ward Management', () => {
    it('should display ward management', () => {
      cy.visit('/admin/wards');

      cy.contains('Ward Management').should('be.visible');
    });
  });

  describe('Analytics and Reporting', () => {
    it('should display analytics dashboard', () => {
      cy.visit('/admin/analytics');

      cy.contains('Analytics').should('be.visible');
      cy.contains('Complaints by Category').should('be.visible');
      cy.contains('Top Officers').should('be.visible');
    });

    it('should display top officers', () => {
      cy.visit('/admin/analytics');

      // Should show officer performance rankings
      cy.get('table').should('be.visible');
    });

    it('should display ward statistics', () => {
      cy.visit('/admin/analytics');

      cy.contains('Complaints by Ward').should('be.visible');
      cy.get('table').should('contain', 'Ward');
      cy.get('table').should('contain', 'Total');
      cy.get('table').should('contain', 'Officers');
    });
  });

  describe('Report Export', () => {
    it('should display report export page', () => {
      cy.visit('/admin/reports');

      cy.contains('Reports').should('be.visible');
      cy.contains('Export Options').should('be.visible');
    });

    it('should allow CSV export', () => {
      cy.visit('/admin/reports');

      cy.get('button').contains('Export as CSV').should('be.visible');
      // Download functionality would be tested
    });
  });

  describe('Admin Logout', () => {
    it('should logout admin', () => {
      cy.contains('Logout').click();

      cy.url().should('include', '/login');
      cy.window().then((win) => {
        expect(win.localStorage.getItem('accessToken')).to.be.null;
      });
    });
  });
});
