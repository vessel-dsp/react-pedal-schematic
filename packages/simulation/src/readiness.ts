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
} from '@vessel-dsp/core';
import { supportLevelForComponent } from './support-matrix';
import type { SimulationDiagnostic, SimulationReadiness } from './types';

const REQUIRED_VALUE_PROPERTIES: Partial<Record<ComponentKind, readonly string[]>> = {
    resistor: ['R', 'Resistance', 'resistance', 'value', 'Value'],
    'variable-resistor': ['R', 'Resistance', 'resistance', 'value', 'Value'],
    capacitor: ['C', 'Capacitance', 'capacitance', 'value', 'Value'],
    inductor: ['L', 'Inductance', 'inductance', 'value', 'Value'],
    'voltage-source': ['V', 'Voltage', 'voltage', 'value', 'Value'],
    'current-source': ['I', 'Current', 'current', 'value', 'Value'],
    battery: ['V', 'Voltage', 'voltage', 'value', 'Value'],
    rail: ['V', 'Voltage', 'voltage', 'value', 'Value'],
};

const MODEL_KINDS: ReadonlySet<ComponentKind> = new Set<ComponentKind>([
    'diode',
    'led',
    'bjt',
    'jfet',
    'mosfet',
]);

const MODEL_PROPERTIES: readonly string[] = [
    'model',
    'Model',
    'modelName',
    'ModelName',
    'partNumber',
    'PartNumber',
    'Type',
];

const UNSUPPORTED_DIRECTIVE_PREFIXES: readonly string[] = [
    '.include',
    '.lib',
    '.param',
    '.step',
    '.subckt',
];

export function analyzeSimulationReadiness(doc: CircuitDocument): SimulationReadiness {
    const diagnostics: SimulationDiagnostic[] = [];
    const connectivity = resolveConnectivity(doc);
    const componentSupport = new Map<string, ReturnType<typeof supportLevelForComponent>>();

    if (doc.components.length > 0 && connectivity.groundNodeId === null) {
        diagnostics.push({
            code: 'missing-ground',
            severity: 'error',
            message: 'Document has no resolved ground node',
        });
    }

    for (const component of doc.components) {
        const support = supportLevelForComponent(component);
        componentSupport.set(component.id, support);

        if (support === 'unsupported') {
            diagnostics.push({
                code: 'unsupported-component',
                severity: 'error',
                message: `${component.id}: ${component.sourceTypeName ?? component.kind} is not supported by simulation V1`,
                componentId: component.id,
            });
            continue;
        }

        const missingValueProperty = missingRequiredValueProperty(component);
        if (missingValueProperty !== null) {
            diagnostics.push({
                code: 'missing-value',
                severity: 'error',
                message: `${component.id}: missing required value property ${missingValueProperty}`,
                componentId: component.id,
            });
        }

        if (MODEL_KINDS.has(component.kind) && missingModel(component)) {
            diagnostics.push({
                code: 'missing-model',
                severity: 'error',
                message: `${component.id}: missing required model property`,
                componentId: component.id,
            });
        }
    }

    for (const directive of doc.directives) {
        const normalized = directive.trim().toLowerCase();
        if (UNSUPPORTED_DIRECTIVE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
            diagnostics.push({
                code: 'unsupported-directive',
                severity: 'error',
                message: `Unsupported simulation directive: ${directive}`,
                directive,
            });
        }
    }

    diagnostics.push(...floatingNodeDiagnostics(connectivity, doc));

    return {
        ready: diagnostics.every((diagnostic) => diagnostic.severity !== 'error'),
        diagnostics,
        componentSupport,
    };
}

function missingRequiredValueProperty(component: Component): string | null {
    const propertyNames = REQUIRED_VALUE_PROPERTIES[component.kind];
    if (propertyNames === undefined) {
        return null;
    }

    for (const propertyName of propertyNames) {
        const value = component.properties[propertyName];
        if (propertyQuantityValue(value) !== null) {
            return null;
        }
    }

    return propertyNames[0] ?? 'value';
}

function missingModel(component: Component): boolean {
    for (const propertyName of MODEL_PROPERTIES) {
        const value = propertyStringValue(component.properties[propertyName]);
        if (value !== null && value.trim().length > 0) {
            return false;
        }
    }
    return true;
}

function floatingNodeDiagnostics(
    connectivity: Connectivity,
    doc: CircuitDocument,
): readonly SimulationDiagnostic[] {
    const diagnostics: SimulationDiagnostic[] = [];
    const anchoredNodes = anchoredNodeIds(connectivity, doc);

    for (const [nodeId, members] of connectivity.nodeMembers) {
        if (nodeId === connectivity.groundNodeId || anchoredNodes.has(nodeId)) {
            continue;
        }
        if (members.length <= 1) {
            diagnostics.push({
                code: 'floating-node',
                severity: 'error',
                message: `Node ${nodeId} has only one connected terminal`,
                nodeId,
            });
        }
    }

    return diagnostics;
}

function anchoredNodeIds(connectivity: Connectivity, doc: CircuitDocument): ReadonlySet<NodeId> {
    const nodeIds = new Set<NodeId>();
    for (const component of doc.components) {
        if (component.kind !== 'jack' && component.kind !== 'port') {
            continue;
        }
        for (const terminal of component.terminals) {
            const node = getPinNode(connectivity, {
                componentId: component.id,
                terminalName: terminal.name,
            });
            if (node !== undefined) {
                nodeIds.add(node);
            }
        }
    }
    return nodeIds;
}
