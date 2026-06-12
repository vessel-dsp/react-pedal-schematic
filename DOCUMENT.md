# Integration Notes

`@vessel-dsp/react-pedal-schematic` has three public import surfaces:

- `@vessel-dsp/react-pedal-schematic`: React UI surface plus the core helpers most React apps need.
- `@vessel-dsp/react-pedal-schematic/core`: headless parsing, validation, editing, netlist, and export helpers.
- `@vessel-dsp/react-pedal-schematic/ui`: React UI compatibility subpath.

The headless `/core` entrypoint does not depend on React. Use it in workers, server-side import pipelines, tests, or build tools.

For the full public API surface, see [API.md](./API.md).

## Parse A Source File

```ts
import {
    parseCircuitDocument,
    validateDocument,
    toNetlistView,
} from '@vessel-dsp/react-pedal-schematic/core';

const document = parseCircuitDocument(sourceText, {
    filename: 'example.asc',
});

const issues = validateDocument(document);
const netlist = toNetlistView(document);
```

Pass a `filename` when possible. The dispatcher uses the extension to choose `.schx`, `.asc`, or SPICE netlist parsing.

Use `parseCircuitDocumentFile()` when the input may also be a project-native `.vdsp` or `.yaml` document:

```ts
import { parseCircuitDocumentFile } from '@vessel-dsp/react-pedal-schematic/core';

const document = parseCircuitDocumentFile(sourceText, {
    filename: 'example.vdsp',
});
```

## Format Conversion

Conversion goes through the normalized `CircuitDocument` model:

```text
.schx / .asc / .cir / .net / .vdsp
  -> CircuitDocument
  -> .vdsp / .schx / .cir
```

`.vdsp` is the project-native Source format. It is strict `circuit-interchange/v2` YAML around a `CircuitDocument`, intended for inspection, copy/paste, light edits, LLM review, and downstream handoff. The schema id remains `circuit-interchange/v2`; `.vdsp` is the product file extension.

Parsed `.vdsp` documents expose scalar source provenance on `document.source`.
Fields such as `format`, `filename`, `version`, `url`, and host-specific
provenance labels round-trip through `parseInterchangeYaml()` and
`serializeInterchangeYaml()`. `serializeVdspCircuitDocument()` preserves an
existing `document.source` block and defaults only missing fields to native
`.vdsp` provenance (`format: interchange` and a `.vdsp` filename).

`.vdsp` can also carry optional stompbox panel placement metadata on
`document.panel`. This is logical control-surface placement, not schematic
placement: component `origin` remains the electrical drawing position, while
`panel.faces[].elements[].grid` describes where knobs, switches, sliders, LEDs,
and jacks should appear on named physical surfaces such as `top`, `left-side`,
`right-side`, `front`, or `rear`.

```yaml
panel:
  faces:
    - id: top
      label: Top
      layout:
        kind: stompbox-grid
        rows: 2
        columns: 3
        indexing: one-based
        rowOrder: top-to-bottom
        columnOrder: left-to-right
      elements:
        - bind: { componentId: DRIVE }
          kind: knob
          grid:
            row: 1
            column: 1
          label: Drive
        - bind:
            componentId: LEVEL
            controlId: LEVEL
          kind: knob
          grid:
            row: 1
            column: 3
            rowSpan: 1
            columnSpan: 1
          label: Level
```

Use existing circuit `componentId` values in panel element bindings. Add
`controlId`, `controlName`, or `property` when one component surfaces multiple
runtime controls or panel ports. The parser accepts `indexing: one-based` or
`indexing: zero-based`, but hand-authored `.vdsp` files should prefer explicit
`one-based` indexing for readability. Legacy `panel.layout` + `controls[]`
input is still accepted and normalized to one `top` face.

Semantic device controls can be declared under top-level `controlGroups`,
`controlContexts`, and `deviceInterface`. Use these blocks when a host needs a
stable product-level control contract that is not coupled to schematic ids or
physical panel placement. A panel element may carry `interfaceControlId` to join
the visual grid position to a semantic control while preserving the source
component binding in `bind`.

```yaml
controlGroups:
  - id: delay-panel
    name: Delay Panel
    role: primary-controls
controlContexts:
  - id: mode-delay
    name: Delay Mode
    role: mode
deviceInterface:
  controls:
    - id: delay-time
      label: Time
      kind: knob
      role: time
      groupId: delay-panel
      order: 1
      binding:
        componentId: U1
        controlId: "U1:time"
        controlName: TIME
        property: TimeControl
      appliesWhen:
        allOf: [mode-delay]
panel:
  faces:
    - id: top
      layout: { kind: stompbox-grid, rows: 1, columns: 1, indexing: one-based }
      elements:
        - bind: { componentId: U1, controlId: "U1:time" }
          kind: knob
          grid: { row: 1, column: 1 }
          label: Time
          interfaceControlId: delay-time
```

