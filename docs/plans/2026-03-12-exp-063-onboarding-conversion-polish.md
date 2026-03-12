# EXP-063 Onboarding & Conversion Polish (Sprint 7)

**Date:** 2026-03-12  
**Status:** Completed  
**Goal:** Reduce first-value onboarding friction via targeted copy/state improvements in existing UI flows.

---

## Friction points addressed

1. New/returning users without profile setup lacked a direct path from alert to onboarding action.
2. First-activity empty states were present but not strongly directional to the next action.
3. Strava callback/auth failures surfaced status but not always an explicit user next step.
4. Expedition-required logging error lacked clear remediation path.

---

## Implemented polish

### App onboarding entry-point guidance

- File: `client/src/App.tsx`
- Change: onboarding info alert now includes an explicit `Open Settings` action button and updated guidance text for profile + expedition setup sequence.

### Members and social first-value empty states

- File: `client/src/components/MembersPanel/MembersPanel.tsx`
- Change: empty state now explicitly guides profile creation + teammate invite/join path.
- File: `client/src/components/LogView/ActivityFeed.tsx`
- Change: empty state now points users to `Add Activity` as the first-value action.

### Log submission blocker guidance

- File: `client/src/components/LogView/LogForm.tsx`
- Change: missing-expedition validation now directs users to the top-bar expedition switch/create control.

### Callback/auth failure actionability

- File: `client/src/components/SettingsPanel/SettingsPanel.tsx`
- Changes:
  - invalid OAuth state now instructs user to restart linking.
  - sign-in-required callback now instructs sign-in then retry.
  - transient connection wait state now instructs user to keep tab open.
  - callback error message now includes retry action.

---

## Test evidence

### Updated/added assertions

- `client/src/components/LogView/LogForm.test.tsx`
  - updated expedition-required guidance assertion.
- `client/src/components/LogView/ActivityFeed.test.tsx`
  - updated empty-state guidance assertion.
- `client/src/components/SettingsPanel/SettingsPanel.test.tsx`
  - added `shows actionable guidance for invalid Strava OAuth state`.
  - updated callback replay waiting-state assertion to actionable copy.

### Validation runs

- Focused suites:
  - `npx vitest run src/components/LogView/LogForm.test.tsx src/components/LogView/ActivityFeed.test.tsx src/components/SettingsPanel/SettingsPanel.test.tsx`
  - Result: `29/29` passing.
- Full frontend suite:
  - `npx vitest run`
  - Result: `56/56` passing.
- Build:
  - `npm run build`
  - Result: pass.

---

## Conversion impact rationale

- Reduced ambiguity in the first-run path by linking messaging directly to the next actionable UI control.
- Improved recoverability in callback/auth failure states by presenting explicit retry/sign-in guidance.
- Preserved functional behavior and design system conventions while tightening onboarding clarity.

---

## Follow-up (deferred)

1. Add lightweight event for onboarding-alert CTA clicks to quantify conversion impact of the new in-app prompt.
2. Pair with EXP-064 gate review to compare activation trend against Sprint 6 baseline in KPI dashboard evidence.
