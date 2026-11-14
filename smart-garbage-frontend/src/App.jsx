// src/App.jsx
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider, useTranslation } from './i18n/LanguageContext';

// Layout Components
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoadingState from './components/common/LoadingState';

// Auth Pages
const LoginPage = lazy(() => import('./pages/Auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/Auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/Auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/Auth/ResetPasswordPage'));

// Citizen Pages
const CitizenDashboard = lazy(() => import('./pages/Citizen/Dashboard'));
const ComplaintForm = lazy(() => import('./pages/Citizen/ComplaintForm'));
const ComplaintTracker = lazy(() => import('./pages/Citizen/ComplaintTracker'));
const ComplaintDetails = lazy(() => import('./pages/Citizen/ComplaintDetails'));

// Officer Pages
const OfficerDashboard = lazy(() => import('./pages/Officer/Dashboard'));
const OfficerMap = lazy(() => import('./pages/Officer/Map'));
const AssignedComplaints = lazy(() => import('./pages/Officer/AssignedComplaints'));
const OfficerProfile = lazy(() => import('./pages/Officer/Profile'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/Admin/Dashboard'));
const AdminComplaints = lazy(() => import('./pages/Admin/Complaints'));
const AdminOfficers = lazy(() => import('./pages/Admin/Officers'));
const AdminWards = lazy(() => import('./pages/Admin/Wards'));
const AdminAnalytics = lazy(() => import('./pages/Admin/Analytics'));
const AdminMap = lazy(() => import('./pages/Admin/ComplaintsMap'));
const AdminReports = lazy(() => import('./pages/Admin/Reports'));

// 404 Page
const NotFound = lazy(() => import('./pages/NotFound'));

function AppContent() {
  const { isLoading } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">{t('common.loadingDots')}</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <a href="#main-content" className="skip-link visually-hidden-focusable">
        {t('common.skipToContent')}
      </a>
      <Toaster
        position="bottom-center"
        gutter={8}
        containerStyle={{ bottom: 80 }}
        toastOptions={{ duration: 4000, className: 'app-toast' }}
      />
      <div className="d-flex flex-column min-vh-100">
        <Header />
        <main id="main-content" tabIndex={-1} className="flex-grow-1 py-4">
          <ErrorBoundary>
          <Suspense fallback={<LoadingState label={t('common.loadingPage')} fullPage />}>
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
              path="/admin/map"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminMap />
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
          </Suspense>
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
