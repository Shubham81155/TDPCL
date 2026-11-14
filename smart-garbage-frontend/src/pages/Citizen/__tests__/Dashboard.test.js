import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import CitizenDashboard from '../Dashboard';
import apiClient from '../../../services/api';

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

const mk = (id, status) => ({ complaint_id: id, status, category: 'garbage', area: 'Ward 1' });

const mockApi = ({ list, summary }) => {
  apiClient.get.mockImplementation((url) => {
    if (url === '/complaints') return Promise.resolve({ data: { data: list } });
    if (url === '/complaints/summary') {
      return summary ? Promise.resolve({ data: { success: true, summary } }) : Promise.reject(new Error('404'));
    }
    return Promise.reject(new Error('unexpected ' + url));
  });
};

const renderDash = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CitizenDashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const countFor = (label) => within(screen.getByText(label).closest('.card')).getByRole('heading', { level: 3 });

describe('Citizen Dashboard', () => {
  afterEach(() => jest.clearAllMocks());

  it('uses the server summary rather than the (capped) list', async () => {
    mockApi({
      list: [mk(1, 'new'), mk(2, 'resolved')],
      summary: { total: 57, pending: 30, in_progress: 10, resolved: 15, rejected: 2 },
    });
    renderDash();
    await waitFor(() => expect(countFor('Total')).toHaveTextContent('57'));
    expect(countFor('Pending')).toHaveTextContent('30');
    expect(countFor('In Progress')).toHaveTextContent('10');
    expect(countFor('Resolved')).toHaveTextContent('15');
    expect(screen.getByText(/2 rejected/)).toBeInTheDocument();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('falls back to counting the list when the summary endpoint is unavailable', async () => {
    mockApi({
      list: [mk(1, 'new'), mk(2, 'assigned'), mk(3, 'in_progress'), mk(4, 'resolved'), mk(5, 'rejected')],
      summary: null,
    });
    renderDash();
    await waitFor(() => expect(countFor('Total')).toHaveTextContent('5'));
    expect(countFor('Pending')).toHaveTextContent('2');
    expect(countFor('In Progress')).toHaveTextContent('1');
    expect(countFor('Resolved')).toHaveTextContent('1');
    expect(screen.getByText(/1 rejected/)).toBeInTheDocument();
  });

  it('guides a brand new citizen', async () => {
    mockApi({ list: [], summary: { total: 0, pending: 0, in_progress: 0, resolved: 0, rejected: 0 } });
    renderDash();
    expect(await screen.findByText('How it works')).toBeInTheDocument();
    expect(screen.getByText(/1\. Take a photo/)).toBeInTheDocument();
    expect(screen.getByText(/2\. Pin the location/)).toBeInTheDocument();
    expect(screen.getByText(/3\. Track progress/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Report your first issue/ }).length).toBeGreaterThan(0);
  });
});
