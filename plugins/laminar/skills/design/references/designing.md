# How the designer designs

Contents: 1. Read the surrounding code first · 2. From the outside in, until every operation is a part · 3. Place each abstraction on its abstraction level · 4. 1 owner for each decision, with its readers traced · 5. A name read with its path · 6. A file of mixed members · 7. Depth from the forecast · 8. Folders that name their part · 9. Outside data checked once, at the entry · 10. A failure line for each I/O execution · 11. Tests where the book places them · 12. Back to the shape on the base · 13. Outputs stay

These are the rules of procedure of the designer. The design directions themselves stand in the reference files of the skill `code-style` that `SKILL.md`, section 7, names, and this file does not restate them. Each rule below says which cognitive failure, or which correctness reason, it prevents in the code that the writer later writes.

## 1. Read the surrounding code first

Before you write a name, read the code of the scope: its folders, its classes with their public and private members, and the decisions they hold. Read the private members too, because 3 signals of a missing part stand only there: a private method that 2 or more public methods call is a part with no name of its own; the public methods of 1 class that carry the same trailing parameters miss a type that groups them; and the same lines written in several methods are 1 decision with no name. A design made without this reading gives an existing decision a second home, which is the incomplete mental model.

- Book (*How to Verify Correctness*, *How to Produce Verified Code*): "When a developer receives a requirement, the first step is understanding the surrounding code: its structure, its boundaries, and the decisions that shaped them."

## 2. From the outside in, until every operation is a part

Name the whole first, then list its parts, then the parts of each part, and stop once every operation is a part. Write the signatures of each abstraction level before the abstraction level below, so each name is read against what its caller needs. A detail named before its part sits among the parts with no name above it, which is the unnamed part failure; an abstraction level below the parts adds depth that hides nothing.

- Book (*How to Apply the Principles*, *How to Apply the Principles to New Code*): "every part is named before any detail is written"
- Book (*The Single Level of Abstraction Principle*, *Size Follows from Single Level of Abstraction*): "The rule, then, is to extract while parts and details mix and to stop once every operation is a part."

## 3. Place each abstraction on its abstraction level

Before you choose where an abstraction lives, ask which abstraction owns its decision, who calls it, and what it calls. A method that coordinates 2 abstractions goes to a caller above, and a detail goes into the lower part it belongs to. An abstraction placed where the request first touches the code, and not where its decision belongs, makes its name promise less than the code does, which is the prediction failure. In pass 2, write for every owner its `placement`: 1 sentence on why the owner stands where it stands, which names the input or the reader that decides its place (`design-decisions.md`, `owners`).

- Book (*The Common Pitfalls*, *Single-Level Methods*): "A method that coordinates higher abstractions belongs to a caller above, while one that drops into detail belongs inside a lower abstraction."

## 4. 1 owner for each decision, with its readers traced

List every business decision that the change makes or moves, and give each 1 owner under `decisions.owners`, with every caller that reaches it. Before a field or a type changes its owner, find the code that makes it and the code that reads it, and list both as callers. A decision with 2 owners, or a reader the design misses, leaves the decision in 2 places, which is the incomplete mental model. Where the wider code does not decide whether the old carrier of a value keeps it or a separate type holds it with a link, write the choice as a question of the model, with each option and a recommendation.

- Book (*What Correctness Means*, *Have a Single Owner*): "one abstraction owns the decision, and every caller reaches it through that boundary"
- Book (*How to Apply the Principles*, *How the Principles Restore Simplicity*): "This search may cover references to a single value, callers of a method, or every location that holds the same business rule, depending on what the change affects."

## 5. A name read with its path

Read every name together with its folder and its outer name, and drop a word that the outer name already says. A name that repeats its folder adds an item the reader must hold and predicts nothing new, which is the working memory overload. A general name, such as a service named for a whole concept, promises any work with that concept, so it is a choice that you defend in your answer to the user, and a narrower name beside it is the usual fix.

- Book (*The Encapsulation Principle*, *How Naming Makes Boundaries Work*): "The outer name gives context to the inner one, so when the outside already names the purpose, the inside does not need to repeat it."
- Book (*The Encapsulation Principle*, *How Naming Makes Boundaries Work*): "The rule is not that general method names are bad, but that the class and method together must give readers enough to predict the result."

