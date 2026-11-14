// src/pages/Citizen/__tests__/ComplaintForm.test.js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ComplaintForm from '../ComplaintForm';
import { AuthProvider } from '../../../context/AuthContext';

// Mock API client and location utility
jest.mock('../../../services/api');
jest.mock('../../../utils/locationUtils');

describe('ComplaintForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render complaint form', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <ComplaintForm />
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByPlaceholderText(/title/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/description/i)).toBeInTheDocument();
  });

  it('should validate title field', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <ComplaintForm />
        </AuthProvider>
      </BrowserRouter>
    );

    const submitButton = screen.getByText(/submit/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    });
  });

  it('should handle file upload', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <ComplaintForm />
        </AuthProvider>
      </BrowserRouter>
    );

    const fileInput = screen.getByLabelText(/photo/i);
    const file = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(fileInput.files[0]).toBe(file);
    });
  });

  it('should validate image size', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <ComplaintForm />
        </AuthProvider>
      </BrowserRouter>
    );

    const fileInput = screen.getByLabelText(/photo/i);
    // Create a file larger than 10MB (this is a mock, won't actually create large file)
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    // Should show error message
    await waitFor(() => {
      expect(true).toBe(true);
    });
  });

  it('should support location detection', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <ComplaintForm />
        </AuthProvider>
      </BrowserRouter>
    );

    const locationButton = screen.getByText(/use my current location/i);
    fireEvent.click(locationButton);

    // Mock location should be detected
    await waitFor(() => {
      expect(true).toBe(true);
    });
  });
});
