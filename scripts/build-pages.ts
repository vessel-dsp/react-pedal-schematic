#!/usr/bin/env bun

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type ConversionDocFunction = Readonly<{
    name: string;
    signature: string;
    description: string;
}>;

export const CONVERSION_DOC_FUNCTIONS: readonly ConversionDocFunction[] = [
    {
        name: 'detectCircuitDocumentFileFormat',
        signature: 'detectCircuitDocumentFileFormat(filename: string): CircuitDocumentFileFormat | null',
        description: 'Detects .vdsp, .yaml, .asc, .schx, .cir/.net, and .circuit.json files by extension.',
    },
    {
        name: 'parseCircuitDocumentFile',
        signature: 'parseCircuitDocumentFile(source: string, { filename }): CircuitDocument',
        description: 'Parses a supported source file into the normalized CircuitDocument model.',
    },
    {
        name: 'serializeCircuitDocumentFile',
        signature: 'serializeCircuitDocumentFile(document, { format, filename? }): string',
        description: 'Serializes a CircuitDocument to .vdsp, .asc, .schx, legacy SPICE, or .circuit.json output.',
    },
    {
        name: 'convertCircuitDocumentFile',
        signature: 'convertCircuitDocumentFile(source, { inputFilename, outputFormat, outputFilename? }): string',
        description: 'One-call conversion from an input file string to the selected output format through CircuitDocument; errors if v3-only build data would be dropped.',
    },
    {
        name: 'convertCircuitDocumentFileWithReport',
        signature: 'convertCircuitDocumentFileWithReport(source, { inputFilename, outputFormat, outputFilename?, lossPolicy? }): { output, diagnostics, droppedFields }',
        description: 'Converts with explicit loss policy support, including drop-with-diagnostics for v3 mechanical, BOM, wiring, and board realization fields.',
    },
    {
        name: 'serializeCircuitJsonDocument',
        signature: 'serializeCircuitJsonDocument(document, options?): { elements, warnings }',
        description: 'Exports official Circuit JSON source and schematic elements plus conversion diagnostics.',
    },
    {
        name: 'parseCircuitJsonDocument',
        signature: 'parseCircuitJsonDocument(elements, options?): CircuitDocument',
        description: 'Imports supported Circuit JSON source/schematic elements back into CircuitDocument.',
    },
    {
        name: 'validateCircuitJsonDocument',
        signature: 'validateCircuitJsonDocument(elements): CircuitJsonSchemaValidationResult',
        description: 'Validates elements with the official circuit-json schema without throwing.',
    },
    {
        name: 'serializeLtspiceAsc',
        signature: 'serializeLtspiceAsc(document, options?): string',
        description: 'Writes LTspice .asc text with Version, SHEET, SYMBOL, SYMATTR, WIRE, FLAG, IOPIN, and TEXT records.',
    },
    {
        name: 'parseVdspCircuitDocument',
        signature: 'parseVdspCircuitDocument(source: string): CircuitDocument',
        description: 'Parses strict circuit-interchange/v2 and circuit-interchange/v3 YAML Source documents.',
    },
    {
        name: 'serializeVdspCircuitDocument',
        signature: 'serializeVdspCircuitDocument(document, options?): string',
        description: 'Serializes a CircuitDocument to the project .vdsp Source format for inspection and editing.',
    },
];

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function functionCard(entry: ConversionDocFunction): string {
    return `<article class="function-card">
    <h3>${escapeHtml(entry.name)}</h3>
    <code>${escapeHtml(entry.signature)}</code>
    <p>${escapeHtml(entry.description)}</p>
</article>`;
}

