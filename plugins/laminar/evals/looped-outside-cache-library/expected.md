# looped-outside-cache-library

## Performance

### Production code

1. Method `GaugeReporter#reportAll`
   - Looped I/O

## Must not appear

Method `PilotWindows#portsWithoutTideTable`, Looped I/O
Method `PilotWindows#portsWithoutTideTable`, Repeated Retrieval
Method `TideTables#tableOf`, Looped I/O
