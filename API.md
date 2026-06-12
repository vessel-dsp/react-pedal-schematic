# API Reference

`@vessel-dsp/react-pedal-schematic` exposes a React schematic view plus a headless circuit document toolchain for parsing, validation, editing, conversion, preview helpers, and panel control metadata.

## Import Surfaces

```ts
// React apps: UI plus core helpers.
import { SchematicView, parseCircuitDocument } from '@vessel-dsp/react-pedal-schematic';

// Headless tools, workers, tests, and server-side pipelines.
import { parseCircuitDocument, validateDocument } from '@vessel-dsp/react-pedal-schematic/core';

// UI compatibility subpath. Equivalent to the React root for UI consumers.
import { SchematicView } from '@vessel-dsp/react-pedal-schematic/ui';
```

The `/core` entrypoint is React-free. Use it when you only need parsing, validation, conversion, or editor state.

## Version Constants

| Export | Type | Notes |
| --- | --- | --- |
| `VERSION` | `string` | Library/core version. |
| `UI_VERSION` | `string` | UI entrypoint version, exported from root and `/ui`. |

## Core Model

The source of truth is `CircuitDocument`.

```ts
type CircuitDocument = Readonly<{
    metadata: DocumentMetadata;
    source?: DocumentSource;
    device?: CircuitDocumentDevice;
    panel?: PanelPlacementMetadata;
    controlInterfaces?: readonly ControlInterface[];
    controlOutputs?: readonly ControlOutput[];
    components: readonly Component[];
    wires: readonly Wire[];
    directives: readonly string[];
    warnings: readonly Warning[];
    rawAttributes: Readonly<Record<string, string>>;
}>;
```

Important model exports:

| Export | Purpose |
| --- | --- |
| `EMPTY_DOCUMENT` | Empty document value for initialization and tests. |
| `CircuitDocument` | Normalized in-memory circuit document. |
| `Component` | Component instance with kind, id, origin, terminals, properties, and source type. |
| `ComponentKind` | Supported normalized component kinds. |
| `Terminal` | Named component terminal with absolute schematic position. |
| `Wire` | Two-point wire segment. |
| `Point` | `{ x, y }` coordinate. |
| `ParsedQuantity` | `{ raw, value, unit }` quantity. |
| `PropertyValue` | `ParsedQuantity | string`. |
| `DocumentMetadata` | `{ name, description, partNumber }`. |
| `DocumentSource` | Scalar source provenance record. |
| `Warning` | Parser/export diagnostic carried on a document. |
| `CircuitDocumentDevice` | Optional product/accessory identity metadata. |
| `CircuitDocumentDeviceKind` | `'audio-pedal' | 'control-accessory' | 'utility' | 'unknown'`. |
| `ControlInterface` | External control/input interface metadata, separate from panel placement. |
| `ControlInterfaceRole` | `'external-control' | 'tempo-tap' | 'trigger' | 'reset' | 'sampler-trigger' | 'expression' | 'unknown'`. |
| `ControlInterfaceConnector` | Preferred connector values such as `'1/4-inch-mono-ts'` and `'1/4-inch-trs'`. |
| `ControlInterfaceAssignmentHint` | `'momentary' | 'latching' | 'momentary-or-latching' | 'continuous'`. |
| `ControlInterfacePolarity` | `'normally-open' | 'normally-closed' | 'expression' | 'unknown'`. |
| `ControlInterfaceBinding` | Optional binding to a source component/control/property. |
| `ControlOutput` | Producer-side external control output metadata. |
| `ControlOutputSwitchMode` | `'momentary' | 'latching'`. |

`Component.properties` is an open metadata map. Parsers, editors, and `.vdsp`
round-trips preserve scalar, parsed-quantity, and structured object/list
properties even when the key is not part of a kind's validation rules.
Validation rules describe the minimum properties required for a usable
component, not an exhaustive whitelist.

