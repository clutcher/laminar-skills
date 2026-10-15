# Modules and applications

Contents: 1. Modules named after the parts of the application · 2. What a module exposes, declared and enforced · 3. Every folder consistent inside, and the folder check · 4. The application, what uses it, and what it needs · 5. A domain free of infrastructure · 6. Classes that coordinate and classes that compute · 7. Another module through its exposed types · 8. Known layouts and few new folders · 9. The same names in every module · 10. The same questions for applications · 11. The entry and exit boundaries of an application · 12. Imports at the top of the file

A module here is a folder or a package of files with 1 name. A folder is an abstraction like a method: its name predicts what it holds.

## 1. Modules named after the parts of the application

Do not keep many files as peers in 1 folder. Find the parts the application has, and give each part a module named after it. At the outermost folder, prefer names that say what the system does over names of frameworks. Peers with no shared shape or purpose do not group into 1 item, and nothing names the part each file belongs to. This is the book's pattern *Modular Monolith*.

- Book (*The Principles at Every Scale*, *Modular Monolith*): "Each file at the root is a detail of one of these parts, so every class belongs inside the module named after its part." · "the outermost folder should communicate what the system does rather than which frameworks it uses"

## 2. What a module exposes, declared and enforced

Split each module into what it offers and what it hides. Let the language visibility or an automated test fail the build on a reference past the boundary. Without this, every file stays reachable from every other module, and the boundary exists in name only.

- Book (*The Principles at Every Scale*, *Modular Monolith*): "To finish encapsulation, each module must declare which classes belong to its public contract and which stay hidden inside." · "Enforcement closes this gap by turning the convention into a rule that language tools or automated tests verify on every change." · "Even one forgotten import breaks a boundary and brings back the problem the modules solved."

## 3. Every folder consistent inside, and the folder check

At every depth, make every file and subfolder a part of what the folder path names. Business naming or technical naming can change from 1 folder to the next, but 1 folder does not mix parts and details. A detail among the parts of a folder is the unnamed part failure, as in a method.

Run this check on every folder the change created or added a file to, and on each folder above it up to the source root. A review asks the same questions of each folder.

1. List the files and subfolders directly in the folder. What a subfolder holds only shows what it is for; it is not answered here.
2. Read the whole path, from the source root down to this folder, as 1 phrase: it names 1 thing or 1 capability, and each folder narrows the one above it.
3. Give each file, then each subfolder, 1 answer: yes, where it is a direct part of what the path names; detail of, and the more specific thing it serves; or other place, and the place it belongs. Read each name as a name of its own: the path never adds a verb or a missing word to make a name fit.
4. A type that holds data and is a piece of the data of 1 other entry is a detail of that entry. 3 or more entries of 1 repeating shape, such as 1 for each provider, are yes where the path names what they are; an entry that chooses, builds or lists them is not 1 of them.
5. In a module, place each file in 1 of the 3 parts of section 4. The application imports no code of its ways in or out, and an implementation of what the application needs sits in a way out, never inside the application.
6. Move each detail into a subfolder named for what it serves, or into that entry, and each other place to its place. Repeat until every answer is yes, at every depth.

- In a folder of 1 way in or 1 way out, keep at its root the class the folder exists for, and put its helpers, such as wire types, clients and mappers, into subfolders named for them. A count of files never sets where a folder splits; belonging does. This rule of the skill is narrower than the book.
- Book (*The Principles at Every Scale*, *Modular Monolith*): "Each folder must follow SLAP, not the order of business and technical naming across folders." · "Every folder, at any depth, stays consistent inside and hides its contents behind its name, which introduces a new abstraction level."

## 4. The application, what uses it, and what it needs

Inside a module, put the application logic in 1 folder, everything that calls the module in a second, and everything the module calls in a third. Inside the application, declare what it offers and what it needs as contracts it owns. Give each way in and each way out its own folder. 1 flat folder mixes transport, business and storage code. This is the book's pattern *Hexagonal Architecture*.

- Book (*The Principles at Every Scale*, *Hexagonal Architecture*): "Within that boundary, applying SLAP separates the module into the three parts every application has: the application itself, everything that uses it, and everything it needs to work." · "The `api/` folder declares what callers can ask for, and the `spi/` folder declares what the application needs."
- Limits: the api and spi interfaces stay even where each has 1 implementation and nothing varies, because they are the boundary of the application, which is an abstraction itself; the rule against an interface for 1 operation that does not vary is not about them: "These interfaces exist because `app` is itself an abstraction: `api/` and `spi/` are its visible boundary, while everything in `domain/` stays hidden behind them." The book sets no layout inside the domain: "No fixed layout applies here, because domain logic takes many forms across different business problems."

## 5. A domain free of infrastructure

Write no call to a database, a remote service or a queue inside the domain. Let the domain state what it needs, and let code at the edge provide it. Let the edge code translate, and do not decide a business rule there. Then a business rule has 1 home and no hidden copy at the edge. Name domain types and the failures the domain raises in business words, with no word of a transport or a technology such as request, response, input or DTO; let the edge translate a failure of an outside system, and do not explain in a domain comment how that system behaves. This naming is a rule of the skill, narrower than the book. This is *Hexagonal Architecture* too.

