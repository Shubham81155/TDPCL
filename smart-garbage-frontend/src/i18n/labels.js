// src/i18n/labels.js
// Display-label helpers for API values. The VALUES (status 'in_progress', category 'plastics',
// urgency 'high') stay English everywhere internally; only the shown text is translated.
// Values the catalog does not know are shown the way the app always showed them.
import { formatComplaintCategory } from '../utils/classificationUtils';

// Lower-cased because the badge CSS (text-transform: capitalize) capitalises it again for English.
export const statusLabel = (t, status) => {
  if (!status) return t('status.unknown').toLowerCase();
  const key = `status.${status}`;
  return t.has(key) ? t(key).toLowerCase() : String(status).replace(/_/g, ' ');
};

export const urgencyLabel = (t, urgency) => {
  const level = urgency ? String(urgency).toLowerCase() : '';
  if (!level) return t('urgency.unknown').toLowerCase();
  return t.has(`urgency.${level}`) ? t(`urgency.${level}`).toLowerCase() : level;
};

// Same text as formatComplaintCategory in English; translated otherwise.
export const categoryLabel = (t, value) => {
  const key = `category.${value}`;
  return value && t.has(key) ? t(key) : formatComplaintCategory(value);
};
