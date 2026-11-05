# The decisions of the design model

Contents: `conventions` · `owners` · `questions` · Which script reads which key

This file holds the decisions half of the design model, the 1 top-level key `decisions`. The designer writes `owners` and `exits` in pass 1 with the tree, and the `placement` of each owner and the other keys in pass 2 on the tree that passed the shape check (`design-model.md`, section 2). Every key that names an abstraction holds a display name (`design-model.md`, section 5).

This file holds `conventions`, `owners` and `questions`. `design-boundaries.md` holds `entries`, `exits` and `tests`, the decisions of each boundary, and `design-findings.md` holds `findings`, `stops` and `scriptCases`, which the designer fills from what the review, the checks and the writer return. Each key is a list of objects, except `conventions` and `tests`. A text key holds 1 sentence or a short phrase in the words of the business.

## `conventions`

An object, required. The designer reads the project conventions at step 1 of the procedure, before the tree, and records them here in pass 2. It records the project conventions the designer read, as the skill `check-conventions` finds them: each `.md` file under `.claude/rules/conventions/` of the repository whose `paths:` match a folder of the model, and each file there with no `paths:`. A project convention may set the zones and their zone order, the naming grammar, the folder layout and the test file suffixes. It overrides a rule marked narrower than the book, and never a format of this skill or a design direction of the book.

| Key | Type | Required | Read by |
|---|---|---|---|
| `folder` | text: the folder searched | yes | design check, render |
| `found` | true or false | yes; where it is false, `design.md` says so in its first line | design check, render |
| `files` | list of paths | yes; empty where none is found | design check, which reports a file of the folder that the list does not hold; render |
| `zoneOrder` | the path of the conventions file that holds the fenced block `zones` (`design-model.md`, section 3), or `default` for the book's layout | yes | design check, render |
| `testNameForms` | list of texts: each form of a test name that the conventions file of the language of the tests states, such as `should<Outcome>When<Condition>` or `test_should_<outcome>_when_<condition>`, where a word in angle brackets stands for 1 or more words | no | design check, which reports a test name that fits no form; where the key is missing, it reports only a name that states no behavior: 1 word, or `test` and the name of a method of the model |

```json
"conventions": { "folder": ".claude/rules/conventions", "found": false, "files": [], "zoneOrder": "default", "testNameForms": ["should<Outcome>When<Condition>"] }
```

## `owners`

1 object per business decision that the change makes or moves. The book: "one abstraction owns the decision, and every caller reaches it through that boundary" (*What Correctness Means*, *Have a Single Owner*).

| Key | Type | Required | Read by |
|---|---|---|---|
| `decision` | text, in the words of the business | yes | design check, render |
| `owner` | display name of the class or method that owns it | yes | design check, which reports 2 owners of 1 decision and an owner the model does not hold; render |
| `placement` | text: 1 sentence on why the owner stands where it stands, which names the input or the reader that decides its place, such as the callers that reach it or the folder whose part it is | yes, written in pass 2 for every owner | design check, which reports an owner with no `placement` (`owner-placement-missing`); render, which prints it beside the owner |
| `callers` | list of display names, or the word `framework` for a method that the host framework calls, such as an exception handler or a scheduled method | yes; empty only for an entry | design check, which resolves each display name and accepts `framework`; render |
| `forecast` | object, written by the change forecaster | yes, before depth is decided | design check, render |
| `depth` | object: `shape`, `takenBy` and `reason` | only where the owner hides a choice, or where the forecast is high within 1 year, also where the minimum fix stands | render |

`forecast` holds `sixMonths`, `oneYear` and `threeYears`, each `low`, `medium` or `high` and never a number; `change`, 1 of `new variant`, `new rule`, `new caller`, `replaced technology` and `removal`; `evidence`, 1 of `domain`, `roadmap`, `churn` and `none`; and `reason`, 1 sentence that names the fact of the domain or the roadmap words. The render prints each forecast as an expectation, and a forecast whose evidence is `churn` or `none` as a guess; `forecaster.md`, section 5, says how far a forecast counts. `depth` holds `shape`, the shape the designer chose, `takenBy`, 1 of `user`, `forecast` and `designer`, where `forecast` stands only for a boundary that a forecast with evidence `roadmap` added (`designing.md`, section 7), and `reason`. The book: "a factory is worth adding only when the choice it hides has more than one answer in this system" (*The Encapsulation Principle*, *Depth Is a Design Decision*). The 3 values, the 3 horizons and the closed lists are a format of this skill, not of the book.

```json
{ "decision": "labour price", "owner": "InvoicePricing#priceLines", "placement": "only invoicing reads", "callers": ["JobInvoicing#priceWork"],
  "forecast": { "sixMonths": "medium", "oneYear": "high", "threeYears": "high", "change": "new rule", "evidence": "domain", "reason": "rates change yearly" },
  "depth": { "shape": "1 concrete class", "takenBy": "designer", "reason": "1 rate today" } }
```

## `questions`

1 object per fact the code does not show, such as the depth of a boundary, a threshold, a boundary between 2 applications, or a change of an existing output that a program outside the application reads. The form of a new output, such as the status code of a new failure, the fields of a new response or the form of a new line of a document, is no question: the code shows no fact that decides it, so the designer decides it and writes it in the model (`design-boundaries.md`, `entries`).

| Key | Type | Required | Read by |
|---|---|---|---|
| `id` | text with no space | yes | design check, which resolves each `failure.question` that names it; render |
| `fact` | text | yes | render |
| `options` | list of objects: `name` and `shape`, the tree or the signatures of that option | yes, 2 or more | render |
| `recommendation` | text: the option name, then the reason | yes | render |
| `autonomous` | `default`, `stop` or `open` | yes | design check, render |
| `answer` | object: `option` and `by`, 1 of `user`, `default` and `delegate`; with `delegate`, also `says`, who answered on the user's delegation | only once the question is answered | design check, render, which prints an answer by `delegate` as `answered on the author's delegation by <says>` |

`autonomous` says what happens where no user answers. `default`: the question takes its `recommendation`, for every kind of question, and `design.md` prints it as a decision taken by default; for a failure policy the recommendation is the first choice of the failure line that fits the execution. `stop`: only for a change of an existing output that a program outside the application reads, because such an output never changes without a user, so the run stops before any writer runs. `open`: a threshold or a boundary between applications stays a question, and the writer writes no code across it. These answers are a format of this skill, not of the book.

```json
{ "id": "finish-response", "fact": "response readers", "options": [ { "name": "new response", "shape": "FinishedJobResponse" }, { "name": "1 more field", "shape": "RepairJob plus invoice" } ], "recommendation": "1 more field", "autonomous": "stop" }
```

## Which script reads which key

The prepare command reads no key of `decisions`, so no judge of the shape check reads a decision. The design check and the render read every key of this file, as each table says. The migration script reads none of them.
