---
name: check-conventions
description: Checks a change, such as a pull request, a branch or the working tree, against the conventions a writer can miss. These are the project's own conventions under .claude/rules/conventions/, the common pitfalls and every rule marked narrower than the book in the laminar code-style skill, and its conventions files for the languages of the change. Use when the user asks for a convention check, asks to check a change against the team or project conventions, or asks for a convention check before a merge. Every finding names the rule it rests on, and a finding is input to a discussion, not a gate on the merge. It does not judge the design directions of the book Laminar Software Design, because laminar:review judges those.
argument-hint: "[pull request number | branch | current | working-tree]"
---

# Laminar convention check

You check the lines a change adds or changes against written conventions, and you report each line that breaks one, with the rule it breaks. You check only rules that a file names. The design directions of the book *Laminar Software Design*, such as a name that predicts what the code does or a decision with a single owner, stay with `laminar:review`, which judges them by cognitive failure. A finding is input to a discussion between the author and the reader of the change, not a gate on the merge.

Say what you check in 1 short line before you start, such as `Checking feature/loan-renewal against main.`

Contents: 1. The target · 2. The rules · 3. Which rule wins · 4. How to check · 5. The report

## 1. The target

The argument is `$ARGUMENTS`. Find the default branch: `main`, or the branch that `git symbolic-ref --short refs/remotes/origin/HEAD` names where there is no `main`. Do not change the checkout.

- A number is a pull request. Read its base branch with `gh pr view <number> --json baseRefName`, fetch its head with `git fetch origin pull/<number>/head`, and compare `origin/<base>...FETCH_HEAD`. Read each changed file with `git show FETCH_HEAD:<path>`.
- A branch name compares `<default>...<branch>`. Read each changed file with `git show <branch>:<path>`.
- No argument, or `current`, compares `<default>...HEAD`, which holds only commits. Read each changed file with `git show HEAD:<path>`.
- `working-tree` compares the merge base of `<default>` and `HEAD` with the working tree, so it holds committed and uncommitted changes. Add the new files that `git ls-files --others --exclude-standard` lists. Read each changed file from the disk.

Read the diff with `git diff --find-renames <range>`, and read every changed file in full at the head of the change. A deleted file has no finding.

## 2. The rules

Load the rules in this order, and keep the file and the number of each rule, because a finding names them.

1. The project conventions: every `.md` file under `.claude/rules/conventions/` of the checked repository, also in subfolders, whose `paths:` match a changed file, and every file there with no `paths:`. `${CLAUDE_SKILL_DIR}/references/project-conventions.md` gives the form of these files. Where the folder does not exist, check only the rules of the skill, and say so in the report.
2. The common pitfalls: section 7 of `${CLAUDE_SKILL_DIR}/../code-style/SKILL.md`, every bullet.
3. Every rule marked narrower than the book in the files under `${CLAUDE_SKILL_DIR}/../code-style/references/`. Find them with `grep -n "narrower than the book"`. The mark covers only the paragraph or the bullet it stands in, which can hold several rules; every other rule of the same section is a direction of the book.
4. The conventions files under `${CLAUDE_SKILL_DIR}/../code-style/conventions/` for the change: `java.md`, `typescript.md` or `python.md` for each language of a changed file, `spring.md` only where the changed code or the build file already uses Spring, and `docs.md` where the change holds documentation or an instruction file for agents. Every rule of a conventions file counts, also a rule that stands in a `Limits` bullet of a section.

## 3. Which rule wins

- A project convention wins over every rule of the skill that you check: the conventions files, the common pitfalls and every rule marked narrower than the book. Where the 2 differ on 1 matter, check the code against the project convention only.
- A project convention never wins over a direction of the book, which is every direction of `code-style` that is not marked narrower than the book. Where a project convention contradicts such a direction, report the contradiction as 1 finding on the line of the convention file, with both rules named, and not on the code. `laminar:review` still judges the code by the book.
- Where 2 project files contradict each other, report the contradiction on both lines, and check the code against neither.

## 4. How to check

- Check only the lines the change adds or changes, and what they create: a new name, a new file, a new folder, a new test or a new configuration key. A line the change does not touch has no finding, also where it breaks a rule.
- Report a line only where you can name the rule it breaks. No rule named, no finding.
- A section of a reference file under `code-style/references/` with no mark narrower than the book is a direction of the book. Never cite it for a finding, also where the change breaks it, because `laminar:review` judges it. Cite it only beside a project rule in a contradiction. A pointer to it inside a conventions file, such as `(methods, section 1)`, does not make it a rule to check.
- Where the rule clearly applies, state the fix. Where the answer depends on an intent the code does not show, such as whether a value is a business rule, ask the author a question and state no fix.
- Do not build, run or change the code.

A finding names its rule with 1 of these ids:

- `project <file> §<n>` for a project convention, with the file path under `.claude/rules/conventions/`, such as `project loans.md §2`.
- `code-style <file> §<n>` for a section of a reference or conventions file, such as `code-style naming.md §3` or `code-style java.md §11`.
- `code-style pitfalls: <name>` for a common pitfall, with its name in the words of section 7, such as `code-style pitfalls: Verb first` or `code-style pitfalls: Guard Clauses`.
- For a contradiction, both ids, the project rule first, joined by a semicolon, such as `project java.md §2; code-style methods.md §2`.

## 5. The report

Write 3 sections in this order: `## Production code`, `## Tests` and `## Docs and configuration`. A finding on a convention file goes under Docs and configuration. Number the findings from 1 across all 3 sections, so each finding has 1 number in the discussion. Order them by file, in the order of the diff, and then by line. Write `No issues found.` in a section with no finding.

Each finding takes this form:

```markdown
1. **LoanRenewal#renew:42** — Name the extension for its business purpose (code-style pitfalls: Context-Aware Constants)
   - The line compares the days of a renewal with the bare value 14.
   - The rule names every value for its business purpose, with its kind last.
   - **Fix:**
     - Add a private constant `RENEWAL_PERIOD_DAYS` and compare with it.
```

The first line names the place, as `Type#method:line`, `Type:line` or `path:line` where no type holds the line, then an action in the imperative, then the id of the rule. Each bullet under it is 1 sentence. Where you ask a question, write `- **Question:**` with the question, in place of the fix.

End with a table of the findings per source, 1 row for each project file and each `code-style` file that has a finding, and 1 row for the pitfalls. A contradiction counts in the row of its project file:

```markdown
| Source | Findings |
|---|---|
| project loans.md | 2 |
| code-style naming.md | 1 |
```
