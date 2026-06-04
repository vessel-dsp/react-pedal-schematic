import { describe, expect, test } from 'bun:test';
import { parseLtspiceAsc } from '../../../src/formats/ltspice/parser';
import { getPinNode, resolveConnectivity } from '../../../src/model/connectivity';
import type { CircuitDocument } from '../../../src/model/types';

const SIMPLE_RC_URL = new URL('../../fixtures/asc/simple-rc.asc', import.meta.url);

async function loadSimpleRc(): Promise<string> {
    return Bun.file(SIMPLE_RC_URL).text();
}

function findComponent(doc: CircuitDocument, id: string): CircuitDocument['components'][number] {
    const component = doc.components.find((candidate) => candidate.id === id);
    if (component === undefined) {
        throw new Error(`missing component ${id}`);
    }
    return component;
}

describe('parseLtspiceAsc', () => {
    test('keeps visible wires for fixture pin, port, and ground connections', async () => {
        const doc = parseLtspiceAsc(await loadSimpleRc());
        const wirePoints = doc.wires.map((wire) => `${wire.endpoints[0].x},${wire.endpoints[0].y} ${wire.endpoints[1].x},${wire.endpoints[1].y}`);

        expect(wirePoints).toContain('16,-32 16,0');
        expect(wirePoints).toContain('16,64 144,64');
        expect(wirePoints).toContain('144,64 176,64');
        expect(wirePoints).toContain('144,128 144,160');
    });

    test('parses common LTspice ASC elements into the normalized model', async () => {
        const doc = parseLtspiceAsc(await loadSimpleRc());

        const r1 = findComponent(doc, 'R1');
        const c1 = findComponent(doc, 'C1');
        const input = findComponent(doc, 'IN');
        const output = findComponent(doc, 'OUT');
        const ground = findComponent(doc, 'GND');
        const label = doc.components.find((component) => component.kind === 'label');

        expect(doc.rawAttributes).toEqual({
            format: 'ltspice-asc',
            version: '4',
            sheet: '1 880 680',
        });
        expect(r1.kind).toBe('resistor');
        expect(r1.sourceTypeName).toBe('ltspice:res');
        expect(r1.properties.R).toMatchObject({ value: 10000, unit: '' });
        expect(r1.properties.Value).toBe('10k');
        expect(c1.kind).toBe('capacitor');
        const cValue = c1.properties.C;
        if (cValue === undefined || typeof cValue === 'string') {
            throw new Error('C1 should expose a parsed capacitance property');
        }
        expect(cValue.value).toBeCloseTo(47e-9);
        expect(cValue.unit).toBe('');
        expect(input.kind).toBe('jack');
        expect(input.sourceTypeName).toBe('ltspice:InputJack');
        expect(input.terminals).toEqual([{ name: 'tip', position: { x: 16, y: -32 } }]);
        expect(input.properties.polarity).toBe('In');
        expect(input.properties.connector).toBe('1/4" TS jack');
        expect(output.kind).toBe('jack');
        expect(output.sourceTypeName).toBe('ltspice:OutputJack');
        expect(output.terminals).toEqual([{ name: 'tip', position: { x: 176, y: 64 } }]);
        expect(output.properties.polarity).toBe('Out');
        expect(output.properties.connector).toBe('1/4" TS jack');
        expect(ground.kind).toBe('ground');
        expect(label?.properties.Text).toBe('RC low-pass fixture');
        expect(doc.directives).toEqual(['.tran 100m']);
        expect(doc.warnings).toEqual([]);
    });

    test('resolves connectivity through wires, flags, ports, and ground', async () => {
        const doc = parseLtspiceAsc(await loadSimpleRc());
        const connectivity = resolveConnectivity(doc);

        const inputNode = getPinNode(connectivity, { componentId: 'IN', terminalName: 'tip' });
        const rInputNode = getPinNode(connectivity, { componentId: 'R1', terminalName: 'a' });
        const outputNode = getPinNode(connectivity, { componentId: 'OUT', terminalName: 'tip' });
        const rOutputNode = getPinNode(connectivity, { componentId: 'R1', terminalName: 'b' });
        const cOutputNode = getPinNode(connectivity, { componentId: 'C1', terminalName: 'a' });
        const cGroundNode = getPinNode(connectivity, { componentId: 'C1', terminalName: 'b' });
        const groundNode = getPinNode(connectivity, { componentId: 'GND', terminalName: 't' });

        expect(inputNode).toBe(rInputNode);
        expect(outputNode).toBe(rOutputNode);
        expect(outputNode).toBe(cOutputNode);
        expect(cGroundNode).toBe(groundNode);
        if (connectivity.groundNodeId === null) {
            throw new Error('expected LTspice FLAG 0 to resolve as ground');
        }
        expect(groundNode).toBe(connectivity.groundNodeId);
    });

    test('keeps unknown LTspice symbols visible with a parser warning', () => {
        const doc = parseLtspiceAsc(`Version 4
SHEET 1 100 100
SYMBOL mystery 0 0 R0
SYMATTR InstName X1
`);

        expect(doc.components).toHaveLength(1);
        expect(doc.components[0]?.id).toBe('X1');
        expect(doc.components[0]?.kind).toBe('unsupported');
        expect(doc.components[0]?.sourceTypeName).toBe('ltspice:mystery');
        expect(doc.warnings).toEqual([
            {
                code: 'unknown-ltspice-symbol',
                message: 'X1: unsupported LTspice symbol "mystery"',
                componentId: 'X1',
            },
        ]);
    });

    test('maps LTspice led symbols to LED components', () => {
        const doc = parseLtspiceAsc(`Version 4
SHEET 1 100 100
SYMBOL led 0 0 R0
SYMATTR InstName DLED
SYMATTR Value LED_RED
`);

        const led = findComponent(doc, 'DLED');
        expect(led.kind).toBe('led');
        expect(led.sourceTypeName).toBe('ltspice:led');
        expect(led.properties.model).toBe('LED_RED');
        expect(led.terminals.map((terminal) => terminal.name)).toEqual(['anode', 'cathode']);
    });
});
