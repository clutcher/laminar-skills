export const BLANK_PATTERN_SOURCE = "[[:blank:]]";
export const IDENTIFIER_PATTERN_SOURCE = "[A-Za-z_][A-Za-z0-9_]*";

export const CONTROL_WORD_PATTERN_SOURCE = "if|for|while|switch|catch|return|else|do|try|throw|await|yield|new";

export const rejectStatements = (...words) => `!^${BLANK_PATTERN_SOURCE}*(${[CONTROL_WORD_PATTERN_SOURCE, ...words].join("|")})(${BLANK_PATTERN_SOURCE}|\\(|$)`;
export const buildCaselessPattern = word => [...word].map(c => `[${c.toUpperCase()}${c}]`).join("");
