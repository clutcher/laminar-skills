# availability-schema-with-misnamed-additions

## Simplicity

### Production code

1. Variable `roastingSchedules` in `bean-availability-api:Availability`
   - Prediction Failure
2. Variable `qty` in `bean-availability-api:RoastingSchedule`
   - Prediction Failure
3. Variable `unit` in `bean-availability-api:RoastingSchedule`
   - Prediction Failure

## To consider

4. Class `bean-availability-api:Availability`
   - Unnamed Part Failure

## Must not appear

Variable `roasteryStocks` in `bean-availability-api:Availability`, Prediction Failure
Variable `incomingShipments` in `bean-availability-api:Availability`, Prediction Failure
Variable `cancellationTerm` in `bean-availability-api:Availability`, Prediction Failure
