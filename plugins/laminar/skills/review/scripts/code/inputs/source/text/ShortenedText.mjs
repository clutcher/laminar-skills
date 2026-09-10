const MAX_LINE_TEXT = 120;

export const shortenText = text => (text.length > MAX_LINE_TEXT ? text.slice(0, MAX_LINE_TEXT) + " …" : text);
