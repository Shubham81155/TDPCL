// src/hooks/useAdminStats.js
import { useQuery } from 'react-query';
import apiClient from '../services/api';
import toast from 'react-hot-toast';

// params: { dateFrom, dateTo } (optional)
export const useAdminStats = (params = {}) =>
  useQuery(
    ['admin', 'stats', params],
    async () => (await apiClient.get('/admin/stats/complaints', { params })).data.stats || null,
    { onError: () => toast.error('Failed to load statistics') }
  );

export const useAdminAnalytics = (params = {}) =>
  useQuery(
    ['admin', 'analytics', params],
    async () => {
      const [categoryRes, wardRes, officersRes] = await Promise.all([
        apiClient.get('/admin/stats/by-category', { params }),
        apiClient.get('/admin/stats/by-ward', { params }),
        apiClient.get('/admin/stats/officer-performance', { params: { ...params, limit: 10 } }),
      ]);
      return {
        categories: categoryRes.data.data || [],
        wards: wardRes.data.data || [],
        officers: officersRes.data.data || [],
      };
    },
    { onError: () => toast.error('Failed to load analytics') }
  );