- Book (*The Principles at Every Scale*, *Hexagonal Architecture*): "That pattern has one clear rule: the domain itself stays free of any infrastructure code." · "So a business rule has one home and cannot appear again in the controllers or repositories, which removes hidden copies that would otherwise cause the incomplete mental model."
- Limits: a framework marker that does nothing when the logic runs may stay on a domain object (see classes).

## 6. Classes that coordinate and classes that compute

Inside the domain, keep classes that coordinate a sequence of steps apart from classes that take inputs and return a result. Keep the computing classes free of changing fields, shared state and calls to the outside. This is the method-scale split of calculation from fetching, 1 scale up, and it makes the logic that needs the most tests the easiest to test.

- Book (*The Principles at Every Scale*, *Hexagonal Architecture*): "Even so, the two principles produce one additional split inside the domain, the same one pure functions make at method scale: some classes orchestrate a sequence of steps, while others only take inputs and return a pure result."
- Book (*How to Verify Correctness*, *How Tests Expose Design Problems*): "From this separation emerges code where the parts needing the most tests are the easiest to test."

## 7. Another module through its exposed types

When 1 module calls another, call it through the types the other module exposes. At the edge of your module, map those types into the domain objects your module already has, and never into a new mirror type with the same members: 2 types for 1 thing hold 1 fact in 2 places, and a member added to 1 must be added to the other. Do not share the internal classes of 2 modules. An entry boundary of the application takes a request type that holds only what the call needs; it returns its own type only where that type holds a different shape from the domain type, and a response type with the same members as a domain type is a mirror type too. The mirror type is a rule of the skill, narrower than the book. The mapping lets each module change its own classes without breaking the other.

- Book (*The Principles at Every Scale*, *Hexagonal Architecture*): "calls it and maps those into its own domain objects" · "The extra mapping into a separate set of classes is the price of the boundary, and it lets each module change its own classes without breaking the other." · "only repeats the same fields, tied to a converter that must change whenever either side does"
- Limits: the mapping is the price of a boundary between modules. Inside 1 module, a second copy of a domain object for storage is not (see classes). The type a module exposes, mapped to and from its own domain type inside that module, is no mirror type: "The extra mapping into a separate set of classes is the price of the boundary, and it lets each module change its own classes without breaking the other."

## 8. Known layouts and few new folders

Use a layout that readers recognize for the boundary folders of a module. Keep the folders that need a new decision from the reader to about 3. Each folder step costs time, and a known layout reads as 1 item.

- Book (*The Principles at Every Scale*, *Hexagonal Architecture*): "The practical guideline follows: use recognizable patterns at the boundary folders, and keep the remaining novel folders to about three." · "What limits comprehension is the number of folders that require novel decisions, not the total depth of the structure."

## 9. The same names in every module

Use the same folder names and the same forms of file names in every module, so the name of a file says its role. A layout that repeats is learned once.

- Book (*The Principles at Every Scale*, *Hexagonal Architecture*): "Because the folders and the names repeat from one module to the next, a practitioner learns the layout once, as a single schema."
- The book's forms of these names: an interface of what a module offers starts with ApiFor and names the action, a type a module exposes to other modules starts with Public and is used only there, and an implementation at the edge ends with Using and the technology, named once: "a name starting with `ApiFor` is something the module offers, and one starting with `Public` is a type it exposes to other modules" · "The last word of a `Using` name states the technology".

## 10. The same questions for applications

At the scale of applications and services, ask the same questions: what each boundary hides, what belongs inside it, and which names predict it. Keep a business rule in the application that owns it; a calling application reads the answer and does not decide the rule again. 1 decision in 2 modules of 1 application is a copy, and it gets 1 owner. In 2 applications that deploy apart, a copy can be a deliberate choice, to save a remote call or to check on both sides; make it on purpose and name it when you report the change.

- Book (*What Software Design Means*, *What Design Means*): "Practitioners still ask the same questions at every scope: what should this boundary hide, what belongs inside it, and what names will predict its behavior."
- Limits: a boundary between services is slow to cross, and merging services trades flexibility for speed. The book names the trade and leaves the choice to the case: "Merge the two into one service and the calls turn local, so the system speeds up, but the boundary that kept them swappable is gone."

## 11. The entry and exit boundaries of an application

For each application you change, know where outside actors call it and where it calls the outside. Check outside data at the entry, and plan the integration tests from the entry to the exit (see correctness and tests). A frontend that calls a backend over the network is a second application, with its own entry and exit.

- Book (*What Testing Means*, *What Testing Means*): "Application entry boundaries are where external actors invoke the application: HTTP endpoints, GraphQL resolvers, CLI command handlers, message and event consumers, scheduled jobs, or UI event handlers."
- Book (*What Testing Means*, *How to Distribute Tests*): "This makes them two applications rather than one, which is easy to miss, so the frontend has its own entry at the click and its own exit at the network call."

## 12. Imports at the top of the file

Put every import at the top of the file, and name each imported thing. A reader then sees in 1 place what the file depends on. This rule of the skill is narrower than the book.

- Limits: where a language needs a late import to break a cycle, the cycle is the problem to fix first.
