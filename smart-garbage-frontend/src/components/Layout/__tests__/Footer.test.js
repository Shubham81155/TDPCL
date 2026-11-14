import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from '../Footer';

const KEYS = [
  'REACT_APP_SUPPORT_EMAIL',
  'REACT_APP_SUPPORT_PHONE',
  'REACT_APP_SOCIAL_FACEBOOK',
  'REACT_APP_SOCIAL_LINKEDIN',
];
const saved = {};
beforeEach(() =>
  KEYS.forEach((k) => {
    saved[k] = process.env[k];
    delete process.env[k];
  })
);
afterEach(() =>
  KEYS.forEach((k) => {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  })
);

const renderFooter = () =>
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>
  );

describe('Footer', () => {
  it('has no placeholder contacts or dead entries by default', () => {
    const { container } = renderFooter();
    expect(container).not.toHaveTextContent('1234567890');
    expect(container).not.toHaveTextContent('support@smartgarbage.in');
    ['About', 'Contact', 'Privacy Policy', 'Terms of Service'].forEach((t) =>
      expect(screen.queryByText(t)).not.toBeInTheDocument()
    );
    expect(container.querySelector('a[href^="mailto:"], a[href^="tel:"], a[target="_blank"]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(container).toHaveTextContent(`${new Date().getFullYear()} Smart Garbage System`);
  });

  it('shows env-configured contacts and socials', () => {
    process.env.REACT_APP_SUPPORT_EMAIL = 'help@example.org';
    process.env.REACT_APP_SUPPORT_PHONE = '+1 555 0100';
    process.env.REACT_APP_SOCIAL_FACEBOOK = 'https://facebook.com/x';
    renderFooter();
    expect(screen.getByRole('link', { name: /help@example.org/ })).toHaveAttribute('href', 'mailto:help@example.org');
    expect(screen.getByRole('link', { name: /555 0100/ })).toHaveAttribute('href', 'tel:+15550100');
    expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', 'https://facebook.com/x');
    expect(screen.queryByRole('link', { name: 'LinkedIn' })).not.toBeInTheDocument();
  });
});
