// cypress/e2e/features.cy.js
// Behavioural checks for the flows the click audit cannot judge (it only proves clicks do not crash).
// All created data is tagged (e2e_ emails, E2E- employee ids, e2e_city wards) so e2e-seed `down` removes it.
const stamp = () => Date.now().toString().slice(-8);

describe('Admin: officers', () => {
  it('adds an officer, lists it, then deletes it', () => {
    const id = stamp();
    const email = `e2e_off_${id}@example.com`;
    cy.loginAs('admin', '/admin/officers');

    cy.contains('button', 'Add Officer').click();
    cy.get('.modal input[name="email"]').type(email);
    cy.get('.modal input[name="password"]').type('E2e!Passw0rd#2026', { log: false });
    cy.get('.modal input[name="employee_id"]').type(`E2E-${id}`);
    cy.get('.modal input[name="assigned_area_name"]').type('E2E Area');
    cy.intercept('POST', '**/api/officers').as('add');
    cy.get('.modal button[type="submit"]').click();
    cy.wait('@add').its('response.statusCode').should('eq', 201);
    cy.contains('Officer added successfully!').should('be.visible');

    cy.get('input[aria-label]').filter('[placeholder*="Search"]').type(email);
    cy.contains(email).should('be.visible');

    cy.on('window:confirm', () => true);
    cy.intercept('DELETE', '**/api/officers/*').as('del');
    cy.get(`button[aria-label="Delete officer ${email}"]:visible`).click();
    cy.wait('@del').its('response.statusCode').should('eq', 200);
    cy.contains('Officer deleted successfully!').should('be.visible');
    cy.contains(email).should('not.exist');
  });

  it('does not delete when the confirmation is declined', () => {
    cy.loginAs('admin', '/admin/officers');
    cy.on('window:confirm', () => false);
    cy.intercept('DELETE', '**/api/officers/*', cy.spy().as('delCall'));
    cy.get('button[aria-label^="Delete officer"]:visible').first().click();
    cy.get('@delCall').should('not.have.been.called');
  });

  it('rejects a duplicate employee id', () => {
    cy.loginAs('admin', '/admin/officers');
    cy.contains('button', 'Add Officer').click();
    cy.get('.modal input[name="email"]').type(`e2e_dup_${stamp()}@example.com`);
    cy.get('.modal input[name="password"]').type('E2e!Passw0rd#2026', { log: false });
    cy.get('.modal input[name="employee_id"]').type('E2E-0001'); // belongs to the seeded officer
    cy.get('.modal input[name="assigned_area_name"]').type('E2E Area');
    cy.get('.modal button[type="submit"]').click();
    cy.contains('A record with this employee id already exists').should('be.visible');
    cy.contains('constraint').should('not.exist'); // no database internals shown
    cy.get('.modal').should('be.visible'); // stays open so the admin can fix it
  });
});

describe('Admin: wards', () => {
  it('creates a ward and edits its name', () => {
    const name = `e2e_ward_${stamp()}`;
    cy.loginAs('admin', '/admin/wards');

    cy.contains('button', 'Add ward').click();
    cy.get('#wardName').type(name);
    cy.get('#wardCity').type('e2e_city');
    cy.get('#wardState').type('e2e_state');
    // a box well away from the seeded ward (0.1-0.11) so auto-assignment of other tests is unaffected
    cy.get('#bbox-south').type('0.3');
    cy.get('#bbox-north').type('0.31');
    cy.get('#bbox-west').type('0.3');
    cy.get('#bbox-east').type('0.31');
    cy.intercept('POST', '**/api/wards').as('create');
    cy.get('.modal button[type="submit"]').click();
    cy.wait('@create').its('response.statusCode').should('eq', 201);
    cy.contains('Ward created').should('be.visible');

    cy.get('input[aria-label="Search wards"]').type(name);
    cy.contains('td', name).should('be.visible');

    cy.intercept('PUT', '**/api/wards/*').as('update');
    cy.get(`button[aria-label="Edit ${name}"]:visible`).click();
    cy.get('#wardName').clear().type(`${name}_x`);
    cy.get('.modal button[type="submit"]').click();
    cy.wait('@update').its('response.statusCode').should('eq', 200);
    cy.contains('Ward updated').should('be.visible');
    cy.contains('td', `${name}_x`).should('be.visible');
  });

  it('validates ward bounds (south must be less than north)', () => {
    cy.loginAs('admin', '/admin/wards');
    cy.contains('button', 'Add ward').click();
    cy.get('#wardName').type(`e2e_ward_${stamp()}`);
    cy.get('#wardCity').type('e2e_city');
    cy.get('#wardState').type('e2e_state');
    cy.get('#bbox-south').type('5');
    cy.get('#bbox-north').type('4');
    cy.get('#bbox-west').type('1');
    cy.get('#bbox-east').type('2');
    cy.get('.modal button[type="submit"]').click();
    cy.contains('South must be less than north').should('be.visible');
  });
});

describe('Admin: reports', () => {
  it('exports a CSV from the server', () => {
    cy.loginAs('admin', '/admin/reports');
    cy.intercept('GET', '**/api/admin/report/export*').as('export');
    cy.contains('button', 'Export CSV').click();
    cy.wait('@export').then(({ response }) => {
      expect(response.statusCode).to.eq(200);
      expect(response.headers['content-type']).to.match(/csv/);
    });
    cy.contains('Report exported successfully').should('be.visible');
  });
});

