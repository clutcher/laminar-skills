# branches-integration-already-covers

## Correctness · Detection

### Production code

1. Class `ShipmentPricingCalculator`
   Every scenario prices a standard shipment, so the next-day fee and the same-day fee are never priced.
   - Unit Test Needed. Add a unit-test class that prices a next-day shipment and a same-day shipment.
   - Moderate confidence

2. Class `ShipmentDispatchPlanner`
   Every scenario dispatches to a city bank, so the suburban carrier and the rural carrier are never planned.
   - Unit Test Needed. Add a unit-test class that plans a suburban shipment and a rural shipment.
   - Moderate confidence

## Must not appear

Class `ShipmentAdmission`, Test Behavior
Class `ShipmentAdmission`, Unit Test Needed

Class `PostalSurchargeTable`, Test Behavior
Class `PostalSurchargeTable`, Unit Test Needed

Class `LockerSizeAndHandoverRules`, Unit Test Needed

Class `ShipmentBookingController`, Integration Test Needed
Method `book` in `ShipmentBookingController`, Integration Test Needed

Class `ShipmentBookingControllerTest`, Partial Path Test
Class `ShipmentBookingControllerTest`, Unit Test to Remove