For `circuit-interchange/v2` runtime descriptors, reusable microblock data is
preserved as explicit properties: delay `mechanism`, reverb/octave `algorithm`,
compressor `topology`, tone-stack `sections`, and active-EQ `descriptor` plus
`bands`. Hosts should treat those fields as the canonical v2 descriptor data
instead of recovering behavior from old `Profile` strings.

### Panel Placement Metadata

`CircuitDocument.panel` describes logical stompbox control placement. It is separate from schematic `component.origin`.

```ts
type PanelPlacementMetadata = Readonly<{
    faces: readonly PanelFace[];
}>;
```

Related exports:

| Export | Purpose |
| --- | --- |
| `PanelGridLayout` | `stompbox-grid` row/column grid declaration. |
| `PanelGridIndexing` | `'one-based' | 'zero-based'`. |
| `PanelRowOrder` | `'top-to-bottom' | 'bottom-to-top'`. |
| `PanelColumnOrder` | `'left-to-right' | 'right-to-left'`. |
| `PanelFace` | Named physical surface with its own grid layout and elements. |
| `PanelElementBinding` | Binds a panel element to a component and optional runtime control/property. |
| `PanelElementPlacement` | Maps a bound panel element to a kind, label, and grid position. |
| `PanelControlPlacement` | Deprecated alias for `PanelElementPlacement`. |
| `PanelControlKind` | `'knob' | 'slider' | 'switch' | 'led' | 'jack'`. |
| `PanelGridPosition` | `{ row, column, rowSpan?, columnSpan? }`. |

Example `.vdsp` panel block:

```yaml
panel:
  faces:
    - id: top
      layout:
        kind: stompbox-grid
        rows: 2
        columns: 3
        indexing: one-based
      elements:
        - bind: { componentId: DRIVE }
          kind: knob
          grid:
            row: 1
            column: 1
          label: Drive
```

### Control Interface Metadata

`CircuitDocument.controlInterfaces` describes product-level external control
interfaces such as DD-3-style trigger/reset inputs, DD-5 tempo tap, expression
jacks, and future CTL/EXP ports. This block is behavioral metadata; keep it
separate from `panel`, which only places controls on a grid.

```ts
type ControlInterface = Readonly<{
    id: string;
    name: string;
    role: ControlInterfaceRole;
    componentId?: string;
    controlRole?: string;
    interface?: string;
    connector?: ControlInterfaceConnector;
    assignmentHint?: ControlInterfaceAssignmentHint;
    polarity?: ControlInterfacePolarity;
    binding?: ControlInterfaceBinding;
    description?: string;
}>;

type ControlInterfaceBinding = Readonly<{
    sourceComponentId?: string;
    controlId?: string;
    controlName?: string;
    property?: string;
}>;
```

Allowed scalar values:

| Type | Values |
| --- | --- |
| `ControlInterfaceRole` | `'external-control' | 'tempo-tap' | 'trigger' | 'reset' | 'sampler-trigger' | 'expression' | 'unknown'` |
| `ControlInterfaceConnector` | `'1/4-inch-mono-ts' | '1/4-inch-trs' | '3.5mm-mono-ts' | '3.5mm-trs' | 'proprietary' | 'unknown'` |
| `ControlInterfaceAssignmentHint` | `'momentary' | 'latching' | 'momentary-or-latching' | 'continuous'` |
| `ControlInterfacePolarity` | `'normally-open' | 'normally-closed' | 'expression' | 'unknown'` |

Receiver contract:

- `id` is the stable interface id. `name` is the user-facing label.
- `role` is required and carries the product-level purpose of the interface.
- `componentId` is optional. When it names an existing jack component, `extractPanel()` overlays the interface metadata onto that jack; otherwise the interface is exposed as a synthesized jack.
- `controlRole` and `interface` preserve source or host semantics. When omitted, panel extraction supplies defaults for known roles.
- `binding` is optional metadata that points to the runtime descriptor component/control/property driven by the external interface.
- Do not put trigger/reset/tempo inputs in `panel.faces[].elements[]` as switches unless the hardware has a visible panel switch. Use `panel` for placement and `controlInterfaces` for behavior.

