# Laminar Skills

A Claude Code plugin that reviews code against the three qualities of high-quality code that the book *Laminar Software Design* defines: simple enough for humans to understand and change, works correctly as intended, and performs adequately for its purpose.

Simplicity is judged from how people read code: each Simplicity and Design finding names the cognitive failure behind it and what it costs the next reader. Correctness is judged as prevention, the design decisions that exclude errors, and as detection, the tests that verify behavior. Performance is judged as waste: extra data movement that a known alternative avoids, such as I/O in a loop. The two principles of the book, encapsulation and single level of abstraction, give the direction of a simplicity fix, and they are not the measure the review judges by.

It is a design review. It does not hunt logic bugs, so run a bug-focused review beside it where you need one.

## What a report looks like

The review writes `review.md` for a person to read. This short example comes from a fictional ferry and climbing gym, in the shape of two cases of the eval suite:

```markdown
**Run** · repository mode, the tree holds every path of the change · 3 file(s), 9 abstraction(s) · ...

The change created class `Crossing` and method `BelaySupervision#supervisorsNeeded`. It changed class `Climber`, in 3 files.

## Simplicity

### Production code

1. Method `BelaySupervision#supervisorsNeeded`
   - Incomplete Mental Model: supervisorsNeeded decides who counts as a beginner from the flags isBeginner and isAdvanced, and two other places decide the same from the same flags.
   - Direction: Encapsulate: move the repeated decision into one method every place calls, or drop it where not needed.
   - Also in `LeadCourseBooking#book`; `RouteAdvisor#highestSuggestedGrade`.
   - Confidence: Moderate. To confirm: Confirm that the 3 places must give the same answer for the same climber.

## Correctness · Prevention

### Production code

2. Class `Crossing`
   - Exclude Illegal States: Crossing holds its status as free text compared with BOARDING, DEPARTED and ARRIVED, so a caller can store any other value.
   - Direction: Encapsulate: change the types so an invalid value cannot be built, or reject it in the constructor.
   - Also in `Crossing#isOpenForBoarding`; `Crossing#hasLeftPort`.

## Limits

The review judges 3 qualities of the code: simplicity, from how people read the code; correctness, by the errors its design prevents and the paths its tests run; and performance, by the work it wastes.
The review does not find logic errors. ...
The review does not judge speed. ...
The review does not report what a compiler, a linter or a type checker reports ...
```

Each finding names the abstraction, the check, what the review found, a short direction for that check, which the script prints with the principle that leads it and no agent writes, and, where it is not high, its confidence with what would confirm it. A question the code cannot settle goes under `## To consider` and is not a finding. Beside `review.md` the review writes `review-evidence.md`, with the file and the line of every finding, and `review.sarif` for a tool. [`reference.md`](plugins/laminar/skills/review/reference.md) explains every section of the three files, every track and every check.

## Requirements

- Claude Code with the Workflow tool available in your session. The review starts its agents through 2 workflows of this plugin.
- Access to the Sonnet and Opus models. By default the screens, the judges and the refuter run on Sonnet, and the verifier runs on Opus.
- git 2.31 or later on the PATH, because the script reads the git folder with `git rev-parse --path-format=absolute`.
- Node.js 18 or later on the PATH. The scripts need no package and no install step.

## Install

```
/plugin marketplace add clutcher/laminar-skills
/plugin install laminar@laminar-skills
```

## Use

Ask Claude Code for a review of a pull request, a branch, a commit, files, a folder or a module, for example `Review my branch against main` or `Run a Laminar Code Review of src/orders`. You can also ask whether code is simple, well named, well structured, well bounded or well tested.

The review needs only git and Node, and finds the remote and the default branch with git alone. The remote is the only remote, else `upstream`, else the remote your branch tracks, else `origin`. The default branch is the branch that remote names as its head, else `main` or `master`. Where none is found, the review asks you. A pull request number is read from the pull request refs the host publishes, and on a host that publishes none the review asks for the branch.

When you name no range, the review fetches the default branch from the remote and reads `<remote>/<default>...HEAD`, for example `origin/main...HEAD`, so a local default branch that is weeks old does not bring changes that are already merged; without a remote, or offline, it uses the local default branch and says so. That range holds only commits, so changes you have not committed are not reviewed. To review them too, ask for the changes in your working tree: the review then compares `<remote>/<default>` with your checkout. The convention check uses the same base. A new file that git does not track yet is still left out, so add it with `git add` first.

