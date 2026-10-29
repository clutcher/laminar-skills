# Methods

Contents: 1. Every operation is a part of the name · 2. Extract, then stop · 3. Extract only what is worth a name · 4. Blank lines between groups · 5. Flat nesting · 6. Preconditions first, and 1 named check · 7. 1 question per condition · 8. A command or a query · 9. No change to a passed object · 10. Calculation apart from fetching · 11. No boolean parameter that chooses the work · 12. Parameters at the abstraction level of the name · 13. The structure of other objects stays hidden

## 1. Every operation is a part of the name

Read the name of the method and hold it as the reference. Ask of each operation: does it belong to what the name describes? Where you are unsure, ask what the operation is for. Where the answer names something more specific, the operation is a detail of that part, and it moves into that part. A detail among parts belongs to a part the name never names, so the reader groups it on the slow path: the unnamed part failure. This holds for every function, and for a function passed to a call too: let such a function hold 1 part only, such as 1 call of a named step, 1 read of a value, or 1 construction of the result that the method name describes, from values as they are, where that construction is the whole function. A lookup, a branch or joined conditions inside it are details with no name, held while the call stays open. A call around a call is 2 operations: where the outer call completes the answer of the inner call, such as a default or a rounding around it, the outer call is a detail of that answer, so give the pair a name. These 2 rules on a function passed to a call and on a call around a call are rules of the skill, narrower than the book. Where an argument of a call holds more than 1 operation, such as a calculation, a condition, or a call that takes the result of another call, compute it first into a variable and pass that variable. Name the variable for what the value means, purpose first and kind last, never by a general word and never by its kind alone (naming, sections 2 and 5). An argument that is a read of a value, or 1 call of a named step, stays inline, because a variable there only repeats the call. Where the language allows no statement before a call to the base constructor, an argument of that call, such as the message of an error, stays in that call. This rule on an argument that holds more than 1 operation, with the name of its variable and its limits, is a rule of the skill, narrower than the book.

- Book (*The Single Level of Abstraction Principle*, *What Single Level of Abstraction Means*): "To apply the question, read what the name describes, hold it as the reference, and ask each operation inside whether it belongs." · "When unsure whether the operation belongs, a follow-up question clarifies it: what is this for?" · "If the answer names something more specific, the operation belongs to that something rather than to the whole."
- Book (*What Simple Means*, *Nesting Depth*): "A nested block has no name, so the reader carries the conditions themselves, and every open construct holds its slot until the block closes."

## 2. Extract, then stop

Move each group of details behind a new method named for the part it serves. Where the part brings a field or a collaborator that no public method of the class uses, it goes into a class of its own instead of a private method: classes.md, section 4, says how. Then ask the same question inside the new method, and extract again where it mixes parts and details. Stop as soon as every operation is a part. Do not split a method only to make it shorter: no line count sets the size of a method. Past the stopping point, each new boundary adds depth and separates parts that belong together.

- Book (*The Single Level of Abstraction Principle*, *How to Fix Mixed Abstraction Levels*): "The full fix applies extraction recursively" · "Stop when every operation in the method is a part of what the name describes, because further extraction would not improve consistency that already holds."
- Book (*How to Apply the Principles*, *How the Principles Restore Simplicity*): "For example, a method with eight operations that are all parts of what its name describes is simpler than four methods of two operations each where the reader must navigate between them to understand one behavior."
- Limits: belonging is relative to the name, so the same code can be a detail in 1 method and a part in another.

## 3. Extract only what is worth a name

Before you extract, check that the new method names a real piece of work: a step a reader recognizes, or a choice with more than 1 answer. Do not extract a fragment whose result every caller must finish before it means anything. A boundary around a fragment makes reading slower.

- Book (*The Encapsulation Principle*, *Navigation Context Fading*): "The navigation cost has been measured, and it depends on what the boundary hides: a fragment not worth naming nearly tripled reading time for novices, while a real sub-computation cut it"
- Book (*The Encapsulation Principle*, *Depth Is a Design Decision*): "Direct creation is simpler when nothing varies, while a factory is worth adding only when the choice it hides has more than one answer in this system."

## 4. Blank lines between groups

