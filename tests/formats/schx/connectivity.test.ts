import { describe, expect, test } from 'bun:test';
import { parseSchx } from '../../../src/formats/schx/parser';
import { getPinNode, resolveConnectivity, type Connectivity } from '../../../src/model/connectivity';
import type { CircuitDocument } from '../../../src/model/types';

async function loadFixture(name: string): Promise<CircuitDocument> {
    const url = new URL(`../../fixtures/schx/${name}.schx`, import.meta.url);
    return parseSchx(await Bun.file(url).text());
}

function expectPinsShareNode(
    connectivity: Connectivity,
    pins: ReadonlyArray<[componentId: string, terminalName: string]>,
): number {
    const nodes = pins.map(([id, name]) =>
        getPinNode(connectivity, { componentId: id, terminalName: name }),
    );
    expect(nodes[0]).toBeDefined();
    for (let i = 1; i < nodes.length; i += 1) {
        expect(nodes[i]).toBe(nodes[0]!);
    }
    return nodes[0]!;
}

function expectPinsDisjoint(
    connectivity: Connectivity,
    pins: ReadonlyArray<[componentId: string, terminalName: string]>,
): void {
    const seen = new Set<number>();
    for (const [id, name] of pins) {
        const node = getPinNode(connectivity, { componentId: id, terminalName: name });
        expect(node).toBeDefined();
        expect(seen.has(node!)).toBe(false);
        seen.add(node!);
    }
}

describe('passive-divider electrical connectivity', () => {
    test('forms exactly three nodes: input, midpoint, ground', async () => {
        const doc = await loadFixture('passive-divider');
        const connectivity = resolveConnectivity(doc);
        expect(connectivity.nodeCount).toBe(3);
        expect(connectivity.groundNodeId).toBe(0);
    });

    test('input rail joins V1.a with R1.b', async () => {
        const doc = await loadFixture('passive-divider');
        const c = resolveConnectivity(doc);
        expectPinsShareNode(c, [['V1', 'a'], ['R1', 'b']]);
    });

    test('midpoint T-junction joins R1.a, R2.a, O1.a', async () => {
        const doc = await loadFixture('passive-divider');
        const c = resolveConnectivity(doc);
        expectPinsShareNode(c, [['R1', 'a'], ['R2', 'a'], ['O1', 'a']]);
    });

    test('ground rail joins V1.b, R2.b, O1.b, GND1.t at node 0', async () => {
        const doc = await loadFixture('passive-divider');
        const c = resolveConnectivity(doc);
        const node = expectPinsShareNode(c, [['V1', 'b'], ['R2', 'b'], ['O1', 'b'], ['GND1', 't']]);
        expect(node).toBe(0);
    });

    test('the three nodes are pairwise disjoint', async () => {
        const doc = await loadFixture('passive-divider');
        const c = resolveConnectivity(doc);
        expectPinsDisjoint(c, [['V1', 'a'], ['R1', 'a'], ['V1', 'b']]);
    });
});

describe('passive-lowpass electrical connectivity', () => {
    test('forms three nodes: input, output (R/C midpoint), ground', async () => {
        const doc = await loadFixture('passive-lowpass');
        const c = resolveConnectivity(doc);
        expect(c.nodeCount).toBe(3);
        expect(c.groundNodeId).toBe(0);
    });

    test('ground node groups V1.b, C1.b, GND1.t, and O1.b together', async () => {
        const doc = await loadFixture('passive-lowpass');
        const c = resolveConnectivity(doc);
        const node = expectPinsShareNode(c, [['V1', 'b'], ['C1', 'b'], ['GND1', 't'], ['O1', 'b']]);
        expect(node).toBe(0);
    });

    test('RC midpoint joins R1.a, C1.a, O1.a', async () => {
        const doc = await loadFixture('passive-lowpass');
        const c = resolveConnectivity(doc);
        expectPinsShareNode(c, [['R1', 'a'], ['C1', 'a'], ['O1', 'a']]);
    });
});

describe('lpb-1-style-boost electrical connectivity', () => {
    test('parses with at least 6 distinct nodes', async () => {
        const doc = await loadFixture('lpb-1-style-boost');
        const c = resolveConnectivity(doc);
        expect(c.nodeCount).toBeGreaterThanOrEqual(6);
        expect(c.groundNodeId).toBe(0);
    });

    test('BJT collector, RC.b, and COUT.b share a node (collector load junction)', async () => {
        const doc = await loadFixture('lpb-1-style-boost');
        const c = resolveConnectivity(doc);
        expectPinsShareNode(c, [['Q1', 'collector'], ['RC', 'b'], ['COUT', 'b']]);
    });

    test('BJT base, RB1.b, RB2.a, and CIN.a share a node (input bias junction)', async () => {
        const doc = await loadFixture('lpb-1-style-boost');
        const c = resolveConnectivity(doc);
        expectPinsShareNode(c, [['Q1', 'base'], ['RB1', 'b'], ['RB2', 'a'], ['CIN', 'a']]);
    });

    test('emitter node joins Q1.emitter with RE.a and CE.a (after the catalog fix)', async () => {
        const doc = await loadFixture('lpb-1-style-boost');
        const c = resolveConnectivity(doc);
        expectPinsShareNode(c, [['Q1', 'emitter'], ['RE', 'a'], ['CE', 'a']]);
    });

    test('COUT couples node 4 (collector) → node 7 (output) → Level.a', async () => {
        const doc = await loadFixture('lpb-1-style-boost');
        const c = resolveConnectivity(doc);
        expectPinsShareNode(c, [['COUT', 'a'], ['Level', 'a']]);
    });

    test('Level.wiper drives the speaker via node 8', async () => {
        const doc = await loadFixture('lpb-1-style-boost');
        const c = resolveConnectivity(doc);
        expectPinsShareNode(c, [['Level', 'wiper'], ['S1', 'a']]);
    });

    test('VCC rail joins VCC.t, RC.a, RB1.a', async () => {
        const doc = await loadFixture('lpb-1-style-boost');
        const c = resolveConnectivity(doc);
        expectPinsShareNode(c, [['VCC', 't'], ['RC', 'a'], ['RB1', 'a']]);
    });

    test('ground rail groups V1.b, GND1.t, RE.b, CE.b, RB2.b, Level.b, S1.b at node 0', async () => {
        const doc = await loadFixture('lpb-1-style-boost');
        const c = resolveConnectivity(doc);
        const node = expectPinsShareNode(c, [
            ['V1', 'b'], ['GND1', 't'], ['RE', 'b'], ['CE', 'b'], ['RB2', 'b'], ['Level', 'b'], ['S1', 'b'],
        ]);
        expect(node).toBe(0);
    });
});
