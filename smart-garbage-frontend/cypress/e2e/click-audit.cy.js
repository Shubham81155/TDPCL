// cypress/e2e/click-audit.cy.js
// Crawls every page per role and clicks every visible, enabled clickable, one at a time, resetting
// the page after each click. Fails on: uncaught exceptions, the error boundary, console errors,
// and API responses >= 400 (other than the expected 401 on logout redirects).
// Destructive actions (logout / delete / remove) are skipped here and covered in feature specs.
const PAGES = {
  citizen: ['/citizen/dashboard', '/citizen/complaint/new', '/citizen/complaints'],
  officer: ['/officer/dashboard', '/officer/map', '/officer/complaints', '/officer/profile'],
  admin: [
    '/admin/dashboard',
    '/admin/complaints',
    '/admin/map',
    '/admin/officers',
    '/admin/wards',
    '/admin/analytics',
    '/admin/reports',
  ],
};

const CLICKABLES =
  'a[href]:visible, button:visible:not(:disabled), summary:visible, [role="tab"]:visible, [role="button"]:visible:not([aria-disabled="true"])';
const SKIP = /log ?out|sign out|delete|remove|print/i;
const label = ($el) =>
  ($el.attr('aria-label') || $el.text() || $el.attr('title') || $el.attr('href') || $el.prop('tagName'))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);

describe('Click audit', () => {
  let problems;

  beforeEach(() => {
    problems = [];
    Cypress.removeAllListeners('uncaught:exception');
    Cypress.on('uncaught:exception', (err) => {
      problems.push(`uncaught: ${err.message}`);
      return false;
    });
    Cypress.removeAllListeners('window:before:load');
    Cypress.on('window:before:load', (win) => {
      win.print = () => {};
      const orig = win.console.error;
      win.console.error = (...args) => {
        const msg = args.map((a) => (a && a.message) || String(a)).join(' ').slice(0, 200);
        // leaflet tile / third-party noise is not an app defect
        if (!/tile|openstreetmap|ERR_|Failed to load resource/i.test(msg)) problems.push(`console.error: ${msg}`);
        return orig.apply(win.console, args);
      };
    });
    cy.intercept('**/api/**', (req) => {
      // Non-blocking listener: the crawler navigates mid-request, which must not error the proxy.
      req.on('response', (res) => {
        if (res.statusCode >= 400) problems.push(`API ${req.method} ${new URL(req.url).pathname + new URL(req.url).search} -> ${res.statusCode}`);
      });
    });
  });

  const audit = (role, path) => {
    const clicked = [];
    cy.loginAs(role, path);
    cy.get('h1, h2').first().should('be.visible');
    cy.get('body').then(($b) => {
      expect($b.text()).not.to.contain('Something went wrong');
    });

    cy.get(CLICKABLES).then(($all) => {
      const count = $all.length;
      cy.log(`${path}: ${count} clickables`);
      Cypress._.times(count, (i) => {
        cy.get(CLICKABLES).then(($els) => {
          const $el = $els.eq(i);
          if (!$el.length) return;
          const name = label($el);
          if (SKIP.test(name) || $el.attr('target') === '_blank' || /^(mailto|tel|https?):/.test($el.attr('href') || '')) return;
          clicked.push(name);
          cy.wrap($el).click({ force: true });
          cy.get('body').then(($b) => {
            if ($b.text().includes('Something went wrong')) problems.push(`error boundary after clicking "${name}"`);
          });
          cy.visit(path); // reset to a clean page (session is in localStorage)
          cy.get('h1, h2').first().should('be.visible');
        });
      });
    });

    cy.then(() => {
      cy.log(`${role} ${path}: clicked ${clicked.length}`);
      expect(problems, `${role} ${path} problems`).to.deep.equal([]);
    });
  };

  before(() => cy.seedComplaint({ description: 'e2e: click audit seed' }));

  Object.entries(PAGES).forEach(([role, paths]) => {
    paths.forEach((path) => {
      it(`${role} ${path}`, () => audit(role, path));
    });
  });
});
