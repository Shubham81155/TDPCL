// tests/unit/complaintRoutes.test.js
// Regression test: the numeric-id routes must match "/5/..." and must not match
// "/officer/assigned" or non-numeric ids. (A refactor once turned the route
// pattern "/:id(\\d+)" into "/:id(\d+)" == "/:id(d+)", which silently 404'd every
// complaint-by-id route.)

jest.mock('../../src/config/database', () => ({ db: {}, pgp: {} }));
jest.mock('../../src/utils/s3Upload', () => ({ uploadToS3: jest.fn() }));

const router = require('../../src/routes/complaints');

const routes = router.stack
  .filter((layer) => layer.route)
  .map((layer) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods), layer }));

const find = (path, method) => routes.find((r) => r.path === path && r.methods.includes(method));
const matches = (route, url) => !!route.layer.match(url);

describe('complaint routes: numeric id patterns', () => {
  const cases = [
    ['/:id(\\d+)', 'get', '/12'],
    ['/:id(\\d+)/timeline', 'get', '/12/timeline'],
    ['/:id(\\d+)/status', 'patch', '/12/status'],
    ['/:id(\\d+)/resolve', 'post', '/12/resolve'],
  ];

  test.each(cases)('%s (%s) matches numeric ids', (path, method, url) => {
    const route = find(path, method);
    expect(route).toBeDefined();
    expect(matches(route, url)).toBe(true);
  });

  test.each(cases)('%s (%s) rejects non-numeric ids', (path, method) => {
    const route = find(path, method);
    const url = path.replace(':id(\\d+)', 'abc');
    expect(matches(route, url)).toBe(false);
  });

  it('does not let /:id swallow /officer/assigned', () => {
    const byId = find('/:id(\\d+)', 'get');
    expect(matches(byId, '/officer/assigned')).toBe(false);
    expect(matches(find('/officer/assigned', 'get'), '/officer/assigned')).toBe(true);
  });
});
