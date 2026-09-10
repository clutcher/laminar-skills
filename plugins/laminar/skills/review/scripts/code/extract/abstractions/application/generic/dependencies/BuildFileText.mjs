export const stripComment = (text, marker) => (text.includes(marker) ? text.slice(0, text.indexOf(marker)) : text).trim();

export const findQuotedWords = text => [...text.matchAll(/["']([^"']+)["']/g)].map(found => found[1]);
