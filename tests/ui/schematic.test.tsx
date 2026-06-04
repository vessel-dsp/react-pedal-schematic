import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { parseLtspiceAsc } from '../../src/formats/ltspice/parser';
import { parseSchx } from '../../src/formats/schx/parser';
import { EMPTY_DOCUMENT, type CircuitDocument } from '../../src/model/types';
import { SchematicView } from '../../src/ui/schematic';

async function renderFixture(name: string): Promise<string> {
    const url = new URL(`../fixtures/schx/${name}.schx`, import.meta.url);
    const xml = await Bun.file(url).text();
    const document = parseSchx(xml);
    return renderToStaticMarkup(createElement(SchematicView, { document }));
}

async function renderAscFixture(name: string): Promise<string> {
    const url = new URL(`../fixtures/asc/${name}.asc`, import.meta.url);
    const source = await Bun.file(url).text();
    const document = parseLtspiceAsc(source);
    return renderToStaticMarkup(createElement(SchematicView, { document }));
}

describe('SchematicView rendering — passive-divider', () => {
    test('emits the horizontal R1→O1 polyline at y=0 (split at the T-junction)', async () => {
        const markup = await renderFixture('passive-divider');
        // The original `-130,0 → 0,0` wire is split at the T-junction (-100,0) into two pieces.
        expect(markup).toContain('points="-130,0 -100,0"');
        expect(markup).toContain('points="-100,0 0,0"');
    });

    test('emits the vertical R2.top branch polyline at x=-100', async () => {
        const markup = await renderFixture('passive-divider');
        expect(markup).toContain('points="-100,0 -100,30"');
    });

    test('emits a junction dot at the T-junction (-100, 0)', async () => {
        const markup = await renderFixture('passive-divider');
        expect(markup).toMatch(/<circle[^>]*cx="-100"[^>]*cy="0"[^>]*r="3"/);
    });

    test('emits junction dots on the ground rail at (-100, 100) and (-150, 100)', async () => {
        const markup = await renderFixture('passive-divider');
        expect(markup).toMatch(/<circle[^>]*cx="-100"[^>]*cy="100"[^>]*r="3"/);
        expect(markup).toMatch(/<circle[^>]*cx="-150"[^>]*cy="100"[^>]*r="3"/);
    });

    test('renders one polyline per wire (13 after splitting at the 3 T-junctions)', async () => {
        const markup = await renderFixture('passive-divider');
        // Wires emit <polyline> with explicit stroke="currentColor"; symbol-internal
        // polylines (resistor zigzag, etc.) inherit stroke from their parent <g>.
        const wirePolylines = markup.match(/<polyline [^>]*stroke="currentColor"/g) ?? [];
        // Original 10 wires + 1 split on horizontal R1→O1 + 2 splits on the ground rail = 13.
        expect(wirePolylines.length).toBe(13);
    });
});

describe('SchematicView rendering — inferred editor junctions', () => {
    test('emits a junction dot when a component terminal lands directly on a wire body', () => {
        const document: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'R2',
                kind: 'resistor',
                name: 'R2',
                origin: { x: -100, y: 20 },
                rotation: 0,
                flipped: false,
                terminals: [{ name: 'a', position: { x: -100, y: 0 } }],
                properties: {},
                sourceTypeName: null,
            }],
            wires: [{
                id: 'main',
                endpoints: [{ x: -130, y: 0 }, { x: 0, y: 0 }],
            }],
        };
        const markup = renderToStaticMarkup(createElement(SchematicView, { document }));
        expect(markup).toMatch(/<circle[^>]*cx="-100"[^>]*cy="0"[^>]*r="3"/);
    });

    test('splits the rendered wire trunk when a component terminal lands directly on the wire body', () => {
        const document: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'R2',
                kind: 'resistor',
                name: 'R2',
                origin: { x: -100, y: 20 },
                rotation: 0,
                flipped: false,
                terminals: [{ name: 'a', position: { x: -100, y: 0 } }],
                properties: {},
                sourceTypeName: null,
            }],
            wires: [{
                id: 'main',
                endpoints: [{ x: -130, y: 0 }, { x: 0, y: 0 }],
            }],
        };
        const markup = renderToStaticMarkup(createElement(SchematicView, { document }));
        expect(markup).toContain('points="-130,0 -100,0"');
        expect(markup).toContain('points="-100,0 0,0"');
        expect(markup).not.toContain('points="-130,0 0,0"');
    });
});

