# EXP-060 Beta Feedback Triage Loop

**Date:** 2026-03-12  
**Cadence:** Weekly (Friday)  
**Driver/Reviewer Rotation:** PM/OPS rotates with FE/BE weekly

---

## 1) Single intake view

Use `Settings > Beta Operations > Triage Queue` as the consolidation surface for:

- In-app notes
- GitHub issues
- Support messages
- Direct beta comments

All items must enter queue in <= 24h.

---

## 2) Required triage fields

Each feedback item requires:

- `source`
- `impact`
- `frequency`
- `severity`
- `owner`
- `next_action`

Supporting reproducibility fields:

- account/sub
- expedition
- summary
- repro steps

---

## 3) Workflow states

`new -> triaged -> in-progress -> validated -> closed`

State definitions:

- `new`: intake captured, not reviewed
- `triaged`: owner and next action assigned
- `in-progress`: active implementation/verification
- `validated`: fix confirmed in test or reproducible check
- `closed`: completed and no further action needed

---

## 4) Taxonomy clusters

Cluster all tickets to one of:

- bug
- UX friction
- onboarding blocker
- performance/reliability issue
- feature request

Use backlog tags:

- `beta-feedback:<category>:<severity>`

---

## 5) SLA and queue health metrics

Track:

- time-to-first-triage (created -> first non-`new` state)
- unresolved high-severity count (`high` + `blocker`, not `closed`)
- unresolved total count

---

## 6) Weekly triage session template

1. Review new queue items from past 7 days.
2. Merge duplicates and link to source issue of truth.
3. Re-rank top blockers by impact/frequency/severity.
4. Confirm owner + next action for all high/blocker items.
5. Promote top actionable items into Sprint 7 queue (`EXP-061..063`).

Output artifact each week:

- prioritized top-10 stabilization list
- list of carried-over unresolved high severity items
- owner commitments and ETA updates
