/** Prism Core — public library API. */
export * from "./types";
export * from "./providers";
export { loadConfig, decorrelationOf, BUILTIN_PROFILES } from "./config";
export type { PrismConfig, ResolvedConfig, RoleMap } from "./config";
export { resolveDiff, defaultBranch, citationHolds } from "./git";
export type { ResolvedDiff, DiffOptions } from "./git";
export { verify } from "./orchestrator/verify";
export type { VerifyInput } from "./orchestrator/verify";
export { validate, writeRun, renderHtml, writeHtml, loadSchema, schemaPath } from "./packet";
export { buildDashboard, loadRuns } from "./dashboard";
export type { RunSummary } from "./dashboard";
