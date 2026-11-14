import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../../context/ThemeContext';
import { LanguageProvider } from '../../../i18n/LanguageContext';
import Header from '../../Layout/Header';

let mockAuth;
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => mockAuth }));

const renderHeader = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>
  );

const DEVANAGARI = /[ऀ-ॿ]/;

describe('LanguageSwitcher in the Header', () => {
  it('is visible when logged out and offers English / हिन्दी', () => {
    mockAuth = { user: null, isAuthenticated: false, logout: jest.fn() };
    renderHeader();
    const select = screen.getByRole('combobox', { name: 'Language' });
    expect(select).toHaveValue('en');
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'हिन्दी' })).toBeInTheDocument();
  });

  it('switches the header text to Hindi and back', () => {
    mockAuth = { user: null, isAuthenticated: false, logout: jest.fn() };
    renderHeader();
    expect(screen.getByText('Login')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'hi' } });
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
    expect(screen.getByText('लॉगिन')).toBeInTheDocument();
    expect(screen.getByText('पंजीकरण').textContent).toMatch(DEVANAGARI);
    expect(screen.getByRole('combobox', { name: 'भाषा' })).toHaveValue('hi');
    // brand stays English; theme toggle label is translated
    expect(screen.getByText('Smart Garbage System')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^थीम:/ })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('hi');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } });
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Theme:/ })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('shows the switcher for logged-in citizens too', () => {
    mockAuth = { user: { role: 'citizen', name: 'Asha' }, isAuthenticated: true, logout: jest.fn() };
    renderHeader();
    expect(screen.getByText('My Complaints')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'hi' } });
    expect(screen.getByText('मेरी शिकायतें')).toBeInTheDocument();
  });
});
