# Night bookings of the observatory

The repository books the telescopes of an observatory for 1 night. Java 21, Gradle, JUnit 5. `NightSchedule` holds the slots of 1 night and the dawn that ends it. Add the 6 behaviours below, each with unit tests, and run `gradle test` at the end; it must pass.

1. Give a slot a new start, given only that start and the schedule it belongs to. Where the slot would then run past the dawn of its night, cut its minutes so that it ends at dawn.
2. Give a slot to another observer: the result is a new slot, the same in every other field, and the only input is the name of the new observer.
3. Let the schedule return a new schedule that holds 1 more slot, given that slot. Refuse a slot that overlaps a slot of the same telescope, with a failure that names both slots.
4. Let the schedule answer whether a given telescope has no slot that covers a given moment of the night. Let the schedule also return its slots whose start lies before the midnight inside its night, read from its own slots, with no input.
5. After a slot, an observer files an observing report: the telescope, the target name, and any of the filter name, the exposure seconds, the seeing in arcseconds and notes. Only the telescope and the target name are required. Callers create a report in steps, starting from the report type and the telescope, and the last step refuses a report with no target name.
6. Wherever a list of slots is sorted, the slots sort by their start. 2 slots are equal where they have the same telescope and the same start. A slot prints in logs as its telescope code, then its start.