Put a blank line between the logical groups of a method, so each group reads as 1 item. Keep the lines of each group together: where a method builds several objects and then combines them, write all the lines of 1 object before the lines of the next. Put a blank line after the block of preconditions, also where a guard checks the value that the line before it reads, and where only 1 line, such as the return, comes after the guard. Put a blank line around a condition or a loop that belongs to the method but reads dense. Without the gaps every line asks for equal attention: the compression failure. This is the book's pattern *Visual Separation*.

- Book (*The Common Pitfalls*, *Visual Separation*): "The discipline is simple: put blank lines between logical groups, so the brain gets the boundaries it needs to compress each into one item." · "keep the lines of each group together, so a product field never sits among the customer lines"
- Book (*The Common Pitfalls*, *Visual Separation*): "The guard clauses earlier showed the same move, with a blank line between the guard block and the main logic." · "blocks that belong to the method yet read dense"
- Limits: a blank line draws no boundary, so while a detail still sits among the parts, extract it instead: "The rule the two principles leave is simple: create a boundary while a detail still sits among the parts, and use visual separation once every line is already a part." Where every line is already a part, a blank line is the whole fix and a new method is not: "A blank line between two groups of them costs nothing, while a new method would only add a boundary and name nothing."

## 5. Flat nesting

Keep the number of open constructs low: a condition, a loop, an error block or a function passed to a call each stays open until it closes. Write a sequence of steps, not steps inside steps. Depth costs and length does not, so a long chain of steps reads well while a short deep method does not: the open construct overload.

- Book (*What Simple Means*, *Nesting Depth*): "One open construct costs almost nothing, two can make you read the code twice, three are worth avoiding, and four should not be written at all." · "So the shape that costs is depth rather than length, which is why a long chain of steps reads easily while a short deeply nested method does not."
- Limits: the deep blocks are usually details, so the lasting fix is often an extraction (section 2), not a new order of the same lines.

## 6. Preconditions first, and 1 named check

Put each precondition at the top of the method and leave the method when it fails, so the main work stays flat. Where several checks together say that the input is ready, move them behind 1 named check, so the rule lives in 1 place and the method reads as 1 check beside its steps. This is the book's pattern *Guard Clauses*.

- Book (*The Common Pitfalls*, *Guard Clauses*): "So the pattern applies rearrangement as a fix: lift each condition to the top and return early when it fails, which keeps the main logic flat." · "Only encapsulation and single level of abstraction resolve both failures, because each needs a boundary that rearrangement cannot add."
- Limits: a guard that returns early and a condition that wraps the steps are both fine: "So the choice between the two forms is preference, one a developer settles by habit or by what the surrounding code already uses." A guard on truly invalid input signals the failure (see correctness). Outside data is checked once, at the entry boundary that the outside actor calls, and not again in the first lines of the operations behind it; a precondition inside an operation guards only a rule that reads state the entry cannot see, such as the credit that is left, and never a rule on the request data alone, such as whether a value is 1 of the allowed values, also where the list of allowed values is stored and read while the operation runs (see correctness, section 8): "Placing the same check inside every method would add complexity without adding safety, so the error handling stays at the edge while the domain logic stays clean."

## 7. 1 question per condition

Do not join a check that a value is present with the rule that uses the value in 1 condition, and not in the expression that a method returns either: there the check is no guard, only a detail of the data being complete. Handle the missing value first, in a guard at the top, then write the rule for a present value. The returned expression is a rule of the skill, narrower than the book. After that, the reader can predict a present value through the rest of the method.

- Book (*How to Apply the Principles*, *How the Detection Works in Practice*): "Handling the missing unit first lets the reader predict a present unit through the rest of the method, so the premium check reads without the question of whether the unit is there."
- Limits: where a missing value has a natural answer, define it as a normal result instead (see correctness).

## 8. A command or a query

Let a method either return a value and change nothing, or change state and return nothing. Where 1 operation needs both, write a query, a command, and a method above them that calls them in order. A method that does both breaks the prediction of its callers, and a caller who needs 1 effect carries both. A longer honest name does not fix this. This is the book's pattern *Command-Query Separation*.

- Book (*The Principles at Every Scale*, *Command-Query Separation*): "every method should be either a command or a query, but not both" · "The two methods need an orchestrator to coordinate them, because the original operation still requires both computation and persistence."
- Limits: a builder step changes the builder and returns it, which breaks the wording of the rule while the caller still predicts the result; then the questions decide, not the wording: "A rule can break this way while the principle holds, because the rule exists to serve the principle: when the prediction holds, CQS has nothing left to protect."

