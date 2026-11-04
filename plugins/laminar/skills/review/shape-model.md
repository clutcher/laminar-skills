# The shape model

Contents: 1. What it is · 2. The form · 3. The kinds · 4. What the scripts do with it · 5. How to write one from any input

## 1. What it is

The shape model is the small JSON form of a planned shape: its folders, the children of each folder, and its classes with their fields and method signatures. The shape check reads only this form. The prepare command reads it with `--shape <file>`, checks it, and writes the code under review that the judges read in a review of code, so every judge gets the sections it already knows.

## 2. The form

```json
{
  "version": 1,
  "folders": [
    { "path": "src/lending", "kind": "created",
      "children": [
        { "name": "Loan.kt", "kind": "created" },
        { "name": "LoanPolicy.kt", "kind": "moved", "oldPath": "src/catalog/LoanPolicy.kt" },
        { "name": "LoanDesk.kt", "kind": "modified" },
        { "name": "Member.kt", "kind": "unchanged" }
      ] }
  ],
  "classes": [
    { "file": "src/lending/Loan.kt", "kindWord": "class", "name": "Loan",
      "extends": [], "implements": [],
      "fields": [ { "name": "copy", "type": "CopyId" }, { "name": "due", "type": "Date" } ],
      "methods": [
        { "visibility": "public", "name": "extend", "parameters": [ { "name": "days", "type": "Days" } ], "returns": "Loan",
          "uses": ["due"] }
      ] }
  ]
}
```

- `version`: always `1`. The prepare command stops on another value.
- `folders`: each folder has `path`, relative to the repository root, `kind`, and `children`. Each child has `name`, which is 1 file or folder name with no `/`, `kind`, and `oldPath` where its kind is `moved`. List only the children the shape adds, moves, changes or removes; the prepare command reads the other children of the folder from the repository.
- `classes`: each class has `file`, the path of its file, an optional `kindWord`, the word the language uses, such as class, record, interface, enum or data class, which is `class` where it is left out, `name`, the optional lists `extends` and `implements`, `fields` with `name` and an optional `type`, and `methods`. A file of functions with no class, a shell script included, is 1 class with the `kindWord` `file`: the class judge reads the file name as the class name and its functions as its public methods. A nested type, such as a record declared inside a class, is 1 class of the same `file` as its outer class, with the `name` `Outer.Inner`.
- Each method has `name`, `parameters` with `name` and an optional `type`, an optional `returns`, an optional `visibility`, which is `public` where it is left out, an optional `uses`, the fields and private methods it uses, and an optional `body`.
- `body` holds the text of the method as the input gives it, also where the text is partial. Where its first line holds the name of the method followed by `(`, the body stands in place of the signature; else the signature comes first and the body below it.
- A method that coordinates 2 or more parts may carry its `body` as the calls in order. The class judge reads the body inside the lines of the class, so it reads the name against what the method will do, and the body also opens the method judge for that method.
- The model needs 1 or more folders or classes. Every other key is ignored, so a role or a note may stand on a folder, a child or a class for the plan, and no judge reads it.

## 3. The kinds

| Kind | For a child | For a folder |
|---|---|---|
| `created` | a new file or folder | a new folder |
| `moved` | a file that moves here from `oldPath`; a new name at the new place counts as a rename | read as `created` at its new path; give its files as `moved` children |
| `modified` | a file that stays and changes | a folder that stays; its kind of change comes from its children |
| `removed` | a file the shape removes; it leaves the folder | a folder the shape removes; it is not judged |
| `unchanged` | a file that stays as it is, listed only for the reader of the plan | a folder listed only for the reader |

A class takes the kind of its file. A class in a file that no folder lists is `modified` where the file is in the repository, and `created` where it is not.

## 4. What the scripts do with it

- A folder becomes a module, with its child count, its file list and its siblings, read from the repository and the shape together. The folder that a created folder joins, and a folder that a file left, become modules too, as in a review of code. The `oldPath` of a moved child is enough to name the folder that the file left, and the model does not need to list the old file as `removed`.
- A class of a created, moved or modified file becomes a class with its signature lines, numbered as a plain text of the shape model: the class head, 1 line per field, and 1 line per method, `<name>(<parameter>: <type>, ...): <returns>`. A class of an unchanged file stays out.
- A class of a moved file whose only change is its path gets no class judge call, as in a review of code: there a move that changes only the package or the path line is trivial, and the class judge reads the name of a class against its members, which a move does not change. Where a moved class also changes its members, give its file as a `created` child at the new path and the old file as a `removed` child of its folder, so the class judge reads it as a created class.
- A class of a moved file with a new file name is renamed, and it gets only the Prediction Failure check of the class judge, as a renamed class in a review of code.
- A renamed test file gets no class judge call, as in a review of code. Its folder gets the finding that the script writes for a test file whose new name starts with no file it can test, and a folder that follows a known test layout gets no module judge call.
- A method becomes a method of its own only where it holds a `body`.
- A class and a method also show the existing types that their lines name: for each type that the shape does not declare in a created, moved or modified file, the prepare command looks for a file of the same name in the same language family of the repository, and shows the head of the type, its fields and the heads of its methods that are not private, each line with its path.
- A class and a method also show, after the existing types, each type that their lines name, other than their own type, and that the shape declares in a created, moved or modified file: the prepare command reads the head of the type, its fields and the heads of its methods that are not private from the shape model, at most 12 lines a type, and the 2 lists share 1 cap of 6 types, where the types the shape declares fill the cap first.
- The judges come from what the model holds, and from nothing else: folders allow the module judge, classes allow the class judge, and a body allows the method judge. A body opens only the method judge, so a shape gives no variable finding. `--judges` and `--scales` can narrow this list and never widen it; a judge outside the list stops the prepare command.
- No relation between abstractions is judged, because a shape has no calls, no callers, no tests and no imports.
- Every finding of a shape run is in the change.
- The prepare command reads the repository and writes nothing into it. It writes the run folder at `--run`, which must be outside the repository, or, with no `--run`, in a new temporary folder that it names on its `run folder:` line.

## 5. How to write one from any input

The input of a shape check can take any form: a plan file, such as one written in the plan mode of Claude Code, an ASCII tree, sketches of classes, a patch, prose, or the target shape of a fix plan. Convert it into 1 shape model yourself before the prepare command runs:

1. Write each folder the input names or implies, with its path from the repository root.
2. Read the repository, read only, to find which folders and files exist already, and give each child its kind by that.
3. Write each class the input names with its fields and method signatures, in the words of the input. Use the names of the input as they stand, and leave out a type the input does not give.
4. Copy a method body only where the input holds example code for that method.
5. Write the model as a JSON file in a folder outside the repository, and pass that file to `--shape`.
