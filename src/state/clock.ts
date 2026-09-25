/** A source of "now". Inject one (tests, previews) instead of reading the real clock. */
export type Clock = () => Date;

/**
 * The real clock, and the only production code allowed to read it
 * (see REAL_CLOCK_ALLOWLIST in scripts/check-architecture.mjs, docs/ARCHITECTURE.md).
 */
export const systemClock: Clock = () => new Date();
