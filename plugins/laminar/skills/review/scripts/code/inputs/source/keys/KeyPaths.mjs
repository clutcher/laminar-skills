export const KEY_TREE_FAMILY = "configuration";

const SEGMENT_PATTERN = /\[[^\]]*\]|[^.[\]]+/g;

export const isAnIndexSegment = segment => String(segment).startsWith("[");

export const formatIndexSegment = index => `[${index}]`;

export const splitKeyPath = text => String(text).trim().match(SEGMENT_PATTERN) || [];

export const formatKeyPath = segments => segments.reduce((joined, segment) => {
  if (!joined) return segment;
  return isAnIndexSegment(segment) ? `${joined}${segment}` : `${joined}.${segment}`;
}, "");
