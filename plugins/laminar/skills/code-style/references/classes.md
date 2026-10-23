# Classes

Contents: 1. Every public method fits the class name · 2. Coordination above, details below · 3. A private method answers to its own name · 4. A group of methods that is a class of its own · 5. Fields that belong together · 6. A category as a closed set · 7. Construction rules in 1 place · 8. A boundary for behavior that keeps growing · 9. 1 home for 1 decision, and look-alike code kept apart · 10. Framework markers and framework behavior · 11. No storage copy of a domain object · 12. Composition over inheritance

In this file a class also means a file or a module of functions that share 1 name, where the language has no classes.

## 1. Every public method fits the class name

Add a public method to a class only where it serves what the class name describes. Read the signatures: the methods of 1 class work with the same types. A method whose types differ from the rest belongs elsewhere. A class that collects methods outside its name holds parts the name never names, and a change to 1 group can break another group that the developer never opened. This is the book's pattern *Single-Level Methods*.

- Book (*The Common Pitfalls*, *Single-Level Methods*): "A public method belongs in the class only when it serves what the class name describes, and any that fails this check belongs elsewhere." · "When every method belongs to what the class name describes, signatures group around the same types."
- A method that computes a business result does not belong on a class whose name only names the collection it holds, such as the plural of its values, because that name predicts no rule; name the class for the business idea, or move the method. This rule of the skill is narrower than the book.
- Limits: no count of methods sets the size of a class. Read both the name and the types: a broad class name rejects nothing, so a method can fit the name and still break the type pattern of its neighbours, and a method can take and return the class's own types while its name places it outside the class: "The first check catches methods that fall outside what the class name describes, but signature consistency catches methods that break the signature pattern even within the right class."

## 2. Coordination above, details below

Where a method combines 2 abstractions, put it in a caller that holds both, not in the class that owns 1 of them. Where a method drops into details, put it inside a lower abstraction. After you split methods across classes, align the signatures inside each class: where 1 method takes whole objects and its neighbours take identifiers, it mixes 2 abstraction levels. This is *Single-Level Methods* too.

- Book (*The Common Pitfalls*, *Single-Level Methods*): "Public methods that fall outside what the class name describes are details that leaked into the wrong abstraction, and they belong elsewhere: above as a coordinator, or below as a detail."
- A domain operation that takes back pieces of the domain's own output that a caller made, and only unpacks, filters or merges them before it hands them to rules the domain already has, is work of that caller: keep it in the caller. This rule of the skill is narrower than the book.
- Book (*The Common Pitfalls*, *Single-Level Methods*): "This second fix shows that the same principle applies at two scales: first split methods across classes by what each name describes, then align signatures within each class."

## 3. A private method answers to its own name

Hold every public method to the class name. Hold a private method to its own name: what is inside it must be a part of what its name describes. Decide by whether a caller can reach the code, not by what kind of code it is.

- Book (*The Common Pitfalls*, *Single-Level Methods*): "What settles each case is whether callers can reach the code, not the kind of code it is, because a class name promises nothing about code that no caller can reach through it." · "A private method is still an abstraction with its own name, so SLAP judges its internals against that name, but the class name that hides it makes no such demand."
- Limits: private methods still count for section 4, because "dependencies are working memory items during modification".

## 4. A group of methods that is a class of its own

Decide this when you extract a part. Where the part brings a field, a parameter or a collaborator that no public method of the class uses, or works with a different set of objects than the rest, it is a part of its own: give it its own class, named after the part, and give the first class a field of that type. The reader then finds the part by its name, and its state no longer stands beside every change of the class.

- Book (*The Encapsulation Principle*, *When No Name Works*): "Methods that share parameters the other methods never use operate within an abstraction smaller than the full class." · "Methods that use a completely different set of objects to do their work belong behind different boundaries."
- Why: "dependencies are working memory items during modification", so the developer who changes the class holds every private group in mind.
- A private method that serves the whole stays private, however many there are: "Each helper method isolates its own dependencies from the others, which means changing one piece does not require understanding the rest of the method at all."
- Work that only runs other work of the class, such as storing its results to look them up again, retrying it or cutting it into batches, sits at another abstraction level than that work: put it in a class of its own. This is derived from the rule that a method outside the class name belongs "above as a coordinator, or below as a detail".
- A class that routes each case to its own private methods can stay 1 class while the set of cases is closed: "this minimum fix is enough when the provider list is closed and new providers are rare."
- Limits: a split adds depth like any extraction, so split only where the group has a name of its own; a count of methods or fields never decides. Methods that change together but apart from the rest are a group too: "Methods that always change together but separately from their neighbors form a group the rest of the class does not join." A test that wants to reach a private method points at the same group: "The urge to test a private method directly signals logic that needs its own class."

## 5. Fields that belong together

