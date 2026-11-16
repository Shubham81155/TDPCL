import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminAnalytics from '../Analytics';
import { useAdminAnalytics } from '../../../hooks/useAdminStats';

jest.mock('../../../hooks/useAdminStats');
jest.mock('react-chartjs-2', () => ({
  Bar: ({ children, ...p }) => <canvas role={p.role} aria-label={p['aria-label']}>{children}</canvas>,
}));

const renderPage = () => render(<MemoryRouter><AdminAnalytics /></MemoryRouter>);

const data = {
  categories: [{ category: 'plastics', count: 4, resolved: 2 }],
  wards: [{ ward_id: 3, name: 'Ward 3', total_complaints: 4, resolved: 2, officer_count: 1 }],
  officers: [{ officer_id: 7, officer_name: 'Ravi', total_complaints: 4, resolved: 2, active: 1, avg_resolution_hours: 3, resolution_rate: 50 }],
};

describe('Admin Analytics', () => {
  it('shows loading and error states', () => {
    useAdminAnalytics.mockReturnValue({ isLoading: true });
    const { unmount } = renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading analytics');
    unmount();
    useAdminAnalytics.mockReturnValue({ isLoading: false, error: new Error('x'), refetch: jest.fn() });
    renderPage();
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
  });

  it('renders labelled charts, links and a card list for narrow screens', () => {
    useAdminAnalytics.mockReturnValue({ isLoading: false, data });
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Analytics' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Bar chart of complaints by ward/ })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Top officers ranked by resolved complaints' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Ravi/ }).length).toBe(2);
    expect(screen.getAllByRole('link', { name: /Ward 3/ })[0]).toHaveAttribute('href', expect.stringContaining('ward=3'));
  });

  it('shows empty states', () => {
    useAdminAnalytics.mockReturnValue({ isLoading: false, data: {} });
    renderPage();
    expect(screen.getAllByText('No data available yet.')).toHaveLength(2);
    expect(screen.getByText('No officer data available yet.')).toBeInTheDocument();
  });
});
