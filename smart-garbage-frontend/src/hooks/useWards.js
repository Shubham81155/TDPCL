// src/hooks/useWards.js
import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient from '../services/api';
import { toastOnError } from './queryUtils';

export const useWards = () =>
  useQuery(['wards'], async () => (await apiClient.get('/wards')).data.data || [], {
    onError: toastOnError('Failed to load wards'),
  });

// payload: { id?, body } - PUT when id is present, POST otherwise
export const useSaveWard = () => {
  const qc = useQueryClient();
  return useMutation(
    ({ id, body }) => (id ? apiClient.put(`/wards/${id}`, body) : apiClient.post('/wards', body)),
    {
      onSuccess: () =>
        Promise.all([qc.invalidateQueries('wards'), qc.invalidateQueries(['admin', 'analytics'])]),
    }
  );
};
