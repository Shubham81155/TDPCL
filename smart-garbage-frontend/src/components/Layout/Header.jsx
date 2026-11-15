// src/components/Layout/Header.jsx
import React from 'react';
import { Navbar, Nav, Container, Dropdown } from 'react-bootstrap';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
import ThemeToggle from '../common/ThemeToggle';
import LanguageSwitcher from '../common/LanguageSwitcher';
import './Header.css';

function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDashboardLink = () => {
    if (!user) return '/login';
    return user.role === 'admin' ? '/admin/dashboard' : user.role === 'officer' ? '/officer/dashboard' : '/citizen/dashboard';
  };

  return (
    <Navbar bg="success" expand="lg" sticky="top" className="navbar-dark app-navbar" data-bs-theme="dark">
      <Container>
        <Navbar.Brand as={Link} to={getDashboardLink()} className="fw-bold">
          <i className="fas fa-recycle me-2"></i>
          {t('common.brand')}
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" aria-label={t('nav.toggle')} />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto align-items-lg-center">
            {isAuthenticated ? (
              <>
                {user?.role === 'citizen' && (
                  <>
                    <Nav.Link as={NavLink} to="/citizen/dashboard">
                      {t('nav.dashboard')}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/citizen/complaint/new">
                      {t('nav.reportIssue')}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/citizen/complaints">
                      {t('nav.myComplaints')}
                    </Nav.Link>
                  </>
                )}

                {user?.role === 'officer' && (
                  <>
                    <Nav.Link as={NavLink} to="/officer/dashboard">
                      {t('nav.dashboard')}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/officer/map">
                      {t('nav.mapView')}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/officer/complaints">
                      {t('nav.assignedWork')}
                    </Nav.Link>
                  </>
                )}

                {user?.role === 'admin' && (
                  <>
                    <Nav.Link as={NavLink} to="/admin/dashboard">
                      {t('nav.dashboard')}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/admin/complaints">
                      {t('nav.complaints')}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/admin/officers">
                      {t('nav.officers')}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/admin/wards">
                      {t('nav.wards')}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/admin/map">
                      {t('nav.map')}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/admin/analytics">
                      {t('nav.analytics')}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/admin/reports">
                      {t('nav.reports')}
                    </Nav.Link>
                  </>
                )}

                <LanguageSwitcher className="nav-language-switcher" />
                <ThemeToggle className="nav-theme-toggle" />
                <Dropdown align="end" className="nav-user-menu">
                  <Dropdown.Toggle variant="light" id="user-dropdown">
                    <i className="fas fa-user me-2"></i>
                    {user?.name || user?.email}
                  </Dropdown.Toggle>

                  <Dropdown.Menu>
                    {user?.role === 'officer' && (
                      <>
                        <Dropdown.Item as={Link} to="/officer/profile">
                          <i className="fas fa-cog me-2"></i>
                          {t('nav.profile')}
                        </Dropdown.Item>
                        <Dropdown.Divider />
                      </>
                    )}
                    <Dropdown.Item onClick={handleLogout}>
                      <i className="fas fa-sign-out-alt me-2"></i>
                      {t('nav.logout')}
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </>
            ) : (
              <>
                <Nav.Link as={NavLink} to="/login">
                  {t('nav.login')}
                </Nav.Link>
                <Nav.Link as={NavLink} to="/register">
                  {t('nav.register')}
                </Nav.Link>
                <LanguageSwitcher className="nav-language-switcher" />
                <ThemeToggle className="nav-theme-toggle" />
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Header;
