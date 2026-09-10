# decision-and-free-text-code-across-an-entry-boundary

## Design

### Production code

1. Method `BikeCard`
   - Leaked Details

## Correctness · Prevention

### Production code

2. Variable `frameClass` in `fleet-api:Bike`
   - Exclude Illegal States

## To consider

3. Variable `accessories` in `fleet-api:Bike`
   - Incomplete Mental Model
   - Also in `BikeFields#accessories`; `BikeCard`

## Must not appear

Variable `batteryPercent` in `fleet-api:Bike`, Incomplete Mental Model
Variable `batteryPercent` in `fleet-api:Bike`, Exclude Illegal States
Variable `label` in `fleet-api:Accessory`, Incomplete Mental Model
Variable `label` in `fleet-api:Accessory`, Exclude Illegal States
Variable `frameClass` in `fleet-api:Bike`, Incomplete Mental Model
Variable `accessories` in `fleet-api:Bike`, Exclude Illegal States
Class `fleet-api:Bike`, Exclude Illegal States
