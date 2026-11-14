# Testing Guide - Smart Garbage Reporting System

This document provides comprehensive instructions for running tests across the full stack application (backend API, frontend components, and end-to-end flows).

---

## Table of Contents

1. [Backend API Testing](#backend-api-testing)
2. [Frontend Component Testing](#frontend-component-testing)
3. [End-to-End Testing](#end-to-end-testing)
4. [Test Coverage](#test-coverage)
5. [Continuous Integration](#continuous-integration)

---

## Backend API Testing

### Setup

```bash
# Navigate to backend directory
cd smart-garbage-backend

# Install dependencies (if not already done)
npm install

# Create test environment file
cp .env .env.test

# Update .env.test with test database credentials
# DATABASE_URL=postgresql://test_user:test_password@localhost:5432/smart_garbage_test
```

### Running Backend Tests

**Run all tests with coverage:**
```bash
npm test
```

**Run tests in watch mode (useful during development):**
```bash
npm run test:watch
```

**Run specific test file:**
```bash
npm test -- tests/auth.test.js
```

**Run tests matching a pattern:**
```bash
npm test -- --testNamePattern="register"
```

**Generate coverage report:**
```bash
npm test -- --coverage
```

### Test Structure

Backend tests are organized by functionality:

- **`tests/auth.test.js`** - Authentication API endpoints
  - User registration
  - Login/logout flows
  - Profile management
  - Password changes
  - Token refresh

- **`tests/complaints.test.js`** - Complaint management
  - Complaint submission with image upload
  - Auto-assignment algorithm
  - Status updates and tracking
  - Pagination and filtering
  - Timeline/history tracking

- **`tests/officers.test.js`** - Officer management (admin)
  - Officer CRUD operations
  - Location tracking
  - Performance metrics
  - Workload management
  - Deactivation and reassignment

- **`tests/assignments.test.js`** - Geolocation & assignment logic
  - PostGIS distance calculations (ST_Distance)
  - Nearest officer search
  - Workload-based assignment
  - Ward detection (ST_Contains)
  - Workload balancing

- **`tests/admin.test.js`** - Admin dashboard & reporting
  - Statistics aggregation
  - Category/ward/officer analytics
  - Heatmap data generation
  - CSV report export
  - Audit logging

- **`tests/services/`** - Service layer unit tests
  - `authService.test.js` - Authentication business logic
  - `assignmentService.test.js` - Geolocation algorithms
  - Password hashing, token generation, etc.

### Expected Test Coverage

- **Target:** 70% code coverage
- **Branches:** 50%+
- **Functions:** 50%+
- **Lines:** 50%+
- **Statements:** 50%+

### Key Testing Patterns

1. **Mock External Services**
   ```javascript
   jest.mock('../../services/api');
   jest.mock('../../../utils/locationUtils');
   ```

2. **Test Async Operations**
   ```javascript
   it('should handle async operations', async () => {
     const response = await apiClient.get('/endpoint');
     expect(response).toBeTruthy();
   });
   ```

3. **Test Error Handling**
   ```javascript
   it('should handle errors', async () => {
     jest.mock(...).mockRejectedValueOnce(new Error('...'));
     expect(async () => { ... }).rejects.toThrow();
   });
   ```

---

## Frontend Component Testing

### Setup

```bash
# Navigate to frontend directory
cd smart-garbage-frontend

# Install dependencies (including testing libraries)
npm install

# React Testing Library is already included in package.json
```

### Running Frontend Tests

**Run all tests:**
```bash
npm test
```

**Run tests in watch mode:**
```bash
npm test -- --watch
```

**Run tests for a specific component:**
```bash
npm test -- ProtectedRoute
```

**Run with coverage:**
```bash
npm test -- --coverage
```

**Update snapshots (if using snapshot testing):**
```bash
npm test -- --updateSnapshot
```

### Test Structure

Frontend tests are organized by component/page:

- **`src/components/__tests__/ProtectedRoute.test.js`**
  - Authentication state handling
  - Role-based access control
  - Redirect logic
  - Loading states

- **`src/pages/Auth/__tests__/LoginPage.test.js`**
  - Form rendering
  - Input validation
  - Error display
  - Form submission
  - Loading states

- **`src/pages/Citizen/__tests__/ComplaintForm.test.js`**
  - Form field rendering
  - Validation logic
  - File upload handling
  - Location detection
  - Image preview
  - Form submission

### Testing Best Practices

1. **User-Centric Testing**
   ```javascript
   // Good - test from user perspective
   fireEvent.click(screen.getByText(/login/i));
   
   // Avoid - testing implementation details
   fireEvent.click(wrapper.find('.login-btn'));
   ```

2. **Async Operations**
   ```javascript
   it('should handle async operations', async () => {
     fireEvent.click(screen.getByText('Submit'));
     
     await waitFor(() => {
       expect(screen.getByText('Success')).toBeInTheDocument();
     });
   });
   ```

3. **Form Testing**
   ```javascript
   fireEvent.change(screen.getByPlaceholderText(/email/i), {
     target: { value: 'test@example.com' }
   });
   ```

4. **Mocking API Calls**
   ```javascript
   jest.mock('../../../services/api', () => ({
     get: jest.fn(() => Promise.resolve({ data: {...} })),
     post: jest.fn(() => Promise.resolve({ data: {...} })),
   }));
   ```

---

## End-to-End Testing

### Setup

```bash
# Navigate to frontend directory
cd smart-garbage-frontend

# Install Cypress
npm install --save-dev cypress

# Open Cypress Test Runner
npx cypress open
```

### Creating Cypress Configuration

The `cypress.config.js` file is already configured with:
- Base URL: `http://localhost:3000`
- Viewport: 1280x720
- Command timeout: 10 seconds
- Request timeout: 10 seconds

### Running E2E Tests

**Open Cypress Test Runner (interactive):**
```bash
npx cypress open
```

**Run all headless tests:**
```bash
npx cypress run
```

**Run specific test file:**
```bash
npx cypress run --spec "cypress/e2e/citizen-journey.cy.js"
```

**Run with specific browser:**
```bash
npx cypress run --browser chrome
# Or: firefox, edge, electron
```

**Run in headless mode with video recording:**
```bash
npx cypress run --headless --record
```

### E2E Test Scenarios

#### **Citizen User Journey** (`citizen-journey.cy.js`)

1. **Registration Flow**
   - Fill registration form with valid data
   - Submit and verify redirect to dashboard
   - Check localStorage for tokens

2. **Login Flow**
   - Valid credentials → dashboard access
   - Invalid credentials → error message
   - Form validation → error messages

3. **Complaint Submission**
   - Fill complaint form
   - Upload image
   - Set location (manual or auto-detect)
   - Submit and verify redirection
   - Check complaint appears in list

4. **Complaint Tracking**
   - View all complaints
   - Filter by status/category
   - View complaint details
   - Check timeline/history

5. **Profile Management**
   - View profile information
   - Update profile (if applicable)
   - Logout verification

#### **Officer User Journey** (`officer-journey.cy.js`)

1. **Dashboard Access**
   - Login as officer
   - View workload statistics
   - Navigate to assignments

2. **Complaint Management**
   - View assigned complaints
   - Filter by status
   - Update complaint status
   - Submit resolution with proof image

3. **Map View**
   - Load map with complaint locations
   - View marker details
   - Interact with map

4. **Profile & Performance**
   - View performance metrics
   - Check resolution rate
   - View assignment history

#### **Admin User Journey** (`admin-journey.cy.js`)

1. **Dashboard Access**
   - Login as admin
   - View system-wide statistics
   - Access management panels

2. **Complaint Management**
   - View all complaints
   - Filter and search
   - Override assignments
   - View complaint details

3. **Officer Management**
   - View officer list
   - Create/update officers
   - View performance metrics
   - Manage ward assignments

4. **Analytics & Reporting**
   - View complaint statistics
   - View category breakdown
   - View ward statistics
   - View top officers ranking
   - Export reports (CSV)

### Common E2E Test Patterns

1. **Login Before Each Test**
   ```javascript
   beforeEach(() => {
     cy.visit('/login');
     cy.get('input[type="email"]').type('user@example.com');
     cy.get('input[type="password"]').type('password');
     cy.get('button[type="submit"]').click();
     cy.url().should('include', '/dashboard');
   });
   ```

2. **Form Filling**
   ```javascript
   cy.get('input[name="title"]').type('Complaint Title');
   cy.get('textarea[name="description"]').type('Details...');
   cy.get('select[name="category"]').select('garbage_heap');
   cy.get('input[type="file"]').attachFile('image.jpg');
   ```

3. **Verification**
   ```javascript
   cy.contains('Success Message').should('be.visible');
   cy.url().should('include', '/expected/path');
   cy.get('table').contains('expected data');
   ```

4. **Waiting for Elements**
   ```javascript
   cy.get('.spinner', { timeout: 10000 }).should('not.exist');
   cy.contains('Loaded Content').should('be.visible');
   ```

---

## Test Coverage

### Expected Coverage Results

```
--------------|----------|----------|----------|----------|
File          | % Stmts  | % Branch | % Funcs  | % Lines  |
-----------__|----------|----------|----------|----------|
All files    | 70.5     | 65.3     | 72.1     | 71.2     |
--------------|----------|----------|----------|----------|
Backend     | 75       | 70       | 75       | 75       |
Frontend    | 68       | 62       | 70       | 68       |
--------------|----------|----------|----------|----------|
```

### Improving Coverage

1. **Identify uncovered lines:**
   ```bash
   npm test -- --coverage
   # Check coverage/index.html in browser
   ```

2. **Write tests for missing scenarios:**
   - Edge cases
   - Error conditions
   - Alternate paths

3. **Focus on critical paths:**
   - Authentication flows
   - Assignment algorithm
   - Data persistence

---

## Continuous Integration

### GitHub Actions Example

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgis/postgis:15-3.3
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: smart_garbage_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies (Backend)
        run: cd smart-garbage-backend && npm ci

      - name: Run backend tests
        run: cd smart-garbage-backend && npm test -- --coverage

      - name: Install dependencies (Frontend)
        run: cd smart-garbage-frontend && npm ci

      - name: Run frontend tests
        run: cd smart-garbage-frontend && npm test -- --coverage

      - name: Run E2E tests
        run: |
          cd smart-garbage-backend && npm run dev &
          cd smart-garbage-frontend && npm run build
          npm run test:e2e
```

---

## Troubleshooting

### Backend Tests Fail with Database Connection
```bash
# Check PostgreSQL is running
psql -U postgres -d smart_garbage_test

# Verify .env.test credentials
cat .env.test

# Run migrations
npm run migrate
```

### Frontend Tests Fail with Module Not Found
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Jest cache
npm test -- --clearCache
```

### E2E Tests Fail with "Cannot find module"
```bash
# Install test dependencies
npm install --save-dev @cypress/webpack-dev-server

# Verify base URL in cypress.config.js
# Ensure app is running on http://localhost:3000
```

### Port Already in Use
```bash
# Kill process on port 5000 (backend)
lsof -i :5000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Kill process on port 3000 (frontend)
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

---

## Test Report Generation

### Coverage Report
```bash
# Generate HTML coverage report
npm test -- --coverage

# View in browser
open coverage/index.html  # macOS
# or xdg-open coverage/index.html  # Linux
# or start \coverage\lcov-report\index.html  # Windows
```

### Test Summary
```bash
# Run tests with detailed output
npm test -- --verbose

# Export test results
npm test -- --json --outputFile=test-results.json
```

---

## Best Practices

✅ **Do:**
- Test user behaviors, not implementation details
- Write independent, isolated tests
- Use descriptive test names
- Mock external dependencies
- Test error scenarios
- Keep tests fast and focused
- Run tests before committing code

❌ **Don't:**
- Test framework internals
- Share state between tests
- Add delays with `cy.wait()`
- Test multiple features in one test
- Ignore test failures
- Skip flaky tests without fixing

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Cypress Documentation](https://docs.cypress.io/)
- [Supertest](https://github.com/visionmedia/supertest)

---

**Last Updated:** March 5, 2026
