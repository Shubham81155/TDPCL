// src/components/__tests__/ProtectedRoute.test.js
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const renderAt = (requiredRole) =>
  render(
    <MemoryRouter initialEntries={['/secret']}>
      <Routes>
        <Route
          path="/secret"
          element={
            <ProtectedRoute requiredRole={requiredRole}>
              <div>secret content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/" element={<div>home page</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('ProtectedRoute', () => {
  it('shows a loading spinner while the session is restored', () => {
    useAuth.mockReturnValue({ user: null, isAuthenticated: false, isLoading: true });
    renderAt('citizen');
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    useAuth.mockReturnValue({ user: null, isAuthenticated: false, isLoading: false });
    renderAt('citizen');
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('renders children when authenticated with the matching role', () => {
    useAuth.mockReturnValue({ user: { role: 'citizen' }, isAuthenticated: true, isLoading: false });
    renderAt('citizen');
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });

  it('redirects users whose role does not match', () => {
    useAuth.mockReturnValue({ user: { role: 'citizen' }, isAuthenticated: true, isLoading: false });
    renderAt('admin');
    expect(screen.getByText('home page')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('allows any authenticated user when no role is required', () => {
    useAuth.mockReturnValue({ user: { role: 'officer' }, isAuthenticated: true, isLoading: false });
    renderAt(undefined);
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });
});
