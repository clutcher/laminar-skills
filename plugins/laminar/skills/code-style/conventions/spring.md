# Spring

Contents: 1. Constructor injection · 2. Inject by the interface · 3. Markers in the domain layer · 4. Configuration classes and properties · 5. Class names by what they do · 6. Strategies collected into a map · 7. Validation markers at the entry · 8. Executors and caches · 9. Tests with the framework · 10. Storage verbs and business verbs

These are rules of this skill for Spring, narrower than the book. Read this file, with java.md, only where the code already uses Spring. Where a project convention under `.claude/rules/conventions/` says otherwise on a Spring matter, follow the project: that override holds for the rules of the skill only, never for the design directions of the main set. Each rule keeps to the design directions of the main set, which win where they seem to pull apart.

## 1. Constructor injection

Inject every dependency through the constructor, into a private final field. Write no field injection, no setter injection, and no Autowired marker on a class with 1 constructor. Never ask the application context for a bean in code: that is a hidden dependency the signature does not show (correctness, section 7). A configuration value comes in as a constructor parameter with its Value marker. Name the field of a dependency for the type it holds, such as carrierClient for a CarrierClient, so the name keeps the kind word of the type (naming, section 5).

## 2. Inject by the interface

Where a dependency has an interface, such as an api or spi interface of the application, declare the field with that interface and never with the class that implements it. Do not add an interface only to inject by it (classes, section 8).

## 3. Markers in the domain layer

A stereotype marker such as Component or Service, and a Value marker on a constructor parameter, may stay on a class in the domain layer: they only describe the class and do nothing when the logic runs (classes, section 10). Behavior that the framework runs on its own, such as a transaction around a method or logic on save, stays out of the domain layer. A qualifier marker, which chooses 1 bean among several of 1 type, is wiring and stays out of the domain layer too (section 4).

- Book (*The Principles at Every Scale*, *Hexagonal Architecture*): "Some framework presence is only a marker on a field"

## 4. Configuration classes and properties

Put the bean wiring of a module into a config folder beside app, in and out, in 1 class named for the module and ending in ModuleConfiguration. Put setup that the whole application shares, such as executors, clients, security and a clock, into classes at the root of the application beside its start class, each named with the application and its purpose and ending in Configuration (modules, section 4). A method that declares a bean starts with a verb like every method, such as createCarrierClient, and gives the bean its name in the bean marker, such as carrierClient, so the method names its work and the bean keeps a noun name (naming, section 3). A configuration class takes its properties as constructor parameters and has no getters and no fields bound by markers. Split the property files by area, such as executors, clients and caches, and write keys in the form of the framework, lower-case words joined by hyphens, grouped like the framework's own keys. Each key with children holds only keys that belong to what it names, as the fields of a class do (classes, section 5). Never commit a file of local overrides.

- Where a class needs 1 of 2 or more beans of 1 type, choose the bean in the bean method of the module configuration: that method takes the chosen bean as a parameter, chosen there by its bean name, and passes it to the constructor of the class (section 1). Which bean a class gets is a decision of the wiring. A qualifier in the domain layer splits that decision between the configuration and that layer, so a reader of the configuration no longer sees the wiring whole. This rule of the skill is narrower than the book, which lets a marker that does nothing when the logic runs stay in the domain layer (section 3).

## 5. Class names by what they do

End a class name with a word for what the class does where one exists, such as Service, Facade, Repository, Controller, Converter, Mapper, Validator, Factory, Builder, Processor or Exception, after a business word that says which, such as OrderFacade (naming, section 2). That word never stands alone, because a name such as Helper or Mapper alone predicts little. Use each such word in 1 sense only, as below. Name the types of a web interface for the call with Request and Response, and a list element in them that is a top-level type with RequestItem or ResponseItem. Name a nested list element for what it is, such as LoanResponse.Book, because the outer name gives the context and stands at each use (java.md, section 7). Request, Response and the 2 Item words stay out of the domain layer (modules, section 5).

- Mapper names only a MapStruct mapper; a conversion class written by hand is a Converter (java.md, section 10).
- A Facade is the 1 class that 1 kind of caller calls: it calls services and holds no business rule of its own. Where a module has an api, a controller calls the api, and no Facade stands between them.
- A Helper is a bean, named with its subject before the word, where every method needs other beans to work. Where its methods need no bean, make them static and move them into the Utils class of the subject (java.md, section 9).
- Processor is allowed, with its subject before it, like the others.
- Do not end a class name in Manager or Handler: name the class for what it does. A name that a framework fixes stays, and so does the book's "single global exception handler", named for what it handles, before ExceptionHandler (correctness, section 10).

## 6. Strategies collected into a map

Where cases keep arriving and each has its own class (classes, section 8), let each strategy state the key it supports, collect the strategies into a map by that key in the constructor, fail at start where 2 strategies claim 1 key, and give a fallback strategy where one is right for every other key. Never choose a strategy by a naming convention of the beans.

## 7. Validation markers at the entry

Put validation markers, such as NotNull and Valid, on the types of an entry boundary and on the parameters of its method, and nowhere inside (correctness, section 8).

## 8. Executors and caches

Build an executor from the factory the framework gives, and set only the values you change, so the framework keeps handling virtual threads. Let a cache drop what it holds under memory pressure, read its time to live from a property, and never store a missing value.

## 9. Tests with the framework

- An integration test starts the application and calls its entry boundary as a real caller does, such as through a web test client, and replaces only what lies past the exit boundary with a substitute bean of the framework, never a plain substitute that the context does not know (tests, sections 3 and 4).
- Assert on the content of the response with concrete values; capture an argument sent to a substitute only for an effect that leaves no trace in the response (tests, section 3).
- Test pure logic without the framework context (java.md, section 11).
- A test class takes the beans it uses through its constructor, into private final fields, and never by field injection (section 1). Set the constructor injection mode of the test framework to all once in the test properties, such as spring.test.constructor.autowire.mode=all, and write no Autowired marker on the constructor.
- Give a test a property through the property support of the test framework or through the constructor, never by setting a field by reflection.
- Mark a test that calls a real outside system with the tag marker of the test framework, or with a condition on a property, so the regular build leaves it out, and give its class the suffix the project chose (tests, section 14).

## 10. Storage verbs and business verbs

Name the methods of a storage interface in the spi with the verbs of the framework, such as find, save and delete, so a reader who knows the framework reads each one as a known operation. A method that only a test substitute adds, such as one that fills it with data, is not a storage method. Name the operations that callers call, in the api and in the services behind it, with the verb of the business action, such as search, create or remove. Each verb keeps 1 meaning: find looks up items by a key or a filter, in storage or among values already in memory, and returns no item where 1 item is missing, or an empty collection where none match (java.md, section 2), search answers a question of a caller, save stores an item, create makes a new item under its business rules, delete removes a stored item, and remove ends an item in the business sense. So the 2 sets of verbs name 2 kinds of work, not 2 words for 1 thing (naming, sections 3 and 11).

- Book (*What Simple Means*, *Long-Term Memory and Schemas*): "The repository lookup schema captures another pattern: take an identifier, query a data source, return an entity or indicate absence."
- Limits: a storage method whose work the framework verbs do not name, such as a count or a lock, takes the verb of its work. An operation that only hands the call on to storage, with no rule of its own, still takes the business verb, because its callers read it on the business side.
