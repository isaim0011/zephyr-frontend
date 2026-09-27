## What

Closes #

## How

<!-- What changed and why. Add a screenshot (light + dark, 360px wide) for UI changes. -->

## Checklist

- [ ] I was assigned to the linked issue before starting
- [ ] `npm run lint`, `npm run format:check` and `npm run typecheck` pass
- [ ] `npm test` passes and new behaviour has component tests (including `expectNoA11yViolations`)
- [ ] New strings are in `lib/i18n/en.ts`, not hard-coded
- [ ] Works at 360px wide, with keyboard only, in light and dark themes
- [ ] No float math on amounts (use `lib/amount.ts`); the JWT stays in memory
- [ ] Backend API changes: regenerated `lib/api/schema.d.ts` with `npm run api:types`
