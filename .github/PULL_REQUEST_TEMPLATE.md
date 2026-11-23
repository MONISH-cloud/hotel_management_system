## Summary
<!-- What does this change, and why? One or two sentences. -->

## Type
- [ ] Feature  - [ ] Fix  - [ ] Docs  - [ ] Tests  - [ ] Chore / tooling

## What changed
<!-- Bullet list of the important changes. Mention any database change (new table/column/procedure/trigger). -->

## How I verified it
<!-- Commands you ran and what you saw, screenshots for UI changes. -->
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Tried it by hand: <!-- describe -->

## Safety checklist
- [ ] **Existing behaviour is unchanged** (or the change is described above)
- [ ] Business rules live in MySQL, not duplicated in the app
- [ ] New API routes check permissions (`requirePerm`) and validate input (Zod)
- [ ] No secrets, passwords or `.env.local` content included
- [ ] Docs updated (`npm run docs:dictionary` if the schema changed)
