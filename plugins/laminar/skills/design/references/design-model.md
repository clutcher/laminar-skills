# The design model

Contents: 1. What it is · 2. The 2 halves and the order of work · 3. The shape half · 4. Kinds against the current tree · 5. Display names · 6. Which script reads which key

## 1. What it is

The design model is 1 JSON file, `design-model.json`, that holds a whole design before any code is written: every public name at every scale, every private method that is a named part of a public method, and the decisions that the code must carry at each boundary. The designer writes it outside the repository. 4 scripts read it, and none of them writes it:

- The prepare command of the skill `review`, `runReview.mjs prepare --shape <file>`, reads the shape half for the shape check and ignores every other key.
- The design check, `scripts/checkDesign.mjs`, reads the whole file and prints each defect of the model and a count of the completed keys (`design-checks.md`).
- The render, `scripts/renderDesign.mjs`, writes `design.md` from the whole file for the writer and the user, so the designer writes nothing twice. Under each created class it writes `used by <classes>`, computed from the field types, the parameter and return types and `calls` of the model, or `used by no class of the model`, and adds `, and through <Interface> by its users` where the class implements or extends a class of the model.
- The migration script, `scripts/planMigration.mjs`, reads the shape half against the current tree of the repository and lists what each change creates, moves, renames, changes and removes, and reads `decisions.tests` for its test steps (`design-checks.md`, section 5).

The scope follows the book: "every part is named before any detail is written" (*How to Apply the Principles*, *How to Apply the Principles to New Code*). A private method that the model names is a part, and the writer keeps its name. A private method that the writer adds below a named part is a detail, and the model does not list it. No method holds a body, except the calls in order of a method that coordinates 2 or more parts, and the I/O line with the failure line of a method that does I/O, where the model creates or changes that method; such a body shows the same choice as its object under `exits` (`design-boundaries.md`), so the designer writes `exits` in pass 1, with the tree.

## 2. The 2 halves and the order of work

The file has 2 halves:

- The shape half is the shape model of `shape-model.md` of the skill `review`, unchanged, plus keys that the prepare command ignores: `zone`, `does`, `exposed`, `oldName`, `removed` and `group` on a class, `calls`, `oldName` and `unchanged` on a method, and `oldPath` on a `created` child and `removedClasses` on a `modified` child (section 4).
- The decisions half is the 1 top-level key `decisions`, whose keys `design-decisions.md`, `design-boundaries.md` and `design-findings.md` hold. The prepare command ignores it, so no judge of the shape check reads a decision.

The designer writes the 2 halves in this order:

1. Pass 1, the tree, after the designer has read the project conventions: write the shape half and `decisions.owners`. The change forecaster then writes the `forecast` of each owner, and the designer decides depth from it and writes the tree in that depth. Then write `decisions.exits`, because the failure line of each I/O execution decides its return type and the I/O body that the shape check reads. Then run the design check on the pass-1 model and fix each defect it prints, other than the keys of pass 2, which it prints as missing. Then run the shape check on the shape half, change the shape half for each kept item, and run the shape check again until every kept item is closed by the tree or holds a reason class under `decisions.findings` (`design-findings.md`). Where the input is a run folder, write `decisions.findings` as the tree closes each item.
2. Pass 2, the decisions on the tree that passed: record the project conventions under `decisions.conventions`, then write `entries`, `tests` and `questions`. Run the design check again, fix each defect it prints, and write each recheck case that the model shows wrong under `scriptCases`.
3. After the writer runs, record each stop the writer returns under `stops`.

A depth change after the shape check passed, such as an interface with 2 implementations in place of 1 class, is the exception: it runs the shape check again on the changed part only, never on the whole tree. A change to the shape half after pass 2 also runs the shape check again on the changed part, and the design check then reports each decision that names a display name the shape half no longer holds.

## 3. The shape half

Every key of `shape-model.md` keeps its type and its meaning: `version`, `folders` with their `children`, and `classes` with `file`, `kindWord`, `name`, `extends`, `implements`, `fields` and `methods`, and each method with `visibility`, `name`, `parameters`, `returns`, `uses` and `body`. Write a private part with `visibility: private`, and name it in the `uses` of each public method it serves. A nested type, such as a record declared inside a class, is 1 class of `classes` with the `file` of its outer class and the `name` `Outer.Inner`, such as `Order.Line`.

