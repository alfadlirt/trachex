# Technical Design: Enforce English Output in Agent Prompts and Evals

## Architecture & Boundaries

The changes are contained within `@trachex/agent`:
1. `packages/agent/src/prompts.ts`:
   - Add English output constraint to `buildExtractionPrompt` and `buildReconciliationPrompt`:
     `All output must be in English. Even if the source document or notes are in another language, translate and provide all titles, descriptions, implementationItems, successCriteria, and rationales in English.`
2. `packages/agent/src/evals/corpus.ts`:
   - Add multilingual fixture(s), e.g. `multilingual-source-english-output`:
     - `source`: Non-English requirement (e.g. Indonesian: *"Pelanggan dapat membatalkan pesanan sebelum barang dikirim. Pengembalian dana harus diproses secara otomatis."*)
     - `concepts`: English target concepts (`cancel order`, `refund`, `shipped`)
     - `output`: English requirements (`Customers can cancel an order before shipment...`)
     - `expected`: `'pass'`
   - Add a non-English violation fixture:
     - Output retains foreign language tokens/sentences when source was non-English.
     - `expected`: `'fail'` or language-specific assertion.
3. `packages/agent/src/evals/harness.ts`:
   - Update `promptAlignment(fixture)`:
     - Add `'All output must be in English'` to `guardrails` array.
   - Add `languageCheck(fixture)` eval function:
     - Metric name: `english-output` under category `'Prompt alignment'` or `'Basic eval'`.
     - Verifies output text does not contain typical non-English marker patterns or checks that text adheres to English character/word distributions, or uses negative pattern checks against fixture languages.
   - Wire `languageCheck` into `runEvalHarness()`.
4. `packages/agent/src/evals/harness.test.ts` (or `pipeline.test.ts` / new test file):
   - Unit tests validating that the eval harness scores pass/fail appropriately on English vs non-English outputs.

## Trade-offs & Considerations

- **Heuristic language validation**: Since we don't want heavy external language-detection binary dependencies (like cld or fasttext), a clean regex / dictionary / common non-English stopword heuristic or common script detection accurately evaluates English output while keeping dependencies lightweight and deterministic.
- **Backwards compatibility**: Existing English fixtures continue to pass without any changes.