Example `.vdsp` control interface block:

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
```

### Device And Control Output Metadata

`CircuitDocument.device` identifies the document as product content, such as a
normal audio pedal, a standalone control accessory, or a utility device.
`CircuitDocument.controlOutputs` describes producer-side external control
outputs. Use this for self-contained accessories such as Boss FS-5U / FS-6
footswitches that can patch into another pedal's `controlInterfaces`.

```ts
type CircuitDocumentDevice = Readonly<{
    id?: string;
    version?: number;
    kind: 'audio-pedal' | 'control-accessory' | 'utility' | 'unknown';
    family?: string;
    model?: string;
    audioProcessing?: boolean;
}>;

type ControlOutput = Readonly<{
    id: string;
    name: string;
    role: ControlInterfaceRole;
    connector?: ControlInterfaceConnector;
    switchMode?: 'momentary' | 'latching';
    polarity?: ControlInterfacePolarity;
    inactiveValue?: number;
    activeValue?: number;
    componentId?: string;
    description?: string;
}>;
```

Producer contract:

- `device.id` is the stable id inside the uploaded `.vdsp`; hosts may still assign their own upload/catalog id.
- `device.version` is a positive integer version for this product document, not the schema version.
- `device.kind: 'control-accessory'` or `device.audioProcessing: false` means valid product content that should not be treated as an audio DSP stage.
- `controlOutputs[].id` is stable within the accessory document and is the value board-level assignments should reference.
- `controlOutputs[].componentId` optionally links the output behavior to a visible jack component.
- `inactiveValue` and `activeValue` are optional normalized contact-closure values after `polarity` is applied. When omitted, hosts can derive them as `0`/`1` for `normally-open` and `1`/`0` for `normally-closed`.
- Runtime state such as pressed, released, or latched is host state and is not persisted in `.vdsp`.
- Enclosure dimensions are not part of this V1 metadata. Use `panel.faces[]` and jack components for logical physical placement.

Example Boss FS-5U `.vdsp` blocks:

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

## Parsing And Format Dispatch

Use the dispatcher when the input source format is known by extension.

```ts
const doc = parseCircuitDocument(sourceText, { filename: 'pedal.asc' });
```

| Export | Signature | Notes |
| --- | --- | --- |
| `detectCircuitFormat(filename)` | `(filename: string) => CircuitFormat | null` | Detects `.schx`, `.asc`, `.cir`, `.net`, `.spice`. |
| `parseCircuitDocument(source, options?)` | `(source: string, options?: ParseCircuitDocumentOptions) => CircuitDocument` | Parses source schematics and netlists. Does not parse `.vdsp`; use file dispatch or `.vdsp` helpers. |
| `detectCircuitDocumentFileFormat(filename)` | `(filename: string) => CircuitDocumentFileFormat | null` | Detects source formats plus `.vdsp`, `.yaml`, `.yml`. |
| `parseCircuitDocumentFile(source, options)` | `(source: string, { filename }) => CircuitDocument` | Parses source schematics, netlists, `.vdsp`, or `.yaml` by filename. |

Types:

| Export | Values |
| --- | --- |
| `CircuitFormat` | `'schx' | 'spice' | 'ltspice-asc'` |
| `CircuitDocumentFileFormat` | `CircuitFormat | 'vdsp' | 'yaml'` |
| `ParseCircuitDocumentOptions` | `{ filename?: string; format?: CircuitFormat }` |
| `ParseCircuitDocumentFileOptions` | `{ filename: string }` |

## `.vdsp` Source API

`.vdsp` is strict `circuit-interchange/v2` YAML around `CircuitDocument`.

| Export | Signature | Notes |
| --- | --- | --- |
| `vdspFileExtension` | `'.vdsp'` | File extension constant. |
| `isVdspFilename(filename)` | `(filename: string) => boolean` | Case-insensitive `.vdsp` check. |
| `vdspFilenameFromName(name)` | `(name: string) => string` | Slugifies a document/preset name to a `.vdsp` filename. |
| `parseVdspCircuitDocument(source)` | `(source: string) => CircuitDocument` | Strict parser. Throws on schema or YAML subset errors. |
| `validateVdspCircuitDocumentSchema(source)` | `(source: string) => VdspSchemaValidationResult` | Non-throwing schema validation wrapper. Returns parsed document when valid. |
| `serializeVdspCircuitDocument(document, options?)` | `(doc: CircuitDocument, options?: SerializeVdspCircuitDocumentOptions) => string` | Serializes the project-native Source view. |

Validation result:

```ts
type VdspSchemaValidationResult =
    | { valid: true; document: CircuitDocument; errors: readonly [] }
    | { valid: false; errors: readonly VdspSchemaValidationIssue[] };