## 9. No change to a passed object

Do not change an object that the caller passed in, inside a method whose name and result look like a query. Change a passed object only in a method whose name says the change and that returns nothing. Otherwise the caller's own object changes with no sign in the signature: a prediction failure, and a dependency the caller cannot see.

- Book (*The Principles at Every Scale*, *Command-Query Separation*): "In this form, the method modifies an object that the caller passed in, which means the caller's own object changes without warning and nothing in the signature reveals the mutation, so the code below should be avoided"
- Limits: a method that returns the passed value built again from its own fields keeps a detail of that value outside it; that work belongs on the type of the value (see correctness, section 5).

## 10. Calculation apart from fetching

Put a calculation or a decision in its own method or class that gets all it needs as parameters and gives all it produces as its result. Let the method above it fetch the data, call the calculation and apply the effects. This method above may read data through named calls, because it exists to coordinate. A method that both fetches and calculates mixes 2 abstraction levels, and its result depends on state that its signature does not show.

- Book (*The Principles at Every Scale*, *How the Principles Shape Methods*): "So the extraction introduces a second abstraction level where none existed: the higher abstraction level holds data gathering and orchestration, and the lower abstraction level holds pure computation whose signature declares every dependency it needs."
- Book (*How to Verify Correctness*, *How Tests Expose Design Problems*): "Most of these friction patterns point toward the same refactoring: extract the decision logic from the side effects into its own pure function or class."

## 11. No boolean parameter that chooses the work

Do not pass a flag that chooses what a method does. Where the flag chooses between 2 different operations, write 2 methods with 2 names. Where it chooses a variant of 1 operation, pass a named value of a closed set. A bare true or false at the call site predicts nothing, so every caller must read inside. This is the book's pattern *Boolean Parameter Splitting*.

- Book (*The Common Pitfalls*, *Boolean Parameter Splitting*): "In the end, from what the flag controls follows the fix: split when it hides two operations, and choose the enum when it picks a variant of one." · "If each variant later needs its own behavior as new cases appear, the Open-Closed Principle handles that growth better than an enum."

## 12. Parameters at the abstraction level of the name

Make the parameters match what the method name describes. Where a method takes plain values and groups them into 1 object as soon as it starts, or where the same few values travel together through several signatures, give them a type with a name and pass that type, and let the methods that work on those values move into it. Where a method uses 1 field of a large object, pass that field. Parameters are dependencies and do not compress, so each one is a separate item at every call site, and a value added to a group that has no type must be added at every call site. Do not add a parameter that no caller sets, or a field that no code reads, for a use that may come later; the rule on a parameter or a field for a later use is a rule of the skill, narrower than the book. This is the book's pattern *Scoped Parameters*.

- Book (*The Common Pitfalls*, *Scoped Parameters*): "Both directions violate the same principle: parameters should match what the method name describes, not sit above or below it." · "Parameters that are too narrow force callers to assemble primitives that the method immediately groups inside, which pushes structure onto every call site."
- Book (*The Common Pitfalls*, *Scoped Parameters*): "The signal for narrow parameters is traveling companions: when the same three or four values appear together across multiple signatures, they signal a missing name." · "The signal for broad parameters is unused surface: when a method touches only one field of a large object, the parameter carries too much."
- Book (*The Common Pitfalls*, *Scoped Parameters*): "Because parameters resist compression, the raw count matters" · "Aim for four parameters or fewer"
- Book (*What Software Design Means*, *When the Qualities Themselves Conflict*): "Extension points, interfaces, and factories for hypothetical future requirements increase cognitive load"
- Limits: a long list of unrelated inputs that no grouping can name is essential complexity of the domain; organize it and stop reshaping it (see comments).

## 13. The structure of other objects stays hidden

Where a method reads many fields deep inside another object, move that reading behind 1 boundary that knows the structure, and let the method call it. During a change every visible field is a dependency to track, so many of them fill working memory before the reasoning starts: the working memory overload.

- Book (*What Simple Means*, *Dependencies Become Items*): "So code with many visible dependencies exceeds capacity before reasoning begins, while code with few visible dependencies leaves room for the reasoning itself."
- Limits: the new boundary adds depth too (section 3). 1 step into a nested part of the object the method works on is not this case, because it keeps the relation visible (see classes, section 5).
