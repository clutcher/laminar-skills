import { WORDS_NEVER_A_TYPE } from "../../../../../inputs/source/text/TypeText.mjs";

export const WORDS_NEVER_A_FIELD_TYPE_PATTERN_SOURCE = [...WORDS_NEVER_A_TYPE].join("|");

export const buildFieldNameReader = fieldPattern => text => (fieldPattern.exec(text) || [])[1] || null;
