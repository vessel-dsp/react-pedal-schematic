---
name: livespice
description: Work on LiveSPICE .schx support for circuit-preview-editor. Use when importing, serializing, fixture-testing, previewing, or documenting LiveSPICE schematics, upstream LiveSPICE example coverage, _Type catalog mappings, terminal geometry, round-trip fidelity, junction/connectivity behavior, and audio pedal or amp schematic compatibility gaps.
---

# LiveSPICE

Use this skill when the task touches LiveSPICE `.schx` schematics in this repository.

In this project, `.schx` is the highest-priority **graphical source format** for audio schematics. The goal is reliable import, preview, inspection, conservative editing, and export. Do not treat LiveSPICE as this project's runtime engine or as a generic SPICE netlist format.

## Repo Surfaces

- Parser: `src/formats/schx/parser.ts`
- Serializer: `src/formats/schx/serializer.ts`
- LiveSPICE `_Type` catalog: `src/formats/schx/catalog.ts`
- Rotation/flip transforms: `src/formats/schx/transforms.ts`
- Connectivity and wire splitting: `src/model/connectivity.ts`, `src/model/wires.ts`
- Preview junction/render behavior: `src/preview/junctions.ts`, `src/preview/renderable-wires.ts`, `src/ui/schematic.tsx`
- Fixture tests: `tests/formats/schx/*.test.ts`
- Local fixtures: `tests/fixtures/schx/*`
- Upstream corpus: `tests/fixtures/schx/livespice-examples/*`
- Playground fixtures: `playground/src/fixtures/*.schx`, `playground/src/lib/fixtures.ts`

## Working Rules

1. Start with fixture coverage. A new LiveSPICE component mapping needs at least one `.schx` fixture or a focused parser test that proves type, properties, terminals, and connectivity.
2. Preserve source fidelity. Keep unknown root/component attributes, `sourceTypeName`, names, descriptions, part numbers, positions, rotations, flips, labels, named wires, and unparseable raw property values.
3. Unknown `_Type` values must remain visible as `kind: 'unsupported'` and produce a parser warning. Do not silently drop unknown elements.
4. Recognized-but-not-modeled components may still be `unsupported` if the normalized model has no honest semantic kind yet. Prefer explicit view-only behavior over false support.
5. Do not infer terminal geometry from the preview symbol. Terminal locations come from LiveSPICE source behavior or fixtures.
6. Round-trip tests should check material topology: component count, wire count, kind, name/id behavior, origin, rotation, flip, terminal count, and selected properties.
7. Connectivity tests should use `resolveConnectivity()` and named pin assertions. Visual overlap is not proof of electrical connectivity.
8. If a wire endpoint lands on another wire body, preserve the T-junction. Parser-time splitting and render-time wire normalization exist to make that behavior explicit.
9. Use `.schx` serializer only for `.schx` documents. Do not serialize LTspice `.asc` or SPICE netlists through the `.schx` path.

## Upstream LiveSPICE Corpus

Use `dsharlet/LiveSPICE` `Tests/Examples` as a compatibility corpus when adding or auditing `.schx` support.

When updating that corpus:

- Verify the current upstream listing before claiming complete coverage.
- Keep an attribution notice because the files are copied from the upstream MIT-licensed repository.
- Add tests that fail for real importer gaps, such as `unknown-component-type`, unstable round-trip counts, or missing key part identity.
- Treat the corpus as parser/preview compatibility coverage, not proof of simulator accuracy.

Current project tests expect all vendored upstream examples to parse without unknown component-type warnings and to round-trip with stable component and wire counts.

## Component Mapping Guidance

LiveSPICE component class names appear in `.schx` as `_Type` values. Map them in `src/formats/schx/catalog.ts`.

Common audio-domain mappings:

- Passives: `Resistor`, `Capacitor`, `Inductor`, `Conductor`
- I/O and references: `Input`, `Speaker`, `Ground`, `Rail`, `VoltageSource`, `CurrentSource`, `Battery`, `NamedWire`, `Port`, `Label`
- Controls: `Potentiometer`, `VariableResistor`, `Switch`, `SPDT`, `SP3T`, `SP4T`
- Semiconductors: `Diode`, `BipolarJunctionTransistor`, `JunctionFieldEffectTransistor`
- ICs and active helpers: `OpAmp`, `IdealOpAmp`, `Buffer`
- Magnetics/tubes: `Transformer`, `CenterTapTransformer`, `Triode`, `Pentode`, tube `Diode`
- Definitions/diagnostics: `VoltageDefinition`, current definitions, warning/error placeholders

If a type is recognized only to preserve topology, keep it view-only/unsupported until the normalized model has the right kind, properties, validation, and preview semantics.

## Pedal And Amp Gap Checks

Use guitar-pedal circuit knowledge to catch missing parser support and wrong terminal geometry:

- Pro Co Rat: preserve `LM308`, hard clipping diodes, tone/filter network, `2N5458` JFET buffer, volume pot, and input/output jacks.
- Tube Screamer / Boss SD-1: distinguish feedback-loop clipping from output shunt clipping; preserve 4558-style op-amp identity and control components.
- Big Muff: preserve cascaded transistor stages, clipping diodes, and passive tone stack components.
- MXR Distortion+: preserve op-amp hard clipper topology and gain/level controls.
- Cry Baby / Phase 90: preserve inductors/JFETs/control metadata even if downstream behavior stays view-only.
- Amp examples such as Bassman, JCM800, Rockerverb, and Fender 5e3 are fixture coverage for tubes, transformers, pentodes, and tone stacks. Do not claim hardware-accurate amp modeling from import support alone.

## Verification

Use targeted checks for the touched surface:

```bash
bun test tests/formats/schx/parser.test.ts tests/formats/schx/serializer.test.ts
bun test tests/formats/schx/roundtrip.test.ts tests/formats/schx/connectivity.test.ts
bun test tests/formats/schx/livespice-examples.test.ts
```

For preview/junction behavior:

```bash
bun test tests/ui/schematic.test.tsx tests/preview/junctions.test.ts tests/preview/renderable-wires.test.ts
```

For public exports or shared model changes:

```bash
bun test
bun run typecheck
```