Where some fields of a class always appear together and the business treats them as 1 whole, move them into a type of their own and hold 1 field of that type. Group the fields as the business thinks of them, not as the storage table lays them out. Where a type already groups the same values as a parameter, use that type for the fields too. Name a field inside a type without repeating the name of the type. Let a type named for a role hold only what that role names: a type of search criteria holds the filters, and paging, sorting or the choice of fields go into types of their own. This holds for the types of a schema that an application exposes too. The rules on the field name, on a type named for a role and on schema types are rules of the skill, narrower than the book. A flat list of fields gives the reader no group, and it holds details of parts that the class never names. This is the book's pattern *Single-Level Fields*.

- Book (*The Common Pitfalls*, *Single-Level Fields*): "Whenever a set of fields always appears together and the business treats them as one whole, those fields belong inside an abstraction." · "This pattern is SLAP applied to the fields of the class: each field should be a part of what the class name describes, not a detail of a part."
- Book (*The Common Pitfalls*, *Single-Level Fields*): "Data classes often start flat because databases store data in tables with columns, so the initial structure mirrors the schema rather than the domain." · "the same abstraction the Scoped Parameters fix used at the method signature, reused here to group fields"
- Book (*The Encapsulation Principle*, *How Naming Makes Boundaries Work*): "The outer name gives context to the inner one, so when the outside already names the purpose, the inside does not need to repeat it."
- Limits: a caller then reaches a nested value through 1 more step, and that step is the price of a visible relation, not a structure to hide: "takes one more step than a flat field, but keeps the relationship between order and address visible at the call site"

## 6. A category as a closed set

Where boolean fields describe what kind of thing an object is, replace them with 1 closed set of named values for each dimension that the domain treats as exclusive. This holds for 1 boolean field too, where its name names 1 value of a category, even with no other field of that category beside it. Do the same where a state or a category is held as text or a number and compared with fixed values: a caller can store a value outside the set, and every place that compares holds its own copy of the set. Text compared with 1 named constant that holds a code is such a case, even where only 1 code is in sight, because a named code is 1 member of a set. An id that names 1 entity registered as data, in this system or another, such as 1 warehouse that an admin adds to a table of the application, 1 plant or 1 sales organization, is not such a case, because every other id is legal and takes the normal path: keep the id as text, keep the few ids that 1 decision tests in a set inside the rule that makes it, named for that decision, and let a second class that needs the same decision call 1 method of that rule on the id. The same id in the sets of 2 decisions is 2 decisions and not a copy. A code for a kind that many things share, such as a delivery state, a frame class or a payment method, is never such an id: it stays a category, even where it is stored as data or comes from the data of another system. Where a type has an unknown or empty case, give it a named value or a factory on the type, so no caller builds or compares a raw text, an empty value or a missing value for it. The rules on a state or a category held as text or a number, on an id that names 1 entity registered as data and on an unknown or empty case are rules of the skill, narrower than the book. Do it early, before data is stored. A better name for a boolean does not fix it, because the value still says only true or false. Booleans allow combinations that the domain forbids, and every condition that reads them holds its own copy of which combinations are valid. This is the book's pattern *Enums Over Boolean Flags*.

- Book (*The Common Pitfalls*, *Enums Over Boolean Flags*): "All three recommendations share one core idea: a boolean field that represents a domain category should become an enum that makes valid states explicit." · "Each new boolean doubles the state space, while each new enum value adds exactly one state to its dimension." · "The variable name carries intent but the value carries none, so renaming fixes nothing."
- Book (*The Common Pitfalls*, *Enums Over Boolean Flags*): "Yet most flags turn out to be a category, and a category rarely stays at two values." · "Modeling it as an enum early puts the category in one place" · "types that prevent invalid states move the constraint from many separate conditionals into one enforced location"
- Limits: a boolean that is a real state of the object stays a boolean, because such flags "describe a real state of the object, not a category". Let the type carry a combination, beside any check in the constructor or builder, because "Only the type carries the decision for the whole codebase at once". Keep the sets of 2 decisions apart even where they hold the same id, because "unrelated business rules must not share one abstraction even when their code looks identical".

## 7. Construction rules in 1 place

Where an object needs parts that depend on each other, do not let callers assemble it step by step in the right order. Put the rules in 1 place, such as a builder whose last step checks that the object is complete and valid, or a constructor. Let 1 step of the builder set the values that depend on each other together, and let 1 step take a group of parts at once, so no caller must know an order. Name each step by the rule of naming, section 3. When the caller must know internal rules to use an object correctly, those rules live in every place that creates it. This is the book's pattern *Builder*.

