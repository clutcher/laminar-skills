---
name: check-conventions
description: Checks a change, such as a pull request, a branch or the working tree, against the rules a writer can miss, which are the project's conventions under .claude/rules/conventions/, the common pitfalls, every rule of the laminar code-style skill marked narrower than the book, and its conventions files for the languages of the change. Use when the user asks for a convention check, asks to check a change against the team or project conventions, or asks for a convention check before a merge. Every finding names the rule it rests on, and a finding is input to a discussion, not a gate on the merge. It checks the patterns of the book among the common pitfalls and the few design directions of the book that the review skill of the laminar plugin does not judge yet, and leaves every other design direction of the book Laminar Software Design to that review skill, which judges them.
argument-hint: "[pull request number | branch | range | current | working-tree] [scales: <list>]"
---

# Laminar convention check

You check the lines a change adds or changes against written conventions, and you report each line that breaks one, with the rule it breaks. You check only rules that a file names. The design directions of the book *Laminar Software Design*, such as a name that predicts what the code does or a decision with a single owner, stay with the skill `review` of the plugin laminar, which judges them by cognitive failure, except the common pitfalls and the list of item 5 of section 2. A finding is input to a discussion between the author and the reader of the change, not a gate on the merge.

Say what you check in 1 short line before you start, such as `Checking feature/loan-renewal against main.`

Contents: 1. The target · 2. The rules · 3. Which rule wins · 4. How to check · 5. The report

## 1. The target

Read the argument, which is the text the user gives after the name of the skill (`$ARGUMENTS`). Do not change the checkout. Where it ends in `scales: <list>`, such as `current scales: application,module,class`, that part is the scale filter of section 5, and the rest is the target. The list takes the words of the skill `review` of the plugin laminar, lowercase and joined by commas with no space; an unknown word stops the check, with its name and the known words.

Choose the remote `<remote>` with git alone. Where `git remote` lists 1 remote, use it. Where it lists `upstream`, use `upstream`. Else use the remote of the upstream of the current branch, which is the part before the first `/` of what `git rev-parse --abbrev-ref --symbolic-full-name "@{upstream}"` prints. Else use `origin` where it is listed. Else ask the user.

Find the default branch `<default>` in this order, and never run `git remote set-head`: the name that `git symbolic-ref --short refs/remotes/<remote>/HEAD` prints, without its `<remote>/` start; else the name after `ref: refs/heads/` in what `git ls-remote --symref <remote> HEAD` prints; else `main` and then `master`, the first that `git rev-parse --verify --quiet <remote>/<name>` or `git rev-parse --verify --quiet <name>` finds; else ask the user.

The base is the default branch as the remote holds it: run `git fetch <remote> <default>`, which moves no local branch and not the checkout, and use `<remote>/<default>` as `<base>`, because a local default branch can be weeks old and then brings changes that are already merged into the diff. Where the repository has no remote or the fetch fails, use the local `<default>` as `<base>`, and say in your first line that the base is local and can be old.

- A number is a pull request, read with git alone. List its refs with 1 call, `git ls-remote <remote> refs/pull/<number>/merge refs/pull/<number>/head refs/merge-requests/<number>/merge refs/merge-requests/<number>/head refs/pull-requests/<number>/merge refs/pull-requests/<number>/from`, because each host names them in its own way. Where a merge ref is listed, fetch it with `git fetch <remote> <that ref>` and read its 2 parents at once with `git rev-parse "FETCH_HEAD^1" "FETCH_HEAD^2"`, because a later fetch replaces `FETCH_HEAD`. The first parent is the target branch of the pull request and the second its head: compare `<first>...<second>`, and read each changed file with `git show <second>:<path>`. Where only a head ref or a from ref is listed, as for a pull request with conflicts, fetch it, compare `<base>...<the commit ls-remote listed for it>`, read each changed file at that commit, and say in your first line that the base is the default branch and not the target of the pull request. Where no ref is listed, as on a host that publishes no pull request refs, stop and ask for the name of the branch.
- A range, an argument with `..` or `...` such as `HEAD~1..HEAD` or `<commit>..<commit>`, compares exactly that range and never takes `<base>` as its start, so a review of 1 fix commit checks only the lines that commit adds or changes. Read each changed file at the end of the range with `git show <end>:<path>`.
- A branch name compares `<base>...<branch>`. Read each changed file with `git show <branch>:<path>`.
- No argument, or `current`, compares `<base>...HEAD`, which holds only commits. Read each changed file with `git show HEAD:<path>`.
- `working-tree` compares the merge base of `<base>` and `HEAD` with the working tree, so it holds committed and uncommitted changes. Add the new files that `git ls-files --others --exclude-standard` lists. Read each changed file from the disk.

Read the diff with `git diff --find-renames <range>`, and read every changed file in full at the head of the change. A deleted file has no finding.

## 2. The rules

Load the rules in this order, and keep the file and the number of each rule, because a finding names them.

