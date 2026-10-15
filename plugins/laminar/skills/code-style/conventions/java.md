# Java

Contents: 1. Records for values · 2. Null for a missing item, and no Optional · 3. Streams only where they read better than a loop · 4. A closed switch over a sealed type or an enum · 5. Failures as unchecked exceptions with an error kind · 6. Fields, constructor, methods in a fixed order · 7. Explicit imports · 8. Small forms of the language · 9. A class of static functions · 10. Libraries: Lombok, MapStruct, multimaps · 11. Tests: JUnit and Mockito

These are rules of this skill for Java, narrower than the book. Read this file whenever you write Java. Each rule keeps to the directions of the main set; where they seem to pull apart, the main set wins.

## 1. Records for values

Write a domain value as a record, and a part of it as a nested record. A record has no setter, so no holder of a reference can change it (correctness, section 5).

- Limits: where the domain forbids a combination of fields, the compact constructor of the record rejects it (correctness, section 4). Work that builds the value again from its own fields is a method of the record.

## 2. Null for a missing item, and no Optional

Do not use Optional. A method that finds 1 item that can be missing returns null and carries a nullable marker on its return type, and its name says it finds. A method that returns a collection returns an empty collection, never null (correctness, section 6). The marker tells the reader where a missing value can appear, with no wrapper type to unpack.

- Limits: a field that is null only in some states of its type is the shape that *Exclude Illegal States* removes; give each state its own type (correctness, section 2).

## 3. Streams only where they read better than a loop

Use a stream only where it is clearly easier to understand than the plain loop; otherwise write the loop. Work on the entries of a map, or a collection into a map, usually reads better as a stream, though not always. Where a stream fits, let it stand as the only statement of a method of its own, whose name states the work that gives its result, and rarely inline among other steps. A stream holds its steps as functions passed to calls, so each function must be 1 part that reads as prose: a method reference, 1 call of a named method, 1 read of a value or 1 plain construction from values as they are (methods, section 1). Prefer a method reference to a lambda that only calls 1 method, and chain a filter and a map rather than a condition inside 1 lambda. Code generators write too many streams and too large ones, and a long or nested stream, or a lambda of several lines inside it, hides parts with no name and holds open constructs. End a stream with toList where the language version has it.

- Limits: a loop body is judged like any method body: each operation in it is a part, or it moves into a named method.

## 4. A closed switch over a sealed type or an enum

Where a value is 1 of a closed set of cases, use a sealed interface with a record per case, or an enum, and a switch with pattern matching that names every case and has no default branch. The compiler then breaks the build where a new case is not handled (correctness, section 2); a default branch turns that check off.

## 5. Failures as unchecked exceptions with an error kind

Signal a failure with an exception that extends RuntimeException, and give it an enum of the kinds of error it can carry where every kind carries the same data. Where a kind carries data of its own, such as the items it rejects, give that kind an exception type of its own, so no caller reads data that its kind never has (correctness, section 2). Do not declare checked exceptions. A checked exception forces recovery code into every caller, while 1 global handler should turn failures into a response (correctness, section 10).

## 6. Fields, constructor, methods in a fixed order

Order a class as constants, then fields, then constructors, then public methods, then private methods. Declare each dependency as a private final field set in the constructor. A fixed order is learned once, so the reader finds each member without a search.

## 7. Explicit imports

Name each imported class; write no wildcard import and no static import. Order the imports as the classes of the application, then other libraries, then the standard library. The reader then sees in 1 place every class the file depends on (modules, section 12).

## 8. Small forms of the language

Write a text of several lines as a text block. Where code runs several tasks at once, use virtual threads where the language version has them. Name every variable in full, also the parameter of a lambda (naming, section 2).

## 9. A class of static functions

A class that holds only static functions is final and has a private constructor. Name it for the work it does, never with a general word such as utils or helper, and never for a thing it does not hold (naming, section 8).

## 10. Libraries: Lombok, MapStruct, multimaps

Read this section only where the code already uses the library.

- Lombok: on a record, use the builder and the with methods of Lombok, and the builder of an existing value to change 1 field in a copy. Declare a logger by hand as a private static final field, not through a Lombok annotation.
- MapStruct: map between the types of 2 boundaries in a MapStruct mapper, not field by field in a controller or a service, and use its built-in support for maps and collections. Name each mapper method with a verb, such as map or convert, and never starting with to or from (naming, section 3). Map only at a boundary between modules or at an entry boundary, never into a second storage copy of a domain object (classes, section 11).
- Multimaps: where code keeps several values for 1 key, use the multimap of the library the project has, not a map of lists or parallel lists that it fills by hand.

## 11. Tests: JUnit and Mockito

Read this section only where the code already uses these libraries.

- Test pure logic with a plain JUnit test, with no framework context and no substitute. Set a field of a test where it is declared, and keep a method that runs before each test for work that must run each time.
- Use a parameterized test for the cases of 1 rule, with 1 case for each outcome of a branch, not 1 case for each row of a table (tests, section 5).
- Write a unit test with Mockito substitutes only where tests, section 5, calls for a unit test, and substitute only what lies past the class under test. Never call verify, never stub with a bare any matcher where the test must check a value, and never set a field by reflection: change the production code so the value comes in through the constructor (tests, sections 2 and 11).
