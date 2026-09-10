import { createShortQuote, createTripleQuote } from "./StringForms.mjs";

export const C_COMMENTS = Object.freeze({ lineComments: ["//"], blockComment: { opens: "/*", closes: "*/" } });
export const HASH_COMMENTS = Object.freeze({ lineComments: ["#"], blockComment: null });

export const createForm = (comments, openers, extra = {}) => Object.freeze({ ...comments, openers, ...extra });

export const createTripleQuotedJvmForm = rules => createForm(C_COMMENTS, [createTripleQuote("\"", rules), createShortQuote("\""), createShortQuote("'")]);
