# CLAUDE.md

Guidance for Claude Code and other coding agents working in this repository.

## Project

Vessel DSP is a TypeScript workspace for audio-circuit and device documents. The canonical packages are `@vessel-dsp/core` for headless circuit/device data, format conversion, schematic/wiring/panel/PCB-oriented layout metadata, and validation, and `@vessel-dsp/react-component` for React rendering surfaces. Guitar effects pedals remain the first fixture and UX target, while stompbox and amplifier enclosures, wiring layouts, PCB layouts, and broader audio hardware metadata are now valid core concerns.

The packages are consumer-agnostic. Any web application can embed them through typed APIs; the core package itself ships no opinions about how the host renders results or what downstream tooling consumes them.

Target formats:

- LiveSPICE `.schx` schematic XML (primary, graphical);
- LTspice `.asc` schematic (graphical, SYMBOL/WIRE/FLAG/IOPIN/TEXT);
- SPICE-style `.cir` / `.net` netlists (connectivity);
- project-native `.vdsp` Source format (strict `circuit-interchange/v2` YAML; LLM-friendly, schema name intentionally rename-safe);
- later KiCad schematic/netlist formats;
- later tscircuit / Circuit JSON interop for PCB and web preview workflows.

The core package is not a full SPICE solver and does not promise fabrication-ready PCB output. Realtime simulation is a staged capability under `@vessel-dsp/simulation`, with explicit readiness diagnostics and support levels instead of a blanket promise that every imported document can run as audio DSP.

## Distribution

The repo has three package deliverables plus the playground/docs site:

- **Core package** -> npm as `@vessel-dsp/core`. Lives under `packages/core/`. This is the React-free surface for formats, normalized documents, editor commands, preview/layout helpers, panel/device metadata, and conversion helpers.
- **React package** -> npm as `@vessel-dsp/react-component`. Lives under `packages/react-component/`. The root re-exports core helpers for React apps, and `@vessel-dsp/react-component/ui` exposes UI-only React components. It does not bundle a UI component framework; consumers bring their own styling.
- **Simulation package** -> workspace-private `@vessel-dsp/simulation` for now. Lives under `packages/simulation/`. It analyzes simulation readiness, compiles explicit simulation IR from `CircuitDocument`, and exposes runtime adapter interfaces without pulling React or browser-only APIs into core.
- **Playground + docs site** -> GitHub Pages. Lives under `playground/`. A Vite + React + Tailwind v4 + shadcn/ui SPA that imports the packages directly through workspace aliases for development, demonstrates supported formats and components, and serves the reference documentation. Hosted at the project's GitHub Pages URL via a GitHub Actions deploy workflow.

The playground is the canonical demo and visual test surface. New capabilities land in the packages first, then get exercised in the playground.

## Scope Boundaries

Keep the first version small:

- Do import, parse, validate, preview, inspect, edit, and export audio circuit and device documents.
- Do model schematic, panel/enclosure, wiring-layout, PCB-layout, and conversion metadata when it is useful to audio hardware workflows.
- Keep realtime simulation explicit and capability-gated through `@vessel-dsp/simulation`.
- Do not implement a full SPICE solver in V1.
- Do not promise exact LiveSPICE, LTspice, KiCad, or tscircuit support unless tested against fixtures.
- Do not use a generic graph editor as the canonical document model.
- Do not make tscircuit the source of truth. Use it as a preview/export target where it fits.

The canonical state is a library-owned circuit document model:

```text
source file (.schx / .cir / etc.)
  -> parsed source-specific AST
  -> normalized circuit document model
  -> editor operations
  -> optional serialized Source `.vdsp` view
  -> preview/export adapters
```

## `.vdsp` Interchange Format

The project-owned `.vdsp` format is the YAML Source view for `.schx`, `.asc`, `.cir`, `.net`, and future formats. It lets users inspect and lightly edit the normalized document through one explicit representation. Treat `circuit-preview-ir` as a project codename only. Do not bake that codename into the saved schema identity because the project may be renamed. Keep using a neutral versioned schema id such as `circuit-interchange/v2`.
The project-owned `.vdsp` format is the YAML Source view for `.schx`, `.asc`, `.cir`, `.net`, and future formats. It lets users inspect and lightly edit the normalized document through one explicit representation. Treat `circuit-preview-ir` as a project codename only. Do not bake that codename into the saved schema identity because the project may be renamed. Keep using a neutral versioned schema id such as `circuit-interchange/v2`.

The in-memory source of truth remains `CircuitDocument`; `.vdsp` is a serialized, LLM-friendly YAML wrapper around that model plus source metadata. It should be easy for humans and LLMs to read, diff, inspect, edit, and discuss.

Current implementation status:

- `src/formats/interchange/serializer.ts` exports `serializeInterchangeYaml(doc, options)` through the headless API.
- `src/formats/interchange/parser.ts` exports `parseInterchangeYaml(source)` through the headless API. It is a strict parser for the project serializer's YAML subset, not a general YAML import surface.
- `src/formats/document.ts` exports `.vdsp` helpers: `parseVdspCircuitDocument`, `validateVdspCircuitDocumentSchema`, `serializeVdspCircuitDocument`, `parseCircuitDocumentFile`, `detectCircuitDocumentFileFormat`, and filename helpers.
- The playground top tab row includes **Source**, which shows the current edited `CircuitDocument` as copyable generated text. Its format dropdown defaults to `.vdsp` and can switch to `.schx` or `.cir`.
- The previous **Raw .schx** tab was removed; Source is now the single copy/paste conversion surface.
- The YAML view uses `schema: circuit-interchange/v2`, `metadata`, `source`, optional `device`, optional `controlGroups`, optional `controlContexts`, optional `deviceInterface`, optional `panel`, optional `controlInterfaces`, optional `controlOutputs`, `components`, explicit terminal `node` ids, top-level `nodes`, `wires`, `directives`, `diagnostics`, and `rawAttributes`.
- `tests/formats/interchange/fixture-coverage.test.ts` verifies current serialization coverage across all supported fixtures in the workspace.
- `tests/formats/interchange/parser.test.ts` verifies the strict YAML parser can rebuild a `CircuitDocument` from the project's own serialized shape and preserves string-valued scalar properties.
- The parser ignores the derived top-level `nodes` block when rebuilding `CircuitDocument`; connectivity is recomputed from component terminals and wires.

Current format shape:

- Stable schema field: `schema: "circuit-interchange/v2"`.
- Stable ids for components, wires, terminals, nodes, and diagnostics.
- Explicit nodes: every component terminal includes its resolved node id; a top-level `nodes` list records names, ground role, aliases, and member pins.
- Typed quantities: preserve `{ raw, value, unit }` rather than flattening values into strings.
- Source provenance: record original format, filename when available, and encoding when relevant under `source`.
- Optional stompbox panel placement: record logical control-surface layout under top-level `panel`, separate from schematic component `origin`. Use `faces[]` for named physical surfaces such as `top`, `bottom`, `left-side`, `right-side`, `front`, and `rear`. Each face has a `layout` with `kind: stompbox-grid`, explicit `rows`, `columns`, and `indexing`, plus `elements[]` entries with `bind: { componentId, optional controlId/controlName/property }`, `kind`, `label`, and a self-describing `grid` object (`row`, `column`, optional `rowSpan`, `columnSpan`). Prefer `indexing: one-based` for hand-authored `.vdsp`, while the parser also accepts `zero-based` when explicitly declared. The parser accepts legacy `panel.layout` + `panel.controls[]` / `controlKind` input and normalizes it to one `top` face. Panel validation warns with `panel-binding-unresolved`, `panel-control-unresolved`, `panel-kind-mismatch`, and `panel-cell-collision`.
- Optional semantic device interface metadata: record stable user-visible controls under top-level `deviceInterface.controls[]`, with grouping under `controlGroups[]` and conditional contexts under `controlContexts[]`. Use lower-kebab semantic roles; `groupId` references `controlGroups[].id`; `appliesWhen.allOf` / `anyOf` reference `controlContexts[].id`; `binding` points back to source components, runtime controls, properties, or external interface ids. `panel.faces[].elements[].interfaceControlId` may join physical placement to a semantic control id, but the panel `bind` remains the source schematic binding.
- Optional external control interface metadata: record product-level external inputs under top-level `controlInterfaces`, separate from layout-only `panel`. Use this for DD-3-style `TRIGGER`/`RESET`, DD-5 `Tempo In`, expression or CTL/EXP jacks, connector type, assignment hint, polarity, and bindings to runtime descriptor controls. Do not model external footswitch targets as normal panel switches unless the hardware has a visible panel switch.
- Optional producer-side control output metadata: record standalone control-accessory identity under `device` and emitted control outputs under `controlOutputs[]`. Use this for FS-5U / FS-6 style accessories that do not process audio but can be patched into another document's `controlInterfaces`.
- Diagnostics: warnings and known lossy conversions are first-class data, not comments.

Do not use compact tuple-heavy data for the persisted interchange format. Prefer self-describing objects like `{ "x": 120, "y": 80 }` over `[120, 80]`, and `{ "componentId": "R1", "terminalName": "a" }` over `"R1:a"` except in derived indexes.

`.vdsp` is an inspection/edit/export artifact, not the canonical model and not a source-format round-trip path. Do not add source-format regeneration or cross-format conversion requirements unless the user explicitly reopens that scope. If future target-format exporters are added, they should consume `CircuitDocument` directly, with `.vdsp` used as an audit/debug/source-edit view.

```text
.schx / .asc / .cir / .net
  -> CircuitDocument
  -> .vdsp
  -> CircuitDocument (strict Source editor parser only)
```

## Audio-Domain Component Coverage

The component model and symbol library prioritize parts that show up in real audio schematics. Treat the following as first-class, not "specialty":

- **Passives**: resistors, capacitors (electrolytic / film / ceramic distinctions), inductors, potentiometers (audio/log + linear tapers), trimpots, variable resistors.
- **Semiconductors**: diodes (clipping, signal, Zener, LED), BJTs (general-purpose, low-noise), JFETs, MOSFETs, photoresistors / vactrols / optocouplers.
- **Tubes**: triodes (12AX7, 12AU7, etc.), pentodes, rectifier tubes, tube diodes.
- **ICs**: op-amps (single / dual / quad packages), audio op-amps (TL07x, NE5532, OPAxxx), comparators, voltage regulators, OTAs, BBDs, switched-cap chips, DSP/codec ICs marked as opaque.
- **Magnetics**: audio transformers (input/output/interstage), chokes, gyrators where used.
- **Mechanical / IO**: input/output jacks (TS, TRS, XLR), footswitches (SPST/SPDT/3PDT/4PDT — true bypass patterns matter), toggle switches, rotary switches, relays.
- **Sources / references**: voltage rails, ground variants (signal/chassis), batteries, power supplies, bias references.
- **View-only metadata**: labels, named wires, ports, test points, diagnostics.

For each component the library tracks: terminal layout, rotation/flip behavior, properties with parsed quantities and units, taper/curve metadata for controls, and a `support` level (`simulatable` vs `view-only`) so downstream tools know what is safe to act on. Unsupported components stay visible and are explicitly marked, never silently dropped.

## Pedal Symbol Strategy

The editor supports schematic preview as its visual surface: abstract electrical symbols, redrawn in a clean common pedal-schematic convention and backed by the normalized circuit document.

Wiring diagrams are out of scope. Do not add physical pedal-wiring symbols, lug-grid layouts, board-pad graphics, offboard wire endpoints, or a separate wiring-view renderer unless the product scope is explicitly reopened.

Symbol work is fixture-driven. Before broad redraw work, collect a component/symbol inventory from the bundled guitar-pedal schematics and use it as the acceptance target. The current pedal fixture corpus mostly needs:

- resistor, capacitor, electrolytic capacitor, inductor;
- diode, LED, Zener where present;
- BJT, JFET, MOSFET;
- op-amp / ideal op-amp;
- potentiometer, variable resistor;
- input jack, output jack, DC/battery supply, voltage rail, ground;
- SPDT and 3PDT/footswitch-style switches;
- label, named wire, port/test point metadata.

Wah-style filters are not a single schematic symbol. Represent them as normal components — inductor, pot, capacitors, resistors, transistor stages — and optionally annotate the related components with role metadata such as `role: "wah-filter"` for inspection surfaces.

Do not base the project symbol plan on downloaded generic EDA symbol packs. A KiCad reference-pack attempt was removed because it was not a good enough match for common guitar-pedal schematic notation. Prefer a small hand-redrawn, pedal-focused symbol set derived from observed pedal fixtures, common published pedal schematics, and an explicit project-native style guide. Terminal geometry comes from the component catalog/source format mapping, not from copied symbol artwork.

## Format Strategy

### `.schx`

Treat LiveSPICE `.schx` as the highest-priority graphical schematic format.

Support:

- XML import/export;
- symbols/components;
- positions, rotations, flips;
- terminals and wires;
- named wires and labels;
- component properties and values;
- warnings for unsupported or view-only components.

Do not silently drop unknown `.schx` data. Preserve unknown attributes where practical, and warn when round-tripping may lose information.

Audio-engine runtime descriptors (`Circuit.MicroBlock*`, `Circuit.MacroTremolo`, `Circuit.MacroPhaser`) are recognized as opaque `kind: "ic"` runtime descriptors, not physical chips. Non-stage descriptors use terminals `input`/`output`, stable `sourceTypeName: "Circuit.<ShortType>"`, `RuntimeDescriptor: "true"`, and a `runtime-descriptor-imported` warning. Existing `MicroBlock*Stage` descriptors keep their legacy `in`/`out` terminals but also carry runtime descriptor metadata. Stereo fields such as `StereoOutputMode` stay component properties; do not synthesize extra schematic jacks unless the source schematic contains them.

### `.cir` / `.net`

Treat SPICE netlists as connectivity-first documents, not graphical schematics.

Support V1 parsing for:

- comments and directives;
- resistors, capacitors, inductors;
- diodes, BJTs, JFETs, MOSFETs as typed components;
- voltage and current sources;
- `.model`, `.subckt`, `.ends`, `.include`, `.param` as preserved metadata where full handling is not implemented.

V1 preview can auto-layout imported netlists, but exported netlists must preserve electrical connectivity and original model/directive text where possible.

### `.asc` (LTspice)

Treat LTspice `.asc` as the second graphical schematic format, alongside `.schx`.

Support:

- line-oriented parsing for `SYMBOL`, `WIRE`, `FLAG`, `IOPIN`, `TEXT`, and `SYMATTR` records;
- symbol catalog mapping LTspice symbol names → normalized `ComponentKind` with terminal geometry (`src/formats/ltspice/catalog.ts`);
- orientation strings (`R0..R270`, `M0..M270`) → our `{ rotation, flipped }` tuple;
- `FLAG` markers for ground/named nets and `IOPIN` markers for input/output jacks;
- `WIRE` records into the same wire-splitting pipeline as `.schx`;
- unknown symbol types fall back to `kind: 'unsupported'` with `sourceTypeName: "ltspice:<symbol>"` so they round-trip visibly.

Surface unsupported keywords (`WINDOW`, `LINE`, `RECTANGLE`, etc.) as warnings, not silent drops.

### Interchangeability Review

Current conversion and Source `.vdsp` confidence by format:

| Format | Import status | Export status | Source `.vdsp` / conversion notes |
| --- | --- | --- | --- |
| `.schx` LiveSPICE | Implemented for graphical symbols, wires, labels, rotations/flips, properties, root attributes | Implemented | Best current round-trip target. Risk remains around unknown element internals and unsupported source-specific component data. |
| `.asc` LTspice | Implemented for common schematic records and catalogued symbols | Not yet implemented | Import can preserve semantic layout, but ignored drawing records and missing `.asy` pin geometry can make strict round-trip impossible until an ASC serializer and symbol-file support exist. |
| `.cir` / `.net` SPICE | Implemented for flat common primitives and preserved directives | Implemented through `toNetlistView()` | Connectivity-first only. Comments, original ordering details, unsupported subcircuit instances, and graphical layout are lossy. |
| `.vdsp` | Strict `circuit-interchange/v2` YAML parser implemented for the project's serialized shape | `CircuitDocument -> .vdsp` serialization implemented | Current fixtures serialize to `.vdsp` for Source-tab coverage. `.vdsp` edits can rebuild `CircuitDocument`, but this is not source-format regeneration. |

Cross-format conversion rules:

- `.schx` ↔ `.asc`: target semantic schematic interchange, but do not promise exact visual or source-file round-trip until both serializers and fixture baselines exist. LTspice symbol-path models and LiveSPICE component `_Type` values need explicit source metadata.
- Graphical formats (`.schx`, `.asc`) → `.cir` / `.net`: preserve electrical connectivity, component values, models, and directives where supported. Expect loss of layout, labels that are not electrical nets, unsupported view-only components, and source-specific visual metadata.
- `.cir` / `.net` → graphical formats: generate deterministic layout and preserve connectivity, but mark the layout as synthesized. Never imply that a generated schematic is the original drawing.
- Any format → `.vdsp`: this is an inspection/edit path for `CircuitDocument`. Do not require `.vdsp -> source format` or `.vdsp -> other format`.
- Cross-format conversion, if implemented later, should go through `CircuitDocument` and target-specific serializers directly, not through YAML as a source-format bridge.

### Multi-format dispatcher

`src/formats/document.ts` exposes:

- `CircuitFormat = 'schx' | 'spice' | 'ltspice-asc'`;
- `detectCircuitFormat(filename)` — extension-based;
- `parseCircuitDocument(source, { format?, filename? })` — single entrypoint that delegates to the right parser.

Use the dispatcher in playground / consumer code rather than calling format-specific parsers directly, so adding a new format only needs a new branch in one place.

The strict YAML serializer/parser lives under `src/formats/interchange/`; the project-owned file format helpers in `src/formats/document.ts` expose that shape as `.vdsp`. Keep source-format dispatch (`.schx`, `.asc`, `.cir`, `.net`) separate from `.vdsp` document-file dispatch.

### Fixture Corpus Strategy

Fixture coverage is the acceptance target for parser behavior, source-format export where supported, and Source `.vdsp` coverage. Collect fixtures by format and by purpose:

- **Minimal fixtures**: small hand-written circuits that isolate one parser feature or edge case.
- **Real pedal fixtures**: complete guitar-pedal schematics that exercise common audio components and naming conventions.
- **Stress fixtures**: larger amp, tone-stack, filter, and utility circuits that reveal support gaps without shifting product scope away from pedals.
- **Round-trip baselines**: expected parse → serialize → parse invariants for source formats that support export.
- **Source `.vdsp` baselines**: source → `CircuitDocument` → `.vdsp` checks, plus focused `.vdsp` → `CircuitDocument` parser checks. Coverage should focus on explicit node ids, component kind, terminal names, values, models, directives, diagnostics, and string-valued scalar properties.

Every external fixture corpus must include provenance next to the files: source URL, license, date vendored, encoding if non-UTF-8, known unsupported symbols/components, and why the corpus matters. Do not add downloaded generic EDA symbol packs as fixture substitutes; fixture files should represent real circuits or targeted parser cases.

Current and target fixture organization:

- `tests/fixtures/schx/`: hand-written LiveSPICE fixtures plus the vendored upstream LiveSPICE example corpus.
- `tests/fixtures/asc/`: small LTspice fixtures; accepted pedal corpora should live under named subdirectories such as `ltspice-guitar-pedals/` with a README/provenance file.
- `tests/fixtures/cir/`: hand-written SPICE fixtures; needs larger pedal-style `.cir` / `.net` examples with `.model`, `.subckt`, `.include`, and parameter coverage.
- Future `tests/fixtures/interchange/`: optional expected `.vdsp` YAML snapshots or focused examples for the Source tab and strict parser.

Fixture tests should cover five layers:

1. Parser smoke: every vendored fixture parses without crashes.
2. Unsupported inventory: unknown symbols/components are either fixed or explicitly allowlisted.
3. Same-format round-trip: component counts, wire counts, terminal names, values, directives, and resolved nodes remain stable.
4. Source `.vdsp` coverage: source → `CircuitDocument` → `.vdsp` succeeds for every supported fixture, with no unresolved terminal nodes; focused parser tests cover `.vdsp` → `CircuitDocument`.
5. Cross-format semantics: only needed for future target serializers; do not route this through YAML import.

Current interchange coverage satisfies broad serialization coverage for layer 4, and focused parser tests cover the editable Source `.vdsp` path. Add more parser fixtures only when new YAML shapes or edge cases are introduced.

### tscircuit

Use tscircuit as a preview and interop target for web-friendly board/schematic rendering, not as the canonical editor model.

Current implementation status:

- `src/formats/circuit-json/serializer.ts` exports `serializeCircuitJsonDocument(doc, options)` through the headless API.
- The V1 exporter emits deterministic source-domain Circuit JSON elements (`source_net`, `source_component`, `source_port`, `source_trace`) plus separate warnings. It does not route PCB traces, choose footprints, or claim fabrication readiness.
- `tests/formats/circuit-json/tscircuit-fixtures.test.ts` converts every bundled `.schx`, `.asc`, and `.cir` / `.net` fixture and validates each emitted element with the official `circuit-json` schema.
- `circuit-json` and `zod` are dev dependencies for target-format alignment and schema validation. Do not move tscircuit-related packages into runtime `dependencies` unless a shipped public API genuinely requires it.

Prefer standalone preview generation first:

- built-in tscircuit elements only for generated previews;
- CDN/browser preview where appropriate;
- any tscircuit, Circuit JSON renderer/type, autorouter, or related preview
  package needed in this repo belongs in `devDependencies` unless a public
  runtime API genuinely requires it.
- no runtime package dependency unless there is a clear shipped-library need.

Mark unsupported source components as comments or warnings instead of pretending they are supported.

## Architecture

Use TypeScript for both the library and the playground. Use Bun for scripts and tests. Use Vite for the playground dev server and GH Pages build.

Preferred module boundaries:

### Core Package (`packages/core/src/`)

- `packages/core/src/formats/document.ts`: cross-format entry — `CircuitFormat`, `detectCircuitFormat(filename)`, `parseCircuitDocument(source, options)`.
- `packages/core/src/formats/schx/*`: `.schx` parser, serializer, type mapping, fixture tests.
- `packages/core/src/formats/ltspice/*`: `.asc` parser, symbol catalog, terminal mapping, fixture tests.
- `packages/core/src/formats/spice/*`: `.cir` / `.net` lexer/parser, serializer, directive preservation, fixture tests.
- `packages/core/src/formats/interchange/*`: LLM-friendly intermediary YAML serializer/parser and fixture coverage tests.
- `packages/core/src/model/*`: normalized circuit document model, component/terminal/wire/node types, validation.
- `packages/core/src/components/*`: audio component catalog — terminal maps, property schemas, taper curves, and schematic symbol metadata.
- `packages/core/src/editor/*`: editor commands such as add, move, rotate, flip, connect, delete, rename, edit property.
- `packages/core/src/preview/*`: SVG schematic preview, fixture-driven symbol inventory, tscircuit preview/export, auto-layout for netlists.
- `packages/core/src/panel/*`: stompbox/enclosure panel placement and validation metadata.
- `packages/core/src/index.ts`: public headless API — formats, model, editor, component catalog, preview/layout helpers, and panel/device metadata.

### React Package (`packages/react-component/src/`)

- `packages/react-component/src/index.tsx`: public React API. Re-exports `@vessel-dsp/core`, then exports React components.
- `packages/react-component/src/ui.tsx`: UI subpath for React consumers.
- `packages/react-component/src/schematic.tsx`: framework-specific schematic renderer and interaction props.
- `packages/react-component/src/simulation-status.tsx`: presentational simulation readiness/runtime status UI. It accepts readiness data from hosts or `@vessel-dsp/simulation` but does not own audio runtime state.

### Simulation Package (`packages/simulation/src/`)

- `packages/simulation/src/readiness.ts`: simulation support diagnostics for grounding, unsupported components, missing values/models, directives, and floating nodes.
- `packages/simulation/src/compile.ts`: `CircuitDocument` -> explicit `SimulationProgram`.
- `packages/simulation/src/support-matrix.ts`: explicit `ComponentKind` support levels.
- `packages/simulation/src/runtime/*`: runtime engine and WASM adapter contracts. Keep these React-free and avoid browser-only APIs in the package root.

- `tests/fixtures/*`: real-world audio circuit fixtures (`.schx`, `.asc`, `.cir`, `.net`) plus provenance notes and round-trip/interchange baselines.

Keep parsing and transformation code independent of React. `@vessel-dsp/core` must work without pulling in the UI layer so that headless consumers (build tools, validators, exporters, server-side renderers) can use it directly.

### Playground + docs (`playground/`)

- `playground/index.html`, `playground/src/main.tsx`: Vite entrypoint.
- `playground/src/App.tsx`: top-level shell — playground and docs surfaces.
- `playground/src/components/ui/*`: shadcn/ui components copied in by the shadcn CLI (project-owned source).
- `playground/src/lib/utils.ts`: `cn()` helper and other playground-scoped utilities.
- `playground/src/index.css`: Tailwind v4 entry + theme tokens.
- `playground/src/pages/*`: playground views (import circuit, inspect, preview) and docs pages.

The playground imports the packages through Vite path aliases (`@vessel-dsp/core`, `@vessel-dsp/react-component`, `@vessel-dsp/react-component/ui`, and `@vessel-dsp/simulation`) so changes under `packages/*/src/` are picked up live during development.
The playground Simulation tab shows `@vessel-dsp/simulation` readiness diagnostics, compiled block counts, support-level counts, and missing-runtime state. It must stay separate from `SchematicView` and any concrete audio engine.

## UI Rules

- Build an actual editor surface, not a marketing page.
- Use a dense, practical circuit-tool layout.
- Do not use React Flow as the canonical circuit editor.
- Use a custom SVG or canvas schematic surface backed by the normalized circuit model.
- The current generic boxed component renderer is a temporary inspection renderer. The future schematic view should use common schematic symbols without generic boxes for supported components, while still keeping selection affordances and clear unsupported-component markers.
- Start with selection, inspector, import/export, warnings, and preview before adding advanced editing.
- Keep unsupported components visible and explicitly marked.
- Editing must not silently change circuit behavior.
- Use **shadcn/ui** for all playground and docs UI chrome (buttons, dialogs, tabs, cards, command palette, etc.). Install via the shadcn CLI; treat the copied component sources as project-owned and edit freely.
- `packages/react-component/src/*` does *not* depend on shadcn/ui. Keep it stylable from the outside via class hooks or render-prop slots so consumers can theme it with their own design system.

## Development Rules

- Use `rg` for search.
- Use Bun commands, not npm, unless the user explicitly asks.
- Keep format parsers covered by fixture tests before expanding UI behavior.
- Add new format support as adapters around the normalized model, not as one-off UI paths.
- Preserve source fidelity first; clever normalization comes after round-trip tests exist.
- Treat the interchange YAML as a serialized Source/export/edit adapter around `CircuitDocument`, not as a second in-memory canonical model and not as a source-format round-trip mechanism.
- Never silently perform lossy format conversion. Emit diagnostics for unsupported components, synthesized layout, dropped directives, ignored source graphics, and missing serializer support.
- Keep the headless library boundary clean — `packages/core/src/index.ts` and everything it transitively imports must not depend on React.
- New components are added to `packages/core/src/components/*` with terminal maps, property schemas, symbol metadata, and at least one fixture that exercises them.

## Verification

Pick the smallest check that covers the change:

- Parser/serializer changes: run the related fixture and round-trip tests.
- Interchange changes: run interchange serializer/parser tests and the broad fixture YAML coverage test.
- Model/editor command changes: run unit tests for command behavior.
- Component catalog changes: run catalog unit tests + any fixture that uses the component.
- UI changes: run TypeScript/web checks and inspect the local browser view when feasible.
- Docs-only changes: inspect the changed file.

## PLAN

Status: planned

### Phase 0: Project Scaffold

Goal: create the package workspace + the GH Pages playground with strict TypeScript, a runnable test setup, working dev server, and clear module boundaries.

Library tasks:

- [x] Create `~/Projects/circuit-preview-editor`.
- [x] Add `CLAUDE.md`.
- [x] Symlink `AGENTS.md` to `CLAUDE.md`.
- [x] Initialize `package.json` (Bun + TypeScript strict + `bun test`).
- [x] Add `tsconfig.json` (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, verbatimModuleSyntax), shared package configs, and per-package build configs.
- [x] Set up package entrypoints: `packages/core/src/index.ts` (headless), `packages/react-component/src/index.tsx` (React), and `packages/simulation/src/index.ts` (simulation).
- [x] Wire scripts: `bun test`, `bun run typecheck`, `bun run build`, `bun run clean`.

Playground tasks:

- [x] Install Vite + React + Tailwind v4 + shadcn/ui prerequisites.
- [x] Create `playground/` (Vite root) with `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`.
- [x] Add `vite.config.ts` with React + Tailwind plugins, `@vessel-dsp/core` / `@vessel-dsp/react-component` / `@vessel-dsp/react-component/ui` / `@vessel-dsp/simulation` path aliases to `packages/*/src/`, GH Pages `base` path, and `outDir` -> `gh-pages/`.
- [x] Add `components.json` and a Tailwind v4 + shadcn token CSS (`playground/src/index.css`); `cn()` helper at `playground/src/lib/utils.ts`.
- [x] Single shared root `tsconfig.json` covers packages + tests + playground via `paths` aliases; package build configs stay under `packages/*/tsconfig.build.json`.
- [x] Add scripts: `bun run dev`, `bun run build:playground`, `bun run preview`.
- [x] Hello-world `App.tsx` renders the library's `VERSION` and the shadcn `Button` to prove the alias and shadcn-ui pipeline work.
- [x] Add `.github/workflows/deploy.yml` that builds the playground and deploys to GitHub Pages on push to `main`.

Success criteria:

- `bun install && bun test && bun run typecheck` succeed on a clean checkout.
- The core entrypoint compiles and imports nothing from `packages/react-component/*` or React.
- `bun run dev` starts the Vite playground and renders a shadcn-styled app that imports from the workspace package aliases.
- `bun run build:playground` emits a static site under `gh-pages/`.
- Scope, audio-domain focus, format separation, and distribution targets are documented in `CLAUDE.md`.

### Phase 1: Core Circuit Model

Goal: define a small normalized circuit document model expressive enough for audio schematics from both graphical and netlist sources.

Tasks:

- [x] Define component, terminal, wire, point, and warning types (`src/model/types.ts`). Directive and source-location types deferred until the format parsers need them.
- [x] Define `ParsedQuantity` with unit tags and a `parseQuantity()` parser (`src/model/quantity.ts`) covering SI prefixes, `Ω`/`ohm`/`F`/`H`/`V`/`A`/`W`/`Hz`/`s`, and scientific notation.
- [x] Implement **Borrow #1** — union-find pin → node resolution (`src/model/connectivity.ts`): `resolveConnectivity()` returns `{ pinToNode, nodeMembers, groundNodeId, nodeCount }`. Reimplemented from textbook union-find; CircuitSetu (GPL-3.0) referenced for the "ground → node 0" convention only.
- [x] Unit tests cover quantity parsing (15 cases) and connectivity (9 cases: empty doc, dangling resistor, wire-joined Rs, RC divider with ground, multi-ground unification, wire chain, coincident pins, multi-terminal op-amp, pinKey stability).
- [ ] Control metadata (taper curves, ranges, default values) → moved to Phase 2 since it's catalog-specific.

Success criteria:

- The model can represent a simple RC filter and a single-transistor gain stage from both `.schx` and `.cir` imports.
- The model has zero React or DOM dependencies.
- `resolveConnectivity()` correctly identifies nodes in fixtures including ground unification and multi-terminal components.

### Phase 2: Audio Component Catalog

Goal: ship a first-class catalog of audio-circuit components with symbols, terminals, and property schemas.

Tasks:

- [x] Implement **Borrow #3** — validation rules + property schemas (`src/model/validation.ts`): `PropertyRule` discriminated union (`quantity` with optional unit/min/max, or `string`), per-kind rule tables for 17 audio-domain kinds, `validateDocument()`, `validateComponent()`, `getRulesForKind()`, `hasErrors()`. 8 stable `ValidationCode`s (`value-required`, `model-required`, `value-unparseable`, `value-out-of-range`, `unit-mismatch`, `unsupported-component`, `duplicate-id`, `degenerate-wire`). 29 unit tests cover required values, alias resolution, range bounds (R=0/-100/2.2G all rejected), unit-mismatch warnings, semiconductor model requirements, duplicate IDs, degenerate wires, and view-only skip. Rules currently live as static lookup tables and will fold into the catalog entries when this phase lands.
- [ ] Define component definitions for the audio-domain coverage list above (passives, semiconductors, tubes, op-amps, transformers, switches, jacks, sources, view-only).
- [ ] Provide SVG symbol primitives that can be reused by the preview layer.
- [ ] Resolve terminal positions per component, including rotation/flip transforms.
- [ ] Distinguish `simulatable` vs `view-only` support per component.
- [ ] Add catalog unit tests (every catalog entry round-trips its terminals; quantity props parse).
- [ ] Migrate the inline lookup tables in `src/model/netlist.ts` (SPICE letter, node order, value property, has-model) and `src/model/validation.ts` (rules) into per-kind catalog entries.
- [ ] Add control metadata (taper curves, ranges, default values) for potentiometers, switches, and variable resistors.

Success criteria:

- A standard guitar-pedal palette (R, C, pot, BJT, JFET, op-amp, diode, footswitch, jack, ground) is available from the headless API.
- Each catalog entry documents its terminals, taper/curve metadata where applicable, and support level.

### Phase 3: `.schx` Import / Export

Goal: support LiveSPICE-style schematic documents with round-trip fidelity for audio circuits.

Tasks:

- [x] Build `.schx` XML parser (`src/formats/schx/parser.ts`). Regex-based (no XML-parser dependency); handles attribute ordering, whitespace, comments, UTF-8 BOM, malformed wires (warn + skip), unknown component types (warn + retain `sourceTypeName` + kind `'unsupported'`), and unique-id collision via `name-N` suffixing.
- [x] Build `.schx` serializer (`src/formats/schx/serializer.ts`). Emits well-formed XML with proper entity escaping, reconstructs the LiveSPICE `_Type` via the catalog when `sourceTypeName` is missing, and round-trips `Name`/`Description`/`PartNumber` plus all extra root attributes.
- [x] Preserve positions, rotations, flips, raw attributes, wires, named wires, and labels. Negative LiveSPICE rotations (e.g. `-1`) normalize to `0..3`. Unparseable quantity values (e.g. `Impedance="∞ Ω"`) fall back to string storage so they round-trip verbatim.
- [x] Map `.schx` element types to the audio component catalog (`src/formats/schx/catalog.ts`) — 36 entries covering passives, semis (incl. canonical `BipolarJunctionTransistor`), tubes, op-amps, transformers, switches/SPDT/SP3T/SP4T, sources, ground/rail, jacks (Input/Speaker), labels, named wires.
- [x] Recognize audio-engine runtime descriptors (`Circuit.MicroBlock*`, `Circuit.MacroTremolo`, `Circuit.MacroPhaser`) as opaque ICs with stable source names, runtime diagnostics, and `input`/`output` terminal geometry for non-stage descriptors.
- [x] Add focused fixture round-trip tests (`tests/fixtures/schx/`) for `passive-divider`, `passive-lowpass`, and `lpb-1-style-boost`. Round-trip asserts component count, wire count, kind, name, origin, rotation, flip, and terminal count are stable. Connectivity + netlist projection also exercised end-to-end on the fixtures.
- [x] Vendor and test the upstream LiveSPICE example corpus under `tests/fixtures/schx/livespice-examples/` with provenance in README. Tests assert every expected `.schx` is present, parses without unknown component type warnings, covers real pedal/amp examples including op-amps and JFETs, and round-trips with stable component/wire counts.
- [ ] Add additional focused minimal fixtures only when a broad example does not isolate the behavior being changed, especially diode clippers, tube triodes, switches, labels/named wires, and source-specific unknown-data preservation.

Success criteria:

- Each fixture imports and exports without material topology loss.
- Unknown attributes are preserved or explicitly surfaced in warnings.

### Phase 4: `.cir` / SPICE Netlist Import + Export

Goal: parse common SPICE netlists into the normalized model and round-trip them out, without pretending to be a full SPICE clone.

Tasks:

- [x] Implement **Borrow #2** — flat netlist projection (`src/model/netlist.ts`): `toNetlistView()` returns `{ components: NetlistComponent[], nodeCount, groundNodeId, directives, warnings }`. Per-kind SPICE letters, node-order conventions (R/C/L → a/b; D → anode/cathode; Q → C/B/E; J → D/G/S; M → D/G/S/B; V/I → +/-), and model-name extraction live as inline lookup tables.
- [x] Build a line-oriented SPICE parser (`src/formats/spice/parser.ts`): comment + continuation handling, R/C/L/D/Q/J/M/V/I rules, multi-line `.SUBCKT` blocks preserved verbatim, `.TITLE` → metadata.name, `.END` terminator, inline `;` comments stripped. Subcircuit instances (`X`) emit a warning. Synthesizes wires + an auto-`GND` component at node "0" via a star topology so the result is renderable through `resolveConnectivity()`.
- [x] Write a SPICE serializer (`src/formats/spice/serializer.ts`) consuming `toNetlistView()`. Subckt-bound kinds emit as commented placeholders. Directives passed through verbatim. 22 unit tests cover parse, serialize, and round-trip.
- [x] Added `directives: readonly string[]` to `CircuitDocument` so `.MODEL`/`.SUBCKT`/`.INCLUDE`/`.PARAM` blocks survive parse → serialize cycles unchanged.
- [ ] Round-trip tests against larger published `.cir` / `.net` fixtures — current coverage is two hand-written fixtures. Prioritize pedal-style circuits with `.model`, `.subckt`, `.include`, `.param`, op-amp/macromodel, transistor, clipping diode, and tone-stack coverage.

Success criteria:

- A simple pedal-style `.cir` fixture (e.g. one-transistor gain stage with a `.model`) imports with correct nodes/components and the `.model` block survives a re-export.
- Unsupported directives are visible in diagnostics and preserved where practical.

### Phase 4b: LTspice `.asc` Import

Goal: parse common LTspice schematic files into the same normalized circuit document, side-by-side with `.schx`.

Tasks:

- [x] Line-oriented `.asc` parser (`src/formats/ltspice/parser.ts`). Tokenizes `SYMBOL` / `WIRE` / `FLAG` / `IOPIN` / `TEXT` / `SYMATTR` records, ignores `WINDOW` / `LINE` / `RECTANGLE` / etc. (with warnings), and runs the parsed wire set through `splitWiresAtJunctions` so junction semantics match `.schx`.
- [x] LTspice symbol catalog (`src/formats/ltspice/catalog.ts`): maps LTspice symbol names → normalized `ComponentKind`, declares terminal layout per symbol, and provides `mapLtspiceTerminal()` + orientation handling (`R0..R270`, `M0..M270` → `rotation`/`flipped`).
- [x] `IOPIN In|Out` markers register as `kind: 'jack'` with `sourceTypeName` `ltspice:InputJack` / `ltspice:OutputJack`; preview symbols distinguish input vs output jacks.
- [x] LED is a first-class `ComponentKind`; `.schx` Diodes with `Type="led"` and LTspice LED symbols both map there. Dedicated `led.svg` preview symbol.
- [x] Unified entrypoint via `parseCircuitDocument(...)` in `src/formats/document.ts`. Extension detection: `.asc` → `'ltspice-asc'`.
- [x] Fixture: `tests/fixtures/asc/simple-rc.asc` covers the IOPIN + WIRE + SYMBOL path end-to-end through parser + SchematicView SSR rendering tests.
- [ ] Accept and document a real LTspice guitar-pedal corpus under `tests/fixtures/asc/ltspice-guitar-pedals/` with source URL, license, encoding, known unsupported symbols, and parser tests. The corpus should cover BJT, JFET, op-amp, wah, compressor, distortion, and tone-control schematics.
- [ ] Add focused `.asc` fixtures for parser edge cases that large pedal schematics obscure: custom symbol paths, Windows-1252 bytes such as `µ`, missing `SYMATTR`, mirrored rotations, multi-point labels, flags, and IOPIN polarity.
- [ ] Add an `.asc` *serializer* so edits round-trip back to LTspice — currently import-only.

Success criteria:

- A pedal-style LTspice `.asc` (input/output jacks, ground, R/C/L, diode/BJT) imports with correct components, wires, and electrical nodes.
- Unknown LTspice symbols surface as `unsupported` with `sourceTypeName` preserved, never silently dropped.

### Phase 4c: Editable `.vdsp` Source + Fixture Matrix

Goal: define the project-native `.vdsp` Source view that turns any parsed `CircuitDocument` from `.schx`, `.asc`, `.cir`, `.net`, and future formats into an explicit, LLM-friendly YAML representation, and allows strict `circuit-interchange/v2` edits to rebuild `CircuitDocument`. Back-conversion to source/fixture formats is not required.

Tasks:

