# Correctness while you design and write

Contents: 1. A boundary that exposes only valid uses · 2. A type for each valid case · 3. A single owner for each decision · 4. State changed only through the abstraction · 5. Immutable where nothing must change · 6. An edge case as a normal result · 7. No hidden dependencies · 8. Outside data checked once, at the entry · 9. Outside data is never safe · 10. Fail fast, and handle failures in 1 place · 11. Where prevention stops · 12. Few logs

The book names 6 design decisions that prevent errors before the code runs. Each entry names its decision in italics.

## 1. A boundary that exposes only valid uses

Design each boundary so that everything it exposes is valid. Make it easy to use correctly and hard to use incorrectly. A caller can use only what the boundary exposes, so a boundary with only valid uses removes whole kinds of error before the code runs.

- Book (*What Correctness Means*, *How Abstraction Design Prevents Errors*): "A caller can use only what that boundary exposes, so if everything it exposes is valid, the caller cannot do anything invalid."
- Book (*What Correctness Means*, *What Correct Means*): "make interfaces easy to use correctly and hard to use incorrectly"

## 2. A type for each valid case

Where a value is in 1 of several states and each state has its own data, give each state its own type that holds only its data. Let the compiler check that every case is handled, so a new case breaks the build where it is forgotten. 1 type with fields that are valid only in some states lets a caller read a field that the state does not have. This is the design decision *Exclude Illegal States*.

- Book (*What Correctness Means*, *Exclude Illegal States*): "You define the types so the compiler rejects the invalid mix before the code runs." · "Adding a new variant then breaks the build everywhere the set is used but not fully covered, so no state gets forgotten when the set grows."
- Limits: "Yet a type reaches only as far as the language can encode the rule, so many decisions still live outside the type system."

## 3. A single owner for each decision

Put each business decision in 1 abstraction, and let every caller reach it through that boundary, so a change of the rule has 1 place to change. Copies of a decision drift apart, and the system then gives different answers on different paths. This is the design decision *Have a Single Owner*.

- Book (*What Correctness Means*, *Have a Single Owner*): "A decision repeated in many places will drift over time, so giving it a single owner is the next design decision that prevents errors." · "The fix is encapsulation: one abstraction owns the decision, and every caller reaches it through that boundary."
- Limits: code that looks the same is not always the same decision (see classes). A copy in 2 applications that deploy apart can be a deliberate choice (see modules).

## 4. State changed only through the abstraction

Where a rule limits the values or the steps of a state, do not let callers set the state directly. Put each change behind a method of the abstraction that refuses a change the rule forbids. Where the allowed step depends on the current state, keep the state inside and refuse a wrong step. Reject an invalid combination at creation too, in the constructor or in the last step of a builder. Do not hand out a changeable field that the rules limit, such as a collection: give the caller a copy, a view that cannot change, or an operation instead of the data. This is the design decision *Protect the State*.

- Book (*What Correctness Means*, *Protect the State*): "Prevention comes from an abstraction that protects its state and controls every transition into it." · "In cases when the decision depends only on the new value, a simpler enforcement is enough: the method that applies the change refuses the value before the object stores it." · "A constructor does this by rejecting any input that would build an invalid combination, so that combination never reaches the object at all." · "When an object exposes setters or mutable fields, every holder of a reference becomes a possible source of change no one expected."

## 5. Immutable where nothing must change

Where the state of an object does not need to change after creation, make it immutable, in the forms the language offers. Every holder of a reference to a changeable object can make a change that no one expects. Work that builds the value again from its own fields belongs on the type of the value, not in a method outside it that returns a new copy. Only work that adds data from another source belongs to a caller that coordinates both. This is *Protect the State* taken to its end.

- Book (*What Correctness Means*, *Protect the State*): "Immutability is state protection taken to its limit, because the abstraction protects its state by allowing no transition at all." · "Yet where state does not need to change, making it immutable removes a whole category of error for free."
- Book (*The Common Pitfalls*, *Scoped Parameters*): "the methods that work mostly on those fields belong on the new class and tend to move there"
- Book (*The Common Pitfalls*, *Single-Level Methods*): "The enrichment logic that combines products with reviews belongs to a caller that coordinates both classes, not to the service that owns one of them."
- Limits: "Not every object can or should be immutable, because some genuinely model state that changes." Such an object protects each change of its state (section 4).

## 6. An edge case as a normal result

Where an input is unusual but not wrong, such as a missing value or an empty list, define the operation so it gives a normal result: an empty collection, a default, or the end state the caller wants. Then no caller needs a check or a recovery step for it. This is the design decision *Remove Edge Cases*.

