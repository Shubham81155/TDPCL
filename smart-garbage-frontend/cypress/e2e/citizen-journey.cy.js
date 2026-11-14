// cypress/e2e/citizen-journey.cy.js
describe('Citizen User Journey', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('User Registration and Login', () => {
    it('should allow citizen to register', () => {
      cy.visit('/register');

      cy.get('input[name="name"]').type('John Doe');
      cy.get('input[name="email"]').type('john@example.com');
      cy.get('input[name="phone"]').type('9876543210');
      cy.get('input[name="password"]').type('Password123!');
      cy.get('input[name="confirmPassword"]').type('Password123!');

      cy.get('button[type="submit"]').click();

      cy.url().should('include', '/citizen/dashboard');
    });

    it('should allow citizen to login', () => {
      cy.visit('/login');

      cy.get('input[type="email"]').type('citizen@example.com');
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').click();

      cy.url().should('include', '/citizen/dashboard');
      cy.contains('Welcome').should('be.visible');
    });

    it('should show validation errors on login', () => {
      cy.visit('/login');
      cy.get('button[type="submit"]').click();

      cy.contains('Email is required').should('be.visible');
      cy.contains('Password is required').should('be.visible');
    });
  });

  describe('Complaint Submission', () => {
    beforeEach(() => {
      // Login first
      cy.visit('/login');
      cy.get('input[type="email"]').type('citizen@example.com');
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/citizen/dashboard');
    });

    it('should allow citizen to submit new complaint', () => {
      cy.visit('/citizen/complaint/new');

      cy.get('input[name="title"]').type('Garbage Heap on Main Street');
      cy.get('textarea[name="description"]').type(
        'Large pile of garbage blocking the road'
      );
      cy.get('select[name="category"]').select('garbage_heap');
      cy.get('select[name="urgency_level"]').select('high');

      // Set location
      cy.get('input[name="latitude"]').clear().type('19.0760');
      cy.get('input[name="longitude"]').clear().type('72.8777');

      // Upload image
      cy.get('input[type="file"]').attachFile('complaint.jpg');

      cy.get('button').contains('Submit').click();

      // Should redirect to complaints list
      cy.url().should('include', '/citizen/complaints');
      cy.contains('Complaint submitted successfully').should('be.visible');
    });

    it('should show validation errors on incomplete form', () => {
      cy.visit('/citizen/complaint/new');
      cy.get('button').contains('Submit').click();

      cy.contains('Title is required').should('be.visible');
      cy.contains('Description is required').should('be.visible');
    });

    it('should detect current location', () => {
      cy.visit('/citizen/complaint/new');

      // Mock geolocation
      cy.window().then((win) => {
        cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake(
          (cb) => {
            cb({
              coords: {
                latitude: 19.0760,
                longitude: 72.8777,
              },
            });
          }
        );
      });

      cy.contains('Use My Current Location').click();

      cy.get('input[name="latitude"]').should('have.value', '19.076');
      cy.get('input[name="longitude"]').should('have.value', '72.8777');
    });
  });

  describe('Complaint Tracking', () => {
    beforeEach(() => {
      // Login
      cy.visit('/login');
      cy.get('input[type="email"]').type('citizen@example.com');
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').click();
    });

    it('should display all citizen complaints', () => {
      cy.visit('/citizen/complaints');

      cy.contains('My Complaints').should('be.visible');
      cy.get('table').should('be.visible');
      cy.get('tbody tr').should('have.length.greaterThan', 0);
    });

    it('should filter complaints by status', () => {
      cy.visit('/citizen/complaints');

      cy.get('select[name="status"]').select('resolved');

      // Should only show resolved complaints
      cy.get('tbody tr').each(($row) => {
        cy.wrap($row).contains('RESOLVED');
      });
    });

    it('should show complaint details', () => {
      cy.visit('/citizen/complaints');

      cy.get('tbody tr').first().within(() => {
        cy.get('button').contains('View').click();
      });

      cy.contains('Complaint #').should('be.visible');
      cy.contains('Activity Timeline').should('be.visible');
    });
  });

  describe('User Profile', () => {
    beforeEach(() => {
      // Login
      cy.visit('/login');
      cy.get('input[type="email"]').type('citizen@example.com');
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').click();
    });

    it('should display user profile', () => {
      cy.get('button').contains('Profile').click();

      // Should show profile options in dropdown or navigate to profile
      cy.url().should('include', '/profile');
    });

    it('should allow logout', () => {
      cy.contains('Logout').click();

      cy.url().should('include', '/login');
      cy.window().then((win) => {
        expect(win.localStorage.getItem('accessToken')).to.be.null;
      });
    });
  });
});
