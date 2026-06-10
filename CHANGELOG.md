# Changelog

## 0.3.1

- Document and test the open component property-map contract, including passive `Material` metadata round-tripping and resistor material remaining preview-neutral.
- Add top-level `.vdsp` `device` and `controlOutputs` metadata for standalone non-audio control accessories such as Boss FS-5U footswitches.
- Preserve control accessory metadata through strict `.vdsp` parse/serialize flows, with schema validation for device kind and output switch mode values.

## 0.3.0

- Replace flat `.vdsp` panel placement metadata with named `panel.faces[]` surfaces containing bound `elements[]`, while keeping legacy `panel.layout` + `controls[]` input accepted and normalized.
- Emit the new `faces` / `elements` / `bind` / `kind` panel shape from the interchange serializer by default.
- Add panel validation warnings for unresolved component bindings, unresolved runtime controls, kind mismatches, and overlapping grid cells.
- Add `direct-output` as a first-class jack role and expose runtime descriptor `DirectOutputJack` metadata as `U1:direct-out` panel jack ports.
- Document the updated `.vdsp` panel placement contract and mark the implementation plan complete.

## 0.2.9

- Add top-level `.vdsp` `controlInterfaces` metadata for external trigger/reset, tempo tap, expression, and similar control inputs.
- Preserve `controlInterfaces` through strict `.vdsp` parse/serialize flows, including connector, assignment hint, polarity, description, optional visible jack component links, and runtime binding metadata.
- Export the `ControlInterface*` model types from the core API so hosts can consume external control metadata without depending on panel extraction.
- Project `controlInterfaces` into extracted `JackPort` descriptors while keeping external footswitch/control targets out of `SwitchControl` and runtime switch state.
- Document the producer contract for external control interfaces separately from layout-only stompbox panel placement, including DD-3-style `TRIGGER`/`RESET` and DD-5-style tempo-tap semantics.

## 0.2.8

- Add non-throwing `.vdsp` schema validation and include API reference docs in the published package.
- Preserve optional stompbox panel placement metadata through `.vdsp` parse and serialize flows.
- Expose runtime descriptor panel controls such as time, feedback, mix, stepped mode selectors, and tempo-tap external control inputs.
- Add source-rated Fulltone OCD revision-3 fixture coverage for dual-opamp MOSFET clipping pedal parsing.
- Add source-rated TC Electronic Dark Matter Distortion fixture coverage for MC33178 stages, LL4148 clipping, and active tone controls.

## 0.2.7

- Treat imported runtime descriptor ICs as validation-safe opaque descriptors when `RuntimeDescriptor: "true"` is present.
- Rename SPDT/SP3T/SP4T catalog terminals from BJT-style names to switch-specific common/throw terminals.
- Parse common electronics shorthand quantities such as `1k5`, `4u7F`, and `2R2`.
- Export JFETs to Circuit JSON as schema-valid depletion-mode FET source metadata with an explicit lossy-mapping warning.

## 0.2.6

- Add a headless Circuit JSON source-domain exporter for `CircuitDocument`, with fixture coverage against the official `circuit-json` schema.
- Add playground keyboard shortcuts for undo, redo, and tidy layout while preserving normal shortcut behavior in editable inspector fields.

## 0.2.5

- Preserve `.vdsp` source provenance fields such as `source.version` and `source.url` through interchange parse/serialize round trips.

## 0.2.4

- Import LiveSPICE audio-engine runtime descriptors as stable opaque IC components with runtime metadata, diagnostics, and non-stage `input`/`output` terminal geometry.
- Preserve stereo runtime fields such as `StereoOutputMode` as component metadata instead of synthesizing extra schematic jacks.

## 0.2.3

- Treat the playground Source tab as a copyable conversion view with a format dropdown that defaults to `.vdsp`, supports `.schx` and `.cir`, and removes the separate Raw source tab.
- Add stepped knob panel metadata for detented controls, including `StepLabels`, numeric detent counts, snapping helpers, and message validation that rejects between-step knob positions.
- Add slider/fader panel controls for potentiometer metadata such as `ControlStyle: "Slider"` / `"Fader"`, with normalized slider runtime state and optional range metadata for graphic EQ style controls.
- Render stepped knob and slider control state overlays in `SchematicView`.
- Remove the playground Live Panel tab and demo surface while keeping the reusable panel/control-state library APIs available to host apps.

## 0.2.1

- Make the playground Source YAML and Raw `.schx` views editable with undoable document replacement.
- Keep Live Panel synchronized with the current edited schematic and preserve tab selection when changing fixtures.
- Add LiveSPICE opaque `MicroBlock...Stage` support for grey-box pedal descriptors.

## 0.2.0

- Add `controlState` and `controlOverlay` props to `SchematicView` for live LED, knob, and switch visualization driven by the `panel` protocol.
- Document virtual-component injection for hosts whose indicators live outside the parsed schematic.
- Add a playground Live Panel demo.
