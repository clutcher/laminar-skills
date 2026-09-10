export const FUNCTION_VALUE_PATTERN_SOURCE = "\\s*(?:async\\s+)?(?:function\\b|\\([^)]*\\)?\\s*(?::[^=]+)?=>|\\([^)]*$|[\\w$]+\\s*=>|<)";

export const FUNCTION_VALUE_PATTERN = new RegExp(`^${FUNCTION_VALUE_PATTERN_SOURCE}`);