Audio jack routing metadata lives on source-visible jack components. Use
`Role` for broad direction, `Interface` for the port family, and `AudioRole`
for an explicit lower-kebab source subtype. `JackLabel` or `Label` can provide
display text when it differs from the component name. Hosts should not infer
`AudioRole` from labels or generic audio interfaces.

```yaml
components:
  - id: J_OUT_A
    kind: jack
    name: J_OUT_A
    sourceTypeName: Circuit.Speaker
    origin: { x: 120, y: 40 }
    rotation: 0
    flipped: false
    terminals: []
    properties:
      Role: output
      Interface: audio
      AudioRole: output-a-mono
      JackLabel: "Output A (Mono)"
```

External control inputs are persisted separately under top-level
`controlInterfaces`. Use this for behavior and wiring semantics such as DD-3
`TRIGGER`/`RESET`, DD-5 `Tempo In`, expression inputs, connector type,
momentary/latching assignment hints, polarity, and bindings to runtime
descriptor controls. Do not model those external targets as normal panel
switches unless the hardware has a visible panel switch.

```yaml
controlInterfaces:
  - id: trigger-input
    name: TRIGGER external
    role: trigger
    controlRole: sampler-trigger
    interface: external-control-input
    connector: "1/4-inch-mono-ts"
    assignmentHint: momentary-or-latching
    polarity: normally-open
    binding:
      sourceComponentId: U1
      controlId: "U1:sampler-trigger"
      controlName: TRIGGER
      property: SamplerTriggerControl
  - id: reset-input
    name: RESET external
    role: reset
    controlRole: reset
    interface: external-control-input
    connector: "1/4-inch-mono-ts"
    assignmentHint: momentary-or-latching
    polarity: normally-open
    binding:
      sourceComponentId: U1
      controlId: "U1:reset"
      controlName: RESET
      property: ResetControl
```

Standalone control accessories can persist product identity under top-level
`device` and producer-side external output behavior under top-level
`controlOutputs`. Use this for self-contained non-audio devices such as Boss
FS-5U / FS-6 footswitches that can be uploaded as `.vdsp` product content and
patched to another document's receiver-side `controlInterfaces`.

```yaml
device:
  id: boss-fs-5u
  version: 1
  kind: control-accessory
  family: external-footswitch
  model: boss-fs-5u
  audioProcessing: false
controlOutputs:
  - id: output
    name: Output
    role: external-control
    connector: "1/4-inch-mono-ts"
    switchMode: momentary
    polarity: normally-open
    inactiveValue: 0
    activeValue: 1
    componentId: J1
```

`device.id` is the stable id inside the uploaded document; hosts can still
assign catalog/upload ids externally. `device.version` is a positive integer
for the product document, not the schema version. A document with
`device.kind: control-accessory` or `device.audioProcessing: false` is valid
product content but should not be compiled as an audio DSP stage.

`controlOutputs[].id` is stable within the accessory document and is the value
board-level assignments should reference. `inactiveValue` and `activeValue` are
optional normalized contact-closure values after polarity is applied. When they
are omitted, hosts can derive `0`/`1` for `normally-open` outputs and `1`/`0`
for `normally-closed` outputs. Runtime pressed/latched state is host state and
is not persisted in `.vdsp`. Enclosure dimensions are not part of this metadata;
use `panel.faces[]` and jack components for logical physical placement.

Use `parseVdspCircuitDocument()` when callers want strict parsing with thrown
errors. Use `validateVdspCircuitDocumentSchema()` for upload flows, editors, or
CLI checks that should report schema errors without throwing.

### Component Property Metadata

Component `properties` are an open metadata map. The strict `.vdsp` parser
accepts scalar values, parsed quantity objects, and structured object/list
properties for any property key, and the serializer emits every property on the
component. Validation rules define the minimum required fields for each
component kind rather than a closed property catalog.

Passive material metadata follows that rule. `Material: carbon-film` on a
resistor round-trips as metadata and does not change validation or preview
behavior. `Material: electrolytic` on a capacitor also round-trips as metadata;
the preview layer currently uses that value to choose the electrolytic capacitor
glyph.