- [ ] Define `src/formats/interchange/types.ts` for a versioned YAML shape with metadata, components, terminals, explicit nodes, wires, directives, source provenance, and diagnostics.
- [x] Add YAML serialization with a persisted schema id that does not depend on the temporary `circuit-preview-ir` codename.
- [x] Implement first-pass `CircuitDocument -> interchange YAML` serialization with explicit node ids derived from `resolveConnectivity()` (`serializeInterchangeYaml`).
- [x] Implement strict `interchange YAML -> CircuitDocument` parsing for the project's own serialized shape (`parseInterchangeYaml`).
- [x] Show copyable generated source text in the playground **Source** tab from the current edited `CircuitDocument`, with a format selector that defaults to `.vdsp` and can switch to `.schx` or `.cir`.
- [x] Remove the separate Raw `.schx` tab so Source is the single copy/paste conversion surface.
- [ ] Add focused YAML output tests for edge cases: unsupported components, parser diagnostics, named wires/labels, source metadata, directives, unitless quantities, and string-valued properties that are not parseable quantities.
- [x] Add focused YAML parser tests for metadata edits, components, terminals, wires, schema rejection, and numeric-looking scalar properties.
- [x] Add broad fixture serialization coverage: every supported fixture currently visible under `tests/fixtures` serializes to interchange YAML without unresolved terminal nodes.
- [ ] Add fixture provenance checks so external fixture directories cannot be added without README/source/license/encoding notes.

Success criteria:

- `.vdsp` represents every current `CircuitDocument` field needed for LLM inspection plus derived nodes and source metadata.
- Every supported fixture can be serialized to `.vdsp` with stable schema id, component data, wire data, diagnostics, and no unresolved terminal nodes.
- The playground Source tab reflects the current edited document, not only the original fixture text, and can show copyable `.schx`, `.vdsp`, or `.cir` output.
- There is no requirement to convert `.vdsp` back to `.schx`, `.asc`, `.cir`, `.net`, or any fixture source format.

### Phase 5: Preview Surface

Goal: make imported pedal circuits understandable before full editing exists, with a schematic preview surface:

- **Schematic**: common pedal/electronics abstract circuit symbols for electrical reasoning.

Tasks:

- [x] Add SVG schematic preview. `packages/core/src/preview/symbols.ts` provides framework-agnostic symbol data (per-kind `Primitive[]` in local coords) covering 26 `ComponentKind`s; `packages/core/src/preview/bounds.ts` computes the document viewBox with fallback + padding; `packages/react-component/src/schematic.tsx` exposes `<SchematicView document={...} />` that renders wires + components via `currentColor` so consumers can theme it.
- [x] Mark unsupported/view-only components in the preview with explicit styling — unsupported kinds render with reduced opacity + dashed strokes via `stroke-dasharray`.
- [x] Wire the playground to load bundled fixtures (`playground/src/fixtures/*.schx` via `?raw` imports), render them in a shadcn-styled shell (`Card` / `Tabs` / `Select` / `Badge`), and expose four tabs: Schematic, Netlist (table of `NetlistView` rows), Warnings (parser + validation + netlist diagnostics), Raw `.schx`.
- [x] **Boxy renderer (CircuitSetu-style frame).** Each component is wrapped in a rounded `<rect>` (`src/preview/box-layout.ts`, `HALF_SIZE=11`, `PAD=0`). Symbol primitives shrunk significantly (resistor body 22×32 → 10×14; BJT/JFET circle r=14 → r=7; op-amp triangle 56×44 → 21×20; port symbols r=18 → r=7; pot body 22×32 → 10×14) so leads dominate visually and connectors land exactly on box edges. Filled connector dots are drawn at every terminal world position. Component name labels sit below the box (outside) with a halo for readability.
- [x] **Pan + zoom.** SVG viewBox is state-managed inside `SchematicView`. Mousewheel zooms anchored at the cursor (clamped to `[0.1×, 10×]` of initial bounds). Drag on empty canvas pans (3 px threshold separates "click to deselect" from "drag to pan"). `userSelect: none` + `touchAction: none` on the SVG so drags don't trigger text selection or touch scroll.
- [x] **Orthogonal wire routing** (`packages/core/src/preview/routing.ts`). Each wire renders as a `<polyline>`: straight 2-point path for axis-aligned wires, single-elbow L-shape for diagonal wires (horizontal-first when `|dx| >= |dy|`, vertical-first otherwise).
- [x] **Junction dots** (`packages/core/src/preview/junctions.ts`). `findJunctions(wires, terminals)` flags any wire endpoint that sits on another wire's middle (T-junction) or any endpoint shared by >=3 wires (Y/X-junction); terminal positions are excluded since the terminal dots already mark them. Rendered as small filled circles on top of components.
- [x] **Wire splitting at T-junctions** (`packages/core/src/model/wires.ts`, `splitWiresAtJunctions`). Called by every parser (`parseSchx`, `parseLtspiceAsc`) after wire collection. Any wire whose middle is touched by another wire's endpoint is split into shorter segments at the junction point. Result: every electrical junction is at a real wire endpoint, so when a component is dragged only the segments that actually touch its terminals move, and the junction stays put. Original `passive-divider` has 10 wires -> 13 after splitting (one split on the horizontal R1 -> O1 trunk, two splits on the ground rail).
- [x] **Runtime wire splitting at terminal positions** (`packages/core/src/preview/renderable-wires.ts`, `buildRenderableWires`). On every render, `SchematicView` re-derives the displayed wire set by additionally splitting wires wherever a component terminal lands on a wire body, including positions that are only reached after a drag. This is what keeps a terminal-on-wire-middle case visually and electrically T-junction-correct without committing extra wires to the model.
- [x] **Inferred junction dots** (`packages/core/src/preview/junctions.ts`). In addition to wire-endpoint T- and Y/X-junctions, `findJunctions` now flags any *component terminal* that lands on the middle of a wire so editor-induced junctions render a dot the moment the user drops a component onto a wire.
- [x] **SVG symbol library refactor** (`packages/core/src/preview/symbols/`). Per-kind symbol artwork now lives as standalone `.svg` files (`resistor.svg`, `bjt-npn.svg`, `bjt-pnp.svg`, `capacitor.svg`, `capacitor-electrolytic.svg`, `diode.svg`, `diode-zener.svg`, `led.svg`, `jfet-n.svg`, `jfet-p.svg`, `mosfet-n.svg`, `mosfet-p.svg`, `triode.svg`, `pentode.svg`, `tube-diode.svg`, `transformer.svg`, `opamp.svg`, `ic-block.svg`, `optocoupler.svg`, `photoresistor.svg`, `potentiometer.svg`, `variable-resistor.svg`, `switch-spst.svg`, `switch-spdt.svg`, `switch-3pdt.svg`, `switch-toggle.svg`, `switch-rotary.svg`, `relay.svg`, `inductor.svg`, `battery.svg`, `voltage-source.svg`, `current-source.svg`, `rail.svg`, `ground.svg`, `jack-input.svg`, `jack-output.svg`, `port.svg`, `named-wire.svg`, `label.svg`, `unsupported.svg`). `svg-content.ts` exposes them as inlineable `<g>` markup so the renderer can place them into the schematic surface alongside the box frame. Inline `Primitive[]` shapes in `packages/core/src/preview/symbols.ts` are still used by the boxed inspection view; the SVG files are the source of truth for the schematic preview surface.
- [x] First-pass LTspice input/output jack rendering and LED support are now driven by the SVG library and the `led` `ComponentKind`.
- [ ] Add a fixture-driven **guitar-pedal symbol inventory** report/test. It should scan bundled pedal fixtures, count observed source component types/kinds, and fail when an observed pedal symbol lacks a schematic-view plan.
- [ ] Replace the temporary generic boxed schematic glyphs for supported pedal components with a hand-redrawn project-native schematic symbol set. Start from the observed pedal inventory and common guitar-pedal schematics: R, C, electrolytic C, inductor, diode, LED, BJT, JFET, MOSFET, op-amp, potentiometer, variable resistor, input/output jack, rail, ground, battery/DC source, SPDT/3PDT/footswitch, label/named wire/test point.
- [ ] Treat wah filters as a recognized subcircuit/role annotation, not as a monolithic component. Keep the schematic as inductor + pot + R/C/transistor network.
- [ ] Add simple auto-layout preview for netlist-only imports — waits for Phase 4 `.cir` parser.
- [x] Add initial headless Circuit JSON source-domain exporter for the subset of the catalog that maps cleanly (`packages/core/src/formats/circuit-json/serializer.ts`).
- [ ] Add tscircuit preview/export adapter with footprint/pin mapping for the subset of the catalog that maps cleanly.
- [ ] Expand op-amp / diode-clipper / tube-triode fixtures so the playground exercises every catalog branch.

