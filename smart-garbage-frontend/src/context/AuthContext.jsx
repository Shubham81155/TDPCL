// src/context/AuthContext.jsx
// Global Authentication Context

import React, { createContext, useState, useContext, useEffect } from 'react';
import * as tokenStorage from '../services/tokenStorage';
import { queryClient } from '../queryClient';

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

  // Restore session from storage on mount
  useEffect(() => {
    const storedToken = tokenStorage.getAccessToken();
    const storedUser = tokenStorage.getUser();

    if (storedToken && storedUser) {
      setAccessToken(storedToken);
      setUser(storedUser);
      setRefreshToken(tokenStorage.getRefreshToken());
    } else if (storedToken || storedUser) {
      tokenStorage.clearAuth();
    }

    setIsLoading(false);
  }, []);

  const login = (userData, accessToken, refreshToken) => {
    queryClient.clear(); // never leak one user's cached data to the next session
    setUser(userData);
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);

    tokenStorage.setUser(userData);
    tokenStorage.setTokens(accessToken, refreshToken);
  };

  const logout = () => {
    queryClient.clear();
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    tokenStorage.clearAuth();
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