## What a review costs and how long it takes

Cost grows with the number of agent calls. There is about 1 judge call for each abstraction the change touched and each judge type that applies to it, 1 refuter call for each possible finding, and 1 verifier call for each item a refuter showed wrong. A cheap screen first removes the checks whose shape is not in the code, and an abstraction the screen empties starts no judge.

Before any agent runs, the first step prints a cost plan: the judge calls, refuter calls and verifier calls it expects, the new tokens, the price in dollars, and the wall time. Where the plan passes 750 calls or 2 million new tokens, the review stops and asks you what to run: all of it, only the application, module and class scales, only some judge types or folders, or nothing.

The repository holds measured costs only for its eval cases, which are small changes of 1 to a few files that each run only the judges they grade. Each case states its allowed cost in its `budget.json`, at 1.5 times what 1 run measured, at list prices with Sonnet judges and an Opus verifier. When this was written, those ceilings ran from 2 cents to 97 cents and from 35 to 107 seconds, with a middle value of 19 cents and 59 seconds. A real pull request touches more abstractions and runs every judge type, so it costs more; read the cost plan line for your own change.

A workflow runs at most 16 agent calls at once, and fewer on a machine with few CPUs. The setting `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS` raises that limit, up to 256, and a large review then runs faster until your account's rate limits slow it down.

## Languages

The script reads code with patterns, not with a full parser or a compiler. It is fast and needs no install, but it can miss an abstraction or read one wrong, most often in code with unusual formatting.

It finds declarations in Ada, Bash, C and C++, C#, Dart, Elixir, Erlang, Fortran, Go, GraphQL, Java, JavaScript and TypeScript, Kotlin, Lua, Objective-C, Pascal, Perl, PHP, Python, Ruby, Rust, Scala, Scheme, SQL and Swift. It knows the roles of common frameworks, such as Spring, Jakarta, NestJS, Flask and FastAPI, and the test libraries of Java, Kotlin, C#, Python, Go and JavaScript, such as JUnit, Mockito, xUnit, NUnit, pytest, Jest and Vitest.

The eval suite is mostly Java and TypeScript, with some Python, Kotlin, PHP, GraphQL, Go and C#, so those languages are the best measured.

## What the review leaves on your machine

- **A worktree for each reviewed head.** A review of a range with 2 ends checks out the head in its own worktree, `<repo>/.claude/worktrees/laminar-review-<name>`, and never touches your checkout. A later review of the same branch uses the same worktree again. A review worktree that no review used for 14 days is removed at the start of a later review in the same repository. To remove one at once, run `git worktree remove --force <folder>`.
- **A line in `.git/info/exclude`.** Where `.claude/worktrees/` is not ignored yet, the review adds the line `/.claude/worktrees/` to `.git/info/exclude`, so git does not show the worktrees as new files.
- **`git worktree prune`.** The review runs it when it creates or removes a worktree. It removes git's record of every worktree whose folder is missing at that moment, so it also removes the record of a worktree of your own whose folder is missing, such as one on a drive that is not mounted.
- **A cache.** The review keeps a search index of the source files of each reviewed repository, which can hold parts of their code, and the I/O rules it wrote, under `laminar-review/` in your user cache folder: `~/.cache/` on Linux, or `$XDG_CACHE_HOME` where it is set, `~/Library/Caches/` on macOS, and `%LOCALAPPDATA%` on Windows. It keeps the newest 64 indexes and the newest 64 rule files, and a rule file for 30 days. You can delete the folder at any time.
- **The run folder.** Every file of a review, the reports among them, is written to a new folder outside the reviewed tree. Claude Code tells you where it is.

## How the review runs

The review runs in five steps: two script steps, two workflows of small agent calls, and a render.

A script first extracts every abstraction the change touches, at the scales variable, method, class and module, and finds each application the change touches. A key of a YAML or properties file is read as a class or as a named value. For each one it reads what kind of change it carries, whether its boundary moved, whether it is a test or production code, where its name and its literals appear elsewhere, and the measures the judges read. Nothing here costs a model anything.

A second script then prepares the judges' work: it plans the book's checks, cuts the slices and writes one file of the code under review per abstraction and judge type. An abstraction the change created, or whose boundary it moved, is judged at its own scale; one whose internals changed hands the walk down to what changed inside it; a trivial hunk plans nothing at all. The test plan is planned once for each application the change touched.

