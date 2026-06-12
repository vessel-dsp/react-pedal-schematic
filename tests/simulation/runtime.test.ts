import { describe, expect, test } from 'bun:test';
import {
    configureRuntimeProgram,
    createWasmRuntimeAdapter,
    type RuntimeEngine,
} from '@vessel-dsp/simulation/runtime';
import type { SimulationProgram } from '@vessel-dsp/simulation';

function program(blocks: SimulationProgram['blocks']): SimulationProgram {
    return {
        version: 'simulation-program/v1',
        nodes: [],
        groundNodeId: null,
        blocks,
    };
}

describe('runtime adapter boundary', () => {
    test('configures runtime descriptors in stable block order', () => {
        const calls: string[] = [];
        const engine: RuntimeEngine = {
            configureRuntimeDescriptor(block) {
                calls.push(`${block.id}:${block.descriptorType}`);
            },
            configureStaticNetlistBlock(block) {
                calls.push(`${block.id}:${block.componentKind}`);
            },
        };

        const diagnostics = configureRuntimeProgram(engine, program([
            {
                id: 'DLY1',
                kind: 'runtime-descriptor',
                descriptorType: 'microblock-delay-chip',
                sourceTypeName: 'Circuit.MicroBlockDelayChip',
                nodes: [1, 2],
                properties: { RuntimeDescriptor: 'true', DescriptorType: 'microblock-delay-chip' },
            },
            {
                id: 'R1',
                kind: 'static-netlist',
                componentKind: 'resistor',
                supportLevel: 'static-netlist',
                nodes: [1, 0],
                value: { raw: '10k', value: 10000, unit: 'Ω' },
                model: null,
                properties: {},
            },
        ]));

        expect(diagnostics).toEqual([]);
        expect(calls).toEqual([
            'DLY1:microblock-delay-chip',
            'R1:resistor',
        ]);
    });

    test('reports actionable diagnostics for missing WASM exports', () => {
        const result = createWasmRuntimeAdapter({
            dsp_schx_clear: () => undefined,
        });

        expect(result.engine).toBeNull();
        expect(result.diagnostics).toContainEqual(expect.objectContaining({
            code: 'missing-wasm-export',
            message: expect.stringContaining('dsp_schx_configure_microblock_delay_chip_mechanism'),
        }));
    });
});