describe('SchematicView rendering — wire flow overlay', () => {
    test('keeps wire flow animation off by default', () => {
        const document: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            wires: [{
                id: 'w1',
                endpoints: [{ x: 0, y: 0 }, { x: 80, y: 0 }],
            }],
        };

        const markup = renderToStaticMarkup(createElement(SchematicView, { document }));

        expect(markup).not.toContain('data-wire-flow="true"');
        expect(markup).toContain('stroke="currentColor"');
        expect(markup).not.toContain('stroke="var(--cpe-wire-flow-base, #cbd5e1)"');
    });

    test('renders an animated semi-opaque overlay when wire flow is enabled', () => {
        const document: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            wires: [{
                id: 'w1',
                endpoints: [{ x: 0, y: 0 }, { x: 80, y: 0 }],
            }],
        };

        const markup = renderToStaticMarkup(createElement(SchematicView, { document, wireFlow: 'all' }));

        expect(markup).toContain('data-wire-flow="true"');
        expect(markup).toContain('stroke="var(--cpe-wire-flow-base, #cbd5e1)"');
        expect(markup).toContain('stroke="var(--cpe-wire-flow, #7dd3fc)"');
        expect(markup).toContain('stroke-opacity="0.62"');
        expect(markup).toContain('stroke-dasharray="6 10"');
        expect(markup).toContain('attributeName="stroke-dashoffset"');
        expect(markup).toContain('repeatCount="indefinite"');
    });
});

describe('SchematicView rendering — lpb-1-style-boost', () => {
    test('Q1.emitter wire endpoint (after the catalog fix) is at world (-30, 140)', async () => {
        const markup = await renderFixture('lpb-1-style-boost');
        // After the +10 emitter offset, the emitter terminal dot is at world (-30, 140).
        expect(markup).toMatch(/<circle[^>]*cx="-30"[^>]*cy="140"[^>]*r="2\.5"/);
    });
});

describe('SchematicView rendering — LTspice I/O jacks', () => {
    test('renders LTspice IN and OUT IOPIN markers as jack components', async () => {
        const markup = await renderAscFixture('simple-rc');

        expect(markup).toContain('data-component-id="IN" data-component-kind="jack"');
        expect(markup).toContain('data-component-id="OUT" data-component-kind="jack"');
        expect(markup).toContain('>INPUT</text>');
        expect(markup).toContain('>OUTPUT</text>');
        expect(markup).toMatch(/<rect[^>]*height="14"/);
    });
});