In `circuit-interchange/v2`, imported runtime descriptor ICs can carry
profile-free structured properties. Delay descriptors use `mechanism`, reverb
and octave descriptors use `algorithm`, compressors use `topology`, tone stacks
use `sections`, and active EQ descriptors use `descriptor` plus `bands`. Source
files may still preserve a raw source `Profile` attribute when it exists, but
v2 `.vdsp` documents should not depend on old profile names as the canonical
microblock identity.

```ts
import {
    parseVdspCircuitDocument,
    validateVdspCircuitDocumentSchema,
} from '@vessel-dsp/react-pedal-schematic/core';

const validation = validateVdspCircuitDocumentSchema(sourceText);
if (!validation.valid) {
    for (const error of validation.errors) {
        console.error(error.path ?? 'vdsp', error.message);
    }
}

const document = parseVdspCircuitDocument(sourceText);
```

```ts
import {
    parseCircuitDocumentFile,
    serializeSchx,
    serializeSpiceNetlist,
    serializeVdspCircuitDocument,
} from '@vessel-dsp/react-pedal-schematic/core';

const document = parseCircuitDocumentFile(inputText, {
    filename: 'pedal.schx',
});

const vdspSource = serializeVdspCircuitDocument(document, {
    filename: 'pedal.vdsp',
});
const schxSource = serializeSchx(document);
const spiceNetlist = serializeSpiceNetlist(document);
```

Current support:

| Format | Import | Export | Notes |
| --- | --- | --- | --- |
| `.vdsp` / `.yaml` | `parseCircuitDocumentFile()` | `serializeVdspCircuitDocument()` | Strict `circuit-interchange/v2` YAML for Source view and handoff. |
| `.schx` | `parseCircuitDocument()` or `parseCircuitDocumentFile()` | `serializeSchx()` | Best current graphical round-trip target. |
| `.asc` | `parseCircuitDocument()` or `parseCircuitDocumentFile()` | Not yet supported | LTspice import preserves supported semantic layout, but exact ASC round-trip is not implemented. |
| `.cir` / `.net` | `parseCircuitDocument()` or `parseCircuitDocumentFile()` | `serializeSpiceNetlist()` | Connectivity-first; graphical layout is not preserved in netlists. |

Conversion is semantic, not byte-for-byte source regeneration. Unsupported components, source-specific graphics, synthesized layout, dropped directives, or missing serializer support should be surfaced through diagnostics or warnings instead of being silently hidden.

## Render A Schematic

```tsx
import { SchematicView } from '@vessel-dsp/react-pedal-schematic';

export function Preview({ document }) {
    return (
        <SchematicView
            document={document}
            className="h-[560px] w-full"
        />
    );
}
```

The renderer is SVG-based. Hosts own sizing, surrounding chrome, styling, and buttons.

## Enable Or Disable Flow Visualization

Use the `wireFlow` prop:

```tsx
<SchematicView document={document} wireFlow="none" />
<SchematicView document={document} wireFlow="all" />
```

`wireFlow="all"` dims the base wire stroke to light gray and draws an animated semi-opaque light-blue dash overlay on top of every rendered wire. It is intentionally visual only: connectivity is known, but current direction is not simulated.

A full React toggle example is available at [examples/schematic-flow-toggle.tsx](./examples/schematic-flow-toggle.tsx).

## Playground Behavior

The playground schematic toolbar includes a `Signal flow` button. It toggles the same `wireFlow` prop used by external integrations:

```tsx
<SchematicView wireFlow={wireFlow ? 'all' : 'none'} />
```

Keep this off by default in product integrations unless the user explicitly asks to trace connections.

## Styling Notes

- The library renderer inherits `currentColor`.
- The host can provide `--cpe-bg` for text halos and note textboxes.
- The host can provide `--cpe-wire-flow-base` to override the base wire color used while flow is enabled.
- The host can provide `--cpe-wire-flow` to override the default light-blue flow overlay.
- `SchematicView` accepts `className` and `style`.
- Flow animation is SVG-native, so no host CSS keyframes are required.

## Editing Hooks

For interactive editor integrations, pass the callback props:

```tsx
<SchematicView
    document={document}
    editMode
    selectedId={selectedId}
    onSelect={setSelectedId}
    onMoveComponent={(componentId, origin) => {
        dispatch({ type: 'move-component', componentId, origin });
    }}
/>
```

Use editor commands from `@vessel-dsp/react-pedal-schematic/core` to keep document changes explicit and undoable in non-React contexts.
