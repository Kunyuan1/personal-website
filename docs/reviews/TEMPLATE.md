# <Topic> review — YYYY-MM-DD

**Scope:** <files or paths reviewed>
**Commit:** <short sha>
**Harness:** `npm run sim:report` — N/14 passing

## Findings

### 1. <One-line claim> — open | fixed | won't fix

**Where:** `path/to/file.ts:LINE`

**What goes wrong:** concrete inputs or state, and the wrong result. If it
can't be stated concretely it probably isn't a finding.

**Evidence:** the measurement that shows it. Prefer a number from the harness
over an argument from reading the code.

**Resolution:** what was done, or why it was left.

## Considered and rejected

Approaches tried that did not work, and the measurement that ruled each out.
This section is the reason the file is worth keeping — it is what stops the
same wrong turn being taken twice.

## Numbers at the time of review

Paste the `npm run sim:report` output so later reviews can diff against it.
