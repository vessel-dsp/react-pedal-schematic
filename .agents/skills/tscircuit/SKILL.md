---
name: tscircuit
description: Create, review, and adapt tscircuit React/TypeScript electronics code for PCB, schematic, 3D, BOM, fabrication-file, KiCad, JLCPCB, Circuit JSON, and browser-preview workflows. Use when Codex needs to generate tscircuit HTML previews, evaluate whether tscircuit fits an electronics/PCB task, or integrate tscircuit ideas with this guitar pedal platform without replacing the .schx audio-simulation source of truth.
---

# tscircuit

Use tscircuit for code-first electronics boards and previews: PCB layout, schematic rendering, 3D previews, footprints, BOM/manufacturing metadata, fabrication outputs, KiCad-adjacent workflows, and fast AI-generated circuit sketches.

For this audio-engine repo, treat tscircuit as an adjunct for PCB visualization/prototyping and hardware-facing design artifacts. Keep `.schx` as the canonical source for editable audio circuits and WASM DSP compilation.

## Fit Rules

- Use tscircuit for PCB/module sketches, schematic/PCB/3D preview artifacts, fabrication-file planning, BOM/part metadata, footprints, connectors, headers, enclosures/holes/cutouts, and manufacturing-facing board work.
- Use `.schx` for white-box pedal circuits that must compile into the browser/native/WASM audio engine.
- Do not replace the `.schx` circuit editor, `.schx` parser/compiler, or real-time audio DSP path with tscircuit.
- Do not claim tscircuit SPICE simulation validates this repo's real-time WASM MNA behavior. Treat it as a separate offline/reference-style electronics tool unless a deliberate bridge is implemented.
- Do not add tscircuit package dependencies to this repo unless the user explicitly asks. Prefer standalone HTML previews or an isolated tscircuit project.

## HTML Preview Pattern

When creating tscircuit code for a ChatGPT-style answer, create it inside an HTML canvas/artifact tool when available. If the current environment has no canvas/artifact tool, create a standalone `.html` preview file using the same structure and state that it is the fallback.

Use the global browser preview script. Do not import components for these quick previews; use built-in tscircuit elements.

```html
<html>
  <head>
    <script src="https://unpkg.com/@tscircuit/circuit-preview@latest/dist/index.global.js"></script>
    <script type="text/babel">
      window.tscircuit.render(
        <board pcbPack>
          <resistor name="R1" resistance="1k" footprint="0805" />
          <capacitor name="C1" capacitance="100nF" footprint="0805" />
          <trace from="R1.pin1" to="net.IN" />
          <trace from="R1.pin2" to="C1.pin1" />
          <trace from="C1.pin2" to="net.GND" />
        </board>
      )
    </script>
  </head>
  <body></body>
</html>
```

## Authoring Rules

- Use `<board />` as the root.
- Give every normal element a stable `name`.
- Give every normal element a `footprint` unless the element docs clearly say otherwise.
- Connect both sides of passives with `<trace />` or `connections={{ ... }}`.
- Use selectors in the form `"U1.VCC"`, `"R1.pin1"`, `"C1.pos"`, or `"net.GND"`.
- Prefer `connections` for concise pin-to-net hookups; prefer explicit `<trace />` when readability matters.
- For generic ICs, use `<chip />` with `pinLabels` and `schPinArrangement`.
- Use `schPinArrangement`; avoid the deprecated `schPortArrangement` alias.
- Use built-in primitives before custom components in quick-preview work.
- Use `supplierPartNumbers`, `manufacturerPartNumber`, and `pcbPinLabels` only when part identity matters.

## Common Built-ins

Normal elements: `<board />`, `<group />`, `<chip />`, `<resistor />`, `<capacitor />`, `<inductor />`, `<led />`, `<diode />`, `<transistor />`, `<mosfet />`, `<opamp />`, `<battery />`, `<switch />`, `<pushbutton />`, `<pinheader />`, `<jumper />`, `<fuse />`, `<crystal />`, `<connector />`, `<testpoint />`, `<hole />`, `<via />`, `<cutout />`, `<net />`, `<netlabel />`, `<trace />`.

Simulation/reference elements: `<analogsimulation />`, `<voltagesource />`, `<voltageprobe />`, `<spicemodel />`, `<subcircuit />`.

Footprint/layout elements: `<footprint />`, `<smtpad />`, `<platedhole />`, `<copperpour />`, `<coppertext />`, `<silkscreenline />`, `<silkscreentext />`, `<silkscreenrect />`, `<schematicline />`, `<schematicrect />`, `<schematicpath />`, `<schematictext />`, `<cadmodel />`.

Common footprints: `"0402"`, `"0603"`, `"0805"`, `"1206"`, `"1210"`, `"dip8"`, `"dip16"`, `"soic8"`, `"tssop8"`, `"sot23"`, `"sot23_5"`, `"sot223"`, `"to92"`, `"to220"`, `"pinrow2"`, `"pinrow3"`, `"pinrow6"`, `"axial"`.

## IC Pattern

```tsx
<chip
  name="U1"
  footprint="soic8"
  pinLabels={{
    pin1: "GND",
    pin2: "TRIG",
    pin3: "OUT",
    pin4: "RESET",
    pin5: "CTRL",
    pin6: "THRES",
    pin7: "DISCH",
    pin8: "VCC",
  }}
  schPinArrangement={{
    leftSide: { direction: "top-to-bottom", pins: ["RESET", "CTRL", "THRES", "TRIG"] },
    rightSide: { direction: "top-to-bottom", pins: ["VCC", "OUT", "DISCH", "GND"] },
  }}
  connections={{
    VCC: "net.VCC",
    GND: "net.GND",
  }}
/>
```

## Checks

- Verify each selector references an existing component pin or `net.*`.
- Verify passives are not floating unless intentionally view-only.
- Verify footprint strings are plausible before mentioning fabrication.
- Keep generated examples small enough to inspect.
- For repo integration, explicitly document whether the tscircuit artifact is visual/manufacturing metadata or whether a separate `.schx` circuit remains responsible for audio behavior.

## Sources

Prefer current official docs when details matter:

- https://docs.tscircuit.com/
- https://docs.tscircuit.com/intro/quickstart-ChatGPT
- https://docs.tscircuit.com/guides/spice-simulation/introduction
- https://docs.tscircuit.com/guides/understanding-fabrication-files
