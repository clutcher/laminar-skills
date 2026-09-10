export const NO_COMMENT_FORMS = Object.freeze({ lineForms: [], blockForms: [] });

export const createBlockForm = (opens, closes) => ({ opens, closes });

export const SLASH_STAR = createBlockForm("/*", "*/");

export const createForms = (lineForms, blockForms) => Object.freeze({ lineForms, blockForms: blockForms || [] });

export const C_FAMILY = createForms(["//"], [SLASH_STAR]);

export const HASH_ONLY = createForms(["#"]);

const buildCommentLinePattern = ({ attributesAreCode, sqlAndLispComments }) => new RegExp(`^\\s*(?:\\/\\/|\\/\\*|\\*|#${attributesAreCode ? "(?!\\[)" : ""}${sqlAndLispComments ? "|--|;;" : ""})`);

export const COMMENT_LINE_FORMS = Object.freeze({
  ANY_LANGUAGE: buildCommentLinePattern({ attributesAreCode: false, sqlAndLispComments: true }),
  ATTRIBUTES_ARE_CODE: buildCommentLinePattern({ attributesAreCode: true, sqlAndLispComments: true }),
  C_STYLE_AND_HASH: buildCommentLinePattern({ attributesAreCode: true, sqlAndLispComments: false }),
});

export const isACommentLine = (text, form = COMMENT_LINE_FORMS.ANY_LANGUAGE) => form.test(text);
