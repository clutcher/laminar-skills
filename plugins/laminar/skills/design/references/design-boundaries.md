# The decisions of each boundary

Contents: `entries` · `exits` · `tests` · Which script reads which key

This file holds 3 keys of `decisions`, the decisions half of the design model: `entries`, `exits` and `tests`. The designer writes `exits` in pass 1 with the tree, because the failure line of each I/O execution decides its return type, and `entries` and `tests` in pass 2 on the tree that passed the shape check (`design-model.md`, section 2). `design-decisions.md` holds the other keys of `decisions`. Every key that names an abstraction holds a display name (`design-model.md`, section 5), and a text key holds 1 sentence or a short phrase in the words of the business.

## `entries`

1 object per entry boundary of each `created`, `moved` or `modified` file of the model, every entry of such a file included, because the review judges a changed file whole. Every object is complete, whether its signature changes or not. An entry whose `changed` is false lists its checks as the code holds them, and never a new one. Where such an entry reads data with no check, the review raises a finding on the whole file, and the designer writes it under `decisions.findings` as `question to the author` or `outside the change` (`design-findings.md`). The form of each new output of a changed entry, such as the status code of a new failure and the fields of a new response, is a decision the designer writes under `responses` and in the fields of the class of the response, and never a question (`design-decisions.md`, `questions`). The book: "That check belongs at the entry boundary, which lets every abstraction inside trust the data that passes." (*What Correctness Means*, *Validate at the Boundary*).

| Key | Type | Required | Read by |
|---|---|---|---|
| `entry` | display name of the entry method | yes | design check, render |
| `changed` | true or false: false where the change touches neither the entry method nor a method on its path to its exits | yes | design check, which with `--repo` reports a false value where the entry method has a `body` or an `oldName`, or a signature that differs from the current tree (`entry-changed-but-marked-unchanged`); render |
| `reads` | list of texts: each value of outside data the entry reads; empty only where the entry reads none, such as a scheduled job | yes | design check, render |
| `validates` | list of objects: `data`, `check` and `at`, the display name of the method that checks | yes; empty only where `reads` is empty or `changed` is false, and the design check reports an empty list beside a `reads` that is not empty on an entry whose `changed` is true | design check, render |
| `invariants` | list of objects: `type` and `carries`, a rule that a type, a constructor or a builder holds in place of a check; an invariant relates 2 or more values that the entry writes, such as a sum, an order or a uniqueness, and an entry that writes values that depend on each other, such as 2 payments and their total, lists at least 1 | no | render |
| `handler` | display name of the method that turns a failed check into a response, once, or the word `framework`, where the default response of the framework answers a failed check; `responses` then lists that response | yes | design check, which reports a `framework` handler whose entry lists no response whose `handledAt` is `framework` (`framework-handler-response-unlisted`); render |
| `responses` | list of objects, 1 per outcome of the entry: `outcome`, text, such as finished or not found; `status`, a text or a number: the HTTP status code, or the exit code or the message type of an entry that is not HTTP; `type`, the display name of the class of the response, which the model lists with its fields, or a library type as the code writes it, such as the error type of the framework; and `handledAt`, only on a response that the default response of the framework writes, the word `framework` | yes; the list may be empty, such as for a scheduled job that answers nothing | design check, which resolves each `type`, prints a `type` that names no class of the model as `library type, not checked`, and reports a `type` that is the word `framework` (`framework-as-response-type`); render |

```json
{ "entry": "RepairJobController#finishJob", "reads": ["body labourMinutes"],
  "validates": [ { "data": "labourMinutes", "check": "present, not negative", "at": "FinishJobRequest#createWorkDone" } ], "changed": true,
  "invariants": [ { "type": "WorkDone", "carries": "minutes not negative" } ], "handler": "RepairJobErrorHandler#answerInvalidRequest",
  "responses": [ { "outcome": "finished", "status": "200", "type": "FinishedJobResponse" }, { "outcome": "job not open", "status": "409", "type": "FailureResponse" } ] }
```

## `exits`

1 object per I/O execution, which is each call of an exit and each parse of outside data, in each `created`, `moved` or `modified` file of the model, every execution of such a file included. 2 executions of 1 exit may differ, so each object names the method it runs from. An entry whose `changed` is true lists every exit on its path, the existing exits included, each with its failure line. Where the path holds an existing gap that the design does not fix, such as an exit whose failure leaves an earlier effect in place, the designer writes the gap under `decisions.existingDefects` with `notFixed` and the reason (`design-findings.md`). The design check reports an exit that the data-flow check finds on such a path and that `exits` does not list (`exit-unlisted`), for the languages that the data-flow check reads, and prints the path in another language as not checked. Each object holds the failure line of its execution, which states 1 of 3 choices:

- A normal result, the first choice: absent, empty or not found is a result that the signature names, so no caller checks for it. The book: "A repository method that returns an empty collection when no rows match removes the exception its callers would otherwise have to check for." (*What Correctness Means*, *Remove Edge Cases*).
- A check at the entry: where an input is wrong and no definition makes it normal, the entry validates it once, and nothing inside repeats the check (`entries`).
- Fail fast: where the execution itself fails, such as a host that does not answer, the code fails fast there, and 1 handler at the entry turns the failure into a response. A failed read is never read as absent, so a signature that answers yes or no, or that returns a normal result for absent, cannot also carry a failed read. The book: "A single global exception handler makes this practical, because it gathers all failures in one place" (*What Correctness Means*, *Fail Fast*).

The 3 choices are the book's. The rule that each I/O execution states its own choice is a format of this skill, not of the book.

| Key | Type | Required | Read by |
|---|---|---|---|
| `exit` | display name of the method that does the I/O | yes | design check, render |
| `from` | display name of the method that runs this execution | yes | design check, which reports a `from` method whose `body` and `calls` do not reach the exit as a recheck case (`exit-not-reached-from`); render |
| `does` | text: the I/O in plain words | yes | render |
| `failure` | object: `absent`, `failed`, `handledAt` and `question` | yes | design check, render |

In `failure`, `absent` is the normal result for absent or not found, where the execution has one; `failed` names the type that the call throws or returns on a failed execution, as a display name of the model or a library type as the code writes it; `handledAt` names the handler; and `question` is the `id` of a question that decides the line, where one does. `failed` and `handledAt` are required. `handledAt` is the display name `Class#method` of the handler method, a class of the model, also where the host framework calls it, and how control reaches the handler is not a concern of the model; or it is the word `framework`, where the default response of the framework answers the failure. The design check reports a `failed` whose first word names no type, neither a class of the model nor a library type that starts with a capital letter, such as `unknown` (`exit-failure-unnamed`), because a failure with no type names no failure kind a handler can take; it prints such an exit as not checked where `handledAt` is `framework` and an entry whose path reaches its `from` method lists the response of the framework. It reports a handler method with no parameter of the type of `failed`, or of a supertype that the model lists through `extends` (`handler-takes-other-type`). Where `handledAt` is `framework`, each entry whose path reaches the `from` method lists that default response as 1 object of `responses` whose `handledAt` is the word `framework`, and the design check reports an entry that lists none (`framework-response-unlisted`). A `from` method with no `body` and no `calls` gives the recheck case too, because the model then shows no path to the exit; the designer adds the `calls`, or records the case under `scriptCases`.

```json
{ "exit": "RepairJobRepository#findById", "from": "RepairDesk#finishJob", "does": "reads the job",
  "failure": { "absent": "null", "failed": "DataAccessException", "handledAt": "RepairJobErrorHandler#answerFailure" } }
```

## `tests`

An object with 2 lists. The book: "Integration tests are the starting point for every application" and "Unit tests belong where combinatorial logic demands them" (*What Testing Means*, *How to Distribute Tests*).

- `integration`: 1 object per object of `entries`, with `entry`, `file`, `substitutes`, the exits that a substitute replaces, and `tests`, the test names. The names hold each branch where the entry refuses a request. All 4 keys are required, and the design check reports an entry with no `integration` object (`entry-without-integration-tests`) and an `integration` object whose `entry` no object of `entries` holds (`integration-without-entry`).
- `unit`: 1 object per class whose `does` is `computes` and whose branches multiply, with `class`, `file` and `tests`, all required. The design check does not require a unit test, because the model holds no key for branches that multiply; the render prints each class whose `does` is `computes` and that has no `unit` object, so the designer sees it. A unit test of a class whose `does` is `coordinates` is a recheck case: such a test needs a substitute for each part the class calls, which is the friction the book reads as a sign of the design. The book: "mock chains, and assertions that depend on implementation all signal that production code needs redesign" (*How to Verify Correctness*, *How Tests Expose Design Problems*). The designer keeps the test where its class has branches that only a unit test reaches, and says so under `scriptCases`.

The test names take the forms of `conventions.testNameForms` (`design-decisions.md`). Where that key is missing, the design check reports only a name that states no behavior.

```json
"unit": [ { "class": "InvoicePricing", "file": "src/test/java/com/example/workshop/invoicing/InvoicePricingTest.java", "tests": ["shouldBillOneQuarterHourWhenLabourIsOneMinute"] } ]
```

## Which script reads which key

The prepare command reads none of these keys, so no judge of the shape check reads them. The design check and the render read every key, as each table says. The migration script reads `tests` for its test steps, and neither `entries` nor `exits`.
