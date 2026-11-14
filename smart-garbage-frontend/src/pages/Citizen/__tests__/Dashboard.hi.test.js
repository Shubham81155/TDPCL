import { screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import CitizenDashboard from '../Dashboard';
import apiClient from '../../../services/api';
import { renderWithI18n } from '../../../test-utils';

jest.mock('../../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
  Toaster: () => null,
}));
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Asha' } }),
}));

const mockApi = ({ list, summary }) => {
  apiClient.get.mockImplementation((url) => {
    if (url === '/complaints') return Promise.resolve({ data: { data: list } });
    if (url === '/complaints/summary') return Promise.resolve({ data: { success: true, summary } });
    return Promise.reject(new Error('unexpected ' + url));
  });
};

const renderDash = (lang) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithI18n(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CitizenDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
    { lang }
  );
};

describe('Citizen Dashboard in Hindi', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows Devanagari labels while the numbers and status values stay intact', async () => {
    mockApi({
      list: [{ complaint_id: 7, status: 'in_progress', category: 'plastics', area: 'वार्ड 1' }],
      summary: { total: 57, pending: 30, in_progress: 10, resolved: 15, rejected: 2 },
    });
    renderDash('hi');

    expect(screen.getByText('स्वागत है, Asha!')).toBeInTheDocument();
    expect(screen.getAllByText('नई समस्या दर्ज करें', { selector: 'button' })).toHaveLength(2);
    expect(screen.queryByText('Report New Issue')).not.toBeInTheDocument();

    const total = await screen.findByText('कुल');
    await waitFor(() => expect(within(total.closest('.card')).getByRole('heading', { level: 3 })).toHaveTextContent('57'));
    expect(screen.getByText('लंबित')).toBeInTheDocument();
    expect(screen.getByText('कार्य जारी', { selector: 'h6' })).toBeInTheDocument();
    expect(screen.getByText('निपटाई गई', { selector: 'h6' })).toBeInTheDocument();
    expect(screen.getByText('इसमें 2 अस्वीकृत शामिल')).toBeInTheDocument();
    expect(screen.getByText('हाल की गतिविधि')).toBeInTheDocument();

    // recent complaint: translated category and status badge, English value kept in the CSS class
    expect(await screen.findByText(/प्लास्टिक/)).toBeInTheDocument();
    const badge = screen.getByText('कार्य जारी', { selector: '.badge' });
    expect(badge).toHaveClass('status-in_progress');
  });

  it('shows the Hindi onboarding steps for a new citizen', async () => {
    mockApi({ list: [], summary: { total: 0, pending: 0, in_progress: 0, resolved: 0, rejected: 0 } });
    renderDash('hi');
    expect(await screen.findByText('यह कैसे काम करता है')).toBeInTheDocument();
    expect(screen.getByText(/1\. फोटो खींचें/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /अपनी पहली शिकायत दर्ज करें/ }).length).toBeGreaterThan(0);
  });

  it('is unchanged in English', async () => {
    mockApi({ list: [], summary: { total: 0, pending: 0, in_progress: 0, resolved: 0, rejected: 0 } });
    renderDash('en');
    expect(await screen.findByText('How it works')).toBeInTheDocument();
    expect(screen.getByText('Welcome, Asha!')).toBeInTheDocument();
  });
});
