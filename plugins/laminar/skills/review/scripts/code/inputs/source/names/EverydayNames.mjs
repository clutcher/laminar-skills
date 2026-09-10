const EVERYDAY_NAMES = new Set(["length", "size", "value", "values", "name", "data", "item", "items", "result", "index",
  "count", "keys", "list", "args", "options", "props", "state", "event", "error", "response", "request", "input",
  "output", "text", "other"]);

export const isAnEverydayName = word => EVERYDAY_NAMES.has(word) || EVERYDAY_NAMES.has(word.toLowerCase());
