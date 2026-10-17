# The scale of a finding

Every finding carries 1 scale, in the words of `laminar:review`: `application`, `module`, `class`, `method` or `variable`. The review also knows `system`, the root above every application of the repository. A convention governs code inside 1 application, so no finding of this check carries `system`, and `scales: system` keeps no finding.

The changed line decides the scale, by the smallest piece that the finding asks the author to change:

- `application`: a build unit or a deployment unit, such as a build file, its dependencies or its deployment settings.
- `module`: a folder, the place of a file, a package or a module name, or a document placed in a folder, as in `docs.md §1`.
- `class`: a type as a whole, such as which fields it holds, its constructor and the dependencies it takes, its public surface, or the split of a test file.
- `method`: a method body or a signature, a guard, the blank lines that group its steps, or a method name.
- `variable`: a value, a named value, a constant, the name of a collection, a parameter, a local, or 1 field with its name and its type, as the review judges a field at this scale.

Where the line does not decide, the source of the rule decides:

- `module`: `modules.md` and every project rule on folders, packages or modules.
- `class`: `classes.md` and every project rule on a type.
- `method`: `methods.md`, the pitfalls *Guard Clauses*, *Visual Separation* and Verb first.
- `variable`: the pitfall *Context-Aware Constants* and every rule on the name of a value or a collection.

Where the rule and the line point to 2 scales, the line wins: a bare number in a method body that a rule asks to name is `variable`, because the fix makes a named value.

A finding on a convention file, a contradiction, takes the scale of the code that the 2 rules govern: a project rule that splits methods by a count of lines is `method`.
