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

`.vdsp` is the project-native Source format. It is strict `circuit-interchange/v1` YAML around a `CircuitDocument`, intended for inspection, copy/paste, light edits, LLM review, and downstream handoff. The schema id remains `circuit-interchange/v1`; `.vdsp` is the product file extension.

Parsed `.vdsp` documents expose scalar source provenance on `document.source`.
Fields such as `format`, `filename`, `version`, `url`, and host-specific
provenance labels round-trip through `parseInterchangeYaml()` and
`serializeInterchangeYaml()`. `serializeVdspCircuitDocument()` preserves an
existing `document.source` block and defaults only missing fields to native
`.vdsp` provenance (`format: interchange` and a `.vdsp` filename).

`.vdsp` can also carry optional stompbox panel placement metadata on
`document.panel`. This is logical control-surface placement, not schematic
placement: component `origin` remains the electrical drawing position, while
`panel.controls[].grid` describes where knobs, switches, sliders, LEDs, and
jacks should appear on a pedal faceplate grid.

```yaml
panel:
  layout:
    kind: stompbox-grid
    rows: 2
    columns: 3
    indexing: one-based
    rowOrder: top-to-bottom
    columnOrder: left-to-right
  controls:
    - componentId: DRIVE
      controlKind: knob
      grid:
        row: 1
        column: 1
      label: Drive
    - componentId: LEVEL
      controlKind: knob
      grid:
        row: 1
        column: 3
        rowSpan: 1
        columnSpan: 1
      label: Level
```

Use existing circuit `componentId` values in panel controls. The parser accepts
`indexing: one-based` or `indexing: zero-based`, but hand-authored `.vdsp`
files should prefer explicit `one-based` indexing for readability.

Use `parseVdspCircuitDocument()` when callers want strict parsing with thrown
errors. Use `validateVdspCircuitDocumentSchema()` for upload flows, editors, or
CLI checks that should report schema errors without throwing.

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
| `.vdsp` / `.yaml` | `parseCircuitDocumentFile()` | `serializeVdspCircuitDocument()` | Strict `circuit-interchange/v1` YAML for Source view and handoff. |
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