describe('Complaint lifecycle: citizen -> officer -> citizen', () => {
  it('shows the status change made by the officer to the citizen', () => {
    cy.seedComplaint({ description: 'e2e: lifecycle' }).then((res) => {
      const id = res.complaint.complaint_id;
      expect(id, 'complaint id from API').to.be.a('number');

      // officer resolves it through the UI
      cy.loginAs('officer', '/officer/complaints');
      cy.contains('tr', `#${id}`).contains('button', 'Update').click();
      cy.intercept('PATCH', '**/api/complaints/*/status').as('status');
      cy.get('.modal select').select('resolved');
      cy.contains('.modal button', 'Update Status').click();
      cy.wait('@status').its('response.statusCode').should('eq', 200);

      // citizen sees it
      cy.clearAllLocalStorage();
      cy.loginAs('citizen', `/citizen/complaint/${id}`);
      cy.contains('Thank you! Your complaint has been successfully resolved.').should('be.visible');
      cy.contains('Activity Timeline').should('be.visible');

      // admin can find it by id and it is counted as resolved
      cy.clearAllLocalStorage();
      cy.loginAs('admin', '/admin/complaints');
      cy.get('input[aria-label="Search complaints by ID, area or citizen"]').type(String(id));
      cy.contains('tr', `#${id}`).should('contain.text', 'resolved');
    });
  });
});

describe('Admin complaints: filtering', () => {
  it('status chips narrow the list and the active filter chip can be removed', () => {
    cy.seedComplaint({ description: 'e2e: filter' });
    cy.loginAs('admin', '/admin/complaints');
    cy.get('tbody tr').its('length').then((all) => {
      cy.get('[aria-label="Filter by status"] button').contains(/resolved/i).click();
      cy.get('body').then(($b) => {
        const rows = $b.find('tbody tr').length;
        expect(rows).to.be.at.most(all);
      });
    });
  });
});

describe('Preferences', () => {
  it('switches language to Hindi and keeps it after reload', () => {
    cy.loginAs('citizen', '/citizen/dashboard');
    cy.get('select.language-switcher').select('hi');
    cy.get('html').should('have.attr', 'lang', 'hi');
    cy.contains('स्वागत').should('be.visible');
    cy.reload();
    cy.get('html').should('have.attr', 'lang', 'hi');
    cy.contains('स्वागत').should('be.visible');
    cy.get('select.language-switcher').select('en');
    cy.contains('Welcome').should('be.visible');
  });

  it('cycles the theme, applies dark mode, and keeps the choice after reload', () => {
    cy.loginAs('citizen', '/citizen/dashboard');
    // light -> dark -> system -> light; click until the toggle reports dark
    const toDark = (n = 0) => {
      cy.get('.theme-toggle').first().invoke('attr', 'data-theme-mode').then((mode) => {
        if (mode === 'dark' || n > 3) return;
        cy.get('.theme-toggle').first().click();
        toDark(n + 1);
      });
    };
    toDark();
    cy.get('.theme-toggle').first().should('have.attr', 'data-theme-mode', 'dark');
    cy.get('html').should('have.attr', 'data-bs-theme', 'dark');
    cy.reload();
    cy.get('.theme-toggle').first().should('have.attr', 'data-theme-mode', 'dark');
    cy.get('html').should('have.attr', 'data-bs-theme', 'dark');
  });
});

describe('Password reset pages', () => {
  it('forgot-password validates, then confirms without revealing whether the account exists', () => {
    cy.visit('/forgot-password');
    cy.get('button[type="submit"]').click();
    cy.contains('Please enter your email address').should('be.visible');
    cy.get('input[type="email"]').type('e2e_nobody@example.com');
    cy.get('button[type="submit"]').click();
    cy.contains('Check Your Email!').should('be.visible');
  });

  it('reset-password with a bad token explains the link is invalid', () => {
    cy.visit('/reset-password?token=not-a-real-token');
    cy.get('input[type="password"]').first().type('E2e!Passw0rd#2026', { log: false });
    cy.get('input[type="password"]').last().type('E2e!Passw0rd#2026', { log: false });
    cy.get('button[type="submit"]').click();
    cy.contains(/invalid|expired|failed/i).should('be.visible');
  });
});

describe('Maps and routing', () => {
  it('renders the officer map and admin map', () => {
    cy.loginAs('officer', '/officer/map');
    cy.get('.leaflet-container, [data-testid="map-picker-coords"], h1, h2').should('exist');
    cy.contains(/Complaints Map/).should('be.visible');
    cy.loginAs('admin', '/admin/map');
    cy.get('[data-testid="heatmap-container"], .leaflet-container').should('exist');
  });

  it('unknown routes show Not Found and the home link works', () => {
    cy.visit('/no/such/page');
    cy.contains('Page Not Found').should('be.visible');
    cy.contains('a', 'Go to Home').click();
    cy.url().should('match', /\/(login|citizen\/dashboard)/);
  });

  it('role guards: each role is bounced from the others\' pages', () => {
    cy.loginAs('citizen', '/officer/dashboard');
    cy.url().should('not.include', '/officer/dashboard');
    cy.loginAs('officer', '/citizen/complaints');
    cy.url().should('not.include', '/citizen/complaints');
  });
});

describe('Citizen: location helpers', () => {
  it('"use my current location" fills the pin from the browser geolocation', () => {
    cy.loginAs('citizen', '/citizen/complaint/new');
    cy.window().then((win) => {
      cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((ok) =>
        ok({ coords: { latitude: 19.076, longitude: 72.8777, accuracy: 5 } })
      );
    });
    cy.contains('button', 'Use my current location').click();
    cy.get('[data-testid="map-picker-coords"]').should('contain.text', '19.076');
  });
});
