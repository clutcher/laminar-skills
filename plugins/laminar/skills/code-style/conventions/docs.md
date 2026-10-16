# Documentation and instruction files

Contents: 1. Documentation in the docs folder · 2. Rules in positive form · 3. Short instruction files

These are rules of this skill for documentation and for instruction files that agents read, such as CLAUDE.md, skill files and rules files, narrower than the book. Read this file whenever you write or change such a file. Where a project convention under `.claude/rules/conventions/` says otherwise on such a matter, follow the project: that override holds for the rules of the skill only, never for the directions of the main set.

## 1. Documentation in the docs folder

Put the documentation of the repository into its docs folder, in 1 file per subject, and write no README inside the folder of an application or a service. A reader then looks for every document in 1 place. A README in a code folder holds a second copy of what the docs folder says, and the 2 copies drift apart.

- Limits: the README at the root of the repository stays, and it points to the docs folder. Where a tool reads a README from a code folder, such as a package registry, keep that README short and let it point to the docs folder too.

## 2. Rules in positive form

State each rule of an instruction file as what to do, and not only as what to avoid. A rule that names only the wrong shape leaves the right shape open, so an agent or a person must guess it, and 2 readers guess 2 different shapes. Give each rule its reason in 1 sentence, so a reader can apply it to a case it does not name.

- Limits: a rule that bans 1 act and has no 1 right shape, such as a ban on a secret in a commit, stays a ban, with its reason.

## 3. Short instruction files

Keep each instruction file short. State each rule once, in the 1 file of its area, and point to that file from other places rather than copy it. Leave out what an agent does without being told. Split a long file by area, and give each file the paths it applies to where the tool supports them, so it loads only for the files it is about. An agent reads every line of a file that loads on every call, at a cost on every call, and a long file is often read only in part, so a rule late in it is missed.

- Limits: a rule that needs a long reason, such as one with a measured cost, keeps the reason in a document of the docs folder, and the instruction file names that document.
