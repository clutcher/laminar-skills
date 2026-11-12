# Plan: refuse at check-in the bags over the allowance

The ferry desk refuses at check-in a passenger whose bags weigh more than the baggage allowance of the fare class of the booking, and issues no boarding pass.

## Changes

1. Give `CheckInDesk#checkIn` the weight of the bags in kilos as a new parameter. In `CheckInDesk`, add the allowance per fare class: 23 kilos for `ECONOMY` and 32 kilos for `FLEX`. Where the bags weigh more than the allowance of the fare class of the booking, throw `BaggageOverAllowanceException`.
2. Add `src/main/java/com/example/ferry/checkin/BaggageOverAllowanceException.java`.
3. Tests: a check-in with bags under the allowance of `ECONOMY`, and a check-in with bags over it, which issues no boarding pass.
