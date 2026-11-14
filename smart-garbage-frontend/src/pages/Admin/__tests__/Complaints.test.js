import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import AdminComplaints from '../Complaints';
import apiClient from '../../../services/api';

jest.mock('../../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
  Toaster: () => null,
}));

const ROWS = [
  { complaint_id: 101, status: 'new', category: 'paper', title: 'A', assigned_officer_id: null, created_at: '2026-02-02T10:00:00Z' },
  { complaint_id: 102, status: 'resolved', category: 'glass', title: 'B', assigned_officer_id: 7, created_at: '2026-02-03T10:00:00Z' },
  { complaint_id: 103, status: 'new', category: 'paper', title: 'C', assigned_officer_id: 7, created_at: '2026-02-04T10:00:00Z' },
];

beforeEach(() => {
  window.sessionStorage.clear();
  apiClient.get.mockImplementation((url) => {
    if (url === '/admin/complaints') return Promise.resolve({ data: { data: ROWS } });
    if (url === '/wards') return Promise.resolve({ data: { data: [{ ward_id: 3, name: 'Ward Three' }] } });
    if (url.startsWith('/officers')) {
      return Promise.resolve({ data: { data: [{ officer_id: 7, name: 'Olive' }] } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
});

const renderPage = (url) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <AdminComplaints />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Admin Complaints preset from query', () => {
  it('presets category, officer, ward and dates from the URL, with removable chips', async () => {
    renderPage('/admin/complaints?category=paper&officer=7&ward=3&from=2026-02-01&to=2026-02-28');
    await waitFor(() => expect(screen.getByText('#103')).toBeInTheDocument());
    expect(screen.queryByText('#101')).not.toBeInTheDocument(); // not assigned to officer 7
    expect(screen.queryByText('#102')).not.toBeInTheDocument(); // glass

    expect(apiClient.get).toHaveBeenCalledWith(
      '/admin/complaints',
      expect.objectContaining({
        params: { ward_id: '3', dateFrom: '2026-02-01', dateTo: '2026-02-28' },
      })
    );
    expect(screen.getByRole('button', { name: /Remove filter Category: Paper/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove filter Officer: Olive/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove filter Ward: Ward Three/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Remove filter Officer/ }));
    await waitFor(() => expect(screen.getByText('#101')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Remove filter Officer/ })).not.toBeInTheDocument();
  });

  it('presets status and keeps the search box and Assign buttons', async () => {
    renderPage('/admin/complaints?status=resolved');
    await waitFor(() => expect(screen.getByText('#102')).toBeInTheDocument());
    expect(screen.queryByText('#101')).not.toBeInTheDocument();
    expect(document.querySelector('input[aria-label*=earch]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reassign complaint 102/ })).toBeInTheDocument();
  });
});