Every field of a class that the change creates or modifies lists its `type`, also a field that the change does not touch, because the review judges a changed class whole, and the type says the unit or the form of the value, such as `Minutes`, `Money` or a closed set of values, and not a bare number or a bare text. A field with no type lets the writer choose a form that admits values the business never has. The book: "You define the types so the compiler rejects the invalid mix before the code runs." (*What Correctness Means*, *Exclude Illegal States*) The design check reports each field with no `type` in a class of a `created` file, except the constants of an enum (`field-without-type`). The text of a message or of a description is left to the writer only where the model names its field and the type of that field. This rule is a format of this skill, not of the book.

The shape half lists each class of a `modified` file whole: every field with its `type`, and every public member, each method that the change leaves as it is with `unchanged: true`. The judges of the shape check then read the class as the review reads it after the code is written. With `--repo`, the design check reads the fields that a Java, JavaScript or TypeScript file of the current tree declares, and reports as a defect each field of a class of a `modified` file that the model does not list (`field-unlisted`); for a file in another language it prints the class as not checked. A defect of an existing field or member of such a class is inside the change, and the designer fixes it (`design-findings.md`, `existingDefects`).

The keys below stand beside them. The prepare command ignores each of them, so the shape check judges the same shape with or without them.

| Key | Where | Type | Required | Read by | Example |
|---|---|---|---|---|---|
| `zone` | class | text: 1 zone of the zone order | only where a zone order applies (`design-checks.md`, section 2); then for each class of a created, moved or modified file | design check | `"zone": "domain"` |
| `does` | class | `computes`, `coordinates` or `translates` | for each class with 1 or more methods in a created, moved or modified file; left out for a class of fields only and for an interface | design check, render | `"does": "computes"` |
| `exposed` | class | true or false | yes, for each class of a created, moved or modified file | design check, render | `"exposed": false` |
| `calls` | method | list of display names (section 5) | no; where a method has a `body`, every class its body calls stands in `calls` | design check, render | `"calls": ["InvoicePricing#priceLines"]` |
| `oldName` | class or method | text: the name in the current tree | only for a class or a method that the change renames | migration script, design check, render | `"oldName": "findAllByPartNumber"` |
| `removed` | class | list of texts: the names of fields and methods the class loses | no | migration script, design check, render | `"removed": ["findOpenJobs"]` |
| `group` | class | number: the migration group of the class, from 1 | no; only on a class that the change creates, moves, renames, modifies or removes; a class with no `group` is in group 1; never on a class of an `unchanged` file | migration script; design check, which reports a `group` on a class of an `unchanged` file (`group-on-unchanged-class`) | `"group": 2` |
| `unchanged` | method | true | no; only on a method of a class of a `modified` file that the change leaves as it is | design check, migration script | `"unchanged": true` |

- `zone`: the name of 1 group of folders in the zone order, which states which zone may call or implement which (`design-checks.md`, section 2). A zone is given per class, so a repository whose folders have other names still gets the order of calls checked. Where `decisions.conventions` names no file with a zone order, the zones are the folders of the book's layout, where `app` holds `api`, `domain` and `spi`, so a class takes `api`, `domain` or `spi`, never `app`. The book: "The `api/` folder declares what callers can ask for, and the `spi/` folder declares what the application needs." (*The Principles at Every Scale*, *Hexagonal Architecture*)
- `does`: `computes` where the methods of the class decide from their parameters and fields alone and reach no exit; `coordinates` where the methods call parts in order, exits among them; `translates` where the class is concrete and every method of it is an exit, such as an implementation in `out` of an interface in `spi`. The test kind follows from it (`design-boundaries.md`, `tests`).
- `exposed`: true where code outside the folder of the class calls it, or where it is an entry, so the class is a type its module exposes to other modules; false where only its own folder calls it.
- `calls`: the abstractions a method reaches, beside `uses`, which names only the fields and private methods of its own class. The cycle check reads the types of the fields, `calls`, `implements` and `extends`, and the graph of folders also reads the parameter and return types of public members (`design-checks.md`, section 3).
- `unchanged`: a method so marked carries no `body`, and the design check asks no other key of it (`key-missing`). An item of a shape run on it takes the reason class `outside the change` with no further test (`design-findings.md`), and the migration script writes no body step for it. With `--repo`, the design check reports the mark as a defect where the current tree does not hold the method with the same signature (`method-changed-but-marked-unchanged`).

