# language-checked-inside-the-export-creation

## Correctness · Prevention

### Production code

1. Method `RecordExportService#createExport`
   - Validate at the Boundary

## Must not appear

Method `SupportedLanguageValidator#validate`, Validate at the Boundary
Method `SupportedLanguageValidator#validate`, Fail Fast
