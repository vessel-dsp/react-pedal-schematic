# Vessel DSP Circuit Workspace

[![core npm version](https://img.shields.io/npm/v/%40vessel-dsp%2Fcore.svg)](https://www.npmjs.com/package/@vessel-dsp/core)
[![react npm version](https://img.shields.io/npm/v/%40vessel-dsp%2Freact-component.svg)](https://www.npmjs.com/package/@vessel-dsp/react-component)

Headless circuit/device tooling, simulation-readiness checks, and React editing
components for guitar pedals and nearby audio electronics.

`@vessel-dsp/react-pedal-schematic` is replaced by `@vessel-dsp/react-component` and `@vessel-dsp/core`.

The project is pedal-first, but the model and fixtures also cover nearby
audio-circuit schematics such as amp stages, tone filters, and utility circuits.

![@vessel-dsp/react-component playground showing the symbol library, schematic canvas, and inspector](./docs/images/playground-schematic-editor.png)

## Packages

| Package | Status | Use it for |
| --- | --- | --- |
| `@vessel-dsp/core` | Public npm package | React-free parsing, validation, editing commands, `.vdsp`, netlist, preview-layout helpers, panel/device metadata, and export adapters. |
| `@vessel-dsp/react-component` | Public npm package | React schematic/editor components, plus core helper re-exports for app integrations. |
| `@vessel-dsp/simulation` | Workspace-private package | Simulation readiness, deterministic simulation IR compilation, and runtime/WASM adapter contracts. |

## Install

```bash
npm install @vessel-dsp/core @vessel-dsp/react-component
```

Headless consumers use `@vessel-dsp/core`:

```ts
import { parseCircuitDocument, validateDocument } from '@vessel-dsp/core';

const document = parseCircuitDocument(sourceText, {
    filename: 'pedal.asc',
});

const issues = validateDocument(document);
```

React apps use `@vessel-dsp/react-component`:

```tsx
import { parseCircuitDocument } from '@vessel-dsp/react-component';
import { SchematicView } from '@vessel-dsp/react-component/ui';

const document = parseCircuitDocument(sourceText, {
    filename: 'pedal.schx',
});

export function CircuitPreview() {
    return <SchematicView document={document} />;
}
```

Simulation readiness is currently exposed from the workspace-private
`@vessel-dsp/simulation` package and surfaced in the playground:

```ts
import { analyzeSimulationReadiness } from '@vessel-dsp/simulation';

const readiness = analyzeSimulationReadiness(document);
```

## Migration From 0.4.x

Replace imports from the old package with the new package split:

```ts
// Before
import { parseCircuitDocument } from '@vessel-dsp/react-pedal-schematic/core';
import { SchematicView } from '@vessel-dsp/react-pedal-schematic';

// After
import { parseCircuitDocument } from '@vessel-dsp/core';
import { SchematicView } from '@vessel-dsp/react-component';
```

There is no compatibility package for `@vessel-dsp/react-pedal-schematic`.

## Supported Inputs

- Project-native `.vdsp` Source documents (`circuit-interchange/v2` YAML)
- LiveSPICE `.schx`
- LTspice `.asc`
- SPICE-style `.cir` / `.net`

Use `parseCircuitDocumentFile()` when accepting project-native `.vdsp` Source
files as well as source schematics.

```ts
import { parseCircuitDocumentFile, serializeVdspCircuitDocument } from '@vessel-dsp/core';

const document = parseCircuitDocumentFile(sourceText, {
    filename: 'pedal.vdsp',
});

const vdspSource = serializeVdspCircuitDocument(document);
```

## Development

```bash
bun install
bun test
bun run typecheck
bun run build
bun run pack:dry-run
bun run build:playground
bun run dev
```

## License

MIT License. See [LICENSE.md](./LICENSE.md).

More integration notes and a full example live in [DOCUMENT.md](./DOCUMENT.md)
and [examples/schematic-flow-toggle.tsx](./examples/schematic-flow-toggle.tsx).
