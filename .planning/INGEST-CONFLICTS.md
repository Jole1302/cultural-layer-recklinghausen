## Conflict Detection Report

### BLOCKERS (0)

(none — single-doc ingest, no LOCKED-vs-LOCKED contradictions, no cross-ref cycles, no UNKNOWN-confidence-low classifications, no existing locked context to violate in `new` mode)

### WARNINGS (0)

(none — no overlapping requirements with divergent acceptance criteria; only one doc was ingested, so no inter-doc requirement collisions are possible)

### INFO (1)

[INFO] Embedded ADR-style decisions log promoted to LOCKED in synthesized intel
  Note: The single ingested document is classified as SPEC (`docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md`). Per orchestrator instruction and per the classifier note, section 13 ("Decisions log — зафиксировано в brainstorming") and section 7 ("Tech stack (locked)") were treated as ADR-equivalent locked decisions during synthesis. Twenty-two decisions (DEC-001 through DEC-022) were materialised in `decisions.md` with `status: locked`. This is a controlled promotion (not an auto-resolve of conflicting sources): the parent SPEC is in status `APPROVED — ready for implementation plan`, which corresponds to ADR Accepted semantics for the embedded log. No content was discarded or merged. Downstream roadmapper/planner should treat these as authoritative.