type VdspSchemaValidationIssue = Readonly<{
    code: 'vdsp-schema-invalid';
    message: string;
    path?: string;
}>;
```

Example upload validation:

```ts
const result = validateVdspCircuitDocumentSchema(sourceText);

if (!result.valid) {
    for (const error of result.errors) {
        console.error(error.path ?? 'vdsp', error.message);
    }
} else {
    render(result.document);
}
```

## Source-Specific Parsers And Serializers

Use these when the host already knows the source format.

| Export | Input | Output | Notes |
| --- | --- | --- | --- |
| `parseSchx(source)` | LiveSPICE `.schx` XML string | `CircuitDocument` | Graphical schematic import. |
| `serializeSchx(document)` | `CircuitDocument` | `.schx` XML string | Best current graphical round-trip target. |
| `parseLtspiceAsc(source)` | LTspice `.asc` string or `Uint8Array` | `CircuitDocument` | Graphical import. ASC export is not implemented. |
| `parseSpiceNetlist(source)` | SPICE `.cir` / `.net` text | `CircuitDocument` | Connectivity-first import. |
| `serializeSpiceNetlist(document)` | `CircuitDocument` | SPICE netlist text | Layout is not represented in netlist output. |

Interchange YAML helpers:

| Export | Purpose |
| --- | --- |
| `parseInterchangeYaml(source)` | Strict parser for the serializer-owned YAML subset. |
| `serializeInterchangeYaml(document, options?)` | Lower-level `.vdsp`/interchange serializer. |
| `SerializeInterchangeYamlOptions` | `{ filename?, source?, sourceFormat? }`. |
| `InterchangeSourceFormat` | String alias for source format metadata. |

## Quantity Parsing

```ts
const q = parseQuantity('4.7k');
// { raw: '4.7k', value: 4700, unit: '' }
```

| Export | Signature | Notes |
| --- | --- | --- |
| `parseQuantity(input)` | `(input: string) => ParsedQuantity | null` | Supports SI prefixes, scientific notation, common electrical units, SPICE `Meg`, and raw preservation. |

## Document Validation

```ts
const issues = validateDocument(doc);
if (hasErrors(issues)) {
    // block export or show errors
}
```

| Export | Purpose |
| --- | --- |
| `validateDocument(document)` | Validates duplicate ids, degenerate wires, unsupported components, and per-kind properties. |
| `validateComponent(component, rules?)` | Validates one component against default or supplied property rules. |
| `getRulesForKind(kind)` | Returns validation rules for a component kind. |
| `hasErrors(issues)` | Returns true when any issue has `severity: 'error'`. |

Related types:

| Export | Purpose |
| --- | --- |
| `ValidationIssue` | Validation result item. |
| `ValidationCode` | Stable issue code union. |
| `ValidationSeverity` | `'error' | 'warning'`. |
| `PropertyRule` | `QuantityRule | StringRule`. |
| `QuantityRule` | Quantity property validation rule. |
| `StringRule` | String property validation rule. |

Validation does not reject extra component properties. For example, a resistor
with a valid `R` or `Resistance` value may also carry `Material: carbon-film`;
that material value remains metadata unless a host or future upstream feature
chooses to interpret it.

## Connectivity

```ts
const connectivity = resolveConnectivity(doc);
const node = getPinNode(connectivity, {
    componentId: 'R1',
    terminalName: 'a',
});
```

| Export | Purpose |
| --- | --- |
| `resolveConnectivity(document)` | Resolves component terminal pins into electrical nodes. Ground components anchor node `0`. |
| `getPinNode(connectivity, pin)` | Looks up a node id for `{ componentId, terminalName }`. |
| `pinKey(pin)` | Stable string key for pin maps. |

Related types:

| Export | Purpose |
| --- | --- |
| `Connectivity` | `{ pinToNode, nodeMembers, groundNodeId, nodeCount }`. |
| `NodeId` | Numeric node id. |
| `PinRef` | `{ componentId, terminalName }`. |

## Netlist Projection

```ts
const view = toNetlistView(doc);
```

| Export | Purpose |
| --- | --- |
| `toNetlistView(document, connectivity?)` | Projects a document into a SPICE-oriented netlist view with warnings. |
| `getSpiceLetter(kind)` | Returns SPICE primitive letter for supported component kinds. |
| `getSpiceNodeOrder(kind)` | Returns expected terminal ordering for a component kind. |
| `kindForSpiceLetter(letter)` | Maps SPICE letter to normalized component kind. |

Related types: `NetlistView`, `NetlistComponent`, `SpiceLetter`.

## Circuit JSON Export

```ts
const circuitJson = serializeCircuitJsonDocument(doc, { target: 'tscircuit' });
```

| Export | Purpose |
| --- | --- |
| `serializeCircuitJsonDocument(document, options?)` | Emits source-domain Circuit JSON elements plus warnings. |

Related types:

`CircuitJsonExport`, `CircuitJsonExportOptions`, `CircuitJsonExportTarget`, `CircuitJsonElement`, `CircuitJsonSourceNet`, `CircuitJsonSourceComponent`, `CircuitJsonSourcePort`, `CircuitJsonSourceTrace`.

The current exporter targets deterministic source-domain preview and interop data. It does not claim routed PCB or fabrication readiness.

## Editor API

Use document commands for single-document transformations and editor commands when you need selection plus undo/redo state.

```ts
let state = createEditorState(doc);
state = applyEditorCommand(state, { type: 'select', componentId: 'R1' });
state = applyEditorCommand(state, {
    type: 'move-component',
    componentId: 'R1',
    origin: { x: 120, y: 80 },
});
```

| Export | Purpose |
| --- | --- |
| `applyDocumentCommand(document, command)` | Applies a stateless document command. |
| `createEditorState(document)` | Creates editor state with selection and history. |
| `applyEditorCommand(state, command)` | Applies document, selection, replace, undo, or redo commands. |
| `canUndo(state)` | True when undo is available. |
| `canRedo(state)` | True when redo is available. |
| `resetEditorState(document)` | Creates a fresh editor state. |
| `buildComponent(args)` | Creates a component using catalog/default terminal geometry. |
| `tidyDocumentLayout(document, options?)` | Moves overlapping schematic components onto free display cells. |

Related types: `DocumentCommand`, `EditorCommand`, `EditorState`, `CreateComponentArgs`, `TidyLayoutOptions`.

Document command types include:

```ts
{ type: 'add-component'; kind; origin; sourceTypeName? }
{ type: 'delete-component'; componentId }
{ type: 'rename-component'; componentId; newName }
{ type: 'set-property'; componentId; propertyName; value }
{ type: 'remove-property'; componentId; propertyName }
{ type: 'move-component'; componentId; origin }
{ type: 'add-wire'; from; to }
{ type: 'delete-wire'; wireId }
{ type: 'delete-wires'; wireIds }
{ type: 'split-wire'; wireId; at }
{ type: 'merge-wires'; at }
{ type: 'tidy-layout' }
```

## Preview Helpers

These helpers are useful for hosts that build their own renderer or editing UI.

| Export | Purpose |
| --- | --- |
| `computeDocumentBounds(document, padding?)` | Computes schematic bounds. |
| `viewBoxString(bounds)` | Formats bounds for SVG `viewBox`. |
| `colorForKind(kind)` | Default color for component kind. |
| `symbolFor(kind, sourceTypeName?, properties?)` | Returns a schematic SVG symbol definition. |
| `COMPONENT_KINDS` | Ordered list of component kinds exposed by the palette/symbol system. |
| `findHangingEndpoints(document)` | Finds wire endpoints that do not connect to terminals or wires. |
| `collectPorts(components)` | Flattens component terminals into selectable ports. |
| `findNearestPort(ports, cursor, radius, exclude?)` | Finds nearest terminal port for snapping. |
| `findNearestWireBodyHit(wires, cursor, radius, excludeWireId?)` | Finds a snap point on a wire body. |
| `findWireChain(rootWireId, document)` | Expands one wire id into an unbranched perceived connector chain. |
| `findChainCorners(document)` | Finds route bend points eligible for merge/split workflows. |

Related types: `Bounds`, `SymbolDef`, `HangingEndpoint`, `Port`, `WireBodyHit`.

`symbolFor()` currently interprets capacitor `Material` values containing
`electrolytic` as the electrolytic capacitor glyph. Resistor `Material` values
are preserved metadata only and render with the normal resistor glyph.

## Panel Controls And Runtime Protocol

Panel metadata is extracted from schematic components and
`document.controlInterfaces`. Physical controls come from potentiometer, switch,
LED, and jack components. Runtime descriptor ICs with `RuntimeDescriptor:
"true"` can also declare panel controls through metadata such as `TimeControl`,
`FeedbackControl`, `MixControl`, `ModeControl`, `ModeLabels`, and
`TempoTapControl`.

```ts
const panel = extractPanel(doc);
let state = defaultControlState(panel);
state = applyControlMessage(state, {
    type: 'control/set',
    controlId: 'LEVEL',
    value: { kind: 'knob', position: 0.75 },
});
```

| Export | Purpose |
| --- | --- |
| `extractPanel(document)` | Extracts knobs, sliders, switches, LEDs, jacks, and optional placement metadata. |
| `defaultControlState(panel)` | Creates initial runtime state for controls. |
| `applyControlMessage(state, message)` | Pure reducer for UI/DSP control messages. |
| `validateMessage(panel, message)` | Returns `null` for a valid message or a short error string. |
| `isKnob(value)` | Type guard for knob values. |
| `isSlider(value)` | Type guard for slider values. |
| `isSwitch(value)` | Type guard for switch values. |
| `isLed(value)` | Type guard for LED values. |
| `nearestKnobStep(steps, position)` | Finds nearest stepped knob position. |
| `snapKnobPosition(knob, position)` | Snaps to the nearest step when present. |
| `isKnobPositionOnStep(knob, position)` | Checks stepped position validity. |
| `knobStepSize(knob)` | Returns spacing between knob steps. |
| `PANEL_PROTOCOL_VERSION` | Current panel protocol version constant. |

Semantic jack metadata takes precedence over source-type inference. Keep jack
metadata split by responsibility:

- `Role` / `ControlRole` describe broad panel or routing direction such as
  `input`, `output`, `direct-output`, or `tempo-tap`.
- `Interface` describes the broad port family such as `audio`,
  `audio-input`, `audio-output`, or `tap-tempo`.
- `AudioRole` optionally describes a source-visible audio subtype such as
  `guitar-input`, `bass-input`, `output-a-mono`, or `stereo-output-b`.
- `JackLabel` or `Label` provide display text when it differs from the
  component name. `JackLabel` takes precedence over `Label`.

For example, a jack with `Role: "output"` is reported as an output even if its
source type looks like `Circuit.Input`, and `ControlRole: "tempo-tap"` or
`Interface: "tap-tempo"` is reported as a tempo tap external control target.
`AudioRole` is explicit metadata; it is not inferred from jack labels, component
names, or generic audio interfaces. Validation warns when `AudioRole` is present
but is not a lower-kebab source subtype slug.

`JackRole` values are:

`'input' | 'output' | 'direct-output' | 'send' | 'return' | 'expression' | 'tempo-tap' | 'external-control' | 'unknown'`.

Common `JackAudioRole` values include:

`'guitar-input' | 'bass-input' | 'main-output' | 'mono-output' | 'output-a' | 'output-a-mono' | 'output-b' | 'stereo-output-b' | 'direct-output' | 'dry-output' | 'wet-output'`.

The type remains open to host-defined lower-kebab subtypes.

```ts
type JackAudioRole =
    | 'guitar-input'
    | 'bass-input'
    | 'main-output'
    | 'mono-output'
    | 'output-a'
    | 'output-a-mono'
    | 'output-b'
    | 'stereo-output-b'
    | 'direct-output'
    | 'dry-output'
    | 'wet-output'
    | (string & {});