## 4. Kinds against the current tree

The model uses the kinds of `shape-model.md`, section 3, and no second set: `created`, `moved`, `modified`, `removed` and `unchanged` on a folder and on a child. A class takes the kind of its file. The migration script reads each kind against the current tree, as follows:

| What the change does | How the model states it |
|---|---|
| creates a file | a `created` child |
| moves a file and keeps its members | a `moved` child with `oldPath`, the same file name |
| renames a file | a `moved` child with `oldPath`, a new file name |
| moves code into a new file and changes its members, or splits 1 file into 2 or more | a `created` child for each new file, each with `oldPath`, the file the code comes from; the prepare command ignores `oldPath` on a `created` child, so the class judge reads each new file as a created class, and the old file is a `removed` child of its folder |
| changes a file that stays | a `modified` child |
| removes a file | a `removed` child |
| renames a class or a method inside a file that stays | `oldName` on the class or the method |
| removes a class from a file that stays | `removedClasses`, a list of class names, on the `modified` child of that file |
| removes a field or a method from a class that stays | `removed` on the class |
| lists a file that stays as it is, for a decision that names it | an `unchanged` child, with its class under `classes`; the prepare command judges no class of an `unchanged` file |

The current tree is the tree of the base commit of the change where one is known, never the files of a writer (`design-checks.md`, section 1). The design check reports each class of the current tree in a folder of the model that disappears with no `removed`, `removedClasses`, `oldName` or `moved` child that accounts for it (`current-class-unaccounted`); it compares a nested type by its full dotted name, such as `Order.Line`, never by the bare name, and it counts a private helper class of a test file, such as a substitute that only that test uses, as a detail of its test, so such a class is never unaccounted. It also reports each public member of a current class that the model neither keeps, renames by `oldName` nor lists in `removed`, as a recheck case (`current-member-unaccounted`), each name of `removed` that the current file does not hold (`removed-name-not-in-tree`), each `oldPath` or `oldName` that the current tree does not hold (`old-path-not-in-tree`, `old-name-not-in-tree`), and each `oldPath` of a `created` child whose old file no folder of the model lists as a `removed` or `modified` child (`old-file-unlisted`).

## 5. Display names

Every key of the model that names an abstraction holds a display name: `Class#method` for a method, and `Class` alone for a class or a call of its constructor. A nested type takes its `name`, such as `Order.Line#total`. Where 2 classes of the model share a name, such as 2 classes of 1 name in 2 modules, each display name of either starts with the `file` of its class: `<file>#Class` and `<file>#Class#method`. A dotted name with no `/` and no file extension is a nested type, `Outer.Inner`, so `Outer.Inner#method` names a method of a nested type, also in `calls`. A file qualifier must contain a `/` or end with the extension of a language the skill reads, which are `.java`, `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.tsx`, `.mts`, `.cts`, `.kt` and `.kts`, so `src/x/Outer.java#Outer` names a file and its class. The design check reports a bare name only where 2 classes share it (`name-ambiguous`), and a display name that names no class or method of the model. A class that a decision names and the change does not touch stands in the model as the class of an `unchanged` child (section 4), so every display name resolves inside the 1 file.

## 6. Which script reads which key

| Key | Prepare command | Design check | Render | Migration script |
|---|---|---|---|---|
| the keys of `shape-model.md` | yes | yes | yes | yes |
| `zone`, `does`, `exposed`, `calls` | no | yes | `does`, `exposed` and `calls` | no |
| `oldName`, `removed`, `removedClasses`, `oldPath` on a `created` child | no | yes | yes | yes |
| `group` | no | yes | no | yes |
| `unchanged` on a method | no | yes | no | yes |
| `decisions` (`design-decisions.md`, `design-boundaries.md`, `design-findings.md`) | no | yes | yes | `tests` and `existingDefects` only |

`design-checks.md` holds what the design check reports and how the migration script orders its steps.
