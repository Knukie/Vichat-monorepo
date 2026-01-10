const ROLE_VALUES = new Set(['assistant', 'customer', 'system', 'tool']);

/**
 * @typedef {import('@valki/contracts').Role} Role
 */

/**
 * @param {string} rawRole
 * @returns {Role}
 */
export function normalizeRole(rawRole) {
  if (rawRole === 'bot') return 'assistant';
  if (rawRole === 'user') return 'customer';
  if (ROLE_VALUES.has(rawRole)) return rawRole;
  return 'customer';
}

/**
 * @param {Role} role
 * @returns {boolean}
 */
export function isCustomerRole(role) {
  return role === 'customer';
}
