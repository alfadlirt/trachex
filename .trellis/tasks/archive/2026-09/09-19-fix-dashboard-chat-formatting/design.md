# Technical Design

## Boundary

The API remains the owner of the chat event contract. It continues to emit one `text` event followed by zero or more `evidence` events and a `done` event. The dashboard owns presentation state and converts those events into one readable assistant entry rather than appending evidence as unrelated messages.

## Normalization

The dashboard will normalize assistant content before rendering by removing duplicate standalone `Evidence:` lines while preserving the first occurrence of each reference. Streamed evidence will be merged into the current assistant response and only added when its source is not already present. This also applies to messages loaded from history.

## Markdown Rendering

Keep the existing dependency-free renderer, but parse lines into paragraphs, headings, and unordered lists. Normalize compact bullet separators into list lines only when they follow a paragraph/list introduction. Apply explicit spacing and readable line-height to each block.

## Non-goals

- Changing the model prompt or evidence schema.
- Changing persistence format or replaying old events.
- Supporting full CommonMark, tables, links, or code fences.
