// src/utils/email.js
// Email addresses are case-insensitive in practice (one mailbox, however it is typed), so accounts are
// stored and matched in lower case. Non-strings pass through so validation can still reject them.
const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : email);

module.exports = { normalizeEmail };
