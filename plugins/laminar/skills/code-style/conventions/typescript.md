# TypeScript

Contents: 1. Types on every function · 2. Names and test names · 3. Fixed versions of dependencies

These are rules of this skill for TypeScript and JavaScript, narrower than the book. Read this file whenever you write TypeScript or JavaScript. Where the project's own CLAUDE.md or its documented conventions say otherwise on a TypeScript matter, follow the project: that override holds for the rules of this file only, never for the directions of the main set.

## 1. Types on every function

Use strict type checking, and write the parameter types and the return type of every function. Never use any. Give a record of known keys a named type, not an untyped map of strings. A signature with no types gives the reader nothing to predict from (methods, section 12).

- Limits: a value whose type truly cannot be known, such as raw outside data before its check at the entry, is unknown, and the entry checks it (correctness, section 8).

## 2. Names and test names

Write names in camel case, in whole words, as the main set says (naming). Name a test in the form should, outcome, when, condition (tests, section 9).

## 3. Fixed versions of dependencies

Pin each dependency to 1 exact version, with no range such as a caret or a tilde. A range lets 2 installs of the same code differ.
