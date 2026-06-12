# Vessel DSP Core

[![core npm version](https://img.shields.io/npm/v/%40vessel-dsp%2Fcore.svg)](https://www.npmjs.com/package/@vessel-dsp/core)

Headless TypeScript tooling for converting audio-circuit documents between
project `.vdsp`, LTspice `.asc`, LiveSPICE `.schx`, and tscircuit Circuit JSON.

The library is React-free and does not include a custom editor or realtime
simulator. GitHub Pages publishes a static API reference for the conversion
functions only; downstream apps should use tscircuit tooling to render or edit
the emitted Circuit JSON.

## Package

| Package | Status | Use it for |
| --- | --- | --- |
| `@vessel-dsp/core` | Public npm package | Parsing, validation, normalized `CircuitDocument` data, `.vdsp` / `.asc` / `.schx` serialization, and Circuit JSON import/export. |

## Install

```bash
npm install @vessel-dsp/core
```

## Convert Through Circuit JSON

```ts
import {
    parseCircuitDocumentFile,
    serializeCircuitJsonDocument,
    convertCircuitDocumentFile,
} from '@vessel-dsp/core';

const document = parseCircuitDocumentFile(sourceText, {
    filename: 'pedal.asc',
});

const circuitJson = serializeCircuitJsonDocument(document).elements;

const vdsp = convertCircuitDocumentFile(JSON.stringify(circuitJson), {
    inputFilename: 'pedal.circuit.json',
    outputFormat: 'vdsp',
    outputFilename: 'pedal.vdsp',
});
```

## Supported V1 Conversion Inputs

- Project-native `.vdsp` Source documents (`circuit-interchange/v2` YAML)
- LTspice `.asc`
- LiveSPICE `.schx`
- tscircuit `.circuit.json`

SPICE `.cir` / `.net` parsing remains available as legacy connectivity support,
but it is not part of the new v1 bidirectional Circuit JSON contract.

## Development

```bash
bun install
bun test
bun run typecheck
bun run build
bun run pack:dry-run
bun run build:pages
```

## License

MIT License. See [LICENSE.md](./LICENSE.md).
