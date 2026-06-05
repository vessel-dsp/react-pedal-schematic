import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EMPTY_DOCUMENT, type CircuitDocument, type Component, type ComponentKind, type Point, type Terminal } from '../../src/model/types';
import { SchematicView, type SchematicViewProps } from '../../src/ui/schematic';

function makeComponent(
    kind: ComponentKind,
    id: string,
    origin: Point,
    terminals: readonly Terminal[],
    options: Readonly<{
        sourceTypeName?: string | null;
        properties?: Component['properties'];
    }> = {},
): Component {
    return {
        id,
        kind,
        name: id,
        origin,
        rotation: 0,
        flipped: false,
        terminals,
        properties: options.properties ?? {},
        sourceTypeName: options.sourceTypeName ?? null,
    };
}

function makeDocument(components: readonly Component[]): CircuitDocument {
    return {
        ...EMPTY_DOCUMENT,
        components,
    };
}

function renderSchematic(props: SchematicViewProps): string {
    return renderToStaticMarkup(createElement(SchematicView, props));
}

const LED1 = makeComponent('led', 'LED1', { x: 0, y: 0 }, [
    { name: 'anode', position: { x: 0, y: -20 } },
    { name: 'cathode', position: { x: 0, y: 20 } },
], {
    sourceTypeName: 'Circuit.Diode, Circuit',
    properties: { PartNumber: '3mm green' },
});

const RV1 = makeComponent('potentiometer', 'RV1', { x: 0, y: 0 }, [
    { name: 'a', position: { x: -10, y: -40 } },
    { name: 'wiper', position: { x: 10, y: 0 } },
    { name: 'b', position: { x: -10, y: 40 } },
]);

const SW1_SPDT = makeComponent('switch', 'SW1', { x: 0, y: 0 }, [
    { name: 'collector', position: { x: 0, y: 20 } },
    { name: 'base', position: { x: -20, y: 0 } },
    { name: 'emitter', position: { x: 10, y: -20 } },
], {
    sourceTypeName: 'Circuit.SPDT, Circuit',
});

const SW1_3PDT = makeComponent('switch', 'SW1', { x: 0, y: 0 }, [
    { name: 't1a', position: { x: -20, y: 20 } },
    { name: 'p1', position: { x: -20, y: 0 } },
    { name: 't1b', position: { x: -20, y: -20 } },
    { name: 't2a', position: { x: 0, y: 20 } },
    { name: 'p2', position: { x: 0, y: 0 } },
    { name: 't2b', position: { x: 0, y: -20 } },
    { name: 't3a', position: { x: 20, y: 20 } },
    { name: 'p3', position: { x: 20, y: 0 } },
    { name: 't3b', position: { x: 20, y: -20 } },
], {
    sourceTypeName: 'Circuit.3PDT, Circuit',
});

