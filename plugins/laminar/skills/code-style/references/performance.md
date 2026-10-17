# Performance

Contents: 1. Batched I/O, not I/O in a loop · 2. Shared data fetched once per operation · 3. Only the data the operation needs · 4. An expensive resource created once · 5. 1 owner for each kind of I/O · 6. Data movement, not computation · 7. Simple algorithms unless N is large · 8. A threshold, a measurement, the hot path · 9. When the fix of waste costs simplicity

Waste is work that a known alternative does with less data movement. Avoid it while you write: it needs no measurement, and the better form costs no simplicity. Everything else about speed waits for a measurement.

- Book (*What Fast Enough Means*, *Avoid Waste*): "Waste avoidance is one of those decisions, because the alternative does the same job with less data movement at no cost in simplicity."

## 1. Batched I/O, not I/O in a loop

Do not run 1 query, 1 remote call or 1 file read per item in a loop. Use 1 batch operation for all items. Each round trip carries the full cost of data movement. Calls per item that run side by side are still 1 call per item, and a chain of calls to 1 service where 1 composed call returns the same data is the same waste. Where each item seems to need its own I/O, such as a migration that writes each record, still use the batch form of the operation where one exists or can be built. The rules on calls side by side, on a chain of calls to 1 service and on items that seem to need their own I/O are rules of the skill, narrower than the book.

- Book (*What Fast Enough Means*, *Avoid Waste*): "Batch operations instead of issuing them in loops: replace N individual queries with one query that returns the same data, replace N API calls with one batch request, and replace N individual file reads with one combined load."
- The match of each answer to its input: prefer an answer that carries its own key, such as the identifier it was asked for. An answer matched back by its position in the list, or by another key made up for the call, holds 1 decision in 2 places, the place that builds the request and the place that reads the answer, and nothing tells the reader of 1 place about the other. This is derived from the rule (*How to Apply the Principles*, *How to Detect Simplicity Problems*) that "when the same decision lives in many places, the mental model at each location feels finished and the reasoning feels sound"
- The work around the call: cutting the items into batches of a size, trying a call again and keeping its answers only run the call, so they sit at another abstraction level than the work that uses the answers. Put them into an abstraction of their own, above the work as a coordinator or below it as a detail (see classes, section 4). A cache also adds state to keep consistent (section 9). This is derived from the rule (*The Common Pitfalls*, *Single-Level Methods*) that such work belongs "above as a coordinator, or below as a detail".

## 2. Shared data fetched once per operation

Load the data that several steps need once, at the start of the operation, and pass it to each step. Do not let each step fetch it again.

- Book (*What Fast Enough Means*, *Avoid Waste*): "Fetch shared data once per operation: load it at the start and pass the result to every step that needs it, instead of refetching independently from each step."

## 3. Only the data the operation needs

Select the fields the operation uses, not whole rows or whole objects; where the operation needs only how many rows match, ask the store for the count, and do not load the rows to count them. Do not build a full object through a general conversion layer for a caller that reads 2 fields. Data that the operation drops still crosses the I/O boundary.

- Book (*What Fast Enough Means*, *Avoid Waste*): "Request only the data the operation needs: select specific columns instead of entire rows, return specific fields instead of full objects, and load thumbnails instead of full-resolution images when the display requires less."
- Book (*What Fast Enough Means*, *What Waste Means*): "Any layered architecture with a generic conversion layer produces this anti-pattern across domains and stacks."

## 4. An expensive resource created once

Pool connections, remote clients and file handles, and reuse them. Do not create 1 per operation, because the setup crosses a boundary each time.

- Book (*What Fast Enough Means*, *Avoid Waste*): "Pool expensive resources instead of creating them per operation: database connections, HTTP clients, and file handles all carry setup costs that pooling pays only once."

## 5. 1 owner for each kind of I/O

Reach I/O through the abstraction that owns it, and create that owner for a new kind of I/O; move other callers only where the change already touches them. Then all callers go through 1 owner, so a batch, a narrower request or a pool reaches every caller at once. Without an owner, the I/O decision lives in many callers, and each one can bring the waste back.

- Book (*What Fast Enough Means*, *What Waste Means*): "The four anti-patterns need different techniques to fix, but all four fixes work only when an abstraction owns the I/O." · "A developer therefore pays once and benefits twice, first in simpler code and then in reliable performance fixes."

## 6. Data movement, not computation

Do not tune computation from reading the code. Do not merge loops or avoid small methods and interfaces for speed. Count the I/O operations and the data they move, and compare them with the alternative. Compilers inline small methods, so an extraction for simplicity rarely costs time.

- Book (*What Fast Enough Means*, *What Waste Means*): "Computation does not count, because its cost is too small or too unpredictable to reason about from code, while data movement carries a known cost set by physics."
- Book (*What Fast Enough Means*, *Why You Can Reason About Waste*): "So data movement is the measure, which means the number of loops in a method says nothing about whether the code wastes anything."
- Book (*What Fast Enough Means*, *The Code You Write Is Not the Code That Executes*): "A function extracted for simplicity rarely adds runtime cost, because compilers inline small methods automatically in most modern language implementations."

## 7. Simple algorithms unless N is large

Prefer the simple algorithm and the simple data structure. Choose a more complex algorithm only where the domain tells you that the number of items is large, as in exports, migrations and batch jobs over full data sets.

- Book (*What Fast Enough Means*, *Pike's Rules*): "Fancy algorithms are slow when n is small, and n is usually small."
- Book (*What Fast Enough Means*, *Why You Can Reason About Waste*): "In work like product exports, data migrations, and batch jobs that process full datasets, you already know how many items the system holds, so you can see the waste while writing rather than after measuring."

## 8. A threshold, a measurement, the hot path

Before you tune for speed, know the threshold that fast enough means for this code. Measure under realistic conditions, and tune only what the profile shows. Keep the tuned code small and isolated, with a comment that gives the reason. Stop when the threshold is met.

- Book (*What Fast Enough Means*, *Measure Against the Threshold*): "Optimize only what the profile identifies, because code outside the hot path does not benefit from optimization no matter how much time you spend on it." · "Code on the hot path may require sacrificing some simplicity for speed, but this sacrifice should be minimal in scope, isolated, and marked with a comment that explains why the code deviates from normal patterns."
- Book (*What Fast Enough Means*, *Define the Threshold*): "From this meaning emerges a practical direction: the threshold tells you not only when code is fast enough but also when to stop optimizing."

## 9. When the fix of waste costs simplicity

Most fixes of waste cost nothing. Where you need a batch operation and the codebase does not have one, add it, then replace the call in the loop with 1 call of it, or load all data before the loop. Do not keep a call in a loop because the batch operation is missing. This rule of the skill is narrower than the book, which names the cost of the new operation. A cache is a different case: it adds state to keep consistent, and how long its data stays correct is a business decision, so keep a new cache inside 1 operation unless that decision is made on purpose.

- Book (*What Software Design Means*, *When the Qualities Themselves Conflict*): "Even waste removal can cost clarity when the fix must build what the codebase lacks: caching adds state to keep consistent, and batching adds infrastructure where no batch interface exists."
