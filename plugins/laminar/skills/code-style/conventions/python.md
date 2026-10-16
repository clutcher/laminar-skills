# Python

Contents: 1. Type hints everywhere · 2. Names and test names · 3. Wiring of a module

These are rules of this skill for Python, narrower than the book. Read this file whenever you write Python. Where a project convention under `.claude/rules/conventions/` says otherwise on a Python matter, follow the project: that override holds for the rules of the skill only, never for the directions of the main set.

## 1. Type hints everywhere

Write type hints on every parameter and every return value. Give a record of known keys a named type, such as a data class, not a dictionary of strings. A signature with no types gives the reader nothing to predict from (methods, section 12).

## 2. Names and test names

Write names in snake case, in whole words, as the main set says (naming). Name a file for the type it declares, or for the work its functions do. Never give a file a general name, such as models, schemas, types or utils, that holds unrelated things: a reader reads the file name as the name of a class, so it must predict everything the file holds (naming, section 8). Name a test in the form should, outcome, when, condition, such as a name that starts with should or with test and then should (tests, section 9).

- Book (*How to Verify Correctness*, *How to Structure Tests*): "The pattern `should<Outcome>When<Condition>` captures them in a consistent format that becomes predictable across the codebase."

## 3. Wiring of a module

Put the wiring of a module into a container file at the module root, beside app, in and out, which builds each api implementation from the application and its ways out, and a loader file beside it, which reads the settings into the configuration types of the domain. Code inside app never reads the settings itself (modules, section 4).
