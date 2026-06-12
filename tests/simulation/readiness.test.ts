import { describe, expect, test } from 'bun:test';
import { analyzeSimulationReadiness, supportLevelForComponent } from '@vessel-dsp/simulation';
import {
    EMPTY_DOCUMENT,
    type CircuitDocument,
    type Component,
    type ComponentKind,
    type PropertyValue,
    type Wire,
} from '@vessel-dsp/core';

function component(
    id: string,
    kind: ComponentKind,
    terminals: ReadonlyArray<[name: string, x: number, y: number]>,
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
        terminals: terminals.map(([name, x, y]) => ({ name, position: { x, y } })),
        properties,
        sourceTypeName,
    };
}

function wire(id: string, ax: number, ay: number, bx: number, by: number): Wire {
    return { id, endpoints: [{ x: ax, y: ay }, { x: bx, y: by }] };
}

function doc(parts: readonly Component[], wires: readonly Wire[] = [], directives: readonly string[] = []): CircuitDocument {
    return { ...EMPTY_DOCUMENT, components: parts, wires, directives };
}

describe('simulation readiness', () => {
    test('assigns every current ComponentKind an explicit support level', () => {
        const kinds: readonly ComponentKind[] = [
            'resistor',
            'capacitor',
            'inductor',
            'diode',
            'led',
            'bjt',
            'jfet',
            'mosfet',
            'opamp',
            'ota',
            'triode',
            'pentode',
            'tube-diode',
            'transformer',
            'potentiometer',
            'variable-resistor',
            'switch',
            'optocoupler',
            'voltage-source',
            'current-source',
            'battery',
            'ground',
            'rail',
            'jack',
            'bbd',
            'delay-ic',
            'power-amp',
            'regulator',
            'analog-switch',
            'flipflop',
            'ic',
            'label',
            'named-wire',
            'port',
            'unsupported',
        ];

        expect(Object.fromEntries(
            kinds.map((kind) => [kind, supportLevelForComponent({ kind, properties: {}, sourceTypeName: null })]),
        )).toEqual({
            resistor: 'static-netlist',
            capacitor: 'static-netlist',
            inductor: 'static-netlist',
            diode: 'static-netlist',
            led: 'static-netlist',
            bjt: 'static-netlist',
            jfet: 'static-netlist',
            mosfet: 'static-netlist',
            opamp: 'static-netlist',
            ota: 'static-netlist',
            triode: 'static-netlist',
            pentode: 'static-netlist',
            'tube-diode': 'static-netlist',
            transformer: 'static-netlist',
            potentiometer: 'static-netlist',
            'variable-resistor': 'static-netlist',
            switch: 'static-netlist',
            optocoupler: 'static-netlist',
            'voltage-source': 'static-netlist',
            'current-source': 'static-netlist',
            battery: 'static-netlist',
            ground: 'static-netlist',
            rail: 'static-netlist',
            jack: 'static-netlist',
            bbd: 'static-netlist',
            'delay-ic': 'static-netlist',
            'power-amp': 'static-netlist',
            regulator: 'static-netlist',
            'analog-switch': 'static-netlist',
            flipflop: 'static-netlist',
            ic: 'unsupported',
            label: 'static-netlist',
            'named-wire': 'static-netlist',
            port: 'static-netlist',
            unsupported: 'unsupported',
        });
    });

    test('reports missing ground and unsupported source components', () => {
        const result = analyzeSimulationReadiness(doc([
            component('R1', 'resistor', [['a', 0, 0], ['b', 10, 0]], { R: '10k' }),
            component('U?', 'unsupported', [['t', 20, 0]], {}, 'Circuit.Mystery'),
        ]));

        expect(result.ready).toBe(false);
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('missing-ground');
        expect(result.diagnostics).toContainEqual(expect.objectContaining({
            code: 'unsupported-component',
            componentId: 'U?',
        }));
    });

    test('reports missing values, missing models, unsupported directives, and floating nodes', () => {
        const result = analyzeSimulationReadiness(doc(
            [
                component('R1', 'resistor', [['a', 0, 0], ['b', 10, 0]]),
                component('D1', 'diode', [['anode', 10, 0], ['cathode', 20, 0]]),
                component('GND', 'ground', [['t', 20, 0]]),
            ],
            [wire('W1', 20, 0, 20, 0)],
            ['.include vendor-models.lib'],
        ));

        expect(result.ready).toBe(false);
        expect(result.diagnostics).toContainEqual(expect.objectContaining({
            code: 'missing-value',
            componentId: 'R1',
        }));
        expect(result.diagnostics).toContainEqual(expect.objectContaining({
            code: 'missing-model',
            componentId: 'D1',
        }));
        expect(result.diagnostics).toContainEqual(expect.objectContaining({
            code: 'unsupported-directive',
        }));
        expect(result.diagnostics).toContainEqual(expect.objectContaining({
            code: 'floating-node',
        }));
    });

    test('recognizes runtime descriptors as realtime-runtime-descriptor support', () => {
        const result = analyzeSimulationReadiness(doc([
            component('U1', 'ic', [['input', 0, 0], ['output', 10, 0]], {
                RuntimeDescriptor: 'true',
                DescriptorType: 'microblock-delay-chip',
                DelayMs: { raw: '320 ms', value: 320, unit: 'ms' },
            }, 'Circuit.MicroBlockDelayChip'),
            component('GND', 'ground', [['t', 0, 10]]),
        ]));

        expect(result.componentSupport.get('U1')).toBe('realtime-runtime-descriptor');
        expect(result.diagnostics.find((diagnostic) => diagnostic.componentId === 'U1')).toBeUndefined();
    });
});