describe('SchematicView rendering — component cards', () => {
    test('renders symbol components as square cards with a centered icon area and solid name band', () => {
        const document: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'GND1',
                kind: 'ground',
                name: 'GND1',
                origin: { x: 0, y: 0 },
                rotation: 0,
                flipped: false,
                terminals: [{ name: 't', position: { x: 0, y: 0 } }],
                properties: {},
                sourceTypeName: null,
            }],
        };

        const markup = renderToStaticMarkup(createElement(SchematicView, { document }));

        expect(markup).toContain('data-component-card="true"');
        expect(markup).toMatch(/<rect[^>]*data-component-card="true"[^>]*x="-20"[^>]*y="-20"[^>]*width="40"[^>]*height="40"/);
        expect(markup).toMatch(/<svg[^>]*data-component-icon-area="true"[^>]*x="-20"[^>]*y="-20"[^>]*width="40"[^>]*height="30"/);
        expect(markup).toMatch(/<rect[^>]*data-component-label-area="true"[^>]*x="-20"[^>]*y="10"[^>]*width="40"[^>]*height="10"/);
        expect(markup).toContain('data-component-card-label="true"');
        expect(markup).toContain('>GND1</text>');
        expect(markup).toMatch(/<circle[^>]*cx="0"[^>]*cy="0"[^>]*r="2\.5"/);
    });

    test('clips card internals and uses thinner borders for normal and active nodes', () => {
        const document: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'GND1',
                kind: 'ground',
                name: 'GND1',
                origin: { x: 0, y: 0 },
                rotation: 0,
                flipped: false,
                terminals: [{ name: 't', position: { x: 0, y: 0 } }],
                properties: {},
                sourceTypeName: null,
            }],
        };

        const normalMarkup = renderToStaticMarkup(createElement(SchematicView, { document }));
        const selectedMarkup = renderToStaticMarkup(createElement(SchematicView, { document, selectedId: 'GND1' }));

        expect(normalMarkup).toContain('data-component-card-clip="true"');
        expect(normalMarkup).toContain('clip-path="url(#component-card-clip-GND1)"');
        expect(normalMarkup).toMatch(/<rect[^>]*data-component-card="true"[^>]*stroke-width="0\.75"/);
        expect(selectedMarkup).toMatch(/<rect[^>]*data-component-card="true"[^>]*stroke-width="1\.25"/);
        expect(selectedMarkup).not.toMatch(/<rect[^>]*data-component-card="true"[^>]*stroke-width="2"/);
    });

    test('renders terminal connection dots and attached wires on the card perimeter', () => {
        const document: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'Volume',
                kind: 'potentiometer',
                name: 'Volume',
                origin: { x: 0, y: 0 },
                rotation: 0,
                flipped: false,
                terminals: [
                    { name: 'a', position: { x: -10, y: -40 } },
                    { name: 'wiper', position: { x: 10, y: 0 } },
                    { name: 'b', position: { x: -10, y: 40 } },
                ],
                properties: {},
                sourceTypeName: null,
            }],
            wires: [
                { id: 'top', endpoints: [{ x: -40, y: -40 }, { x: -10, y: -40 }] },
                { id: 'wiper', endpoints: [{ x: 10, y: 0 }, { x: 50, y: 0 }] },
                { id: 'bottom', endpoints: [{ x: -10, y: 20 }, { x: -10, y: 60 }] },
            ],
        };

        const markup = renderToStaticMarkup(createElement(SchematicView, { document }));

        expect(markup).toMatch(/<circle[^>]*cx="-10"[^>]*cy="-20"[^>]*r="2\.5"/);
        expect(markup).toMatch(/<circle[^>]*cx="20"[^>]*cy="0"[^>]*r="2\.5"/);
        expect(markup).toMatch(/<circle[^>]*cx="-10"[^>]*cy="20"[^>]*r="2\.5"/);
        expect(markup).not.toMatch(/<circle[^>]*cy="-40"[^>]*r="2\.5"/);
        expect(markup).not.toMatch(/<circle[^>]*cy="40"[^>]*r="2\.5"/);
        expect(markup).toContain('points="-40,-40 -10,-40 -10,-20"');
        expect(markup).toContain('points="20,0 50,0"');
        expect(markup).toContain('points="-10,20 -10,60"');
    });

    test('moves center terminals to the card edge that faces the attached wire', () => {
        const document: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'GND1',
                kind: 'ground',
                name: 'GND1',
                origin: { x: 0, y: 0 },
                rotation: 0,
                flipped: false,
                terminals: [{ name: 't', position: { x: 0, y: 0 } }],
                properties: {},
                sourceTypeName: null,
            }],
            wires: [{
                id: 'ground-lead',
                endpoints: [{ x: 0, y: -60 }, { x: 0, y: 0 }],
            }],
        };

        const markup = renderToStaticMarkup(createElement(SchematicView, { document }));

        expect(markup).toMatch(/<circle[^>]*cx="0"[^>]*cy="-20"[^>]*r="2\.5"/);
        expect(markup).not.toMatch(/<circle[^>]*cx="0"[^>]*cy="0"[^>]*r="2\.5"/);
        expect(markup).toContain('points="0,-60 0,-20"');
        expect(markup).not.toContain('points="0,-60 0,0"');
    });
});

describe('SchematicView rendering — note labels', () => {
    test('renders long multiline note text in a wrapped textbox', () => {
        const document: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'NOTE1',
                kind: 'label',
                name: 'NOTE1',
                origin: { x: 40, y: 60 },
                rotation: 0,
                flipped: false,
                terminals: [],
                properties: {
                    Text: 'NOTE: Use the following commands to switch between time and frequency domain simulations.\nGAIN SIM:\n.step param Rgain list 1k 2k 5k 10k 20k 50k 100k',
                },
                sourceTypeName: 'ltspice:TEXT',
            }],
        };

        const markup = renderToStaticMarkup(createElement(SchematicView, { document }));
        const renderedLines = markup.match(/data-label-line="true"/g) ?? [];

        expect(markup).toContain('data-label-textbox="true"');
        expect(renderedLines.length).toBeGreaterThanOrEqual(4);
        expect(markup).toContain('>NOTE: Use the following commands to switch between</tspan>');
        expect(markup).toContain('>time and frequency domain simulations.</tspan>');
        expect(markup).toContain('>GAIN SIM:</tspan>');
        expect(markup).toContain('>.step param Rgain list 1k 2k 5k 10k 20k 50k 100k</tspan>');
    });

    test('uses a monospaced technical font for rendered schematic text', () => {
        const document: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'R1',
                kind: 'resistor',
                name: 'R1',
                origin: { x: 0, y: 0 },
                rotation: 0,
                flipped: false,
                terminals: [],
                properties: {},
                sourceTypeName: null,
            }, {
                id: 'NOTE1',
                kind: 'label',
                name: 'NOTE1',
                origin: { x: 40, y: 60 },
                rotation: 0,
                flipped: false,
                terminals: [],
                properties: {
                    Text: 'NOTE: gain stage',
                },
                sourceTypeName: 'ltspice:TEXT',
            }],
        };

        const markup = renderToStaticMarkup(createElement(SchematicView, { document }));

        expect(markup).toContain('font-family="ui-monospace');
        expect(markup).not.toContain('font-family="ui-sans-serif');
    });
});
