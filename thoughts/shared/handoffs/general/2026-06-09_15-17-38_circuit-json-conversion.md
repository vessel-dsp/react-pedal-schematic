---
date: 2026-06-09T15:17:38+01:00
researcher: Codex
git_commit: 304d0077651f5dcd5a279fb40cb44f6a14b539fa
branch: main
repository: circuit-preview-editor
topic: "Circuit JSON Conversion Feature Implementation Strategy"
tags: [implementation, strategy, circuit-json, tscircuit, netlist, export]
status: complete
last_updated: 2026-06-09
last_updated_by: Codex
type: implementation_strategy
---

# Handoff: Circuit JSON conversion feature

## Task(s)

Planned feature: add a Circuit JSON / tscircuit conversion path for
`@vessel-dsp/react-pedal-schematic`.

The immediate product need came from `pedal-stompbox`: generated `board.svg`
started becoming a hand-authored hybrid between PCB visualization and stompbox
wiring layout. The desired direction is to use this upstream schematic library as
the source for schematic parsing/rendering and expose a PCB-capable downstream
representation instead of reinventing PCB layout in the consuming app.

Status:

- Research completed.
- Initial production implementation started in this repository.
- First deliverable implemented: a headless `CircuitDocument` to Circuit JSON
  source-domain exporter.
- tscircuit should be supported as an export/preview target first, not made the
  canonical model.

## Critical References

- `CLAUDE.md:31` - scope boundary: do not make tscircuit the source of truth; use
  it as a preview/export target where it fits.
- `CLAUDE.md:265` - headless API and library module boundaries; `src/index.ts`
  is the public headless API.
- `CLAUDE.md:296` - development rules: use Bun, add format support as adapters,
  keep headless entrypoint React-free, and never silently perform lossy
  conversion.
- `src/model/types.ts:11` - current `ComponentKind` union.
- `src/model/types.ts:87` - canonical `CircuitDocument`.
- `src/model/netlist.ts:17` - current `NetlistView` shape.
- `src/model/netlist.ts:149` - `toNetlistView()` implementation.
- `src/index.ts:24` - current netlist exports.
- `src/formats/document.ts:42` - source-format dispatcher.
- `DOCUMENT.md:40` - documented conversion model through `CircuitDocument`.

External references:

- tscircuit docs: https://docs.tscircuit.com/
- Circuit JSON spec repo: https://github.com/tscircuit/circuit-json
- Circuit JSON SVG renderer: https://github.com/tscircuit/circuit-to-svg
- tscircuit autorouter: https://github.com/tscircuit/tscircuit-autorouter
- Freerouting: https://www.freerouting.app/
- KiCad CLI: https://docs.kicad.org/master/en/cli/cli.html

## Recent Changes

Implemented initial V1 exporter:

- `src/formats/circuit-json/serializer.ts` adds
  `serializeCircuitJsonDocument(doc, options)`.
- `src/index.ts` re-exports the Circuit JSON exporter and local exported types
  from the headless API.
- `tests/formats/circuit-json/serializer.test.ts` covers source nets,
  source components, source ports, source traces, rail/ground metadata,
  unsupported diagnostics, and missing-value fallback behavior.
- `tests/formats/circuit-json/tscircuit-fixtures.test.ts` converts every bundled
  `.schx`, `.asc`, and `.cir` / `.net` fixture and validates each emitted
  element with `circuit-json`'s official `any_circuit_element` schema.
- `tests/package.test.ts` verifies the exporter is available from root/core
  package imports and that Circuit JSON / tscircuit validation tooling stays out
  of runtime dependencies.
- `package.json` and `bun.lock` add `circuit-json` and `zod` as dev
  dependencies.

Related cross-repo note:

- `/Users/josephcheng/Projects/pedal-stompbox/thoughts/shared/plans/2026-06-09-schematic-to-pcb-pipeline.md:23`
  documents the downstream reason for the feature and the preferred pipeline.
- `/Users/josephcheng/Projects/pedal-stompbox/CLAUDE.md:50` now tells that repo
  to consume this library for schematic parsing/rendering and use a real PCB
  representation for board work.

## Learnings

The existing repository already has the right architectural boundary:

- The library is consumer-agnostic and should not own downstream host rendering
  policy (`CLAUDE.md:7` and `CLAUDE.md:9`).
- tscircuit / Circuit JSON is already named as a later interop target
  (`CLAUDE.md:18`).
- The library explicitly says not to make tscircuit the source of truth
  (`CLAUDE.md:40`).
- `.vdsp` is an inspection/edit/export artifact around `CircuitDocument`, not a
  second canonical model (`CLAUDE.md:82`).
- Headless conversion must not pull React into `src/index.ts` transitively
  (`CLAUDE.md:270` and `CLAUDE.md:305`).

Circuit JSON conversion is not just a SPICE netlist export:

- `NetlistView` has component ids, kinds, values, models, nodes, directives, and
  warnings (`src/model/netlist.ts:7` and `src/model/netlist.ts:17`).
- PCB-capable Circuit JSON also needs footprint decisions, terminal-to-footprint
  pin mapping, board dimensions, placement hints, keep-outs, trace width, and
  clearance rules. Those do not currently exist in `CircuitDocument`.
- `toNetlistView()` skips view-only kinds such as ground, label, named-wire,
  port, and jack (`src/model/netlist.ts:109`). That is appropriate for SPICE-ish
  netlists, but Circuit JSON may need explicit source/net/connector elements for
  some of those concepts.
- Op-amps and other multi-terminal/subcircuit-like parts currently surface with
  `spiceLetter: null` in `toNetlistView()` (`src/model/netlist.ts:166`). The
  Circuit JSON adapter should map from `ComponentKind` and terminal names, not
  blindly from `spiceLetter`.

