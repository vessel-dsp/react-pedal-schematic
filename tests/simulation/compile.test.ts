import { describe, expect, test } from 'bun:test';
import { compileSimulationProgram } from '@vessel-dsp/simulation';
import {
    EMPTY_DOCUMENT,
    type CircuitDocument,
    type Component,
    type ComponentKind,
    type Point,
    type PropertyValue,
    type Wire,
} from '@vessel-dsp/core';

function component(
    id: string,
    kind: ComponentKind,
    terminals: ReadonlyArray<[name: string, point: Point]>,
    properties: Record<string, PropertyValue> = {},
    sourceTypeName: string | null = null,
): Component {
    return {
        id,
        kind,
        name: id,
        origin: { x: 0, y: 0 },
        rotation: 0,
        flipped: false,
        terminals: terminals.map(([name, position]) => ({ name, position })),
        properties,
        sourceTypeName,
    };
}

function wire(id: string, a: Point, b: Point): Wire {
    return { id, endpoints: [a, b] };
}

function doc(parts: readonly Component[], wires: readonly Wire[] = []): CircuitDocument {
    return { ...EMPTY_DOCUMENT, components: parts, wires };
}

describe('compileSimulationProgram', () => {
    test('compiles a simple RC circuit into deterministic static-netlist blocks', () => {
        const gnd = { x: 20, y: 0 };
        const out = { x: 10, y: 0 };
        const input = { x: 0, y: 0 };
        const result = compileSimulationProgram(doc([
            component('IN', 'jack', [['t', input]], { Role: 'input' }),
            component('R1', 'resistor', [['a', input], ['b', out]], { R: '10kΩ' }),
            component('C1', 'capacitor', [['a', out], ['b', gnd]], { C: '47nF' }),
            component('GND', 'ground', [['t', gnd]]),
        ]));

        expect(result.diagnostics).toEqual([]);
        expect(result.program.blocks).toEqual([
            expect.objectContaining({
                id: 'R1',
                kind: 'static-netlist',
                componentKind: 'resistor',
                value: { raw: '10kΩ', value: 10000, unit: 'Ω' },
            }),
            expect.objectContaining({
                id: 'C1',
                kind: 'static-netlist',
                componentKind: 'capacitor',
                value: { raw: '47nF', value: 4.7000000000000004e-8, unit: 'F' },
            }),
        ]);
        expect(result.program.nodes.map((node) => node.id)).toEqual([0, 1, 2]);
        expect(result.program.groundNodeId).toBe(0);
    });

    test('compiles a passive divider in component declaration order with stable node ids', () => {
        const input = { x: 0, y: 0 };
        const middle = { x: 10, y: 0 };
        const ground = { x: 20, y: 0 };
        const result = compileSimulationProgram(doc([
            component('IN', 'jack', [['t', input]], { Role: 'input' }),
            component('R_TOP', 'resistor', [['a', input], ['b', middle]], { Resistance: '100k' }),
            component('R_BOTTOM', 'resistor', [['a', middle], ['b', ground]], { Resistance: '10k' }),
            component('GND', 'ground', [['t', ground]]),
        ]));

        expect(result.program.blocks.map((block) => block.id)).toEqual(['R_TOP', 'R_BOTTOM']);
        expect(result.program.blocks.map((block) => block.nodes)).toEqual([
            [1, 2],
            [2, 0],
        ]);
    });

    test('preserves structured runtime descriptor properties from CircuitDocument', () => {
        const result = compileSimulationProgram(doc([
            component('IN', 'jack', [['t', { x: 0, y: 0 }]], { Role: 'input' }),
            component('DLY1', 'ic', [['input', { x: 0, y: 0 }], ['output', { x: 10, y: 0 }]], {
                RuntimeDescriptor: 'true',
                DescriptorType: 'microblock-delay-chip',
                mechanism: {
                    memoryType: 'bbd',
                    stageCount: 3207,
                },
                delayMs: 320,
                feedback: 0.35,
            }, 'Circuit.MicroBlockDelayChip'),
            component('OUT', 'jack', [['t', { x: 10, y: 0 }]], { Role: 'output' }),
            component('GND', 'ground', [['t', { x: 0, y: 10 }]]),
        ]));

        expect(result.diagnostics).toEqual([]);
        expect(result.program.blocks).toEqual([
            {
                id: 'DLY1',
                kind: 'runtime-descriptor',
                descriptorType: 'microblock-delay-chip',
                sourceTypeName: 'Circuit.MicroBlockDelayChip',
                nodes: [1, 2],
                properties: {
                    RuntimeDescriptor: 'true',
                    DescriptorType: 'microblock-delay-chip',
                    mechanism: {
                        memoryType: 'bbd',
                        stageCount: 3207,
                    },
                    delayMs: 320,
                    feedback: 0.35,
                },
            },
        ]);
    });
});
