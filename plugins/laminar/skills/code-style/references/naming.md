# Naming

Contents: 1. A name predicts what the code holds or does · 2. Whole words, read with the outer name · 3. An action name or a value name · 4. A part named in the words of the part · 5. A constant or a value named for its purpose · 6. 1 constant for 1 rule · 7. A bare value that already says what it means · 8. A class named for what it represents · 9. Rename or reshape · 10. A collection, a boolean and a value built in steps · 11. Known terms of the industry

## 1. A name predicts what the code holds or does

Give every variable, method, class and module a name that predicts all that the code holds or does, and nothing more: no hidden side effect, no wider scope, no other kind of result than the name suggests. A reader who trusts a wrong name must give up a model and build a new one, which costs more than reading new code: a prediction failure.

- Book (*The Encapsulation Principle*, *How Naming Makes Boundaries Work*): "A name is trustworthy when the behavior it promises matches the behavior it delivers exactly, without surprises or side effects the name does not mention." · "The name acts as a boundary between the computation that produced the value and every line that uses it afterward."
- Book (*How to Apply the Principles*, *How to Detect Simplicity Problems*): "Unfamiliar code builds a model from nothing, while a prediction failure forces the reader to discard a wrong model before building the right one."
- Limits: where the code does more than the name says, change the code before the name (section 9).

## 2. Whole words, read with the outer name

Write names in whole words. Do not use abbreviations, placeholders or general words that name no particular thing. Judge a name together with the name it is read beside: the class or variable before a method, the type around a field. Where the outer name already says the purpose, the inner name does not repeat it. Where the outer name is general, the inner name carries the meaning. The reason is prediction: a vague name predicts nothing, so the reader opens the code each time.

- Book (*What Simple Means*, *Names as Retrieval Cues*): "A vague name breaks the handle both ways, because it predicts nothing and recalls nothing"
- Book (*The Encapsulation Principle*, *How Naming Makes Boundaries Work*): "The rule is not that general method names are bad, but that the class and method together must give readers enough to predict the result." · "The outer name gives context to the inner one, so when the outside already names the purpose, the inside does not need to repeat it."
- Limits: the outer name gives context to the inner name, but the pair together must still predict the result. A general method name, such as execute or process, fits only a class whose name says the action; on a class whose name names a thing, it is not a part of that thing, even where the pair predicts the result. This rule of the skill is narrower than the book.
- A short form that is the usual word for a thing, such as id, URL or JSON, is a whole word. A single letter is a name only for the index of a loop, such as i or j, and never for a value or a parameter of a function passed to a call. A word such as data, info, item, result or context names no particular thing, as the book says of context: "a word that names no particular thing". These are rules of the skill, narrower than the book.

## 3. An action name or a value name

Start every method name with a verb that states the work the method does. A noun phrase, or a name that starts with a word that relates instead of acting, such as to, from, of, as, into, for or by, does not say what the method does to its input. This rule of the skill is narrower than the book, which also accepts a conversion name; it holds in every language. Give a value name only to a method that exposes a value and takes no input, such as a read of 1 field of a data type, and keep names that the language or a framework fixes. A step of a builder may be named by the word with followed by the field it sets, or by the bare field; the bare field reads like a read of that field, so a review may ask about it. Give each verb 1 meaning across the code, and use the same verb wherever that meaning comes back. These are rules of the skill, narrower than the book. A method named to find or to get may return no item where the item is missing. A method that fails where the item is missing names that it requires the item, such as with the verb require; this rule of the skill is narrower than the book. The wrong kind of name breaks the prediction of every caller.

- Book (*The Encapsulation Principle*, *How Naming Makes Boundaries Work*): "That prediction also separates two kinds of name: an action name promises the method does something, while a value name promises a result." · "A value name fits only the opposite case, where the method exposes a value without taking input."
- Book (*What Simple Means*, *Long-Term Memory and Schemas*): "The repository lookup schema captures another pattern: take an identifier, query a data source, return an entity or indicate absence."

## 4. A part named in the words of the part

Name an extracted method for the part it is of its caller, in the words of the caller, such as a business step. Do not name it for the mechanics inside it, such as a loop, a check or a store. A name made of detail words hides the code but leaves a detail among the parts of the caller: the unnamed part failure stays.

- Book (*The Single Level of Abstraction Principle*, *How Both Principles Work Together*): "A name that predicts behavior but states a detail still leaves the caller with no part to recognize, so compression there drops to the slow path."
- Book (*The Single Level of Abstraction Principle*, *Summary*): "Whether that helps depends on the new name, because a name built from details leaves a detail among the parts even behind a boundary."

## 5. A constant or a value named for its purpose

Where a literal hides its meaning, replace it with a constant named for the business purpose of the value. Put the purpose first, and end with the kind of value, such as days, rate, threshold or key. Where the constant holds a behavior, such as an ordering, its kind is the role it plays, such as comparator. Name every other value the same way, a variable, a field or a parameter: purpose first, kind last, because a variable is an abstraction too and its use site shows no more than the use site of a constant. A name made of the value says what the value is, not what it controls: a prediction failure. The kind word tells the reader how to use the value. This is the book's pattern *Context-Aware Constants*.

