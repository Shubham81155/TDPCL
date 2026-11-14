// src/hooks/useComplaints.js
import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient from '../services/api';
import { toastOnError } from './queryUtils';

export const complaintKeys = {
  mine: ['complaints', 'mine'],
  assigned: ['complaints', 'assigned'],
  admin: ['admin', 'complaints'],
  officers: ['admin', 'active-officers'],
};

// Citizen's own complaints (dashboard + tracker share this cache entry)
export const useMyComplaints = (opts = {}) =>
  useQuery(
    complaintKeys.mine,
    async () => (await apiClient.get('/complaints')).data.data || [],
    { staleTime: 0, onError: toastOnError('Failed to load complaints'), ...opts }
  );

// Officer's assigned complaints
export const useAssignedComplaints = (opts = {}) =>
  useQuery(
    complaintKeys.assigned,
    async () => (await apiClient.get('/complaints/officer/assigned')).data.data || [],
    { staleTime: 0, ...opts }
  );

export const useAdminComplaints = () =>
  useQuery(
    complaintKeys.admin,
    async () => (await apiClient.get('/admin/complaints')).data?.data || [],
    { onError: toastOnError('Failed to load complaints') }
  );

export const useActiveOfficers = () =>
  useQuery(
    complaintKeys.officers,
    async () => (await apiClient.get('/officers?status=active')).data?.data || [],
    { onError: toastOnError('Failed to load officers') }
  );

// Anything that changes complaint data should refresh every list/stat derived from it
export const useInvalidateComplaintData = () => {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries('complaints'),
      qc.invalidateQueries('admin'),
      qc.invalidateQueries('wards'),
    ]);
};

export const useAssignComplaint = () => {
  const invalidate = useInvalidateComplaintData();
  return useMutation(
    ({ complaintId, officerId }) =>
      apiClient.post(`/assignments/assign/${complaintId}`, { officer_id: Number(officerId) }),
    { onSuccess: invalidate }
  );
};

export const useUpdateComplaintStatus = () => {
  const invalidate = useInvalidateComplaintData();
  return useMutation(
    ({ complaintId, status }) => apiClient.patch(`/complaints/${complaintId}/status`, { status }),
    { onSuccess: invalidate }
  );
};