type JackPort = Readonly<{
    id: string;
    name: string;
    role: JackRole;
    audioRole?: JackAudioRole;
    impedance?: ParsedQuantity;
    sourceTypeName?: string;
    sourceComponentId?: string;
    controlRole?: string;
    interface?: string;
    connector?: ControlInterfaceConnector;
    assignmentHint?: ExternalControlAssignmentHint;
    polarity?: ControlInterfacePolarity;
    binding?: ControlInterfaceBinding;
    description?: string;
}>;
```

`extractPanel()` projects `document.controlInterfaces` into `panel.jacks` with
these defaults when fields are omitted:

| `ControlInterface.role` | `JackPort.role` | Default `controlRole` | Default `interface` |
| --- | --- | --- | --- |
| `tempo-tap` | `tempo-tap` | `tempo-tap` | `tap-tempo` |
| `trigger` | `external-control` | `trigger` | `external-control-input` |
| `reset` | `external-control` | `reset` | `external-control-input` |
| `sampler-trigger` | `external-control` | `sampler-trigger` | `external-control-input` |
| `expression` | `expression` | `expression` | `external-control-input` |
| `external-control` | `external-control` | none | `external-control-input` |
| `unknown` | `unknown` | none | none |

If `componentId` matches an extracted jack id, the interface metadata is merged
into that jack. Otherwise the panel jack id is `controlInterface.id`. When
`binding.sourceComponentId` is present, it becomes `JackPort.sourceComponentId`.
Tempo tap descriptor controls are exposed as jacks with
`role: 'tempo-tap'` and `assignmentHint: 'momentary'`; DD-3 style
`TRIGGER`/`RESET` interfaces are exposed as `external-control` jacks. These
ports are not added to runtime switch state.

Related types:

`Panel`, `PanelMessage`, `ControlState`, `ControlValue`, `Knob`, `KnobValue`, `KnobStep`, `KnobTaper`, `KnobControlMode`, `SliderControl`, `SliderValue`, `SliderOrientation`, `SliderRange`, `SwitchControl`, `SwitchValue`, `SwitchKind`, `LedIndicator`, `LedValue`, `JackPort`, `JackRole`, `JackAudioRole`, `ExternalControlAssignmentHint`.

## React UI

```tsx
import { SchematicView } from '@vessel-dsp/react-pedal-schematic';

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

