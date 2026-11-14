// src/pages/Citizen/__tests__/ComplaintForm.test.js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ComplaintForm from '../ComplaintForm';
import apiClient from '../../../services/api';
import { getCurrentLocation } from '../../../utils/locationUtils';

jest.mock('../../../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
}));
jest.mock('../../../utils/locationUtils', () => ({
  __esModule: true,
  getCurrentLocation: jest.fn(),
}));
jest.mock('../../../components/common/MapPicker', () => ({
  __esModule: true,
  default: ({ value, onChange }) => (
    <div>
      <button type="button" onClick={() => onChange({ lat: 12.5, lng: 77.25 })}>
        fake-tap-map
      </button>
      <span data-testid="pin">{value ? `${value.lat},${value.lng}` : 'none'}</span>
    </div>
  ),
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
  Toaster: () => null,
}));

const renderForm = () =>
  render(
    <MemoryRouter initialEntries={['/citizen/complaint/new']}>
      <Routes>
        <Route path="/citizen/complaint/new" element={<ComplaintForm />} />
        <Route path="/citizen/complaints" element={<div>my complaints</div>} />
      </Routes>
    </MemoryRouter>
  );

const field = (container, selector) => container.querySelector(selector);
const makeImage = (name = 'p.jpg', type = 'image/jpeg', size) => {
  const file = new File(['x'], name, { type });
  if (size) Object.defineProperty(file, 'size', { value: size });
  return file;
};

beforeEach(() => {
  getCurrentLocation.mockResolvedValue({ latitude: 19.076, longitude: 72.8777 });
  global.URL.createObjectURL = jest.fn(() => 'blob:preview');
});

describe('ComplaintForm', () => {
  it('renders the fields, including description and urgency', async () => {
    const { container } = renderForm();
    expect(await screen.findByText(/photo of issue/i)).toBeInTheDocument();
    expect(field(container, 'textarea[name="description"]')).toBeInTheDocument();
    expect(field(container, 'select[name="urgency_level"]')).toHaveValue('medium');
    expect(screen.getByRole('button', { name: /submit complaint/i })).toBeInTheDocument();
  });

  it('pre-fills coordinates from the detected location', async () => {
    const { container } = renderForm();
    await waitFor(() => expect(field(container, 'input[name="latitude"]')).toHaveValue(19.076));
    expect(field(container, 'input[name="longitude"]')).toHaveValue(72.8777);
  });

  it('puts the photo first and keeps manual coordinates in a collapsed details', async () => {
    const { container } = renderForm();
    expect(await screen.findByText(/take \/ choose a photo/i)).toBeInTheDocument();
    const details = field(container, 'details');
    expect(details).not.toHaveAttribute('open');
    expect(details).toContainElement(field(container, 'input[name="latitude"]'));
    const photo = screen.getByText(/^Photo of Issue/);
    const location = screen.getByText('Location *');
    expect(photo.compareDocumentPosition(location) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('moving the pin updates the coordinate inputs and typing updates the pin', async () => {
    getCurrentLocation.mockRejectedValue(new Error('denied'));
    const { container } = renderForm();
    expect(screen.getByTestId('pin')).toHaveTextContent('none');
    fireEvent.click(screen.getByText('fake-tap-map'));
    expect(field(container, 'input[name="latitude"]')).toHaveValue(12.5);
    expect(field(container, 'input[name="longitude"]')).toHaveValue(77.25);
    fireEvent.change(field(container, 'input[name="latitude"]'), { target: { value: '10.25' } });
    expect(screen.getByTestId('pin')).toHaveTextContent('10.25,77.25');
  });

  it('requires a location and focuses the first invalid field', async () => {
    getCurrentLocation.mockRejectedValue(new Error('denied'));
    renderForm();
    fireEvent.click(await screen.findByRole('button', { name: /submit complaint/i }));
    expect(await screen.findByText(/choose the location on the map/i)).toBeInTheDocument();
    expect(screen.getByText(/image is required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /take \/ choose a photo/i })).toHaveFocus();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('shows a Retake action after a photo is chosen', async () => {
    const { container } = renderForm();
    await screen.findByText(/photo of issue/i);
    fireEvent.change(field(container, 'input[type="file"]'), { target: { files: [makeImage()] } });
    expect(await screen.findByRole('button', { name: /retake/i })).toBeInTheDocument();
    expect(screen.getByAltText(/preview/i)).toBeInTheDocument();
  });

  it('asks for category and photo before submitting', async () => {
    renderForm();
    fireEvent.click(await screen.findByRole('button', { name: /submit complaint/i }));
    expect(await screen.findByText(/image is required/i)).toBeInTheDocument();
    expect(screen.getByText(/category is required/i)).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('rejects images over 10MB', async () => {
    const { container } = renderForm();
    await screen.findByText(/photo of issue/i);
    fireEvent.change(field(container, 'input[type="file"]'), {
      target: { files: [makeImage('big.jpg', 'image/jpeg', 11 * 1024 * 1024)] },
    });
    expect(await screen.findByText(/less than 10mb/i)).toBeInTheDocument();
  });

  it('rejects unsupported file types', async () => {
    const { container } = renderForm();
    await screen.findByText(/photo of issue/i);
    fireEvent.change(field(container, 'input[type="file"]'), {
      target: { files: [makeImage('doc.pdf', 'application/pdf')] },
    });
    expect(await screen.findByText(/only jpeg, png, and gif/i)).toBeInTheDocument();
  });

  it('submits category, description, urgency and image as multipart data', async () => {
    apiClient.post.mockResolvedValue({ data: { message: 'ok' } });
    const { container } = renderForm();
    await waitFor(() => expect(field(container, 'input[name="latitude"]')).toHaveValue(19.076));

    fireEvent.change(field(container, 'select[name="category"]'), { target: { value: 'plastics' } });
    fireEvent.change(field(container, 'textarea[name="description"]'), { target: { value: '  Overflowing bin  ' } });
    fireEvent.change(field(container, 'select[name="urgency_level"]'), { target: { value: 'high' } });
    fireEvent.change(field(container, 'input[type="file"]'), { target: { files: [makeImage()] } });
    fireEvent.click(screen.getByRole('button', { name: /submit complaint/i }));

    expect(await screen.findByText('my complaints')).toBeInTheDocument();
    const [url, body] = apiClient.post.mock.calls[0];
    expect(url).toBe('/complaints');
    expect(body.get('category')).toBe('plastics');
    expect(body.get('description')).toBe('Overflowing bin');
    expect(body.get('urgency_level')).toBe('high');
    expect(body.get('latitude')).toBe('19.076');
    expect(body.get('image')).toBeInstanceOf(File);
  });
});
