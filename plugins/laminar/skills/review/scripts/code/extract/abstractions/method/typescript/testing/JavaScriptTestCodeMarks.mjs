export const JAVASCRIPT_TEST_STRUCTURE_MARKS = Object.freeze({
  setupMarkers: [/(?<![\w.])before(?:Each|All)\s*\(/],
  testOpeners: [/(?<![\w.])(?:it|test)\s*\(\s*["'`]/],
});

export const JAVASCRIPT_MOCK_FUNCTION_MARKS = Object.freeze({
  interactionAssertions: [/\btoHaveBeenCalled/],
  substitutesReturningSubstitutes: [/\bmock(?:Resolved)?ReturnValue(?:Once)?\s*\(\s*(?:(?:jest|vi)\.fn\b|mock\w*\s*[<(]|\{[^}]*\b(?:jest|vi)\.fn\b)/],
});
