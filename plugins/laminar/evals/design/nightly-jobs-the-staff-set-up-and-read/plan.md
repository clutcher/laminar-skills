# Plan: nightly jobs that the library staff set up and read

The library staff want the upkeep of the loans to run each night with no person at the desk. Today a librarian starts it by hand each morning through `ApiForLoanUpkeep`: the overdue notices of the day, and the close of the day, which archives the loans returned that day.

A librarian sets up a nightly job: a name that is unique, the kind of work it does, the time of the night at which it runs, and its retry setting, which is the most attempts and the minutes between 2 attempts. 2 kinds of work exist today: `overdue-notices`, which sends the overdue notices of the day, and `close-the-day`, which closes the day before. A librarian may change the time and the retry setting of a job, and may pause a job and start it again.

Each night, at the time of each job that is not paused, the job runs. Each run is kept: the job, the start time, the end time, the number of attempts, and its outcome, which is done, with the count that the work answered, or failed, with the text of the last failure. An attempt that fails is tried again after the minutes of the retry setting, until the most attempts are used. A librarian reads the runs of 1 job of the last 30 days, the newest first.

## Changes

1. Add the module `nightly` under `org.example.library.nightly`, in the hexagonal layout of the module `loan`. It offers the operations that set up, change, pause and start a job again, and the operation that reads the runs of a job. A name already in use fails with `JobNameTakenException`, an unknown job name with `JobNotFoundException`, and an unknown kind of work with `UnknownKindOfWorkException`.
2. The runner keeps the kinds of work by their name, and finds the work of a job by the name of its kind. Each kind of work is 1 class that calls `ApiForLoanUpkeep` of the module `loan`.
3. A clock of the framework calls the runner each minute with the current time, and the runner starts each job whose time has come and that has no run that night yet.
4. The jobs and the runs are kept in new stores in memory, in the module `nightly`.
5. Tests: a job set up and run at its time, with its run read back; a run whose first attempt fails and whose second attempt is done; a run that fails after the most attempts; a paused job that does not run; a second job of the same name; and a job of an unknown kind of work.
