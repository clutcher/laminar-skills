# availability-schema-with-misnamed-additions

## Simplicity

### Production code

1. Variable `orderSchedules` in `product-availability-api:Availability`
   - Prediction Failure
2. Variable `qty` in `product-availability-api:OrderSchedule`
   - Prediction Failure
3. Variable `unit` in `product-availability-api:OrderSchedule`
   - Prediction Failure

## To consider

4. Class `product-availability-api:Availability`
   - Unnamed Part Failure

## Must not appear

Variable `stockLevels` in `product-availability-api:Availability`, Prediction Failure
Variable `replenishments` in `product-availability-api:Availability`, Prediction Failure
Variable `returnTerm` in `product-availability-api:Availability`, Prediction Failure
