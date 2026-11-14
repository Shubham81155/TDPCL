// src/pages/Auth/__tests__/LoginPage.test.js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from '../LoginPage';
import { AuthProvider } from '../../../context/AuthContext';
import apiClient from '../../../services/api';

jest.mock('../../../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
  Toaster: () => null,
}));

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/citizen/dashboard" element={<div>citizen home</div>} />
          <Route path="/admin/dashboard" element={<div>admin home</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

const submit = () => fireEvent.click(screen.getByRole('button', { name: /^login$/i }));
const fill = (email, password) => {
  fireEvent.change(screen.getByPlaceholderText(/enter your email/i), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText(/enter your password/i), { target: { value: password } });
};

describe('LoginPage', () => {
  it('renders the login form', () => {
    renderLogin();
    expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^login$/i })).toBeEnabled();
  });

  it('requires email and password', async () => {
    renderLogin();
    submit();
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('rejects a malformed email', async () => {
    renderLogin();
    fill('not-an-email', 'secret1');
    submit();
    expect(await screen.findByText(/email is invalid/i)).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('logs in, stores the session (including name) and redirects by role', async () => {
    apiClient.post.mockResolvedValue({
      data: { user_id: 7, name: 'Asha', email: 'a@x.com', role: 'admin', accessToken: 'AT', refreshToken: 'RT' },
    });
    renderLogin();
    fill('a@x.com', 'secret1');
    submit();

    expect(await screen.findByText('admin home')).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledWith('/auth/login', { email: 'a@x.com', password: 'secret1' });
    expect(window.localStorage.getItem('accessToken')).toBe('AT');
    expect(JSON.parse(window.localStorage.getItem('user')).name).toBe('Asha');
  });

  it('shows the server error when login fails', async () => {
    apiClient.post.mockRejectedValue({ response: { data: { error: 'Invalid email or password' } } });
    renderLogin();
    fill('a@x.com', 'wrongpw');
    submit();

    await waitFor(() => expect(screen.getByText('Invalid email or password')).toBeInTheDocument());
    expect(window.localStorage.getItem('accessToken')).toBeNull();
  });
});
