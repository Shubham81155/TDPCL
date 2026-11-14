// src/hooks/queryUtils.js
import toast from 'react-hot-toast';

export const errorMessage = (err, fallback) => err?.response?.data?.error || fallback;

// onError helper: keeps the toast the pages showed before react-query
export const toastOnError = (fallback) => (err) => toast.error(errorMessage(err, fallback));
