/**
 * Canonical backend contracts (Phase 1.1)
 *
 * TODO: Normalize legacy roles ("user") to "customer" when standardizing API responses.
 * TODO: Align id fields to UUIDs in runtime responses (messages/users) in later phases.
 */

export const ROLE_VALUES = /** @type {const} */ ([
  "customer",
  "agent",
  "assistant",
  "system",
  "bot"
]);

/** @typedef {typeof ROLE_VALUES[number]} Role */

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
 * @typedef {Object} ImageMeta
 * @property {string} url
 * @property {string} type
 * @property {string=} name
 * @property {number=} size
 * @property {string=} host
 */

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
