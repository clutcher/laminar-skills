# Project conventions

Contents: 1. Where the files live · 2. When Claude Code loads them · 3. The form of a file · 4. The id a finding names · 5. An example

A project writes its own conventions in files of 1 form, so a writer reads them while writing and `laminar:check-conventions` checks a change against them. Section 3 of the `SKILL.md` of this skill says which rule wins where a project convention and a rule of `code-style` differ.

## 1. Where the files live

Put the files into `.claude/rules/conventions/` of the repository, as `.md` files, in subfolders where that helps, such as 1 subfolder for each application. Give each file 1 subject, such as 1 language, 1 framework or 1 area of the domain, and name the file for that subject, such as `kotlin.md` or `loans.md`.

## 2. When Claude Code loads them

Claude Code loads a file of `.claude/rules/` when it reads or writes a file that matches the `paths:` of that file, also a new file it writes. A file with no `paths:` loads at the start of every session, for every file. So give every file that holds the rules of 1 language, 1 framework or 1 folder its `paths:`, and leave them out only for the few rules that hold for every file of the repository.

## 3. The form of a file

- Frontmatter: only `paths:`, a list of glob patterns, each in quotes. Leave the frontmatter out where the file holds no `paths:`.
- A title line, then a `Contents:` line that lists every section with its number and its title.
- 1 section for each rule, headed `## <n>. <title>`, numbered from 1. The body states the rule in positive form, as what to write, and then its reason in 1 or 2 sentences. A rule that has limits ends with 1 bullet that starts with `- Limits:`.
- Add a new rule at the end of its file, with the next number. Do not number the sections again, because a finding names a rule by its number.
- Keep each file short, 100 lines or fewer, and state each rule once. Where 2 files would hold 1 rule, keep it in 1 file and give that file the `paths:` of both.

## 4. The id a finding names

A finding on a project convention names it as `project <file> §<n>`, with the path of the file under `.claude/rules/conventions/` and the number of its section, such as `project loans.md §2` or `project lending-app/kotlin.md §1`.

## 5. An example

A fictional library that lends books keeps its rules for loans in `.claude/rules/conventions/loans.md`:

```markdown
---
paths:
  - "lending-app/src/main/kotlin/**/loans/**/*.kt"
---
# Loans

Contents: 1. A loan period as a duration · 2. Fines in 1 currency type

## 1. A loan period as a duration

Hold every loan period as a Duration, and name it for the loan it limits, such as standardLoanPeriod. A bare number of days leaves the unit to the reader, and a period in hours for e-books would then read as days.

- Limits: a period that a member types into a form arrives as a number, and the entry turns it into a Duration.

## 2. Fines in 1 currency type

Hold every fine as a Money value with its currency, never as a bare decimal. 2 branches in 2 countries charge fines, and a bare decimal loses the currency between them.
```

A change that adds `val loanDays = 21` in a file under `loans/` breaks `project loans.md §1`.