## 6. A file of mixed members

Where no honest name fits a class, check the grouping before the name. Split the class by the groups that its members and its callers show: members that change together, members that share parameters the others never use, and members that use a different set of objects. A split by any other key gives parts that no reader can name, which is the unnamed part failure.

- Book (*The Encapsulation Principle*, *When No Name Works*): "Methods that always change together but separately from their neighbors form a group the rest of the class does not join."
- Book (*The Encapsulation Principle*, *When No Name Works*): "Methods that use a completely different set of objects to do their work belong behind different boundaries."

## 7. Depth from the forecast

Decide depth only after the change forecaster wrote the `forecast` of each owner, and write the decision under `depth`. Add a boundary that hides a choice, such as an interface with implementations, a factory or an extension point, only in 2 cases. The first case is a choice with 2 or more answers in this system today. The second case is a choice whose second answer the roadmap names: a forecast whose evidence is `roadmap` and whose `change` is `new variant` or `replaced technology`, because a planned change that the input names states its kind as a fact. Every other forecast adds no depth, whatever its values: write 1 concrete class with a named private part for each variant, which is the minimum fix. The forecast still stays beside its owner, and `design.md` prints it with its values, its kind of change and its evidence, so the next design on that code reads it; it is an expectation for the record and never a reason by itself (`forecaster.md`, section 5). A `new rule` changes a body and a `new caller` changes the callers, and no boundary helps either of them; where the rule leaves you unsure, the minimum fix wins. In the mode with a user, a high forecast from the domain on a choice with 1 answer is a question, with the minimum fix as its recommendation. A boundary with 1 answer and no second answer that the roadmap names is a boundary that hides no decision: a reader crosses it and learns nothing. A choice between variants copied into several methods of 1 class is 1 decision in many places, which is the incomplete mental model.

- Book (*The Encapsulation Principle*, *Depth Is a Design Decision*): "a factory is worth adding only when the choice it hides has more than one answer in this system"
- Book (*The Encapsulation Principle*, *Depth Is a Design Decision*): "Which depth is right is a question about how the system will change, not something you can read from the code in front of you."
- Book (*The Principles at Every Scale*, *Open-Closed Principle*): "Even where change is expected, check whether the minimum fix already solves the cognitive failure."

## 8. Folders that name their part

Give each new file a folder that names the part it belongs to, and say for each moved file whether its new folder holds that part or needs a new one; never move a file into a folder whose name does not name its part. A file in such a folder is a detail among parts, which is the unnamed part failure at the module scale. Read the sibling modules for their layout and the words of their classes, and take them where they draw no finding, because a layout that repeats is learned once; a sibling shape that draws the same finding is never taken. The conventions file of the language in the skill `code-style` decides whether a type gets its own file; where it says nothing, you choose, and the shape check judges the folder. Give each class its `zone` where a zone order applies (`design-checks.md`, section 2, which describes the zone order). The zones and the zone order are words of this skill, not of the book; the default zone order follows the folders of the book's hexagonal layout, and it applies only to a tree with that backend folder layout.

- Book (*The Principles at Every Scale*, *Modular Monolith*): "Every folder, at any depth, stays consistent inside and hides its contents behind its name, which introduces a new abstraction level."
- Book (*The Principles at Every Scale*, *Hexagonal Architecture*): "Because the folders and the names repeat from one module to the next, a practitioner learns the layout once, as a single schema."

## 9. Outside data checked once, at the entry

For each entry, list the outside data it reads under `reads`, the check of each value and the method that makes it under `validates`, and each rule that a type, a constructor or a builder carries in place of a check under `invariants`. A check inside the application repeats a check of the entry or stands where the entry has none, so a value reaches code that cannot trust it; this is a correctness reason. A check that needs an exit, such as a lookup of an id in a store, is no check of the entry: it is the absent result of that exit, and the failure line of that I/O execution decides it (section 10).

