const PRIVATE_WORD_PATTERN = /(^|[^\w$])(private|internal|fileprivate)([^\w$]|$)/;

export const hasAPrivateWord = text => PRIVATE_WORD_PATTERN.test(String(text || ""));
