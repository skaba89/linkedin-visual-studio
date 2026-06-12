# Task 8: Refactor A/B Testing Engine — Dual-Store Elimination

## Agent: Code Refactoring Agent
## Status: ✅ Completed

## Summary

Eliminated the dual-store problem (in-memory Maps + Prisma DB running in parallel) by making Prisma the single source of truth for the A/B testing engine.

## Files Modified

### 1. `/home/z/my-project/src/lib/ab-testing/ab-engine.ts` (Full rewrite)
**Changes:**
- Removed `experiments: Map<string, ExperimentConfig>` — replaced with `db.experiment.*` queries
- Removed `results: Map<string, ExperimentResult[]>` — replaced with `db.experimentResult.*` queries
- Kept `assignments: Map<string, ABTestAssignment>` as an in-memory session cache (performance only, NOT source of truth)
- Made all public methods `async`:
  - `createExperiment()` → `db.experiment.create()`
  - `startExperiment()` → `db.experiment.update()` with status="running", startDate=new Date()
  - `assignVariant()` → `db.experiment.findUnique()` to get variants, consistent hashing kept
  - `recordOutcome()` → `db.experimentResult.create()` + auto-checkSignificance
  - `checkSignificance()` → `db.experimentResult.findMany()` + `db.experiment.update()`
  - `getReport()` → `db.experiment.findUnique()` + `db.experimentResult.findMany()`
  - `updateStatus()` → `db.experiment.update()`
  - `getExperiments()` → `db.experiment.findMany()`
- Removed `loadExperiments()` (no longer needed — DB is the source)
- Added `experimentToConfig()` helper to parse DB records → ExperimentConfig (parses JSON `variants` field)
- Added `import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db"`
- Kept all statistical methods unchanged: `consistentHash`, `selectVariant`, `wilsonScoreInterval`, `zScoreToConfidence`
- Kept class name `ABTestingEngine` and singleton export `abEngine`

### 2. `/home/z/my-project/src/app/api/data/experiments/route.ts`
**Changes:**
- Removed `import { abEngine } from "@/lib/ab-testing"` — the route already used Prisma directly for all CRUD

### 3. `/home/z/my-project/src/app/api/data/experiments/[id]/route.ts`
**No changes needed** — already uses Prisma directly, no `abEngine` import

### 4. `/home/z/my-project/src/app/api/data/experiment-results/route.ts`
**No changes needed** — already uses Prisma directly, no `abEngine` import

### 5. `/home/z/my-project/src/lib/ab-testing/index.ts`
**No changes needed** — re-exports remain valid (class name and types unchanged)

### 6. `/home/z/my-project/src/lib/ab-testing/types.ts`
**No changes needed** — all type definitions remain the same

## Key Design Decisions

1. **Assignments Map stays in-memory**: It's purely a session cache for variant assignment performance. On server restart, the deterministic consistent-hash algorithm will produce the same assignment for the same userId+experimentId combo, so no data loss occurs.

2. **JSON parsing for variants field**: The Prisma `Experiment.variants` field stores a JSON string. The `experimentToConfig()` helper parses this into `Variant[]` when converting DB records to the `ExperimentConfig` type used by the engine.

3. **Experiment.results field**: The `results` JSON string field on the Experiment model is for storing analysis results metadata, separate from the `ExperimentResult` records table.

4. **All callers must now `await`**: Since all engine methods are now async, any existing callers (if any) must use `await`. The only known consumer was the experiments route, which has been decoupled.
