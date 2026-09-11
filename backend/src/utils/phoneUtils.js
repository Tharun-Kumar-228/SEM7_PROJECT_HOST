/**
 * Normalizes phone numbers to a consistent digit format.
 * Strips non-digit characters and standardizes Indian (+91/91/0) and international phone numbers.
 * @param {string} phone 
 * @returns {string} Normalized phone number digit string
 */
function normalizePhone(phone) {
  if (!phone) return '';
  let digits = String(phone).trim().replace(/\D/g, '');
  
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  
  return digits;
}

module.exports = { normalizePhone };

