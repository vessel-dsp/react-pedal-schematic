# Integration Notes

`@vessel-dsp/react-pedal-schematic` has three public import surfaces:

- `@vessel-dsp/react-pedal-schematic`: React UI surface plus the core helpers most React apps need.
- `@vessel-dsp/react-pedal-schematic/core`: headless parsing, validation, editing, netlist, and export helpers.
- `@vessel-dsp/react-pedal-schematic/ui`: React UI compatibility subpath.

The headless `/core` entrypoint does not depend on React. Use it in workers, server-side import pipelines, tests, or build tools.

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

## Reflect Live Panel State

Use the panel helpers when a host has runtime control values from a UI, worklet,
or hardware bridge:

```tsx
import { useReducer } from 'react';
import {
    applyControlMessage,
    defaultControlState,
    extractPanel,
} from '@vessel-dsp/react-pedal-schematic';
import { SchematicView } from '@vessel-dsp/react-pedal-schematic/ui';

export function LivePreview({ document }) {
    const panel = extractPanel(document);
    const [controlState, dispatch] = useReducer(
        applyControlMessage,
        defaultControlState(panel),
    );

    return <SchematicView document={document} controlState={controlState} />;
}
```

`controlState` is a render-time overlay. It does not mutate `CircuitDocument`
and does not change exported source. Matching component ids get visual state:
LEDs light, potentiometer indicators move, and active switch throws highlight.
Ids absent from the document are ignored.

For host-owned indicators that are not in the parsed schematic, use one of two
patterns:

- pass `controlOverlay` and render HUD-style SVG children from the provided
  `componentPositions` and `viewBox`;
- append a synthetic render-only `Component` with a stable id to the document
  passed to `SchematicView`, then drive that id through `controlState`.

Synthetic components are a host rendering concern. Do not serialize them back
to `.schx`, `.asc`, or netlist formats unless the host intentionally wants to
edit the schematic source.

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
