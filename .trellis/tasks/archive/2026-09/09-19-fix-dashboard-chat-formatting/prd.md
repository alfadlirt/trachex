# Fix dashboard agent evidence and markdown rendering

## Goal

Investigate and fix duplicate evidence lines and poor spacing/list rendering in dashboard agent chat responses.

## Requirements

- The dashboard chat must show each evidence reference at most once, even when the model includes an evidence label in its answer and the API also emits an evidence event.
- Evidence references must remain available in the streamed response and must not be fabricated when the API provides none.
- Assistant markdown must render readable paragraphs, headings, unordered lists, and inline code/emphasis with consistent spacing.
- Common compact model output such as `It covers: - item one - item two` must not render as one unstructured paragraph.
- Existing chat history must receive the same normalization and rendering treatment as newly streamed messages.
- The change must preserve the existing JSONL chat protocol and pending-proposal behavior.

## Acceptance Criteria

- [ ] A response containing repeated identical `Evidence:` lines displays one copy of each reference.
- [ ] Evidence emitted separately by the API does not create duplicate visible lines when already present in the answer.
- [ ] Evidence events are still displayed once when the answer does not contain them.
- [ ] Paragraphs have visible separation, and unordered list items render as list items with indentation and spacing.
- [ ] Headings and inline markdown continue to render correctly.
- [ ] Targeted dashboard/API tests and typecheck pass.

## Notes

- The defect crosses the API JSONL event boundary and dashboard chat rendering, so the implementation plan must cover both sides.
- Do not introduce a full markdown dependency for this focused chat renderer.
