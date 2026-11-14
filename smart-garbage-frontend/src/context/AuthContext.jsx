// src/context/AuthContext.jsx
// Global Authentication Context

import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        setAccessToken(storedToken);
        setUser(JSON.parse(storedUser));
        setRefreshToken(localStorage.getItem('refreshToken'));
      } catch (error) {
        console.error('Failed to restore session:', error);
        localStorage.clear();
      }
    }

    setIsLoading(false);
  }, []);

  const login = (userData, accessToken, refreshToken) => {
    setUser(userData);
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);

    // Persist to localStorage
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.clear();
  };

  const value = {
    user,
    accessToken,
    refreshToken,
    isLoading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
