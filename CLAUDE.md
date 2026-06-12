# CLAUDE.md

Guidance for coding agents working in this repository.

## Project

Vessel DSP Core is a TypeScript workspace centered on the publishable
`@vessel-dsp/core` package. The package is a headless conversion library for
audio-circuit documents and tscircuit Circuit JSON.

Current target formats:

- project-native `.vdsp` Source documents (`circuit-interchange/v2` YAML);
- LTspice `.asc`;
- LiveSPICE `.schx`;
- tscircuit `.circuit.json`;
- legacy SPICE `.cir` / `.net` parser and netlist serializer support.

The project no longer publishes repo-owned UI or realtime-runtime packages. Do
not rebuild a custom React component library, custom schematic editor, or
realtime simulator in this repo. Use tscircuit/Circuit JSON for rendering and
downstream electronics workflows.

## Packages

- `packages/core/` -> npm package `@vessel-dsp/core`.
- `scripts/build-pages.ts` -> static GitHub Pages generator for the core
  conversion API reference.

The root package is private and only orchestrates workspace scripts.

## Core Boundary

`packages/core/src/index.ts` must stay React-free. It may depend on
`circuit-json` and `zod` for public Circuit JSON schema validation, but it must
not import React, React DOM, browser-only rendering APIs, AudioContext, or an
audio runtime.

Canonical data flow:

```text
.vdsp / .asc / .schx / .cir / .net / .circuit.json
  -> parsed source-specific data
  -> CircuitDocument
  -> Circuit JSON / .vdsp / .asc / .schx / legacy netlist output
```

`.vdsp` is still a serialized Source/edit/audit view around `CircuitDocument`,
not a second in-memory model and not a required bridge for source-format
conversion. Cross-format conversion should go through `CircuitDocument` and a
target-specific serializer.

## Important Core Paths

- `packages/core/src/formats/document.ts` - file detection, parse/serialize
  dispatch, and `convertCircuitDocumentFile()`.
- `packages/core/src/formats/circuit-json/serializer.ts` - Circuit JSON export,
  validation, and import.
- `packages/core/src/formats/interchange/*` - strict `.vdsp` YAML serializer and
  parser.
- `packages/core/src/formats/ltspice/*` - LTspice parser, catalog, encoding, and
  serializer.
- `packages/core/src/formats/schx/*` - LiveSPICE parser, catalog, transforms,
  and serializer.
- `packages/core/src/model/*` - normalized model, connectivity, netlist, values,
  and validation.
- `tests/fixtures/*` - parser/conversion fixture corpus.

## Circuit JSON Contract

V1 bidirectional Circuit JSON conversion covers `.vdsp`, `.asc`, and `.schx`.
The core package exports:

- `serializeCircuitJsonDocument(document)`;
- `parseCircuitJsonDocument(elements, options?)`;
- `validateCircuitJsonDocument(elements)`;
- official Circuit JSON types such as `CircuitJson`, `AnyCircuitElement`, and
  `AnyCircuitElementInput`;
- `serializeCircuitDocumentFile(document, { format, filename? })`;
- `convertCircuitDocumentFile(source, options)`;
- `serializeLtspiceAsc(document, options?)`.

Unsupported PCB, fabrication, BOM, or simulation-only Circuit JSON elements must
not be silently converted into schematic semantics. Emit diagnostics when data is
unsupported, lossy, or synthesized.

## Development Rules

- Use Bun commands, not npm, unless the user explicitly asks.
- Use `rg` for search.
- Keep parser/serializer changes covered by focused tests and fixture tests.
- Use official `circuit-json` schema validation for Circuit JSON boundaries.
- Treat `.vsdp` and `.asr` as typos, not supported aliases.
- Preserve source fidelity first; clever normalization comes after tests.
- Do not add React or tscircuit preview packages to `packages/core`.
- Do not add a repo-owned playground or reusable UI package. Render or edit
  Circuit JSON in downstream tscircuit apps.

## Verification

Pick the smallest check that covers the change:

- Circuit JSON changes: `bun test tests/formats/circuit-json`.
- LTspice changes: `bun test tests/formats/ltspice`.
- `.vdsp` changes: `bun test tests/formats/interchange tests/formats/document.test.ts`.
- Package contract changes: `bun test tests/package.test.ts tests/smoke.test.ts`.
- GitHub Pages docs changes: `bun test tests/pages tests/package.test.ts` and
  `bun run build:pages`.
- Final full check: `bun test && bun run typecheck && bun run build && bun run build:pages`.