Recommended boundary:

- Add an optional headless exporter in this library.
- Keep tscircuit, Circuit JSON renderer/types, autorouter helpers, and related
  preview/build/test packages in `devDependencies` in this project. Do not add
  them as runtime `dependencies` unless a shipped public API genuinely requires
  them.
- If official Circuit JSON types are useful, prefer type-only imports from a
  dev dependency or local minimal type definitions at first.
- Keep PCB layout/routing policy downstream. This library can emit enough
  structured data for consumers to hand to tscircuit/Circuit JSON, but it should
  not become a PCB fabrication tool.

## Artifacts

Created:

- `thoughts/shared/handoffs/general/2026-06-09_15-17-38_circuit-json-conversion.md:1`

Relevant existing artifacts:

- `CLAUDE.md:31`
- `CLAUDE.md:265`
- `CLAUDE.md:296`
- `DOCUMENT.md:40`
- `src/model/types.ts:11`
- `src/model/types.ts:87`
- `src/model/netlist.ts:17`
- `src/model/netlist.ts:149`
- `src/index.ts:24`
- `src/formats/document.ts:42`
- `tests/model/netlist.test.ts:41`
- `package.json:25`
- `package.json:54`

## Action Items & Next Steps

1. Add RED tests for a minimal Circuit JSON export surface.
   Suggested test file: `tests/formats/circuit-json/serializer.test.ts`.
   Start with a simple resistor/capacitor/ground fixture and assert stable
   source-component ids, values, nets, and warnings.
   - Done: `tests/formats/circuit-json/serializer.test.ts`.

2. Decide the exported API name and module boundary.
   Conservative starting point:
   - `src/formats/circuit-json/serializer.ts`
   - `export type CircuitJsonExportOptions`
   - `export function serializeCircuitJsonDocument(doc: CircuitDocument, options?: CircuitJsonExportOptions)`
   - re-export from `src/index.ts`
   - Done with the conservative API name and module boundary.

3. Add a tiny internal Circuit JSON target type or import official Circuit JSON
   types as type-only from a dev dependency.
   Avoid bringing tscircuit UI/runtime into the core package. The current package
   exports keep `/core` React-free (`package.json:25` and `DOCUMENT.md:3`).
   - Done as local exported types plus `circuit-json` and `zod` in
     `devDependencies`.

4. Implement the minimum GREEN adapter.
   Do not route or lay out PCB traces yet. Emit deterministic, inspectable source
   elements/components/nets or the smallest Circuit JSON subset that can later be
   rendered by `circuit-to-svg`.
   - Done for source-domain `source_net`, `source_component`, `source_port`,
     and `source_trace` elements.

5. Add explicit lossy-conversion diagnostics.
   Unknown component kinds, missing terminal mappings, skipped view-only elements,
   missing footprints, and synthesized layout should be first-class warnings, not
   silent drops. This follows `CLAUDE.md:304`.
   - Partially done: unsupported components, unmapped component kinds,
     source-only labels/named wires, missing quantities, and resolved nodes with
     no exported ports produce warnings. Footprint diagnostics remain future work.

6. Add a footprint/pin mapping layer separately from electrical connectivity.
   Suggested file:
   - `src/formats/circuit-json/footprints.ts`
   Cover at least resistor, capacitor, diode, LED, BJT, JFET, opamp, potentiometer,
   jack/port, ground, and rail.

7. Exercise the exporter on real fixtures.
   Good starting fixtures:
   - `tests/fixtures/schx/livespice-examples/MXR Distortion +.schx`
   - `tests/fixtures/schx/livespice-examples/Pro Co Rat.schx`
   - `tests/fixtures/asc/ltspice-guitar-pedals/ts808_tube_screamer.asc`
   - `tests/fixtures/schx/lpb-1-style-boost.schx`
   - Done broadly for all bundled fixtures via
     `tests/formats/circuit-json/tscircuit-fixtures.test.ts`.

8. After the headless exporter works, consider a playground tab.
   This can show the raw Circuit JSON first. A tscircuit/circuit-to-svg visual
   preview should come later and may belong in the playground only, not the
   library core.

9. Verification commands for implementation:
   - `bun test tests/formats/circuit-json/serializer.test.ts`
   - `bun test tests/model/netlist.test.ts`
   - `bun run typecheck`
   - `bun run build`

## Other Notes

Possible staged API:

```ts
import {
    parseCircuitDocumentFile,
    serializeCircuitJsonDocument,
} from '@vessel-dsp/react-pedal-schematic/core';

const document = parseCircuitDocumentFile(source, { filename: 'mxr.schx' });
const circuitJson = serializeCircuitJsonDocument(document, {
    target: 'tscircuit',
    includeWarnings: true,
});
```

Naming caution:

- `serializeCircuitJsonDocument()` is clear but may imply exact official
  compatibility. If the first version is only a partial bridge, consider
  `toCircuitJsonPreview()` or `toCircuitJsonExport()` and return a diagnostics
  object alongside elements.

Preferred return shape for V1:

```ts
type CircuitJsonExport = Readonly<{
    elements: readonly unknown[];
    warnings: readonly string[];
}>;
```

This prevents the exporter from pretending every source schematic is fully PCB
ready. When official Circuit JSON compatibility is verified by fixture tests,
the return type can become stricter.

Avoid these mistakes:

- Do not route through `.vdsp` YAML for conversion. Consume `CircuitDocument`
  directly.
- Do not depend on React or the playground from the headless exporter.
- Do not make tscircuit the canonical model.
- Do not add tscircuit-related packages to runtime `dependencies` for this
  library unless the shipped API truly needs them.
- Do not silently drop unsupported components.
- Do not implement autorouting inside this library before the plain conversion
  surface is tested.
