import { describe, expect, test } from 'bun:test';
import { parseSchx } from '../../../src/formats/schx/parser';
import { serializeSchx } from '../../../src/formats/schx/serializer';
import { resolveConnectivity } from '../../../src/model/connectivity';
import { toNetlistView } from '../../../src/model/netlist';

const FIXTURES: readonly string[] = [
    'passive-divider',
    'passive-lowpass',
    'lpb-1-style-boost',
    'fulltone-ocd',
    'spdt-bypass-pedal',
    '3pdt-true-bypass-pedal',
];

async function loadFixture(name: string): Promise<string> {
    const url = new URL(`../../fixtures/schx/${name}.schx`, import.meta.url);
    return Bun.file(url).text();
}

describe('schx fixture round-trip', () => {
    for (const name of FIXTURES) {
        test(`${name} parses and re-serializes with stable topology`, async () => {
            const original = await loadFixture(name);
            const first = parseSchx(original);

            expect(first.components.length).toBeGreaterThan(0);
            expect(first.wires.length).toBeGreaterThan(0);

            const reserialized = serializeSchx(first);
            const second = parseSchx(reserialized);

            expect(second.components).toHaveLength(first.components.length);
            expect(second.wires).toHaveLength(first.wires.length);

            for (let i = 0; i < first.components.length; i += 1) {
                const a = first.components[i]!;
                const b = second.components[i]!;
                expect(b.kind).toBe(a.kind);
                expect(b.name).toBe(a.name);
                expect(b.origin).toEqual(a.origin);
                expect(b.rotation).toBe(a.rotation);
                expect(b.flipped).toBe(a.flipped);
                expect(b.terminals.length).toBe(a.terminals.length);
            }

            for (let i = 0; i < first.wires.length; i += 1) {
                const a = first.wires[i]!;
                const b = second.wires[i]!;
                expect(b.endpoints[0]).toEqual(a.endpoints[0]);
                expect(b.endpoints[1]).toEqual(a.endpoints[1]);
            }
        });
    }

    test('passive-lowpass exposes a resistor, a capacitor, and a ground', async () => {
        const xml = await loadFixture('passive-lowpass');
        const doc = parseSchx(xml);
        const kinds = doc.components.map((c) => c.kind);
        expect(kinds).toContain('resistor');
        expect(kinds).toContain('capacitor');
        expect(kinds).toContain('ground');
    });

    test('passive-divider connectivity puts the ground at node 0 and joins the midpoint', async () => {
        const xml = await loadFixture('passive-divider');
        const doc = parseSchx(xml);
        const connectivity = resolveConnectivity(doc);
        expect(connectivity.groundNodeId).toBe(0);
        expect(connectivity.nodeCount).toBeGreaterThanOrEqual(3);
    });

    test('passive-lowpass netlist projection emits at least R and C rows', async () => {
        const xml = await loadFixture('passive-lowpass');
        const doc = parseSchx(xml);
        const view = toNetlistView(doc);
        const letters = view.components.map((c) => c.spiceLetter);
        expect(letters).toContain('R');
        expect(letters).toContain('C');
        expect(view.groundNodeId).toBe(0);
    });

    test('lpb-1-style-boost parses without throwing and produces a netlist view', async () => {
        const xml = await loadFixture('lpb-1-style-boost');
        const doc = parseSchx(xml);
        expect(doc.components.some((c) => c.kind === 'bjt')).toBe(true);
        const view = toNetlistView(doc);
        expect(view.components.length).toBeGreaterThan(0);
    });

    test('fulltone-ocd fixture covers the analyzed dual-opamp MOSFET clipping pedal', async () => {
        const xml = await loadFixture('fulltone-ocd');
        const doc = parseSchx(xml);
        const byId = new Map(doc.components.map((component) => [component.id, component]));

        expect(doc.metadata.name).toBe('Fulltone OCD analysis');
        expect(byId.get('U1A')?.kind).toBe('opamp');
        expect(byId.get('U1A')?.properties.PartNumber).toBe('TL082');
        expect(byId.get('U1B')?.kind).toBe('opamp');
        expect(byId.get('M1')?.kind).toBe('mosfet');
        expect(byId.get('M1')?.properties.PartNumber).toBe('2N7000');
        expect(byId.get('M2')?.kind).toBe('mosfet');
        expect(byId.get('D1')?.kind).toBe('diode');
        expect(byId.get('D1')?.properties.PartNumber).toBe('1N34A');
        expect(byId.get('DRIVE')?.kind).toBe('potentiometer');
        expect(byId.get('DRIVE')?.properties.Resistance).toMatchObject({ value: 1_000_000, unit: 'Ω' });
        expect(byId.get('TONE')?.properties.Resistance).toMatchObject({ value: 10_000, unit: 'Ω' });
        expect(byId.get('HP_LP')?.kind).toBe('switch');
        expect(doc.warnings).toEqual([]);
    });

});