Success criteria:

- `.schx` circuits render using their source geometry.
- `.cir` circuits render with deterministic generated layout.
- Every observed guitar-pedal fixture symbol has an explicit schematic symbol strategy.
- tscircuit preview is clearly labeled as a preview/export target and skips unmapped components with warnings.
- The deployed GH Pages playground shows working previews of all bundled fixtures.

### Phase 6: Minimal Editing

Goal: implement useful editing without expanding into a full EDA suite.

The playground has two modes:
- **Preview** (default): non-interactive (read-only) — click only selects. Future iteration will add an auto-sort/auto-layout pass for `.cir`-imported docs.
- **Edit**: free-form. Components can be placed anywhere by drag-and-drop. Wires stay where they are (not auto-routed).

Tasks:

- [x] `packages/core/src/editor/commands.ts` — pure `applyDocumentCommand(doc, command)` reducer. Commands: `delete-component`, `rename-component`, `set-property` (auto-`parseQuantity` when prior value was a quantity), `remove-property`, `move-component` (shifts terminals by the delta AND rewrites any wire endpoint that matches an old terminal position, so wires follow the dragged component).
- [x] `packages/core/src/editor/history.ts` — `EditorState = { document, selectedId, past, future }` + `applyEditorCommand` with select / undo / redo / pass-through. History capped at 200 entries. Deleting the selected component clears selection.
- [x] `SchematicView` accepts `editMode`, `selectedId`, `onSelect`, `onMoveComponent`, `snapTo` (default 10), `snapRadius` (default 12), `minZoom` / `maxZoom`. Pointer events handle click-to-select, background-click-to-deselect, drag-to-move (with pointer capture). Selected components get a thicker outline. While dragging, wires connected to the dragged component re-route in real time and a snap target indicator appears when a dragged terminal comes within `snapRadius` of another component's terminal (`packages/core/src/preview/snap.ts` — `findSnap` picks the closest target and adjusts the candidate origin so the terminals coincide exactly).
- [x] Playground mode toggle (Preview / Edit) + Undo / Redo / Delete buttons + selection info bar. Editor state reducer mounted with a `key={fixtureId}` so switching fixtures resets the history.
- [x] **Inspector panel** (`playground/src/components/inspector.tsx`). 320-px right column on `lg` screens, stacked on mobile. Shows the selected component's id (header) + kind (badge), editable name (commits on blur / Enter), read-only meta chips (origin, rotation, terminal count, source type), per-property `<Input>` row with parsed `value + unit` subtitle, `×` remove button per property, and a destructive Delete button. All edit affordances disabled in Preview mode. Built with shadcn `Input` / `Label` / `Separator`.
- [x] **Connectivity correctness**: `resolveConnectivity` now unions wire endpoints with the wires they sit on mid-segment, so T-junctions are electrically merged even when one side is dragged into a diagonal. Combined with `splitWiresAtJunctions` at parse time, every junction stays self-consistent through edits.
- [x] **BJT emitter catalog fix**: LiveSPICE places the NPN/PNP emitter at local `(+10, -20)` (slanted), not `(0, -20)`. Catalog + symbol primitives updated. Without this, Q1.emitter in the LPB-1 fixture was an electrically floating pin.
- [x] **Fixture-level connectivity tests** (`tests/formats/schx/connectivity.test.ts`): per-fixture assertions for node counts, ground anchoring, and which terminals share each electrical node (passive-divider: 5 cases; passive-lowpass: 3; lpb-1-style-boost: 7 including the BJT bias junction, collector load, emitter group, output coupling, and pot wiper).
- [x] **SVG rendering tests** (`tests/ui/schematic.test.tsx`): SSR `SchematicView` via `react-dom/server` and assert the expected polyline points + junction dots are in the markup.
- [ ] Graphical rotate / flip commands.
- [ ] Wire create / delete in edit mode.
- [ ] Preview-mode auto-layout pass — sort/organize components into a clean schematic from arbitrary positions. Deferred as a larger refactor.
- [ ] Serialize edits back to `.schx` and warn when an edit doesn't round-trip cleanly.

Success criteria:

- A user can import a `.schx`, move/edit components, export it, and re-import it without topology loss.
- Netlist imports can be inspected and edited conservatively without losing original directives.

### Phase 7: Package Workspace & Public API

Goal: publish clean, typed, consumer-friendly packages that other web apps can embed.

Tasks:

- [x] Lock the public surface as `@vessel-dsp/core` (headless parsers/model/editor/preview helpers) and `@vessel-dsp/react-component` / `@vessel-dsp/react-component/ui` (React UI plus core helper re-exports for React apps).
- [x] Verify the headless entrypoint has no React dependency through `tests/smoke.test.ts`.
- [x] Produce ESM + type declaration build output suitable for npm publishing via per-package `tsconfig.build.json` files.
- [x] Declare `react` / `react-dom` as peer dependencies for the React UI surface.
- [x] Add npm publish readiness metadata for `@vessel-dsp/core` and `@vessel-dsp/react-component`: `files`, `main`/`module`/`types`, export maps, `publishConfig`, build scripts, and dry-run packing.

Success criteria:

- A web app can install `@vessel-dsp/core` and use the headless API without React in its bundle.
- A React web app can import `SchematicView` and common helpers from `@vessel-dsp/react-component`, or use the `@vessel-dsp/react-component/ui` subpath.
- The build output is reproducible, typechecked, tested, and packable with `npm pack --dry-run` for the public packages.