The planned work is then judged on five tracks. Simplicity reads the abstraction against its own internals. Design reads 2 or more abstractions together, a group of chains of called methods, a parameter type with every operation that takes it, a core operation with its neighbours, or a class with the groups its private members form, and reads 1 method alone where it is an in or out operation that decides or a method that rebuilds a value it takes, for over-extraction, for scoped parameters, for leaked details and for a missing boundary; each of its findings leads with the cognitive failure, such as Working Memory Overload (Over-Extraction). Correctness · Prevention reads the same abstraction with its callers, and reads Validate at the Boundary on a boundary path: a changed abstraction with the entry methods that reach it and the calls between them. Correctness · Detection reads a test with the code under test, and reads the tests of each application the change touched as one test plan: the main paths no test runs from entry to exit, the branches no test takes, the unit tests the integration tests already make needless, and the tests that stop short of the path they claim. Performance reads the changed code with what it calls, and every loop that reaches an I/O call. A cheap screen answers presence questions first, so a prevention or a Performance check runs only where the shape it judges is actually there.

**Judging is one small judge call per abstraction**, all of them at once. There is a Simplicity judge for each of the scales variable, method, class and module, one for a test method, which answers its Simplicity and its detection checks together, one for the test plan of an application, one for prevention, one for a boundary path, one for the waste inside an abstraction and one for the loops that reach an I/O call, one for the comments of production code, one for each of the four Design checks, one for the entry boundaries across applications, and one for the decision an abstraction repeats, which asks whether the decision being changed lives in any other place and carries the code toward a single owner. Each judge reads only 1 file the script wrote, and returns possible findings only: a planned check it answers with nothing found is a pass, and no pass is ever written.

Every line a judge names is then read back against the code in script, and a possible finding whose line is not there is dropped before anyone sees it. Each possible finding that survives then gets a second read. A refuter, a separate refuter call for each possible finding, tries to show it wrong by naming a line and a rule. A possible finding it does not refute is kept as the judge wrote it. A refuted one goes to the verifier, which keeps it, lowers its confidence, combines it with another check of the same item, or rejects it by naming a fact in the code. The verifier never raises a confidence.

The three report files are rendered in code from the fields the agents filled, so no model rewrites a finding on its way to the reader.

There is no severity, no ranking and no cap. Every finding is a must, or it is not a finding. A finding carries a confidence instead, and it says what would confirm the cost where the confidence is not high. What the code cannot settle, such as a copy of a decision in another application, which only the author knows to be kept on purpose or not, is never a finding: the report lists it under `To consider`, as a question to the author.

## Two modes

Against a repository the review reads callers, folders, tests and the build configuration. Against a bare patch it cannot, and the report says so: the mode is stated in the first line, the test checks read only the tests the patch carries, a finding that a test is needed has low confidence, and a check the patch cannot complete says in its own confidence what would confirm it.

## Coding style

The plugin also holds `laminar:code-style`, the same book's design directions for code that is written or changed: a new feature, a bug fix, a pull request comment or the fix of a review finding. Each direction gives its reason, the cognitive failure it prevents or its correctness or performance reason, so the code an agent writes is code the review accepts. It loads when Claude Code writes code, and you can ask for it by name. It keeps a change to what was asked: it moves an existing abstraction only where the new code needs it, as its own step with no change of behavior, asks before a move that other modules or tests depend on, and fixes a small problem only inside a method the change already edits.

Its core is short and holds the order of work, the qualities, the cognitive failures, the 2 principles, the rules for when 2 directions pull against each other and the common pitfalls. Reference files per area, such as names, methods, classes, modules, tests and performance, hold the full directions with the book's sentences. A few rules of the author are narrower than the book, such as a verb at the start of every method name, and the skill marks each of them. Files under `conventions/` hold the rules of 1 language or framework, or of documentation and instruction files, and a project's own conventions win on those matters.

It is not a review: it reports nothing, and the review stays the check of the result.

## Convention check

`laminar:check-conventions` checks a change, a pull request, a branch or your working tree, against the rules a writer can miss: the common pitfalls and the rules of `laminar:code-style` that are narrower than the book, its conventions files for the languages of the change, and your project's own conventions. Ask for a convention check, or a check against your team's conventions before a merge. Every finding names the rule it rests on and is input to a discussion, not a gate on the merge; the book's design directions stay with the review. Every finding also names its scale, in the words of the review: application, module, class, method or variable. Add `scales:` with a list in the review's form, such as `/laminar:check-conventions current scales: application,module,class`, to report only those scales; the report then says how many findings it left out at each other scale.

