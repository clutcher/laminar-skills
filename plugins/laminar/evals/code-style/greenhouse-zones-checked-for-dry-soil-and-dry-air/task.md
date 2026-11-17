# Review finding on the greenhouse checks

The repository waters the zones of a greenhouse. Java 21, Gradle, JUnit 5. `WateringRound` opens the valve of each zone whose soil is dry, `DrySoilMorningNotifier` sends the grower 1 message each morning that lists the zones whose soil is dry, and `MistingRound` starts the misting fans of each zone whose air is dry. Dry soil means the same in the watering round and in the morning message. The greenhouse manager sets the limit of the air apart from the limit of the soil, and each of the 2 limits changes without the other.

A review of the code printed the finding below. Fix it, and run `gradle test` at the end; the tests must still pass.

## Simplicity

### Production code

1. Method `waterDryZones` in `WateringRound`
   - Incomplete Mental Model: Whether the soil of a zone is dry is decided by comparing the soil moisture with 30 in waterDryZones and again in addLineWhenDry of DrySoilMorningNotifier.
   - Direction: Encapsulate: give the decision to the abstraction that makes it, or drop a copy that no place needs.
   - Also in `DrySoilMorningNotifier#addLineWhenDry`.
