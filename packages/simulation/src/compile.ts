import {
    getPinNode,
    propertyQuantityValue,
    propertyStringValue,
    resolveConnectivity,
    type CircuitDocument,
    type Component,
    type ComponentKind,
    type Connectivity,
    type NodeId,
    type ParsedQuantity,
} from '@vessel-dsp/core';
import { analyzeSimulationReadiness } from './readiness';
import { isRuntimeDescriptor, supportLevelForComponent } from './support-matrix';
import type {
    RuntimeDescriptorSimulationBlock,
    SimulationBlock,
    SimulationCompileResult,
    SimulationNode,
    StaticNetlistSimulationBlock,
} from './types';

const SKIP_BLOCK_KINDS: ReadonlySet<ComponentKind> = new Set<ComponentKind>([
    'ground',
    'label',
    'named-wire',
    'port',
    'jack',
]);

const NODE_ORDER: Partial<Record<ComponentKind, readonly string[]>> = {
    resistor: ['a', 'b'],
    'variable-resistor': ['a', 'b'],
    capacitor: ['a', 'b'],
    inductor: ['a', 'b'],
    diode: ['anode', 'cathode'],
    led: ['anode', 'cathode'],
    'tube-diode': ['anode', 'cathode'],
    bjt: ['collector', 'base', 'emitter'],
    jfet: ['drain', 'gate', 'source'],
    mosfet: ['drain', 'gate', 'source', 'body'],
    'voltage-source': ['+', '-'],
    'current-source': ['+', '-'],
    battery: ['+', '-'],
    rail: ['t'],
    opamp: ['vin+', 'vin-', 'vout', 'vcc', 'vee'],
    triode: ['plate', 'grid', 'cathode'],
    pentode: ['plate', 'screen', 'grid', 'cathode', 'suppressor'],
};

const VALUE_PROPERTIES: Partial<Record<ComponentKind, readonly string[]>> = {
    resistor: ['R', 'Resistance', 'resistance', 'value', 'Value'],
    'variable-resistor': ['R', 'Resistance', 'resistance', 'value', 'Value'],
    capacitor: ['C', 'Capacitance', 'capacitance', 'value', 'Value'],
    inductor: ['L', 'Inductance', 'inductance', 'value', 'Value'],
    'voltage-source': ['V', 'Voltage', 'voltage', 'value', 'Value'],
    'current-source': ['I', 'Current', 'current', 'value', 'Value'],
    battery: ['V', 'Voltage', 'voltage', 'value', 'Value'],
    rail: ['V', 'Voltage', 'voltage', 'value', 'Value'],
};

const MODEL_PROPERTIES: readonly string[] = [
    'model',
    'Model',
    'modelName',
    'ModelName',
    'partNumber',
    'PartNumber',
    'Type',
];

export function compileSimulationProgram(doc: CircuitDocument): SimulationCompileResult {
    const readiness = analyzeSimulationReadiness(doc);
    const connectivity = resolveConnectivity(doc);
    const blocks: SimulationBlock[] = [];

    for (const component of doc.components) {
        if (SKIP_BLOCK_KINDS.has(component.kind)) {
            continue;
        }

        const supportLevel = supportLevelForComponent(component);
        if (supportLevel === 'unsupported') {
            continue;
        }

        if (component.kind === 'ic' && isRuntimeDescriptor(component.properties)) {
            blocks.push(runtimeDescriptorBlock(component, connectivity));
            continue;
        }

        blocks.push(staticNetlistBlock(component, connectivity));
    }

    return {
        diagnostics: readiness.diagnostics,
        program: {
            version: 'simulation-program/v1',
            nodes: simulationNodes(connectivity),
            groundNodeId: connectivity.groundNodeId,
            blocks,
        },
    };
}

function runtimeDescriptorBlock(
    component: Component,
    connectivity: Connectivity,
): RuntimeDescriptorSimulationBlock {
    return {
        id: component.id,
        kind: 'runtime-descriptor',
        descriptorType: descriptorType(component),
        sourceTypeName: component.sourceTypeName,
        nodes: orderedNodes(component, connectivity, ['input', 'output']),
        properties: component.properties,
    };
}

function staticNetlistBlock(
    component: Component,
    connectivity: Connectivity,
): StaticNetlistSimulationBlock {
    return {
        id: component.id,
        kind: 'static-netlist',
        componentKind: component.kind,
        supportLevel: supportLevelForComponent(component),
        nodes: orderedNodes(component, connectivity, NODE_ORDER[component.kind] ?? null),
        value: componentValue(component),
        model: componentModel(component),
        properties: component.properties,
    };
}

function descriptorType(component: Component): string {
    const raw = component.properties.DescriptorType;
    const text = propertyStringValue(raw);
    if (text !== null && text.trim().length > 0) {
        return text;
    }
    return component.sourceTypeName?.replace(/^Circuit\./, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
        ?? 'runtime-descriptor';
}

function orderedNodes(
    component: Component,
    connectivity: Connectivity,
    expected: readonly string[] | null,
): readonly NodeId[] {
    if (expected === null) {
        return component.terminals.flatMap((terminal) => {
            const node = getPinNode(connectivity, {
                componentId: component.id,
                terminalName: terminal.name,
            });
            return node === undefined ? [] : [node];
        });
    }

    const nodes: NodeId[] = [];
    for (const terminalName of expected) {
        const node = getPinNode(connectivity, {
            componentId: component.id,
            terminalName,
        });
        if (node !== undefined) {
            nodes.push(node);
        }
    }

    return nodes;
}

function componentValue(component: Component): ParsedQuantity | null {
    const propertyNames = VALUE_PROPERTIES[component.kind] ?? [];
    for (const propertyName of propertyNames) {
        const value = propertyQuantityValue(component.properties[propertyName]);
        if (value !== null) {
            return value;
        }
    }
    return null;
}

function componentModel(component: Component): string | null {
    for (const propertyName of MODEL_PROPERTIES) {
        const value = propertyStringValue(component.properties[propertyName]);
        if (value !== null && value.trim().length > 0) {
            return value;
        }
    }
    return null;
}

function simulationNodes(connectivity: Connectivity): readonly SimulationNode[] {
    return Array.from(connectivity.nodeMembers.entries())
        .sort(([a], [b]) => a - b)
        .map(([id, members]) => ({
            id,
            members: members.map((member) => `${member.componentId}:${member.terminalName}`).sort(),
        }));
}