A project writes its conventions as `.md` files under `.claude/rules/conventions/`, each with its `paths:` and numbered rules, and Claude Code loads a file when it reads or writes a file that matches. A project convention wins over the skill's conventions files, its common pitfalls and its rules narrower than the book, and never over a direction of the book: the check reports such a contradiction on the convention file. Hooks of the plugin remind Claude Code once per session to load `laminar:code-style` before its first write or shell command, and add the conventions file of a language when it first writes a file in that language with the Write or Edit tool; set `LAMINAR_CONVENTION_HINTS=off` in the `env` of your settings to turn both off.json to turn it off.

## What this review is not

It does not find logic errors. A wrong tax formula is written exactly like a correct one, so reading the code cannot tell them apart. Only running the code reaches such an error.

It does not judge speed. The source is not what runs on the hardware. The one performance question it can answer is whether the code moves data a known alternative avoids.

It does not report what a compiler, a linter or a type checker reports.

The report says these limits where they apply, because silence must never read as a pass.

## The book

The skill is built from *Laminar Software Design: Foundations of High-Quality Code*, by Igor Zarvanskyi, which the author publishes.

Find the book on [Amazon](https://www.amazon.com/dp/8409859289) and [Google Books](https://books.google.es/books?id=sacHEgAAQBAJ).

Every check is built on a rule of the book, and the vocabulary the review uses is the vocabulary the book defines. Where the book leaves a question open, the review adds a small number of review conventions of its own, and it takes no side between anemic and rich types, between inheritance and composition, or between test-first and design-first.

A Simplicity or Design finding leads with one of the six cognitive failures of the book. The damage column is the book's own:

| Failure | What it means | Damage, in the book's words |
|---|---|---|
| Incomplete Mental Model | The same decision lives in more than 1 place, so a reader who changes 1 place does not know about the others. | Causes wrong changes with high confidence |
| Prediction Failure | The name or the signature makes the reader expect what the body does not do. | Forces model revision after reading |
| Working Memory Overload | Too many visible items to hold in mind at once. | Slows comprehension and blocks reasoning |
| Compression Failure | The lines share no shape and no purpose the reader can name, so each stays a separate item. | Keeps operations as separate items |
| Unnamed Part Failure | A detail sits among the parts, and the part it belongs to has no name. | Drops compression to the slow path |
| Open Construct Overload | Constructs nest so deep that the reader must hold several open at once. | Takes memory slots that cannot be freed |

## The eval suite

The evaluation cases are published under [`plugins/laminar/evals/`](plugins/laminar/evals/README.md): the cases of the review under `review/`, each as the diff a review is given, the findings the review is expected to raise and the ones it may not, written in the shape of the review's own reader file, and the cost the run is allowed, with `grade.mjs` beside them to build a case and grade a run on both, and the cases of the coding style skill under `code-style/`. The private evaluation set, the other fixture repositories and the checkers that audit the skill's own text are kept privately.

## Licence

Copyright (c) 2026 Igor Zarvanskyi.

The code is licensed under the MIT License, in [`LICENSE`](LICENSE). The code is the scripts under `plugins/laminar/skills/review/scripts/`, the workflows under `plugins/laminar/workflows/`, the hook under `plugins/laminar/hooks/`, the eval harness `plugins/laminar/evals/grade.mjs`, and the code in the diffs of the eval cases.

The text is licensed under the Creative Commons Attribution 4.0 International License, in [`LICENSE-CC-BY-4.0`](LICENSE-CC-BY-4.0), with the summary at <https://creativecommons.org/licenses/by/4.0/>. The text is the agent bodies under `plugins/laminar/agents/`, the skill text under `plugins/laminar/skills/` other than the review's scripts, the README files, and the `expected.md` files of the eval cases. You may share and adapt it, including commercially, if you give appropriate credit, link to the licence, and say whether you changed anything.

**Attribution.** Please credit the text as:

> Laminar Skills, by Igor Zarvanskyi, from the book *Laminar Software Design*. Licensed under CC BY 4.0 <https://creativecommons.org/licenses/by/4.0/>. Source: <https://github.com/clutcher/laminar-skills>.

Everything is provided as is, with no warranties.
