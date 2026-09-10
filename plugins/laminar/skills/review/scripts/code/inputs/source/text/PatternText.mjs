export const escapeForAPattern = text => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const ASSIGNING_EQUALS_SIGN_PATTERN_SOURCE = "=(?![=>])";

export const buildWholeWordShapePattern = (shape, flags = "") => new RegExp(`(?<![\\w$])(?:${shape})(?![\\w$])`, flags);

export const buildWholeWordPattern = (word, flags = "") => buildWholeWordShapePattern(escapeForAPattern(word), flags);
