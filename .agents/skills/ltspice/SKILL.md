---
name: ltspice
description: Work on LTspice .asc schematic support for circuit-preview-editor. Use when importing, parsing, mapping, fixture-testing, previewing, or documenting LTspice ASC files, especially line-oriented SYMBOL/WIRE/FLAG/IOPIN/TEXT handling, built-in symbol catalog coverage, extension dispatch, and audio-circuit fixture gaps.
---

# LTspice

Use this skill when the task touches LTspice `.asc` schematics in this repository.

This project treats LTspice as an **import source format** for the normalized circuit document model. It is not the canonical model, not a simulator backend, and not a replacement for `.schx`/SPICE fixture coverage.

## Repo Surfaces

- Parser: `src/formats/ltspice/parser.ts`
- Symbol catalog and terminal geometry: `src/formats/ltspice/catalog.ts`
- Generic format dispatch: `src/formats/document.ts`
- Public headless exports: `src/index.ts`
- Unit tests: `tests/formats/ltspice/parser.test.ts`, `tests/formats/document.test.ts`
- Fixtures: `tests/fixtures/asc/*`, `playground/src/fixtures/*.asc`
- Playground fixture registry: `playground/src/lib/fixtures.ts`

## Working Rules

1. Add or update a fixture before broadening parser behavior. Keep the fixture small enough that terminal positions and connectivity can be inspected.
2. Preserve source fidelity first. Store original `SYMATTR` values, source symbol names, directives, flags, and labels where possible.
3. Keep unsupported LTspice symbols visible as `kind: 'unsupported'` with a parser warning. Do not silently drop them.
4. Do not claim custom `.asy` library support unless the parser actually reads the `.asy` symbol file and has fixture coverage for it.
5. Treat `.asc` as line-oriented schematic text. Important V1 commands are `Version`, `SHEET`, `WIRE`, `FLAG`, `IOPIN`, `SYMBOL`, `SYMATTR`, and `TEXT`.
6. `TEXT ... !...` is a directive source. `TEXT ... ;...` is a schematic label/comment source.
7. Use `resolveConnectivity()` in tests for real behavior. Visual placement is not enough; verify that ports, ground, component terminals, and wires resolve into expected nodes.
8. Add built-in symbol mappings conservatively in `catalog.ts`. A recognized symbol needs terminal definitions, a normalized `ComponentKind`, value/model property handling, and at least one parser test.
9. Use `parseCircuitDocument(source, { filename })` when the code path should support multiple extensions. Direct `parseLtspiceAsc()` calls are fine for LTspice-specific tests.

## Common Mapping Expectations

Current V1 support is intended for common audio-circuit schematics:

- Passives: `res`, `res2`, `cap`, `cap2`, `ind`
- Sources: `voltage`, `current`
- Semiconductors: `diode`, `led`, `zener`, `npn`, `pnp`, `njf`, `pjf`, `nmos`, `pmos`
- Connectivity and metadata: `WIRE`, `FLAG`, `IOPIN` input/output markers as `jack` components, directive text, and label text

When adding op-amps, potentiometers, switches, jacks, or vendor-specific symbols, do not guess from the symbol name alone. Find or create a fixture that proves the pin locations and the intended property names.

## Audio Pedal Sanity Checks

Use pedal-domain knowledge to find parser gaps, not to make simulator claims.

- RAT-style circuits should preserve LM308 op-amp identity, clipping diodes, tone/filter network, volume pot, and JFET output buffer when present.
- Tube Screamer / SD-1 style circuits should preserve feedback-loop clipping topology; do not flatten feedback diodes into output shunt clipping.
- Big Muff style circuits should preserve cascaded BJT gain stages and the passive tone stack.
- Phase 90 style circuits should preserve JFET stage identity and control metadata, even if later behavior is view-only.

If the parser cannot model a part yet, keep it visible and warn. Never make an unsupported symbol disappear just to produce a cleaner preview.

## Verification

Use the smallest command that covers the change:

```bash
bun test tests/formats/ltspice/parser.test.ts tests/formats/document.test.ts
bun run typecheck
```

For playground fixture changes, also run:

```bash
bun run build:playground
```

Run the full suite when the public export or shared format dispatcher changes:

```bash
bun test
```
