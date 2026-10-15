# Comments

Contents: 1. A named method instead of a comment that says what · 2. No comment unless it holds what no name can · 3. Generated code reshaped, not only stripped · 4. The reason of a deliberate sacrifice · 5. Essential complexity organized, with its domain knowledge · 6. The phase marks of a test

## 1. A named method instead of a comment that says what

Where you want to write a comment that says what a block does, extract the block into a method whose name says it. The wish to write such a comment is the signal to extract. A block that needs that comment is a detail among the parts, and the comment is the name the writer knew and did not write. This is the book's pattern *Self-Documenting Code*.

- Book (*The Common Pitfalls*, *Self-Documenting Code*): "When code needs a comment to explain its purpose, usually it means that a detail sits among parts of what the method describes." · "The fix is to extract each commented block into a named method, so the name communicates the intent that the comment carried."
- Limits: a block that is already a part of what the method describes needs a blank line before it, not a new method (see methods). Name the new method for the intent the comment held, not for the mechanics inside it (see naming, section 4).

## 2. No comment unless it holds what no name can

Write no comment in production code by default. Keep a comment only where it holds knowledge that no name and no structure can express: the domain context, the regulation or the ticket behind a rule, or the measured reason why code differs from the normal form. Where you want to write a comment that says what a piece of code is for, the name does not show its purpose: rename the code or extract it first. Put work that is left undone in the task tracker, not in a comment. A doc comment on a method, a class or a field that tells the steps its code takes is a comment that says what, as one above a block is. A comment that repeats the code doubles what the reader holds and adds nothing.

- Book (*The Common Pitfalls*, *Self-Documenting Code*): "By default there must be no comments in production code, and every one that stays is an exception you should be able to defend." · "Comments earn their place only when they carry knowledge that no name or structure can express, and domain context is the most common exception." · "comment about code purpose signals that the name fails to show intent"
- Book (*What Software Design Means*, *What Limits Design*): "A comment that restates what code already expresses doubles the cognitive load without adding understanding that the reader did not have."
- Limits: the reason of a deliberate sacrifice (section 4) and the domain knowledge behind a rule (section 5) are not a purpose that a name can carry, so those comments stay. A comment that stays states its knowledge short and direct, and never narrates or repeats the code beside it. How an outside system behaves is not such knowledge: the edge that talks to that system translates it into the words of the domain, so a domain comment that explains it is wrong. These 2 are rules of the skill, narrower than the book.

## 3. Generated code reshaped, not only stripped

When generated code arrives with comments that explain each block, do not only delete the comments. Reshape the code so that the names hold what the comments said, because the code is still shaped to need them.

- Book (*The Common Pitfalls*, *Self-Documenting Code*): "Removing those comments, or instructing the tool to omit them, does not help, because the generated code is still shaped to require them."

## 4. The reason of a deliberate sacrifice

Where a deadline or a measured hot path forces you to lower a quality, put the lowered code inside its own abstraction, and add a comment that names the reason the code cannot show. Return to the default order of the qualities when the pressure ends.

- Book (*What Software Design Means*, *When Business Overrides Design*): "The discipline for handling sacrifice begins with isolation: keep the compromised code separate from the system rather than allowing it to spread." · "A comment completes the discipline only where the reason cannot live in code: the performance requirement or the deadline that forced the sacrifice, which future maintainers have no other way to learn."
- Limits: "What separates the legitimate case from the damaging one is whether the sacrifice stays a decision or becomes a habit."

## 5. Essential complexity organized, with its domain knowledge

When every attempt to encapsulate leaves a long list of unrelated inputs, or the code needs domain knowledge to read, the complexity is essential. Stop reshaping it. Group similar rules where they share a shape, keep the rules explicit in the code, and let a comment hold the domain knowledge or point to it.

- Book (*What Software Design Means*, *What Limits Design*): "The distinction matters: accidental complexity can be eliminated through better abstractions, while essential complexity can only be organized within the best structure the principles achieve." · "Keep the rules explicit in the code, and let the comment carry only the domain knowledge that no name or structure can express, such as the regulation or the ticket behind a rule."

## 6. The phase marks of a test

Mark the given, when and then blocks of a test, because the marks show a schema the reader already knows (see tests). In production code, the blank lines alone group the code.

- Book (*The Common Pitfalls*, *Visual Separation*): "Together they look like the test the reader already knows, so the whole compresses and no longer needs to be read line by line." · "Production code needs no such comments: the operations in each group already reveal its purpose, so the blank lines group the code on their own."
