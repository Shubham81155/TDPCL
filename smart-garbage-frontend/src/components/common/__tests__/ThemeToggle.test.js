import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../../../context/ThemeContext';
import ThemeToggle from '../ThemeToggle';

describe('ThemeToggle', () => {
  it('has an accessible name and cycles system -> light -> dark -> system', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', expect.stringMatching(/Theme: System/));
    expect(btn).toHaveAttribute('title');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-label', expect.stringMatching(/Theme: Light/));
    expect(btn.querySelector('.fa-sun')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-label', expect.stringMatching(/Theme: Dark/));
    expect(btn.querySelector('.fa-moon')).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-label', expect.stringMatching(/Theme: System/));
  });
});
