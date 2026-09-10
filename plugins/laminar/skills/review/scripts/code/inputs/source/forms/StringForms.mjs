export const createTextFrame = (closes, rules) => ({ holdsText: true, closes, ...rules });

export const createDelimitedOpener = (opens, closes, rules = {}) => ({
  opensAt: (text, at) => (text.startsWith(opens, at) ? { length: opens.length, frame: createTextFrame(closes, rules) } : null),
});

export const createMatchedOpener = (pattern, frameOf) => ({
  opensAt(text, at) {
    pattern.lastIndex = at;
    const found = pattern.exec(text);
    return found ? { length: found[0].length, frame: frameOf(found) } : null;
  },
});

export const MULTI_LINE = Object.freeze({ spansLines: true, escapes: true });
export const RAW_MULTI_LINE = Object.freeze({ spansLines: true, escapes: false });
const ONE_LINE = Object.freeze({ spansLines: false, escapes: true });

export const createShortQuote = quote => createDelimitedOpener(quote, quote, ONE_LINE);
export const createTripleQuote = (quote, rules) => createDelimitedOpener(quote.repeat(3), quote.repeat(3), rules);

export const createHeredocFrame = terminator => ({ holdsText: true, heredoc: true, terminator });
