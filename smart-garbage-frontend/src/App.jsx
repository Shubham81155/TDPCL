// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';

// Layout Components
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import ProtectedRoute from './components/ProtectedRoute';

// Auth Pages
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import ForgotPasswordPage from './pages/Auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/Auth/ResetPasswordPage';

// Citizen Pages
import CitizenDashboard from './pages/Citizen/Dashboard';
import ComplaintForm from './pages/Citizen/ComplaintForm';
import ComplaintTracker from './pages/Citizen/ComplaintTracker';
import ComplaintDetails from './pages/Citizen/ComplaintDetails';

// Officer Pages
import OfficerDashboard from './pages/Officer/Dashboard';
import OfficerMap from './pages/Officer/Map';
import AssignedComplaints from './pages/Officer/AssignedComplaints';
import OfficerProfile from './pages/Officer/Profile';

// Admin Pages
import AdminDashboard from './pages/Admin/Dashboard';
import AdminComplaints from './pages/Admin/Complaints';
import AdminOfficers from './pages/Admin/Officers';
import AdminWards from './pages/Admin/Wards';
import AdminAnalytics from './pages/Admin/Analytics';
import AdminReports from './pages/Admin/Reports';

// 404 Page
import NotFound from './pages/NotFound';

function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-right" />
      <div className="d-flex flex-column min-vh-100">
        <Header />
        <main className="flex-grow-1 py-4">
          <Routes>
            {/* Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Citizen Routes */}
            <Route
              path="/citizen/dashboard"
              element={
                <ProtectedRoute requiredRole="citizen">
                  <CitizenDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/complaint/new"
              element={
                <ProtectedRoute requiredRole="citizen">
                  <ComplaintForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/complaints"
              element={
                <ProtectedRoute requiredRole="citizen">
                  <ComplaintTracker />
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/complaint/:id"
              element={
                <ProtectedRoute requiredRole="citizen">
                  <ComplaintDetails />
                </ProtectedRoute>
              }
            />

            {/* Officer Routes */}
            <Route
              path="/officer/dashboard"
              element={
                <ProtectedRoute requiredRole="officer">
                  <OfficerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/officer/map"
              element={
                <ProtectedRoute requiredRole="officer">
                  <OfficerMap />
                </ProtectedRoute>
              }
            />
            <Route
              path="/officer/complaints"
              element={
                <ProtectedRoute requiredRole="officer">
                  <AssignedComplaints />
                </ProtectedRoute>
              }
            />
            <Route
              path="/officer/profile"
              element={
                <ProtectedRoute requiredRole="officer">
                  <OfficerProfile />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/complaints"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminComplaints />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/officers"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminOfficers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/wards"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminWards />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminReports />
                </ProtectedRoute>
              }
            />

            {/* Default Routes */}
            <Route path="/" element={<Navigate to="/citizen/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
