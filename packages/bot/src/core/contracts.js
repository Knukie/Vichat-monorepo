/**
 * Canonical backend contracts (Phase 1.1)
 */

/** @typedef {import("@valki/contracts").Role} Role */
/** @typedef {import("@valki/contracts").ImageMeta} ImageMeta */
/** @typedef {import("@valki/contracts").Message} Message */

export const ROLE_VALUES = /** @type {const} */ ([
  "assistant",
  "customer",
  "system",
  "tool"
]);

const ROLE_SET = new Set(ROLE_VALUES);

/** @param {string} rawRole @returns {Role} */
export function normalizeRole(rawRole) {
  if (rawRole === "user") return "customer";
  if (ROLE_SET.has(rawRole)) return rawRole;
  return "customer";
}

export const CONVERSATION_STATUS_VALUES = /** @type {const} */ (["open", "pending", "closed"]);

/** @typedef {typeof CONVERSATION_STATUS_VALUES[number]} ConversationStatus */

export const USER_ROLE_VALUES = /** @type {const} */ ([
  "customer",
  "agent",
  "assistant",
  "admin"
]);

/** @typedef {typeof USER_ROLE_VALUES[number]} UserRole */

export const USER_STATUS_VALUES = /** @type {const} */ (["online", "offline", "away"]);

/** @typedef {typeof USER_STATUS_VALUES[number]} UserStatus */

/**
 * @typedef {Object} Message
 * @property {string} id
 * @property {string} conversationId
 * @property {Role} role
 * @property {string} content
 * @property {ImageMeta[]} images
 * @property {string} ts
 */

/**
 * @typedef {Object} Conversation
 * @property {string} id
 * @property {string | null} summary
 * @property {ConversationStatus} status
 * @property {string | null} assignedAgentId
 * @property {string | null} departmentId
 * @property {string | null} lastMessageAt
 */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {UserRole} role
 * @property {string | null} displayName
 * @property {string | null} avatarUrl
 * @property {UserStatus} status
 */
