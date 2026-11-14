// src/components/Layout/Header.jsx
import React from 'react';
import { Navbar, Nav, Container, Dropdown } from 'react-bootstrap';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

function Header() {
  const { user, logout, isAuthenticated } = useAuth();
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
    <Navbar bg="success" expand="lg" sticky="top" className="navbar-dark">
      <Container>
        <Navbar.Brand as={Link} to={getDashboardLink()} className="fw-bold">
          <i className="fas fa-recycle me-2"></i>
          Smart Garbage System
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" aria-label="Toggle navigation" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            {isAuthenticated ? (
              <>
                {user?.role === 'citizen' && (
                  <>
                    <Nav.Link as={NavLink} to="/citizen/dashboard">
                      Dashboard
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/citizen/complaint/new">
                      Report Issue
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/citizen/complaints">
                      My Complaints
                    </Nav.Link>
                  </>
                )}

                {user?.role === 'officer' && (
                  <>
                    <Nav.Link as={NavLink} to="/officer/dashboard">
                      Dashboard
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/officer/map">
                      Map View
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/officer/complaints">
                      Assigned Work
                    </Nav.Link>
                  </>
                )}

                {user?.role === 'admin' && (
                  <>
                    <Nav.Link as={NavLink} to="/admin/dashboard">
                      Dashboard
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/admin/complaints">
                      Complaints
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/admin/officers">
                      Officers
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/admin/wards">
                      Wards
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/admin/analytics">
                      Analytics
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/admin/reports">
                      Reports
                    </Nav.Link>
                  </>
                )}

                <Dropdown align="end">
                  <Dropdown.Toggle variant="light" id="user-dropdown">
                    <i className="fas fa-user me-2"></i>
                    {user?.name || user?.email}
                  </Dropdown.Toggle>

                  <Dropdown.Menu>
                    {user?.role === 'officer' && (
                      <>
                        <Dropdown.Item as={Link} to="/officer/profile">
                          <i className="fas fa-cog me-2"></i>
                          Profile
                        </Dropdown.Item>
                        <Dropdown.Divider />
                      </>
                    )}
                    <Dropdown.Item onClick={handleLogout}>
                      <i className="fas fa-sign-out-alt me-2"></i>
                      Logout
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </>
            ) : (
              <>
                <Nav.Link as={NavLink} to="/login">
                  Login
                </Nav.Link>
                <Nav.Link as={NavLink} to="/register">
                  Register
                </Nav.Link>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Header;