`SchematicView` renders an SVG schematic surface. Hosts own layout, surrounding chrome, and styling.

### `SchematicViewProps`

| Prop | Type | Notes |
| --- | --- | --- |
| `document` | `CircuitDocument` | Required document to render. |
| `className` | `string` | Host CSS class. |
| `style` | `CSSProperties` | Host inline style. |
| `padding` | `number` | Extra computed viewBox padding. |
| `showLabels` | `boolean` | Defaults to `true`. |
| `wireFlow` | `WireFlowMode` | `'none'` or `'all'`; visual-only wire flow overlay. |
| `editMode` | `boolean` | Enables edit affordances. |
| `selectedId` | `string | null` | Selected component id. |
| `selectedWireId` | `string | null` | Selected wire id. |
| `onSelect` | `(id: string | null) => void` | Component selection callback. |
| `onSelectWire` | `(wireId: string | null) => void` | Wire selection callback. |
| `onMoveComponent` | `(id: string, origin: Point) => void` | Component move callback. |
| `onCanvasDrop` | `(event, origin) => void` | Drop callback with schematic origin. |
| `onCreateWire` | `(from: Point, to: Point) => void` | Wire creation callback. |
| `onSplitWire` | `(wireId: string, at: Point) => void` | Wire split callback. |
| `onMergeCorner` | `(at: Point) => void` | Wire corner merge callback. |
| `snapTo` | `number` | Grid snap size, default `10`. |
| `snapRadius` | `number` | Wire/port snap radius, default `12`. |
| `minZoom` | `number` | Minimum zoom scale, default `0.1`. |
| `maxZoom` | `number` | Maximum zoom scale, default `10`. |
| `showHangingEndpoints` | `boolean` | Defaults to `true`. |
| `controlState` | `ControlState` | Optional runtime control values for live overlays. |
| `controlOverlay` | `(ctx: ControlOverlayContext) => ReactNode` | Custom SVG overlay hook. |