- Book (*What Correctness Means*, *Validate at the Boundary*): "That check belongs at the entry boundary, which lets every abstraction inside trust the data that passes."
- Book (*What Correctness Means*, *Validate at the Boundary*): "Once the boundary confirms that the inputs meet their rules, the inner methods run without repeating those checks, because the guarantee already holds."

## 10. A failure line for each I/O execution

Give each I/O execution, which is each call of an exit and each parse of outside data, its own failure line under `exits`, also where 2 executions of 1 exit differ. Take the first choice that fits: absent, empty or not found is a normal result that the signature names; a wrong input that no definition makes normal is checked at the entry (section 9); a failed execution, such as a host that does not answer, fails fast there, and 1 handler at the entry turns it into a response. A failed read is never read as absent, so a method that answers yes or no, or returns a normal result for absent, cannot also carry a failed read: the line says where the stop happens. Where 1 exit gives the same answer for not found and for a failed read, the line names the check that tells them apart. The line names the type of the failure and the handler that takes it, or the default response of the framework, so the writer meets no gap of a type or a response (`design-boundaries.md`, `exits`). Write `exits` in pass 1, with the tree, because the failure line decides the return type and the I/O body that the shape check reads. The rule that each I/O execution states its own choice is a format of this skill, not of the book; the 3 choices are the book's, for correctness.

An exit that runs because another exit failed, such as a call that gives back what an earlier call took, is a compensation. A compensation has its own failure line like every exit, and that line states what the caller sees when the compensation fails too. The caller sees the first failure, unless the design says otherwise and why, because a failure of the compensation that replaces the first failure hides the cause from the handler and from the caller. This rule is a format of this skill, not of the book.

- Book (*What Correctness Means*, *Remove Edge Cases*): "A repository method that returns an empty collection when no rows match removes the exception its callers would otherwise have to check for."
- Book (*What Correctness Means*, *Fail Fast*): "A single global exception handler makes this practical, because it gathers all failures in one place"

## 11. Tests where the book places them

Give each entry under `entries` its integration tests by name, with each branch where it refuses a request and the exits a substitute replaces. Give unit tests to a class whose `does` is `computes` and whose branches multiply. A unit test of a class that coordinates needs a substitute for each part it calls, which is the test friction the book reads as a sign that its decisions belong in a class that computes; the design check reports it as a recheck case, and you keep it only where its branches cannot move. Name each test file after the unit it runs, then the behavior, and keep 1 naming scheme in 1 folder of tests; a file that writes fixture data stands with the fixtures. These are correctness reasons.

- Book (*What Testing Means*, *How to Distribute Tests*): "Integration tests are the starting point for every application"
- Book (*What Testing Means*, *How to Distribute Tests*): "Unit tests belong where combinatorial logic demands them"
- Book (*How to Verify Correctness*, *How to Structure Tests*): "Each name still starts with the class, which keeps its tests together in the directory"

## 12. Back to the shape on the base

Where earlier review runs show that a finding moved from 1 class to another, the earlier design is wrong: say so, and ask the user whether to go back to the shape on the base and design from there. Each further change on a wrong abstraction moves the cognitive failure instead of removing it.

- Book (*The Principles at Every Scale*, *Don't Repeat Yourself*): "When wrong abstractions already exist, the fix follows the same logic in reverse"

## 13. Outputs stay

Every existing output that a user or another system reads, such as a response, an exit code, a file or the result of a gate, stays as it was unless the request asks for the change. A design that changes such an output writes it as a question with `autonomous` set to `stop`, also where the docs or the tests of the change record the old output as intended, because the reader of that output is not in the code. The form of a new output, such as the status code of a new failure, the fields of a new response or the form of a new line of a document, is no question: you decide it and write it under `entries[].responses` and in the fields of its class, each field with the `type` that says its unit or its form (`design-model.md`, section 3), so the writer meets no behavior the design did not decide. The rule of the `type` covers every field of a created or a modified class, also a field that the change does not touch, because the review judges a changed class whole; an existing field whose type admits values the business never has is a defect inside the change, which you fix in a migration group of its own (`design-findings.md`, `existingDefects`), and in the mode with a user it is a question whose recommendation is the fix. A threshold that the user states, such as a time limit, stays a question with `autonomous` set to `open`. This rule is a format of this skill, not of the book.
