# The cost check, where the cost plan ends in yes

Read this file only where the `costPlan` line of the prepare `RESULT` ends in `yes`. Until the user answers, dispatch nothing.

Read `<run>/cost-plan.json` and ask the user with 1 `AskUserQuestion` call, header `Scope`, 1 question: `This review would run <upTo.judgeCalls> judge calls, <upTo.refuterCalls> refuter calls and <upTo.verifierCalls> verifier calls, with <afterScreen.newTokens> to <upTo.newTokens> new tokens, about <upTo.wallSeconds in minutes> min. What should run?` Give the options below, each with its cost in its description:

| Option | Its cost, from `cost-plan.json` |
|---|---|
| `Run all` | `upTo` and `afterScreen` |
| `Application, module and class only` | `upTo` and `afterScreen` of `scalesRun`; where `scalesRun` is null, leave this option out |
| `Only some judge types or folders` | none; the next call shows it |
| `Cancel` | nothing runs |

On `Only some judge types or folders`, ask 1 more `AskUserQuestion` call with 2 questions, both `multiSelect`: header `Judges`, `Which judge types should run?`, with the first 4 entries of `byJudgeType`; and header `Folders`, `Which folders should run?`, with the first 4 entries of `byFolder`. Each option is the `judgeType` or the `folder` value as the plan writes it, with `<judgeCalls> judge calls, <newTokensAfterScreen> to <newTokens> new tokens` as its description. The user can type other values under Other.

On `Run all`, go on to step 2 with the `RESULT` object you have. On `Cancel`, stop, and say in 1 line that nothing was dispatched and that the plan is in `<run>/cost-plan.json`. On any other answer, run prepare again in the same run folder with the filter the answer names, and never run extract again:

```bash
node "<skill>/scripts/runReview.mjs" prepare --run "<run>" --scales application,module,class
node "<skill>/scripts/runReview.mjs" prepare --run "<run>" --judges "<judgeType,...>" --paths "<folder,...>"
```

Give only the flags the answer set, with the values joined by commas; a question the user left empty sets no flag. `--paths` keeps only the code under review whose path lies under 1 of its prefixes. The path of a module is its folder, and the path of an application is its root. So a prefix that names a file keeps the class, method and variable checks of that file and drops every module check, and the scope line counts the modules left out. The application checks stay. Pass folders, as `byFolder` writes them. To limit a review to some files and still judge their folders as modules, pass those files with `--files` beside `--range` to the extract command instead. Where the command stops on a judge type it does not know, it prints the known ones; ask again with that list. Prepare runs again in seconds and replaces every file the first prepare wrote; the refuter calls and the verifier calls of its plan follow the judge calls it keeps. Go on to step 2 with the `RESULT` object of this last prepare command, and do not ask again, even where its `costPlan` line still ends in `yes`.