describe('SchematicView controlState', () => {
    test('lights an in-document LED and dims it when off', () => {
        const document = makeDocument([LED1]);
        const onMarkup = renderSchematic({
            document,
            controlState: { LED1: { kind: 'led', on: true, intensity: 0.5 } },
        });
        const offMarkup = renderSchematic({
            document,
            controlState: { LED1: { kind: 'led', on: false } },
        });

        expect(onMarkup).toContain('data-control-kind="led"');
        expect(onMarkup).toContain('data-control-id="LED1"');
        expect(onMarkup).toContain('data-control-on="true"');
        expect(onMarkup).toContain('data-led-glow="true"');
        expect(onMarkup).toContain('fill="green"');
        expect(onMarkup).toContain('opacity="0.09"');

        expect(offMarkup).toContain('data-control-kind="led"');
        expect(offMarkup).not.toContain('data-control-on="true"');
        expect(offMarkup).not.toContain('data-led-glow="true"');
        expect(offMarkup).toContain('opacity="0.08"');
    });

    test('renders potentiometer position as a card-local wiper indicator', () => {
        const document = makeDocument([RV1]);
        const minMarkup = renderSchematic({ document, controlState: { RV1: { kind: 'knob', position: 0 } } });
        const midMarkup = renderSchematic({ document, controlState: { RV1: { kind: 'knob', position: 0.5 } } });
        const maxMarkup = renderSchematic({ document, controlState: { RV1: { kind: 'knob', position: 1 } } });

        expect(minMarkup).toContain('data-control-kind="knob"');
        expect(minMarkup).toContain('data-control-id="RV1"');
        expect(minMarkup).toContain('data-control-position="0"');
        expect(minMarkup).toContain('rotate(-120)');

        expect(midMarkup).toContain('data-control-position="0.5"');
        expect(midMarkup).toContain('rotate(0)');

        expect(maxMarkup).toContain('data-control-position="1"');
        expect(maxMarkup).toContain('rotate(120)');
    });

    test('highlights the active SPDT throw for switch position', () => {
        const document = makeDocument([SW1_SPDT]);
        const topMarkup = renderSchematic({ document, controlState: { SW1: { kind: 'switch', position: 0 } } });
        const bottomMarkup = renderSchematic({ document, controlState: { SW1: { kind: 'switch', position: 1 } } });

        expect(topMarkup).toContain('data-control-kind="switch"');
        expect(topMarkup).toContain('data-control-id="SW1"');
        expect(topMarkup).toContain('data-control-position="0"');
        expect(topMarkup).toContain('data-control-terminal-name="collector"');
        expect(topMarkup).not.toContain('data-control-terminal-name="emitter"');

        expect(bottomMarkup).toContain('data-control-position="1"');
        expect(bottomMarkup).toContain('data-control-terminal-name="emitter"');
        expect(bottomMarkup).not.toContain('data-control-terminal-name="collector"');
    });

    test('applies the same switch position to every 3PDT pole', () => {
        const markup = renderSchematic({
            document: makeDocument([SW1_3PDT]),
            controlState: { SW1: { kind: 'switch', position: 1 } },
        });
        const activeTerminals = markup.match(/data-control-active-terminal="true"/g) ?? [];

        expect(activeTerminals).toHaveLength(3);
        expect(markup).toContain('data-control-terminal-name="t1b"');
        expect(markup).toContain('data-control-terminal-name="t2b"');
        expect(markup).toContain('data-control-terminal-name="t3b"');
        expect(markup).not.toContain('data-control-terminal-name="t1a"');
    });

    test('ignores unknown ids and mismatched control kinds', () => {
        const markup = renderSchematic({
            document: makeDocument([RV1]),
            controlState: {
                MISSING_LED: { kind: 'led', on: true },
                RV1: { kind: 'led', on: true },
            },
        });

        expect(markup).toContain('data-component-id="RV1"');
        expect(markup).not.toContain('data-control-kind="led"');
        expect(markup).not.toContain('data-control-kind="knob"');
    });
});

describe('SchematicView controlOverlay', () => {
    test('receives visual component positions and the public SVG viewBox shape', () => {
        const document = makeDocument([LED1]);
        const markup = renderSchematic({
            document,
            padding: 0,
            controlState: { LED1: { kind: 'led', on: true } },
            controlOverlay: (ctx) => {
                const position = ctx.componentPositions.get('LED1');
                return createElement('circle', {
                    'data-host-overlay': 'true',
                    cx: position?.x,
                    cy: position?.y,
                    'data-viewbox': `${ctx.viewBox.x},${ctx.viewBox.y},${ctx.viewBox.width},${ctx.viewBox.height}`,
                });
            },
        });

        expect(markup).toContain('data-control-overlay="true"');
        expect(markup).toContain('data-host-overlay="true"');
        expect(markup).toContain('cx="0"');
        expect(markup).toContain('cy="0"');
        expect(markup).toContain('data-viewbox="0,-20,0,40"');
    });
});
