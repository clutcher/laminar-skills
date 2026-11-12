# lease-end-before-its-start-accepted-at-creation

## Correctness · Prevention

### Production code

1. Method `PlotLease#PlotLease`
   - Protect the State

## Must not appear

Method `ShedLease#ShedLease`, Protect the State
Method `ShedLease#moveEnd`, Protect the State
Method `PlotLease#moveEnd`, Protect the State
Class `ShedLease`, Protect the State
Class `PlotLease`, Exclude Illegal States
Class `ShedLease`, Exclude Illegal States
Any other finding, except Protect the State, Integration Test Needed and Unit Test Needed
