# looped-framework-query

## Performance

### Production code

1. Method `SeasonClose#renew_all`
   - Looped I/O

## Must not appear

Method `LeaseStore#end_date_statements`, Looped I/O
Method `LeaseStore#end_date_statements`, Repeated Retrieval
Method `LeaseRenewal#renew`, Looped I/O
