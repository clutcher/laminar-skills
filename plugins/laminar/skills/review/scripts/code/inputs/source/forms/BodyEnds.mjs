export const BODY_ENDS = Object.freeze({ CLOSING_BRACE: "CLOSING_BRACE", INDENT: "INDENT", CLOSING_MARK: "CLOSING_MARK" });

const readBodyEnd = language => language.bodyEnd || BODY_ENDS.CLOSING_BRACE;

export const areBlocksIndented = language => readBodyEnd(language) === BODY_ENDS.INDENT;

export const doBodiesEndWithoutABrace = language => readBodyEnd(language) !== BODY_ENDS.CLOSING_BRACE;
