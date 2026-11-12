Design the fix of every finding of the review run in `<run folder>`, for the repository in the current folder, which holds the change `main...change`, together with the described change below. base: `main`. decided: `<decided file>`. mode: autonomous. results: `<results folder>`. The ceiling is 3 shape runs. You run as a subagent of the calling session, which started you. The skill ends at the plan and starts no writer, so change no file of the repository.

The described change: the staff of the library also gets 1 copy of the reminders of each run, in 1 message to every address of `reminder.staff-recipients` in `src/main/resources/reminders.properties`, with the list of the due items of that run attached as a CSV file.

A fact from the calling session: the reminder job runs today once a day at 7 o'clock, by the cron expression `0 0 7 * * *`, and the plan keeps that schedule.

The fix table of the calling session, for the finding on the class `ReminderMailer`: rename `ReminderMailer` to `DueNoticeService`.