- Book (*The Common Pitfalls*, *Builder*): "The signal is the same as in other encapsulation failures: when the caller must hold knowledge about internal rules to use an object correctly, those rules belong behind a boundary that enforces them." · "The fix encapsulates the construction protocol behind a builder that enforces rules in one place"
- Book (*The Common Pitfalls*, *Builder*): "Each setter call carries a hidden dependency on previous calls" · "The caller's working memory now holds what the document contains rather than how to assemble it correctly"
- Limits: a builder does not stop other ways of creation from building a forbidden mix; where the rule is a combination of values, let the type carry it (see correctness). The steps of a builder change it and return it, which breaks the wording of command-query separation and not its principle (see methods, section 8).

## 8. A boundary for behavior that keeps growing

Where new cases keep arriving, such as new providers, put the varying behavior behind 1 contract with 1 class per case, so a new case is new code. First check whether a smaller fix, 1 class that keeps the branching inside, already removes the failure. Ask where the behavior will change next, and add the boundary only where variation is seen or expected. This is the book's pattern *Open-Closed Principle*.

- Book (*The Principles at Every Scale*, *Open-Closed Principle*): "The practitioner's version of this decision is a question: if this behavior changes next year, where will that change happen?" · "Even where change is expected, check whether the minimum fix already solves the cognitive failure." · "The full Open-Closed split earns its place only when new providers keep arriving, where it accepts each new provider as new code without changing working methods."
- Limits: the api and spi interfaces of a module in the hexagonal shape are not this choice; they exist because the application is an abstraction, also with 1 implementation (see modules, section 4). Events hide which classes react, which leaves the reader with an incomplete mental model: "So events earn their place only when their benefit outweighs that cost: many classes react, and each belongs to a different part of the system."

## 9. 1 home for 1 decision, and look-alike code kept apart

Where the same business decision is written in several places, move it behind 1 boundary. Where 2 pieces of code look the same but serve different business rules, keep them apart, also where a tool reports a duplicate. A repeated decision drifts with no signal. 2 rules merged into 1 abstraction change together with no signal, which is the same failure. This is the book's pattern *Don't Repeat Yourself*.

- Book (*The Principles at Every Scale*, *Don't Repeat Yourself*): "DRY says to create an abstraction so the same knowledge has one home, with the caveat that unrelated business rules must not share one abstraction even when their code looks identical." · "Ignoring a tool warning is trivial, while fixing a wrong abstraction requires a refactoring that touches every caller."
- The same routing on 1 value in 2 conditionals is 1 decision in 2 places, because "a developer who adds a provider to one conditional has no signal that the other exists". Give the routing 1 owner: first 1 class that keeps the branching inside, and a contract with 1 class per case only where cases keep arriving (section 8).
- Limits: whether 2 pieces of code are 1 rule or 2 is a question of the business, which no tool answers.

## 10. Framework markers and framework behavior

On a domain object, keep a framework marker that only describes a field or a parameter and does nothing when the logic runs. Move framework behavior that runs on its own, such as loading on first use or logic that runs on save, out of the domain object. Active behavior looks like plain business logic, so the reader predicts it does nothing extra, and that prediction is wrong.

- Book (*The Principles at Every Scale*, *Hexagonal Architecture*): "Some framework presence is only a marker on a field: it records how the field is stored and does nothing by itself when the logic runs." · "A marker can sit among business rules because the reader takes it in like a type name, but active behavior cannot." · "So I recommend keeping the markers and moving the behavior outside, which leaves a single domain object that still reads as business logic."

## 11. No storage copy of a domain object

Do not split a domain object into a domain copy and a storage copy joined by a converter only to keep storage markers out of the domain. The second copy repeats the same fields, and the converter must change whenever either side does.

- Book (*The Principles at Every Scale*, *Hexagonal Architecture*): "So the second copy changes nothing for the better, and only repeats the same fields, tied to a converter that must change whenever either side does."
- Limits: a type that 1 module exposes to other modules, mapped at the edge of each module, is the price of a module boundary and not this case (see modules).

## 12. Composition over inheritance

Give a class the behavior it needs through fields of other types that it calls, not through a chain of base classes. A reader of a subclass must hold every base class in mind to predict what a method does. The book reports the old warning, "Favor object composition over class inheritance", and this rule of the skill is narrower than the book.

- Book (*What Quality Means*, *What Objects Promised (1980-1995)*): "Reading a single method required understanding its parents, grandparents, and every override along the way."
- Limits: a class that implements a contract, such as an interface of the application, is not inheritance in this sense. 1 abstract base for the variants of 1 shape is fine where the base extends no other class of the project, every subclass is final, and no subclass overrides a concrete method of the base: a reader of a subclass then holds exactly 1 parent and no override to trace. A base whose subclasses override its concrete methods, or a chain of 2 or more base classes, stays under this rule, because there "Developers traced execution through deep inheritance hierarchies, bouncing between parent and child classes repeatedly without ever understanding what happened." and "changing a parent broke children in unexpected ways".