export function renderPagesHtml(): string {
    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@vessel-dsp/core conversion API</title>
    <style>
        :root {
            color-scheme: light;
            --ink: #101820;
            --muted: #52606d;
            --line: #d9e2ec;
            --panel: #f8fafc;
            --accent: #0f766e;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            color: var(--ink);
            font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #ffffff;
        }
        main {
            width: min(1080px, calc(100vw - 40px));
            margin: 0 auto;
            padding: 56px 0 72px;
        }
        header {
            border-bottom: 1px solid var(--line);
            margin-bottom: 32px;
            padding-bottom: 28px;
        }
        h1 {
            margin: 0 0 12px;
            font-size: clamp(2rem, 6vw, 4rem);
            line-height: 1;
            letter-spacing: 0;
        }
        h2 {
            margin: 36px 0 14px;
            font-size: 1.35rem;
            letter-spacing: 0;
        }
        h3 {
            margin: 0 0 10px;
            font-size: 1rem;
            letter-spacing: 0;
        }
        p { margin: 0 0 14px; color: var(--muted); max-width: 76ch; }
        a { color: var(--accent); }
        code {
            display: block;
            overflow-x: auto;
            border: 1px solid var(--line);
            border-radius: 6px;
            padding: 10px 12px;
            color: #0f172a;
            background: var(--panel);
            font: 0.9rem/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        }
        .badge-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 20px;
        }
        .badge {
            border: 1px solid var(--line);
            border-radius: 999px;
            padding: 5px 10px;
            color: #334155;
            background: var(--panel);
            font-size: 0.88rem;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 14px;
        }
        .function-card {
            border: 1px solid var(--line);
            border-radius: 8px;
            padding: 18px;
            background: #ffffff;
        }
        .function-card p {
            margin-top: 12px;
            margin-bottom: 0;
        }
        .note {
            border-left: 4px solid var(--accent);
            padding: 12px 16px;
            background: #f0fdfa;
        }
        @media (max-width: 640px) {
            main { width: min(100vw - 28px, 1080px); padding-top: 36px; }
        }
    </style>
</head>
<body>
    <main>
        <header>
            <h1>@vessel-dsp/core conversion API</h1>
            <p>Headless TypeScript functions for converting audio-circuit files through CircuitDocument and official Circuit JSON.</p>
            <div class="badge-row" aria-label="Supported formats">
                <span class="badge">.vdsp</span>
                <span class="badge">circuit-interchange/v3</span>
                <span class="badge">.asc</span>
                <span class="badge">.schx</span>
                <span class="badge">.circuit.json</span>
            </div>
        </header>

        <section>
            <h2>Install</h2>
            <code>npm install @vessel-dsp/core</code>
        </section>

        <section>
            <h2>Core Flow</h2>
            <code>source file -&gt; CircuitDocument -&gt; Circuit JSON or target source format</code>
            <p class="note">SPICE .cir and .net helpers remain available as legacy connectivity support, but the v1 bidirectional Circuit JSON contract is .vdsp, .asc, .schx, and .circuit.json.</p>
        </section>

        <section>
            <h2>VDSP V3 Build Data</h2>
            <p>.vdsp supports circuit-interchange/v3 for reviewed physical build metadata: build scope, mechanical envelopes, BOM rows, embedded part and footprint catalogs, off-board wiring, panel drill placement, and board realizations for stripboard, perfboard, breadboard-pattern protoboard, and fabricated PCB.</p>
            <p class="note">Converting v3 documents to formats that cannot preserve these fields errors by default. Use convertCircuitDocumentFileWithReport with lossPolicy: "drop-with-diagnostics" only when lossy export is intentional.</p>
        </section>

        <section>
            <h2>Conversion Functions</h2>
            <div class="grid">
                ${CONVERSION_DOC_FUNCTIONS.map(functionCard).join('\n                ')}
            </div>
        </section>

        <section>
            <h2>Example</h2>
            <code>import { parseCircuitDocumentFile, serializeCircuitJsonDocument } from '@vessel-dsp/core';

const document = parseCircuitDocumentFile(sourceText, { filename: 'pedal.asc' });
const circuitJson = serializeCircuitJsonDocument(document).elements;</code>
        </section>

        <section>
            <h2>Downstream Rendering</h2>
            <p>Render or edit the emitted Circuit JSON in your downstream tscircuit application. This repository ships only the core conversion package and this static API reference.</p>
        </section>
    </main>
</body>
</html>
`;
}

export async function buildPages(outputDir = join(import.meta.dir, '..', 'gh-pages')): Promise<void> {
    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'index.html'), renderPagesHtml(), 'utf8');
}

if (import.meta.main) {
    await buildPages();
}