Related UI exports:

| Export | Purpose |
| --- | --- |
| `SchematicView` | React SVG schematic renderer. |
| `SchematicViewProps` | Props for `SchematicView`. |
| `WireFlowMode` | `'none' | 'all'`. |
| `ControlOverlayContext` | Context passed to custom control overlays. |

Styling hooks:

| CSS variable | Purpose |
| --- | --- |
| `--cpe-bg` | Text halo / note textbox background. |
| `--cpe-wire-flow-base` | Base wire color while flow is enabled. |
| `--cpe-wire-flow` | Animated flow overlay color. |
| `--cpe-control-accent` | Live control overlay accent color. |

## Common Workflows

### Parse, Validate, Render

```tsx
import {
    SchematicView,
    parseCircuitDocumentFile,
    validateDocument,
} from '@vessel-dsp/react-pedal-schematic';

const document = parseCircuitDocumentFile(sourceText, { filename });
const issues = validateDocument(document);

<SchematicView document={document} />;
```

### Convert To `.vdsp`

```ts
import {
    parseCircuitDocument,
    serializeVdspCircuitDocument,
} from '@vessel-dsp/react-pedal-schematic/core';

const document = parseCircuitDocument(sourceText, { filename: 'pedal.schx' });
const source = serializeVdspCircuitDocument(document, { filename: 'pedal.vdsp' });
```

### Edit With Undo

```ts
import {
    createEditorState,
    applyEditorCommand,
} from '@vessel-dsp/react-pedal-schematic/core';

let editor = createEditorState(document);

editor = applyEditorCommand(editor, {
    type: 'set-property',
    componentId: 'R1',
    propertyName: 'Resistance',
    value: '10k',
});
```

### Extract Panel Controls

```ts
import {
    extractPanel,
    defaultControlState,
} from '@vessel-dsp/react-pedal-schematic/core';

const panel = extractPanel(document);
const controlState = defaultControlState(panel);
```

## Boundary Notes

- The library parses and represents circuits; it is not a SPICE solver.
- `.vdsp` is an editable Source view around `CircuitDocument`; it is not a promise of byte-for-byte source regeneration.
- Graphical formats preserve layout where supported. SPICE netlists are connectivity-first.
- React UI components do not depend on shadcn/ui. The playground does, but the library does not.
