const TEXT_LITERAL_PATTERN = /(["'`])((?:(?!\1).)*)\1/g;

export const findTextLiterals = text => [...String(text).matchAll(TEXT_LITERAL_PATTERN)]
  .map(found => ({ at: found.index, length: found[0].length, text: found[2] }));

export const readFirstLiteral = text => (findTextLiterals(text)[0] || {}).text || "";

export const STRING_LITERAL_PATTERN = /"([^"\\]{3,}?)"|'([^'\\]{3,}?)'/g;
