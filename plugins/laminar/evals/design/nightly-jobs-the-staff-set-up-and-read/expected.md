# nightly-jobs-the-staff-set-up-and-read

## Level 1

- checkDesign: no defect
- No name holds: registry
- Model path absent: KindsOfWork
- No file moves

## Level 2

- The nightly job, its run and its retry setting are created classes marked `represents` `domain object` in the domain of the module `nightly`. The person who uses this part of the application is a librarian who sets up jobs and reads their runs, so a job, a run and a retry are words of that person's work, also where the domain is technical.
- The job carries `madeWhen` naming the librarian who sets it up, such as "a librarian sets up a nightly job". The retry setting carries `partOf` naming the job, and the job holds it as a field. The run carries `madeWhen` naming a run of a job that a librarian set up, such as "a nightly job that a librarian set up reaches its time", or `partOf` naming the job where the job holds its runs.
- The kinds of work by name are a map field of the runner, or of the class that starts a run, built by the wiring from the classes of the kinds and handed to it; the lookup by the name of the kind is a method of that class, which fails with `UnknownKindOfWorkException` on a missing name. No created class holds only that map, under any name.
- Every created class outside a test file, a failure type and the `config` zone carries `represents`, and each kind of work is marked `work`.
- At `ready`, the design check prints no line of `kind-does-not-fit` and no line of `type-holds-only-a-collection` on the job, the run, the retry setting or any other class of the model.
