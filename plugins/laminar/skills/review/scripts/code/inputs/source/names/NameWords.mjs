const WORD_PATTERN = /[A-Z]+(?![a-z])|[A-Z][a-z0-9]+|[a-z0-9]+/g;

export const splitNameWords = name => [...String(name || "").matchAll(WORD_PATTERN)].map(match => match[0].toLowerCase());
