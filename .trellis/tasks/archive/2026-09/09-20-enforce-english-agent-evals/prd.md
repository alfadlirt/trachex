# Enforce English Output in Agent Prompts and Evals

## Goal

Ensure that agent output (extracted requirements, implementation items, success criteria, descriptions, and rationales) is always produced in English, even when the input source documents, notes, or resources are provided in other languages (such as Indonesian, Spanish, Chinese, Japanese, etc.), and enforce this behavior with explicit evaluation metrics and fixtures in `@trachex/agent`.

## Background & Context

Trachex ingests business requirements documents, adjustment notes, and tickets to generate structured proposals (`extractionOutputSchema`, `reconciliationOutputSchema`).
Currently:
- `buildExtractionPrompt` and `buildReconciliationPrompt` in `packages/agent/src/prompts.ts` define rules against hallucinating tech stacks and inferring endpoints, but lack an explicit instruction mandating English output regardless of source language.
- `packages/agent/src/evals/` contains evaluation categories (`Basic eval`, `Contains`, `Relevancy`, `Faithfulness`, `G-Eval`, `Prompt alignment`) and fixtures in `corpus.ts`.
- There is currently no evaluation metric verifying that non-English source text yields English output, nor guardrail verification in `promptAlignment`.

## Requirements

1. **System Prompt Instructions**:
   - Update `buildExtractionPrompt` and `buildReconciliationPrompt` in `packages/agent/src/prompts.ts` with explicit instructions:
     "All output must be in English. Even if the provided source document or notes are written in another language, translate and express all titles, descriptions, implementationItems, successCriteria, and rationales in English."
2. **Evaluation Metric for English Output**:
   - Add an evaluation metric (e.g. `english-output` under `Prompt alignment` or `Faithfulness` / `Language`) to verify that agent outputs are written in English.
   - Detect non-English text or verify English language adherence on generated requirements/proposals.
   - Update `promptAlignment` in `harness.ts` to include the English output guardrail in its required prompt guardrails list.
3. **Corpus Fixtures**:
   - Add multilingual fixture(s) in `packages/agent/src/evals/corpus.ts` where the source is in another language (e.g., Indonesian or Spanish) and the expected output is translated into English.
   - Add a negative fixture or test case showing detection/failure when output fails the English requirement if applicable.
4. **Integration & Test Coverage**:
   - Add unit/integration tests for the evals harness verifying that the English output metric passes for English output and flags non-English output.
   - Ensure all `@trachex/agent` tests and typechecks pass (`pnpm --filter @trachex/agent test` and `pnpm --filter @trachex/agent typecheck`).

## Acceptance Criteria

- [x] `buildExtractionPrompt` and `buildReconciliationPrompt` include explicit instructions to output exclusively in English regardless of input resource language.
- [x] `promptAlignment` checks that the English output guardrail is present in prompts.
- [x] An evaluation metric checks that requirements output is in English.
- [x] Multilingual fixtures are added to `CHECKLIST_FIXTURES` in `corpus.ts`.
- [x] The harness runs and reports the new metric in `runEvalHarness()`.
- [x] Tests covering prompt instructions and eval metric behavior pass cleanly in `packages/agent`.

## Out of Scope

- Translation of canonical code identifiers, exact API paths, or verbatim quoted URLs/impact values that are language-neutral technical tokens.
- Dynamic runtime language translation APIs or third-party cloud translation services; prompt steering and regex/heuristic-based eval checks within `@trachex/agent` suffice.

