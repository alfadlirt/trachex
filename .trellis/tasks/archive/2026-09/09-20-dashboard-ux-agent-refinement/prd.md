# Dashboard UX and agent workflow refinement

## Goal

Make the dashboard answer the user's next question quickly: what should I do first, what changed, what is waiting, and where can I record the next adjustment? The refinement must preserve the product's evidence-first and human-approval model while reducing visual bulk and unnecessary setup steps.

## Background

- Projects are managed at `/projects`; subjects are represented by the project ticket route and share the checklist identity.
- The ticket canvas currently returns active checklist items, proposals, impacts, scenarios, timeline events, and adjustment jobs, but not superseded requirements.
- Requirements already persist `displayOrder`; domain code already has a reorder operation, while the dashboard/API path is incomplete.
- The adjustment API returns a queued job and the worker creates a proposal asynchronously.
- Chat currently rejects a message without an existing session, forcing the user to click `New Chat` first.
- The dashboard uses a light paper-like shell with amber as the primary accent. Apply antislop rules during implementation: preserve product-specific hierarchy, keyboard access, honest states, and responsive reflow.

## Requirements

### R1. Project and subject management

- Users can edit the name and slug of a project and subject.
- Users can delete a project or subject only through a danger confirmation dialog that requires typing the exact displayed name before the destructive action is enabled.
- The delete flow must clearly explain the cascade: deleting a project deletes its subjects, checklist data, chats, proposals, sources, and adjustment history; deleting a subject deletes its checklist and subject-scoped history. The server remains authoritative for cascade behavior.
- Create forms ask only for the human-readable name/title. Slugs are generated automatically and shown as small secondary text beneath the title after creation, not as editable create inputs.
- Edit forms may expose name and slug together because slug editing is explicitly requested.

### R2. Active checklist and superseded evidence

- The main subject/ticket page shows the active checklist as the primary work surface.
- A separate collapsible section labelled `Superseded` contains every superseded item, including its reason/evidence, source, attribution when available, original timestamp, superseded timestamp, and replacement or superseded-by item.
- Superseded items remain read-only evidence and are excluded from active completion counts and active pagination.
- Missing provenance is displayed honestly as unavailable rather than inferred.

### R3. Checklist scale and ordering

- Active checklist items are paginated separately per subject, with 10 items per page. Pagination includes current page, total pages, previous/next controls, and an empty state.
- Pagination must preserve the persisted checklist order.
- Users can reorder active checklist items with a drag interaction and an equivalent keyboard-accessible move control. Reordering persists through the API and has success/error feedback.
- The agent may propose a complete checklist order every time an adjustment is submitted and whenever a proposal is generated. The proposed order is visible as part of proposal review, and approval persists it only after the user accepts the proposal. Afterward, users can manually reorder items and their manual order is persisted.
- Agent ordering must be based on dependency and implementation sequence, not arbitrary title sorting. The response must explain ordering rationale or identify uncertainty when dependencies are unclear.

### R4. Chat sessions

- Opening the Chat panel shows a usable composer immediately, even when no session exists.
- Sending the first message automatically creates a session before dispatching the request. `New Chat` remains available for an explicit fresh conversation.
- The Sessions view allows selecting an existing session or starting a new one; switching sessions loads its messages and does not silently discard unsent text.
- Chat errors explain the recovery action and do not leave the user in a dead session state.

### R5. Adjustment intake and queue

- Adjustment source categories display in title case, while submitted values remain the existing API enum values.
- Source selection uses a clearly styled accessible control with an obvious selected state and keyboard support.
- File upload uses a styled drop/select area with accepted types, selected-file metadata, remove action, and validation/error states. It must remain usable without drag and drop.
- The page layout places `Add adjustment` before `Adjustment processing`, so the action precedes its resulting queue. On mobile the composer remains before the queue in document order.
- Successful submission opens a modal informing the user that the adjustment was queued, gives the source/category summary, and closes automatically after a short delay while remaining dismissible immediately. The queue then shows the new job and polls existing statuses.

### R6. Main page hierarchy

- The canvas hierarchy is: subject identity and primary actions, active checklist/proposal review, adjustment composer, superseded evidence, then supporting context/history/chat. The queue is adjacent to or below the composer, never above the action that creates queue entries.
- The layout must distinguish the primary decision, `what should I do next`, from supporting evidence and history.
- The layout must reflow through mobile and intermediate widths without horizontal overflow, clipped controls, or tap targets below 44px.

## Acceptance Criteria

- [ ] Project and subject create flows accept a name/title only, generate a slug, and show the slug below the title.
- [ ] Project and subject edit flows update name and slug and refresh links and displayed identity.
- [ ] Project and subject deletion is unavailable until the exact name is typed, confirms the cascade, and returns the user to a valid parent route after success.
- [ ] The canvas returns and renders active requirements separately from a collapsible, provenance-rich superseded section.
- [ ] Active requirements show 10 per subject page and retain order across page changes and reloads.
- [ ] Users can reorder the active checklist with pointer and keyboard interactions; persisted order is returned by a fresh canvas load.
- [ ] Adjustment/proposal processing can persist an agent-proposed order with explicit review, and manual reorder remains available afterward.
- [ ] Agent proposal instructions and tests demonstrate dependency-aware ordering and a rationale/uncertainty field rather than title-only sorting.
- [ ] The first chat message works without clicking `New Chat`; session history and explicit new sessions continue to work.
- [ ] Adjustment category labels are title case, selection/file controls have accessible selected, loading, success, empty, and error states, and a queued modal appears after submission.
- [ ] The adjustment composer appears before the processing queue on desktop, tablet, and mobile.
- [ ] Dashboard builds and tests pass, and the implemented controls are keyboard-operable with visible focus indicators.

## Out Of Scope

- Changing the underlying product identity, introducing a new theme, or adding fabricated metrics, customer content, illustrations, or navigation destinations.
- Full-text search/filtering of checklist items.
- Reordering superseded or archived evidence.
- Silent agent approval or automatic completion of checklist items.

## Key Decisions

- Delete confirmation uses the exact displayed project or subject name, not a generic `DELETE` phrase, because it verifies the user is acting on the intended resource.
- Project deletion is cascading and subject deletion removes subject-scoped data, with the server enforcing the final behavior.
- The chat composer is the default entry point; the first send creates the session lazily to avoid empty sessions from simply opening the panel.
- The adjustment composer moves before its queue because users need the cause/action before the resulting status list.
- The queued modal is auto-dismissed after a short delay and can always be dismissed manually, so feedback is visible without blocking follow-up work.

## Blocking Open Questions

None. The latest product decisions and the repository evidence are sufficient to finalize the implementation plan.
