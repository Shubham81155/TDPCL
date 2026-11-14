import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../../context/ThemeContext';
import Header from '../Header';

let mockAuth;
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => mockAuth }));

const renderHeader = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    </ThemeProvider>
  );

describe('Header', () => {
  it('renders the theme toggle for logged-out users', () => {
    mockAuth = { user: null, isAuthenticated: false, logout: jest.fn() };
    renderHeader();
    expect(screen.getByRole('button', { name: /Theme:/ })).toBeInTheDocument();
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('renders the toggle and nav links for an admin', () => {
    mockAuth = { user: { role: 'admin', name: 'Ada' }, isAuthenticated: true, logout: jest.fn() };
    renderHeader();
    expect(screen.getByRole('button', { name: /Theme:/ })).toBeInTheDocument();
    ['Dashboard', 'Complaints', 'Officers', 'Wards', 'Map', 'Analytics', 'Reports'].forEach((t) =>
      expect(screen.getByText(t)).toBeInTheDocument()
    );
  });
});