- Book (*The Common Pitfalls*, *Context-Aware Constants*): "The fix is to name each constant for its business purpose, so readers learn what the value means rather than what the value is." · "So the rule is to name the purpose first and end with the kind, the role the value plays" · "The name carries the kind because the use site shows nothing else, which is the same reason a name must predict behavior at every other boundary."
- Book (*The Common Pitfalls*, *Context-Aware Constants*): "The same pairing extends to constants that hold a behavior, where the kind is the role the value plays." · "The kind also predicts how to use the constant, since the reader applies an ordering differently from a count or a key." · "Without the kind, the reader cannot tell a count from a threshold, or a lookup key from the value it retrieves."
- Book (*The Encapsulation Principle*, *Separating Then Hiding*): "A variable is an abstraction: the variable name is the boundary, and the expression that gave it a value stays hidden."
- Limits: a value that is clear where it stands stays bare (section 7).

## 6. 1 constant for 1 rule

Give each business rule its own constant, also where 2 rules use the same value today. Declare the constant private in the class that uses it. Where you want to share a constant across classes, look for the abstraction that must own the decision. 1 constant for 2 unrelated rules ties them together with no signal: an incomplete mental model. This is *Context-Aware Constants* too.

- Book (*The Common Pitfalls*, *Context-Aware Constants*): "When a constant deserves a name, define it as private in the class that uses it, because a constant used in one place belongs there." · "The urge to share a constant across classes signals a value-named constant used differently by each class, or a missing abstraction that should own it."
- Limits: a shared constant gives the value 1 home, but not the decision that uses it. Where several places make the same decision with the value, the decision needs 1 owner.

## 7. A bare value that already says what it means

Do not make a constant for a value that is clear where it stands. Name a value only where it hides meaning, or where unrelated rules share it. A constant that adds no meaning makes the reader look up a name for nothing. This limits sections 5 and 6, and it holds in tests too: a literal in a test stays, unless the literal alone sets up the condition that the test name states; then a name explains it, and a local variable is enough.

- Book (*The Common Pitfalls*, *Context-Aware Constants*): "Not every literal value needs a constant, because a name helps only when the bare value hides something: either meaning the reader cannot recover, or a shared value that unrelated rules depend on." · "When neither condition holds, the bare value already carries its own meaning, so a constant would only add noise."

## 8. A class named for what it represents

Name a class for the 1 thing it represents or the 1 work it does. The name sets what belongs inside, so every public method must fit it. A failure of a class name repeats at every public method, so it costs more than a failure at method scale.

- Book (*The Principles at Every Scale*, *How the Principles Shape Classes*): "Where method names predict single operations, class names predict the operations they group together, so the name shapes expectations about what belongs inside." · "A failure at this boundary multiplies across every public method, which makes class-scale failures costlier than at method scale."
- Limits: a broad name, such as one that covers validation, formatting and storage at once, rejects nothing and predicts nothing. Reshape the class (section 9).

## 9. Rename or reshape

When you cannot find a short honest name, look at what the abstraction holds before you look for a better name. Where it holds unrelated behavior, move each piece of behavior to the abstraction it belongs to. A name that lists unrelated jobs is a signal and not the fix: a longer honest name fixes the prediction failure, but the reader still holds both jobs. Where the grouping is right and only the name is imprecise, rename and do not reshape.

- Book (*The Encapsulation Principle*, *When No Name Works*): "A naming problem needs a more precise name, while an abstraction problem needs the behavior redistributed across different abstractions." · "when naming an abstraction feels difficult, check what the abstraction contains before searching for a better name"
- Book (*How to Apply the Principles*, *How the Principles Restore Simplicity*): "Renaming the boundary without fixing the grouping only hides this signal, leaving callers to trust a name the code cannot deliver."
- Book (*The Principles at Every Scale*, *Command-Query Separation*): "Renaming addresses the prediction failure but not the working memory overload, so both failures require a structural fix."

## 10. A collection, a boolean and a value built in steps

Name a collection that holds entries by a key for the entries, then the key, and end with a word for the kind of collection, such as map or index. A name that states only the key, or only the plural of the entries, does not tell the reader both what the collection holds and how to find it. Name a boolean for what its condition looks for, in the positive form and with a prefix such as is, has, can or should, and state how many the condition counts where a plural leaves it open, such as any or all. Name a value that holds an entry found among others for the kind of that entry, and not for the fact that the entry reports. Name a value made from another value in several steps for the whole result, not only for the last step. These are rules of the skill, narrower than the book; each one keeps a name from claiming more or less than the value holds, which is a prediction failure.

- Limits: where a framework fills a collection by a key, the key may be left out of the name, and the word for the kind of collection stays. A boolean does not repeat where its condition looks where the outer name already says it.

## 11. Known terms of the industry

Where the industry has a known term for a thing, such as rate limit, use that term and its usual word order, and do not invent a new word. Where no such term exists, use plain everyday words that a reader with basic English knows. A known term calls up a schema the reader already holds, so the name reads as 1 item. This rule of the skill is narrower than the book. Agreement with other code of the repository is a weaker reason, and it never keeps a name that these rules reject.
