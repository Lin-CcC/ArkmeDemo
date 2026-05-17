---
name: arkme-arrangements-exam
description: Use when working on this Arkme Demo coding exercise, especially the "安排" module. Guides Codex to analyze the README/original oral requirements, choose a small polished MVP, implement mobile-first React changes, keep user-facing copy understandable, validate the mobile demo, and follow the repository logging/verification rules. Trigger when the user asks to implement, refine, review, test, or plan the 笔试安排模块, or asks for help prioritizing the fuzzy arrangements requirement.
---

# Arkme Arrangements Exam

This skill is a trimmed project-local workflow derived from the useful parts of the local `meathill-coding-skills` set: code maintenance discipline, product-content review, and operator-style QA. It is intentionally scoped to this repository and this coding exercise.

## Non-Negotiable Project Rules

Before analyzing or editing anything:

1. Read `AGENTS.md` and `docs/candidate-rules.md` if they have not been read in this turn.
2. Check `.codex/candidate-session.json` and confirm it points to the current candidate log.
3. Confirm the previous iteration is recorded in both the active `docs/codex-logs/*.md` file and `src/data/aiConversationLog.ts`.
4. Read `README.md`; for arrangement work, also read `docs/arrangements-requirements.md` if present.
5. Keep each iteration recorded in both logs and run `pnpm verify:answer` before the final response.

## Product Reading

Treat the README's "安排" text as raw oral requirements, not a finished PRD. The important product ideas are:

- "安排" is broader than todo/calendar/reminder/task. It represents things that may need later attention or execution.
- Sources include manual creation, messages to self, private chats, group chats, and AI recognition from conversation context.
- Items may relate to people, time, place, source conversations, reminders, completion, postponement, and AI-assistable execution.
- Similar items should be mergeable, but the detail page must preserve related conversation context.
- The experience should reduce anxiety. Avoid red overdue piles and punishment-style language.
- The exam rewards judgment: define a small version, implement it well, and avoid shallow overbuilding.

## Default Implementation Strategy

When the user asks to build or improve the arrangements module:

1. Restate the concrete goal and affected surface: Mobile Demo `/`, message test console `/sendtest`, or both.
2. Inspect existing routes/components/styles before editing.
3. Choose the smallest useful slice unless the user explicitly asks for more.
4. Prefer a polished mobile-first interaction over many half-finished features.
5. Keep the visual language consistent with the existing Arkme Demo. Do not create a marketing page.
6. Use existing state/data patterns before adding new abstractions.
7. Add dependencies only when they clearly reduce real implementation risk.

## MVP Priority

Prefer this sequence for exam delivery:

1. Arrangement tab or entry integrated into existing navigation.
2. Arrangement list with calm grouping: today/upcoming/later or focus/regular/later.
3. Manual creation with title, optional time, optional person/place/source note.
4. Detail view showing context/source notes.
5. Complete and "以后再说" actions. "以后再说" should feel like relief, not failure.
6. One AI-related scenario only after the basics feel good, such as extracting an arrangement from a sample chat in `/sendtest`.
7. API key binding or broader AI recognition only if the user asks and the basic product is already coherent.

Avoid implementing every oral requirement at once.

## User-Facing Copy

Review visible text from a normal user's perspective:

- Avoid developer terms such as API, payload, endpoint, token, schema, mock, unless the screen is explicitly for technical setup.
- Prefer short action labels that say what happens: "添加安排", "完成", "以后再说", "查看来源".
- Empty states must offer a next step, not just "暂无数据".
- Overdue or stale arrangements should not use alarming red-heavy copy by default.
- Keep Chinese punctuation and tone consistent with the existing app.

## Mobile QA Checklist

After UI changes, verify at least:

- `http://127.0.0.1:5173/` for Mobile Demo changes.
- `http://127.0.0.1:5173/sendtest` for message console changes.
- iPhone-like narrow viewport: no clipped buttons, overlapping text, or unreachable actions.
- Primary create/complete/postpone paths work by clicking, not only by code inspection.
- Empty state, populated state, and detail/back navigation are coherent.
- Any unread badge or sidebar entry still opens the expected destination.

Use browser verification when a local dev server is available or when layout/interaction changed.

## Code Hygiene Boundaries

Borrow these maintenance rules from the source skills:

- Read first, then edit.
- Keep changes local to the feature.
- Do not split files only because they are long; split only when it removes real complexity.
- Extract shared helpers only after meaningful duplication appears.
- Do not add TODO/FIXME comments as a substitute for finishing the slice.
- Do not clean unrelated docs, old logs, or historical candidate records unless the user asks or project rules require it.

## Final Response Shape

For completed implementation work, report:

- What changed.
- Which local test link applies: `/`, `/sendtest`, or both.
- Verification result, especially `pnpm verify:answer`.
- Any intentionally deferred requirement.

Keep the response short and concrete.
