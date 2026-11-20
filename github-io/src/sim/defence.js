// Re-export shim (AAA round 2, CW-A): the Defence rules moved to src/sim/defence/ (index.js builds the
// mixin in the original key order). Every import of this path keeps working.
export * from "./defence/index.js";
