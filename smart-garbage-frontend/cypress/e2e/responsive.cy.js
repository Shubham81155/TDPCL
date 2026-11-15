// cypress/e2e/responsive.cy.js
// Every page must fit a 360px phone without horizontal page scroll, in English and Hindi.
const PAGES = {
  citizen: ['/citizen/dashboard', '/citizen/complaint/new', '/citizen/complaints'],
  officer: ['/officer/dashboard', '/officer/complaints', '/officer/profile'],
  admin: [
    '/admin/dashboard',
    '/admin/complaints',
    '/admin/officers',
    '/admin/wards',
    '/admin/analytics',
    '/admin/reports',
  ],
};

describe('Mobile layout (360x740)', () => {
  before(() => {
    cy.seedComplaint({ description: 'e2e: responsive seed' }); // so tables/cards have rows
  });
  beforeEach(() => cy.viewport(360, 740));

  ['en', 'hi'].forEach((lang) => {
    Object.entries(PAGES).forEach(([role, paths]) => {
      paths.forEach((path) => {
        it(`${role} ${path} fits the screen [${lang}]`, () => {
          cy.loginAs(role, path, { lang });
          cy.get('html').should('have.attr', 'lang', lang);
          cy.get('h1, h2').first().should('be.visible');
          cy.get('[aria-busy="true"], .spinner-border, .skeleton').should('not.exist');
          cy.document().then((doc) => {
            const el = doc.documentElement;
            expect(el.scrollWidth, 'document scrollWidth').to.be.at.most(el.clientWidth + 1);
          });
        });
      });
    });
  });
});
