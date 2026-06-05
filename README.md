# @vessel-dsp/react-pedal-schematic

[![npm version](https://img.shields.io/npm/v/%40vessel-dsp%2Freact-pedal-schematic.svg)](https://www.npmjs.com/package/@vessel-dsp/react-pedal-schematic)

React circuit-schematic tooling for guitar pedals and nearby audio electronics. The library renders a stylable SVG schematic preview, and also includes format-aware parsing, validation, inspection, light editing, and export helpers.

The project is pedal-first, but the model and fixtures also cover nearby audio-circuit schematics such as amp stages, tone filters, and utility circuits.

![@vessel-dsp/react-pedal-schematic playground showing the symbol library, schematic canvas, and inspector](./docs/images/playground-schematic-editor.png)

## Install

```bash
npm install @vessel-dsp/react-pedal-schematic
```

React apps can import the UI component and document helpers from the package root:

```ts
import { parseCircuitDocument, validateDocument } from '@vessel-dsp/react-pedal-schematic';
import { SchematicView } from '@vessel-dsp/react-pedal-schematic';
```

Headless consumers can avoid the React entrypoint:

```ts
import { parseCircuitDocument, validateDocument } from '@vessel-dsp/react-pedal-schematic/core';
```

## Supported Inputs

- LiveSPICE `.schx`
- LTspice `.asc`
- SPICE-style `.cir` / `.net`

Use the dispatcher for consumer integrations:

```ts
import { parseCircuitDocument } from '@vessel-dsp/react-pedal-schematic/core';

const document = parseCircuitDocument(sourceText, {
    filename: 'pedal.asc',
});
```

## React Preview

```tsx
import { useState } from 'react';
import { SchematicView, type WireFlowMode } from '@vessel-dsp/react-pedal-schematic';
import type { CircuitDocument } from '@vessel-dsp/react-pedal-schematic/core';

export function CircuitPreview(props: { document: CircuitDocument }) {
    const [wireFlow, setWireFlow] = useState<WireFlowMode>('none');

    return (
        <>
            <button
                type="button"
                aria-pressed={wireFlow === 'all'}
                onClick={() => setWireFlow((mode) => mode === 'all' ? 'none' : 'all')}
            >
                Signal flow
            </button>
            <SchematicView document={props.document} wireFlow={wireFlow} />
        </>
    );
}
```

`wireFlow="all"` is a visual overlay only. It dims the base wires to light gray and animates light-blue dashes along wires so users can trace connectivity; it does not claim simulated current direction. Override the colors with `--cpe-wire-flow-base` and `--cpe-wire-flow` on the `SchematicView` host element.

## Live Control State

The panel helpers can extract schematic controls and drive render-time state without mutating the circuit document:

```tsx
import { useReducer } from 'react';
import {
    applyControlMessage,
    defaultControlState,
    extractPanel,
} from '@vessel-dsp/react-pedal-schematic';
import { SchematicView } from '@vessel-dsp/react-pedal-schematic/ui';

const panel = extractPanel(document);
const [controlState, dispatch] = useReducer(applyControlMessage, defaultControlState(panel));

return <SchematicView document={document} controlState={controlState} />;
```

`controlState` lights LED components, moves potentiometer wiper indicators, and highlights active switch throws when ids match `Component.id`. Unknown ids are ignored, so hosts can carry virtual indicators. Use `controlOverlay` for HUD-style host widgets, or append a synthetic render-only component with a stable id if the indicator should appear inside the schematic.

## Development

```bash
bun install
bun test
bun run typecheck
bun run build
npm pack --dry-run
bun run build:playground
bun run dev
```

## License

MIT License. Copyright (c) 2026 Joseph Cheng <indiejoseph@gmail.com>.

More integration notes and a full example live in [DOCUMENT.md](./DOCUMENT.md) and [examples/schematic-flow-toggle.tsx](./examples/schematic-flow-toggle.tsx).
