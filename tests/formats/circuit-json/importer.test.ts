import { describe, expect, test } from 'bun:test';
import { getPinNode, resolveConnectivity } from '../../../packages/core/src/model/connectivity';
import {
    parseCircuitJsonDocument,
    validateCircuitJsonDocument,
    type CircuitJson,
} from '../../../packages/core/src/formats/circuit-json/serializer';
import { isParsedQuantity } from '../../../packages/core/src/model/properties';

const SIMPLE_RC_CIRCUIT_JSON: CircuitJson = [
    {
        type: 'source_net',
        source_net_id: 'source_net:0',
        name: 'GND',
        member_source_group_ids: [],
        is_ground: true,
        is_analog_signal: true,
    },
    {
        type: 'source_net',
        source_net_id: 'source_net:1',
        name: 'OUT',
        member_source_group_ids: [],
        is_analog_signal: true,
    },
    {
        type: 'source_component',
        source_component_id: 'source_component:R1',
        name: 'R1',
        ftype: 'simple_resistor',
        resistance: 10000,
        display_resistance: '10k',
        display_value: '10k',
    },
    {
        type: 'source_component',
        source_component_id: 'source_component:C1',
        name: 'C1',
        ftype: 'simple_capacitor',
        capacitance: 47e-9,
        display_capacitance: '47nF',
        display_value: '47nF',
    },
    {
        type: 'source_component',
        source_component_id: 'source_component:GND',
        name: 'GND',
        ftype: 'simple_ground',
    },
    {
        type: 'source_port',
        source_port_id: 'source_port:R1:a',
        source_component_id: 'source_component:R1',
        name: 'a',
        port_hints: ['a'],
    },
    {
        type: 'source_port',
        source_port_id: 'source_port:R1:b',
        source_component_id: 'source_component:R1',
        name: 'b',
        port_hints: ['b'],
    },
    {
        type: 'source_port',
        source_port_id: 'source_port:C1:a',
        source_component_id: 'source_component:C1',
        name: 'a',
        port_hints: ['a'],
    },
    {
        type: 'source_port',
        source_port_id: 'source_port:C1:b',
        source_component_id: 'source_component:C1',
        name: 'b',
        port_hints: ['b'],
    },
    {
        type: 'source_port',
        source_port_id: 'source_port:GND:t',
        source_component_id: 'source_component:GND',
        name: 't',
        port_hints: ['t'],
        provides_ground: true,
    },
    {
        type: 'source_trace',
        source_trace_id: 'source_trace:1',
        connected_source_port_ids: ['source_port:R1:b', 'source_port:C1:a'],
        connected_source_net_ids: ['source_net:1'],
        display_name: 'OUT',
    },
    {
        type: 'source_trace',
        source_trace_id: 'source_trace:0',
        connected_source_port_ids: ['source_port:C1:b', 'source_port:GND:t'],
        connected_source_net_ids: ['source_net:0'],
        display_name: 'GND',
    },
];

describe('parseCircuitJsonDocument', () => {
    test('imports source components, quantities, ports, traces, and synthesized layout diagnostics', () => {
        const doc = parseCircuitJsonDocument(SIMPLE_RC_CIRCUIT_JSON, { filename: 'simple.circuit.json' });
        const byId = new Map(doc.components.map((component) => [component.id, component]));

        expect(doc.source).toEqual({
            format: 'circuit-json',
            filename: 'simple.circuit.json',
        });
        expect(byId.get('R1')?.kind).toBe('resistor');
        expect(byId.get('C1')?.kind).toBe('capacitor');
        expect(byId.get('GND')?.kind).toBe('ground');
        expect(byId.get('R1')?.terminals.map((terminal) => terminal.name)).toEqual(['a', 'b']);

        const resistance = byId.get('R1')?.properties.R;
        const capacitance = byId.get('C1')?.properties.C;
        expect(isParsedQuantity(resistance) ? resistance.raw : null).toBe('10k');
        expect(isParsedQuantity(capacitance) ? capacitance.value : null).toBeCloseTo(47e-9);

        const connectivity = resolveConnectivity(doc);
        expect(getPinNode(connectivity, { componentId: 'R1', terminalName: 'b' })).toBe(
            getPinNode(connectivity, { componentId: 'C1', terminalName: 'a' }),
        );
        expect(getPinNode(connectivity, { componentId: 'C1', terminalName: 'b' })).toBe(
            getPinNode(connectivity, { componentId: 'GND', terminalName: 't' }),
        );
        expect(doc.warnings.map((warning) => warning.code)).toContain('circuit-json-layout-synthesized');
    });

    test('preserves available schematic component geometry instead of synthesizing layout', () => {
        const doc = parseCircuitJsonDocument([
            ...SIMPLE_RC_CIRCUIT_JSON,
            {
                type: 'schematic_component',
                schematic_component_id: 'schematic_component:R1',
                source_component_id: 'source_component:R1',
                center: { x: 12, y: -4 },
                size: { width: 2, height: 1 },
            },
        ]);

        expect(doc.components.find((component) => component.id === 'R1')?.origin).toEqual({ x: 12, y: -4 });
        expect(doc.warnings.map((warning) => warning.code)).not.toContain('circuit-json-layout-synthesized');
    });
});

describe('validateCircuitJsonDocument', () => {
    test('reports schema failures without throwing', () => {
        const result = validateCircuitJsonDocument([{ type: 'source_component', source_component_id: 7 }]);

        expect(result.valid).toBe(false);
        if (result.valid) {
            throw new Error('expected invalid Circuit JSON');
        }
        expect(result.errors[0]?.code).toBe('circuit-json-schema-invalid');
        expect(result.errors[0]?.message).toContain('source_component_id');
    });
});
