import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from '../Dashboard';
import { useAdminStats } from '../../../hooks/useAdminStats';

jest.mock('../../../hooks/useAdminStats');
jest.mock('react-chartjs-2', () => ({
  Doughnut: ({ children, ...p }) => <canvas role={p.role} aria-label={p['aria-label']}>{children}</canvas>,
}));

const renderPage = () => render(<MemoryRouter><AdminDashboard /></MemoryRouter>);

describe('Admin Dashboard', () => {
  it('shows a loading status', () => {
    useAdminStats.mockReturnValue({ isLoading: true });
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading statistics');
  });

  it('shows an error with retry', () => {
    useAdminStats.mockReturnValue({ isLoading: false, error: new Error('x'), refetch: jest.fn() });
    renderPage();
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
  });

  it('renders stats, an accessible chart and quick links', () => {
    useAdminStats.mockReturnValue({
      isLoading: false,
      data: { total_complaints: 10, resolved_count: 5, new_count: 2, in_progress_count: 3, high_urgency_count: 1, avg_resolution_hours: 4 },
    });
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: /Admin Dashboard/ })).toBeInTheDocument();
    expect(screen.getByText('5 of 10 resolved')).toBeInTheDocument();
    expect(screen.getByText('4.0h')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Doughnut chart of complaint status distribution: New 2/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Manage Complaints/ })).toHaveAttribute('href', '/admin/complaints');
    expect(screen.getByTestId('active-range')).toHaveTextContent('All time');
  });

  it('shows the empty state when there are no complaints', () => {
    useAdminStats.mockReturnValue({ isLoading: false, data: { total_complaints: 0 } });
    renderPage();
    expect(screen.getByText('No complaints yet.')).toBeInTheDocument();
  });
});