- Book (*What Correctness Means*, *Remove Edge Cases*): "When an operation treats these as normal results rather than errors, its callers never have to check for them or handle a failure." · "A repository method that returns an empty collection when no rows match removes the exception its callers would otherwise have to check for."
- Limits: an input that is truly wrong cannot become a normal result (sections 8 and 10).

## 7. No hidden dependencies

Write a calculation so it reads only its inputs and changes nothing outside itself. Most languages do not check this, so you keep it by hand. A function that reads state that another part can change depends on that part, and its signature does not show it; the order of calls or of threads can then change its result. A value the code draws from the world outside its inputs, such as the current time or a new random identifier, is such a dependency: take it from a parameter or from a source the class receives, as you take a clock. This is the design decision *Remove Hidden Dependencies*.

- Book (*What Correctness Means*, *Remove Hidden Dependencies*): "When a function reads state that another part of the system can change, it depends on that part, but its signature cannot show that link." · "A pure function reads only its inputs and changes nothing outside itself, so it never touches state that other code shares."

## 8. Outside data checked once, at the entry

Check data from outside where it enters the application: in the method that the outside actor calls, such as the method that receives a request or a message, or the method that a scheduled job runs. Inside, do not check the same rule again, also not in the first lines of the operation that the entry calls; trust what passed the entry. A precondition inside an operation guards the rules of that operation, such as a state that the work itself can reach, and not the request data again. The entry boundary is the 1 place where the data has met no rule yet. This is the design decision *Validate at the Boundary*.

- Book (*What Correctness Means*, *Validate at the Boundary*): "That check belongs at the entry boundary, which lets every abstraction inside trust the data that passes." · "Placing the same check inside every method would add complexity without adding safety, so the error handling stays at the edge while the domain logic stays clean." · "check once at the edge, then trust what flows past it" · "Yet even a validated input can drive the abstraction into a bad state while it runs"
- Book (*What Testing Means*, *What Testing Means*): "Application entry boundaries are where external actors invoke the application"
- Limits: the business rules of the domain stay in the domain; the entry checks the outside data (see methods, section 6). A check at the entry covers only the rule it states, so check every rule of the outside data there, such as its range as well as its presence; check the range at the entry too, not inside after a presence check at the entry, because "Once the boundary confirms that the inputs meet their rules, the inner methods run without repeating those checks".

## 9. Outside data is never safe

Treat data from outside as data that can come from an attacker. Meet the expectations that no ticket writes down: no injection, no secret in a log, no crash or loss of data on bad input. Code that breaks such an expectation is incorrect. This is *Validate at the Boundary* too.

- Book (*What Correctness Means*, *Validate at the Boundary*): "Some of that data can come from an attacker looking for a missing check, which is why the boundary can never treat outside data as safe."
- Book (*What Correctness Means*, *What Correct Means*): "Code that violates these implicit expectations is incorrect, regardless of what the explicit requirements say."

## 10. Fail fast, and handle failures in 1 place

Where the code meets a truly invalid state, stop and signal the failure. Do not return in silence, and do not try to recover in place. Let 1 global place turn every failure into a response, so methods hold no recovery code. A program that runs on in a broken state gives results that look right but are wrong, and those cost far more to trace. This is the design decision *Fail Fast*.

- Book (*What Correctness Means*, *Fail Fast*): "This means the code stops at the first sign of a bad state, rather than running past it." · "A single global exception handler makes this practical, because it gathers all failures in one place instead of spreading recovery code through every method."
- Write the message of a failure for the developer who reads it in the log; that global place decides what the caller sees, as it "logs the context for later review, and returns a clean error response". This rule of the skill is narrower than the book.
- Limits: an unusual input with a natural answer gets a normal result (section 6), and that is not running past a bad state. "Some inputs are just wrong, and no change to what an operation means can turn them into a normal result, so the code must check them somewhere." The domain decides which inputs are truly invalid.

## 11. Where prevention stops

After you shape the types and the boundaries, still test the results. A formula or a rate can be wrong in code that is defined correctly, and only running the code shows it.

- Book (*What Correctness Means*, *Where Prevention Stops*): "Prevention ends here, because it closes every error in how an abstraction is defined, yet only running the code can judge whether the results are right."

## 12. Few logs

Log failures and the few events that the people who run the application need, once, where they are handled; do not log the inner steps of an operation, and do not log in tests. Each log line is 1 more item for the reader of the code and of the log. Never log a secret or personal data from outside (section 9). This rule of the skill is narrower than the book.

- Book (*What Correctness Means*, *What Correct Means*): "don't expose passwords in logs"
