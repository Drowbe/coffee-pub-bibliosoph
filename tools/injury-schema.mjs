// ==================================================================
// ===== INJURY SCHEMA (tools/injury-schema.mjs) =====================
// ==================================================================
// Re-export shim. The schema itself lives in scripts/data/injury-schema.js
// so the Foundry runtime and these build tools read ONE definition —
// keeping a second copy here is exactly how the old metadata drifted.
// ==================================================================

export * from '../scripts/data/injury-schema.js';