1. The project conventions: every `.md` file under `.claude/rules/conventions/` of the checked repository, also in subfolders, whose `paths:` match a changed file, and every file there with no `paths:`. `references/project-conventions.md` of this skill gives the form of these files. Where the folder does not exist, check only the rules of the skill, and say so in the report.
2. The common pitfalls: section 7 of `../code-style/SKILL.md`, a path relative to the folder of this skill, every bullet, with the limits of the reference section it names. A form that those limits allow is no finding. A clause that its bullet, or the reference section it names, marks narrower than the book is a rule of the skill; every other clause, and every pattern named in italics, is a design direction of the book, and you check it too.
3. Every rule marked narrower than the book in the files under `../code-style/references/`, a path relative to the folder of this skill. Find them with a search of the file contents for `narrower than the book` (the Grep tool). A mark that names its rules, such as "The returned expression is a rule of the skill", covers only the rules it names. A mark that names no rule, such as "These are rules of the skill, narrower than the book", covers the sentence it stands in and the sentences before it, back to the previous mark or to the start of its paragraph or bullet. Every other rule of the section is a design direction of the book.
4. The conventions files under `../code-style/conventions/`, a path relative to the folder of this skill, for the change: `java.md`, `typescript.md` or `python.md` for each language of a changed file, `spring.md` only where the changed code or the build file already uses Spring, and `docs.md` where the change holds documentation or an instruction file for agents. Every rule of a conventions file counts, also a rule that stands in a `Limits` bullet of a section.
5. The design directions of the book that the skill `review` does not judge yet, each a design direction of the book, cited with the id of its reference section. The list shrinks as the review comes to judge them: 4 parameters or fewer (code-style methods.md §12), a calculation apart from fetching (code-style methods.md §10), classes that coordinate apart from classes that compute (code-style modules.md §6), a test that marks none of its phases as given, when or then, by comments or by named step calls (code-style tests.md §8), and no silent return from a guard on a truly invalid state where no caller acts on the work of the method as done (code-style correctness.md §10). The limit of 4 parameters or fewer counts the parameters of a method. It does not count the fields of a record or the parameters of a constructor that only stores them in fields, and a constructor that does more counts as a method.

## 3. Which rule wins

- A project convention wins over every rule of the skill that you check: the conventions files and every rule marked narrower than the book, and every clause of a common pitfall that is marked narrower than the book. Where the 2 differ on 1 matter, check the code against the project convention only.
- A project convention never wins over a design direction of the book, which is every design direction of `code-style` that is not marked narrower than the book, also a pattern of the book among the common pitfalls and every design direction of item 5 of section 2. Where a project convention contradicts such a design direction, report the contradiction as 1 finding on the line of the convention file, with both rules named, and not on the code. The skill `review` of the plugin laminar still judges the code by the book.
- Where 2 project files contradict each other, report the contradiction on both lines, and check the code against neither.

## 4. How to check

- Check only the lines the change adds or changes, and what they create: a new name, a new file, a new folder, a new test or a new configuration key. A line the change does not touch has no finding, also where it breaks a rule.
- Report a line only where you can name the rule it breaks. No rule named, no finding.
- Give every finding 1 scale, as `references/scales.md` of this skill says.
- A section of a reference file under `code-style/references/` with no mark narrower than the book is a design direction of the book. The skill `review` judges the design directions of the book, and the rules marked narrower than the book are the rules of this check, so never cite such a section for a finding, also where the change breaks it, unless the design direction stands in the list of item 5 of section 2 or in a common pitfall. Cite it only beside a project rule in a contradiction. A pointer to it inside a conventions file, such as `(methods, section 1)`, does not make it a rule to check.
- Where the rule clearly applies, state the fix. Where the answer depends on an intent the code does not show, such as whether a value is a business rule, ask the author a question and state no fix.
- Do not build, run or change the code.

A finding names its rule with 1 of these ids:

- `project <file> §<n>` for a project convention, with the file path under `.claude/rules/conventions/`, such as `project loans.md §2`.
- `code-style <file> §<n>` for a section of a reference or conventions file, such as `code-style naming.md §3` or `code-style java.md §11`.
- `code-style pitfalls: <name>` for a common pitfall, with its name in the words of section 7, such as `code-style pitfalls: Verb first` or `code-style pitfalls: Guard Clauses`.
- For a contradiction, both ids, the project rule first, joined by a semicolon, such as `project java.md §2; code-style methods.md §2`.

## 5. The report

Open the report with 1 line that names the scales covered, as `Scales: application,module,class,method,variable`. With a scale filter, check every changed line against every rule as before, and leave out only the findings of the scales not asked for; the first line then names each scale left out with the number of findings it left out, as `Scales: module,class · left out: application 0, method 2, variable 1`.

Then write 3 sections in this order: `## Production code`, `## Tests` and `## Docs and configuration`. A finding on a convention file goes under Docs and configuration. Number the findings from 1 across all 3 sections, so each finding has 1 number in the discussion. Order them by file, in the order of the diff, and then by line. Write `No issues found.` in a section with no finding.

Each finding takes this form:

```markdown
1. **LoanRenewal#renew (src/loans/LoanRenewal.java:42)**: Name the extension for its business purpose (code-style pitfalls: Context-Aware Constants) · variable
   - The line compares the days since the loan was issued with the bare value 14, and nothing on the line says what 14 controls.
   - The rule names a value whose line hides its meaning for its business purpose, with its kind last.
   - **Fix:**
     - Add a private constant `RENEWAL_PERIOD_DAYS` and compare with it.
```

The first line names the place in exactly 1 of 3 forms, and in no other: `Type#method (path:line)` for a method, `Type (path:line)` for a type, and `path:line` where no type holds the line. Then it holds a colon and a space, then an action in the imperative that never ends in text in brackets, then the id of the rule in brackets, then ` · ` and the scale as 1 bare lowercase word, last on the line. A tool reads this line, so keep its form exact. Each bullet under it is 1 sentence. Where you ask a question, write `- **Question:**` with the question, in place of the fix.

End with a table of the findings per source and scale, 1 row for each project file, each `code-style` file and the pitfalls, for each scale it has a reported finding in. A contradiction counts in the row of its project file:

```markdown
| Source | Scale | Findings |
|---|---|---|
| project loans.md | class | 2 |
| code-style pitfalls | variable | 1 |
```
