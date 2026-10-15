# Python

Contents: 1. Type hints everywhere · 2. Names and test names

These are rules of this skill for Python, narrower than the book. Read this file whenever you write Python.

## 1. Type hints everywhere

Write type hints on every parameter and every return value. Give a record of known keys a named type, such as a data class, not a dictionary of strings. A signature with no types gives the reader nothing to predict from (methods, section 12).

## 2. Names and test names

Write names in snake case, in whole words, as the main set says (naming). Name a test in the form should, outcome, when, condition, such as a name that starts with should or with test and then should (tests, section 9).
