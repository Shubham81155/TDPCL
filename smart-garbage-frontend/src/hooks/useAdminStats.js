// src/hooks/useAdminStats.js
import { useQuery } from 'react-query';
import apiClient from '../services/api';
import toast from 'react-hot-toast';

export const useAdminStats = () =>
  useQuery(
    ['admin', 'stats'],
    async () => (await apiClient.get('/admin/stats/complaints')).data.stats || null,
    { onError: () => toast.error('Failed to load statistics') }
  );

export const useAdminAnalytics = () =>
  useQuery(
    ['admin', 'analytics'],
    async () => {
      const [categoryRes, wardRes, officersRes] = await Promise.all([
        apiClient.get('/admin/stats/by-category'),
        apiClient.get('/admin/stats/by-ward'),
        apiClient.get('/admin/stats/officer-performance?limit=10'),
      ]);
      return {
        categories: categoryRes.data.data || [],
        wards: wardRes.data.data || [],
        officers: officersRes.data.data || [],
      };
    },
    { onError: () => toast.error('Failed to load analytics') }
  );

