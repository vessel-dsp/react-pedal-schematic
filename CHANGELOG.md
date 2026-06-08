# Changelog

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
