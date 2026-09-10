import { COMMENT_LINE_FORMS, isACommentLine } from "../forms/CommentForms.mjs";

export const isANonBlankCodeLine = text => Boolean(text.trim()) && !isACommentLine(text);

const isOutsideACStyleOrHashComment = text => !isACommentLine(String(text ?? ""), COMMENT_LINE_FORMS.C_STYLE_AND_HASH);

export const isACodeLineCarryingAMark = (text, marks) => isOutsideACStyleOrHashComment(text) && marks.some(mark => mark.test(String(text ?? "")));
