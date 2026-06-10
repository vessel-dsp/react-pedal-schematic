import { getPinNode, resolveConnectivity, type Connectivity, type NodeId } from '../../model/connectivity';
import { parseQuantity } from '../../model/quantity';
import type { CircuitDocument, Component, ComponentKind, ParsedQuantity, PropertyValue } from '../../model/types';

export type CircuitJsonExportTarget = 'tscircuit';

export type CircuitJsonExportOptions = Readonly<{
    target?: CircuitJsonExportTarget;
}>;

export type CircuitJsonSourceNet = Readonly<{
    type: 'source_net';
    source_net_id: string;
    name: string;
    member_source_group_ids: readonly string[];
    is_power?: boolean;
    is_ground?: boolean;
    is_digital_signal?: boolean;
    is_analog_signal?: boolean;
    is_positive_voltage_source?: boolean;
}>;

export type CircuitJsonSourceComponent = Readonly<{
    type: 'source_component';
    source_component_id: string;
    name: string;
    ftype?: string;
    display_name?: string;
    display_value?: string;
    resistance?: number;
    display_resistance?: string;
    capacitance?: number;
    display_capacitance?: string;
    inductance?: number;
    display_inductance?: string;
    voltage?: number;
    current?: number;
    wave_shape?: 'dc' | 'sine' | 'square' | 'triangle' | 'sawtooth' | 'sinewave';
    transistor_type?: 'npn' | 'pnp';
    channel_type?: 'n' | 'p';
    mosfet_mode?: 'enhancement' | 'depletion';
    max_resistance?: number;
    display_max_resistance?: string;
    manufacturer_part_number?: string;
}>;

export type CircuitJsonSourcePort = Readonly<{
    type: 'source_port';
    source_port_id: string;
    source_component_id: string;
    name: string;
    port_hints: readonly string[];
    provides_ground?: boolean;
    requires_ground?: boolean;
    provides_power?: boolean;
    requires_power?: boolean;
    provides_voltage?: number;
}>;

export type CircuitJsonSourceTrace = Readonly<{
    type: 'source_trace';
    source_trace_id: string;
    connected_source_port_ids: readonly string[];
    connected_source_net_ids: readonly string[];
    display_name?: string;
}>;

export type CircuitJsonElement =
    | CircuitJsonSourceNet
    | CircuitJsonSourceComponent
    | CircuitJsonSourcePort
    | CircuitJsonSourceTrace;

export type CircuitJsonExport = Readonly<{
    elements: readonly CircuitJsonElement[];
    warnings: readonly string[];
}>;

type QuantityLookup = Readonly<{
    value: ParsedQuantity;
}>;

type QuantityKey = 'resistance' | 'capacitance' | 'inductance' | 'voltage' | 'current';

const VALUE_PROPERTY_NAMES: Readonly<Record<QuantityKey, readonly string[]>> = {
    resistance: ['R', 'Resistance', 'resistance', 'value', 'Value'],
    capacitance: ['C', 'Capacitance', 'capacitance', 'value', 'Value'],
    inductance: ['L', 'Inductance', 'inductance', 'value', 'Value'],
    voltage: ['V', 'Voltage', 'voltage', 'value', 'Value'],
    current: ['I', 'Current', 'current', 'value', 'Value'],
};

const MODEL_PROPERTY_NAMES: readonly string[] = [
    'manufacturerPartNumber',
    'ManufacturerPartNumber',
    'manufacturer_part_number',
    'partNumber',
    'PartNumber',
    'model',
    'Model',
    'modelName',
    'ModelName',
];

const DIRECT_EXPORT_KINDS: ReadonlySet<ComponentKind> = new Set<ComponentKind>([
    'resistor',
    'variable-resistor',
    'capacitor',
    'inductor',
    'diode',
    'led',
    'bjt',
    'jfet',
    'mosfet',
    'opamp',
    'potentiometer',
    'switch',
    'voltage-source',
    'current-source',
    'battery',
    'ground',
    'rail',
    'jack',
    'port',
    'ic',
]);

const SOURCE_ONLY_NET_NAME_KINDS: ReadonlySet<ComponentKind> = new Set<ComponentKind>([
    'label',
    'named-wire',
]);

export function serializeCircuitJsonDocument(
    doc: CircuitDocument,
    _options: CircuitJsonExportOptions = {},
): CircuitJsonExport {
    const connectivity = resolveConnectivity(doc);
    const warnings: string[] = [];
    const exportedComponentIds = new Set<string>();
    const sourcePortIdsByNode = new Map<NodeId, string[]>();
    const names = netNames(doc, connectivity);
    const powerNodes = railNodeIds(doc, connectivity);

    const nets = sourceNetElements(connectivity, names, powerNodes);
    const components: CircuitJsonSourceComponent[] = [];
    const ports: CircuitJsonSourcePort[] = [];

    for (const component of doc.components) {
        const sourceComponent = sourceComponentElement(component, warnings);
        if (sourceComponent === null) {
            continue;
        }
        exportedComponentIds.add(component.id);
        components.push(sourceComponent);

        for (const terminal of component.terminals) {
            const nodeId = getPinNode(connectivity, {
                componentId: component.id,
                terminalName: terminal.name,
            });
            const sourcePort = sourcePortElement(component, terminal.name);
            ports.push(sourcePort);
            if (nodeId !== undefined) {
                appendSourcePort(sourcePortIdsByNode, nodeId, sourcePort.source_port_id);
            }
        }
    }

    const traces = sourceTraceElements(connectivity, names, sourcePortIdsByNode, warnings);
    warnings.push(...sourceOnlyWarnings(doc, exportedComponentIds));

    return {
        elements: [...nets, ...components, ...ports, ...traces],
        warnings,
    };
}

function sourceNetElements(
    connectivity: Connectivity,
    names: ReadonlyMap<NodeId, string>,
    powerNodes: ReadonlySet<NodeId>,
): readonly CircuitJsonSourceNet[] {
    const elements: CircuitJsonSourceNet[] = [];

    for (let nodeId = 0; nodeId < connectivity.nodeCount; nodeId += 1) {
        const isGround = connectivity.groundNodeId === nodeId;
        const isPower = powerNodes.has(nodeId);
        const name = names.get(nodeId) ?? (isGround ? 'GND' : `N${nodeId}`);
        elements.push({
            type: 'source_net',
            source_net_id: sourceNetId(nodeId),
            name,
            member_source_group_ids: [],
            ...(isGround ? { is_ground: true } : {}),
            ...(isPower ? { is_power: true, is_positive_voltage_source: true } : {}),
            is_analog_signal: true,
        });
    }

    return elements;
}

function sourceComponentElement(
    component: Component,
    warnings: string[],
): CircuitJsonSourceComponent | null {
    if (component.kind === 'unsupported') {
        warnings.push(
            `${component.id} (unsupported): unsupported source type ${component.sourceTypeName ?? 'unknown'} skipped from Circuit JSON export`,
        );
        return null;
    }
    if (SOURCE_ONLY_NET_NAME_KINDS.has(component.kind)) {
        return null;
    }
    if (!DIRECT_EXPORT_KINDS.has(component.kind)) {
        warnings.push(`${component.id} (${component.kind}): no Circuit JSON source-component mapping; skipped`);
        return null;
    }

    const base = sourceComponentBase(component);
    const manufacturerPartNumber = firstStringProperty(component, MODEL_PROPERTY_NAMES);

    switch (component.kind) {
        case 'resistor':
        case 'variable-resistor': {
            const resistance = quantity(component, 'resistance');
            if (resistance === null) {
                return missingQuantityComponent(component, 'resistance', warnings, manufacturerPartNumber);
            }
            return {
                ...base,
                ftype: 'simple_resistor',
                ...(manufacturerPartNumber !== null ? { manufacturer_part_number: manufacturerPartNumber } : {}),
                resistance: resistance.value.value,
                display_resistance: resistance.value.raw,
                display_value: resistance.value.raw,
            };
        }
        case 'capacitor': {
            const capacitance = quantity(component, 'capacitance');
            if (capacitance === null) {
                return missingQuantityComponent(component, 'capacitance', warnings, manufacturerPartNumber);
            }
            return {
                ...base,
                ftype: 'simple_capacitor',
                ...(manufacturerPartNumber !== null ? { manufacturer_part_number: manufacturerPartNumber } : {}),
                capacitance: capacitance.value.value,
                display_capacitance: capacitance.value.raw,
                display_value: capacitance.value.raw,
            };
        }
        case 'inductor': {
            const inductance = quantity(component, 'inductance');
            if (inductance === null) {
                return missingQuantityComponent(component, 'inductance', warnings, manufacturerPartNumber);
            }
            return {
                ...base,
                ftype: 'simple_inductor',
                ...(manufacturerPartNumber !== null ? { manufacturer_part_number: manufacturerPartNumber } : {}),
                inductance: inductance.value.value,
                display_inductance: inductance.value.raw,
                display_value: inductance.value.raw,
            };
        }
        case 'diode':
            return {
                ...base,
                ftype: 'simple_diode',
                ...(manufacturerPartNumber !== null ? { manufacturer_part_number: manufacturerPartNumber } : {}),
            };
        case 'led':
            return {
                ...base,
                ftype: 'simple_led',
                ...(manufacturerPartNumber !== null ? { manufacturer_part_number: manufacturerPartNumber } : {}),
            };
        case 'bjt':
            return {
                ...base,
                ftype: 'simple_transistor',
                transistor_type: inferTransistorType(component),
                ...(manufacturerPartNumber !== null ? { manufacturer_part_number: manufacturerPartNumber } : {}),
            };
        case 'jfet':
            warnings.push(
                `${component.id} (jfet): Circuit JSON has no simple_jfet ftype; emitted simple_mosfet depletion-mode source metadata`,
            );
            return {
                ...base,
                ftype: 'simple_mosfet',
                channel_type: inferJfetChannel(component),
                mosfet_mode: 'depletion',
                ...(manufacturerPartNumber !== null ? { manufacturer_part_number: manufacturerPartNumber } : {}),
            };
        case 'mosfet':
            return {
                ...base,
                ftype: 'simple_mosfet',
                channel_type: inferMosfetChannel(component),
                mosfet_mode: inferMosfetMode(component),
                ...(manufacturerPartNumber !== null ? { manufacturer_part_number: manufacturerPartNumber } : {}),
            };
        case 'opamp':
            return {
                ...base,
                ftype: 'simple_op_amp',
                ...(manufacturerPartNumber !== null ? { manufacturer_part_number: manufacturerPartNumber } : {}),
            };
        case 'potentiometer': {
            const resistance = quantity(component, 'resistance');
            if (resistance === null) {
                return missingQuantityComponent(component, 'resistance', warnings, manufacturerPartNumber);
            }
            return {
                ...base,
                ftype: 'simple_potentiometer',
                ...(manufacturerPartNumber !== null ? { manufacturer_part_number: manufacturerPartNumber } : {}),
                max_resistance: resistance.value.value,
                display_max_resistance: resistance.value.raw,
                display_value: resistance.value.raw,
            };
        }
        case 'switch':
            return { ...base, ftype: 'simple_switch' };
        case 'voltage-source':
        case 'battery': {
            const voltage = quantity(component, 'voltage');
            if (voltage === null) {
                return missingQuantityComponent(component, 'voltage', warnings, null);
            }
            return {
                ...base,
                ftype: 'simple_voltage_source',
                voltage: voltage.value.value,
                display_value: voltage.value.raw,
            };
        }
        case 'rail': {
            const voltage = quantity(component, 'voltage');
            if (voltage === null) {
                return missingQuantityComponent(component, 'voltage', warnings, null);
            }
            return {
                ...base,
                ftype: 'simple_power_source',
                voltage: voltage.value.value,
                display_value: voltage.value.raw,
            };
        }
        case 'current-source': {
            const current = quantity(component, 'current');
            if (current === null) {
                return missingQuantityComponent(component, 'current', warnings, null);
            }
            return {
                ...base,
                ftype: 'simple_current_source',
                wave_shape: 'dc',
                current: current.value.value,
                display_value: current.value.raw,
            };
        }
        case 'ground':
            return { ...base, ftype: 'simple_ground' };
        case 'jack':
            return { ...base, ftype: 'simple_connector' };
        case 'port':
            return { ...base, ftype: 'simple_test_point' };
        case 'ic':
            return {
                ...base,
                ftype: 'simple_chip',
                ...(manufacturerPartNumber !== null ? { manufacturer_part_number: manufacturerPartNumber } : {}),
            };
        case 'ota':
        case 'triode':
        case 'pentode':
        case 'tube-diode':
        case 'transformer':
        case 'optocoupler':
        case 'bbd':
        case 'delay-ic':
        case 'power-amp':
        case 'regulator':
        case 'analog-switch':
        case 'flipflop':
        case 'label':
        case 'named-wire':
            warnings.push(`${component.id} (${component.kind}): no Circuit JSON source-component mapping; skipped`);
            return null;
    }
}

function sourceComponentBase(component: Component): CircuitJsonSourceComponent {
    return {
        type: 'source_component',
        source_component_id: sourceComponentId(component.id),
        name: component.name,
        display_name: component.name,
    };
}

function sourcePortElement(component: Component, terminalName: string): CircuitJsonSourcePort {
    const voltage = component.kind === 'rail' ? quantity(component, 'voltage') : null;
    return {
        type: 'source_port',
        source_port_id: sourcePortId(component.id, terminalName),
        source_component_id: sourceComponentId(component.id),
        name: terminalName,
        port_hints: [terminalName],
        ...(component.kind === 'ground' ? { provides_ground: true } : {}),
        ...(component.kind === 'rail' ? { provides_power: true } : {}),
        ...(voltage !== null ? { provides_voltage: voltage.value.value } : {}),
    };
}

function sourceTraceElements(
    connectivity: Connectivity,
    names: ReadonlyMap<NodeId, string>,
    sourcePortIdsByNode: ReadonlyMap<NodeId, readonly string[]>,
    warnings: string[],
): readonly CircuitJsonSourceTrace[] {
    const traces: CircuitJsonSourceTrace[] = [];

    for (let nodeId = 0; nodeId < connectivity.nodeCount; nodeId += 1) {
        const sourcePortIds = sourcePortIdsByNode.get(nodeId) ?? [];
        if (sourcePortIds.length === 0) {
            warnings.push(`${sourceNetId(nodeId)}: no exported source ports reference this resolved node`);
            continue;
        }
        traces.push({
            type: 'source_trace',
            source_trace_id: sourceTraceId(nodeId),
            connected_source_port_ids: sourcePortIds,
            connected_source_net_ids: [sourceNetId(nodeId)],
            display_name: names.get(nodeId) ?? (connectivity.groundNodeId === nodeId ? 'GND' : `N${nodeId}`),
        });
    }

    return traces;
}

function netNames(doc: CircuitDocument, connectivity: Connectivity): ReadonlyMap<NodeId, string> {
    const names = new Map<NodeId, string>();
    for (const component of doc.components) {
        if (component.terminals.length === 0) {
            continue;
        }
        if (component.kind !== 'rail' && component.kind !== 'named-wire' && component.kind !== 'label') {
            continue;
        }
        const terminal = component.terminals[0];
        if (terminal === undefined) {
            continue;
        }
        const nodeId = getPinNode(connectivity, {
            componentId: component.id,
            terminalName: terminal.name,
        });
        if (nodeId !== undefined && !names.has(nodeId)) {
            names.set(nodeId, component.name);
        }
    }
    if (connectivity.groundNodeId !== null) {
        names.set(connectivity.groundNodeId, 'GND');
    }
    return names;
}

function railNodeIds(doc: CircuitDocument, connectivity: Connectivity): ReadonlySet<NodeId> {
    const ids = new Set<NodeId>();
    for (const component of doc.components) {
        if (component.kind !== 'rail') {
            continue;
        }
        for (const terminal of component.terminals) {
            const nodeId = getPinNode(connectivity, {
                componentId: component.id,
                terminalName: terminal.name,
            });
            if (nodeId !== undefined) {
                ids.add(nodeId);
            }
        }
    }
    return ids;
}

function sourceOnlyWarnings(
    doc: CircuitDocument,
    exportedComponentIds: ReadonlySet<string>,
): readonly string[] {
    const warnings: string[] = [];
    for (const component of doc.components) {
        if (exportedComponentIds.has(component.id)) {
            continue;
        }
        if (SOURCE_ONLY_NET_NAME_KINDS.has(component.kind)) {
            warnings.push(`${component.id} (${component.kind}): used for net naming only; no Circuit JSON source component emitted`);
        }
    }
    return warnings;
}

function appendSourcePort(map: Map<NodeId, string[]>, nodeId: NodeId, sourcePortIdValue: string): void {
    const existing = map.get(nodeId);
    if (existing === undefined) {
        map.set(nodeId, [sourcePortIdValue]);
        return;
    }
    existing.push(sourcePortIdValue);
}

function quantity(component: Component, key: QuantityKey): QuantityLookup | null {
    const names = VALUE_PROPERTY_NAMES[key];
    for (const name of names) {
        const value = component.properties[name];
        const parsed = propertyQuantity(value);
        if (parsed !== null) {
            return { value: parsed };
        }
    }
    return null;
}

function propertyQuantity(value: PropertyValue | undefined): ParsedQuantity | null {
    if (value === undefined) {
        return null;
    }
    if (typeof value === 'string') {
        return parseQuantity(value);
    }
    return value;
}

function missingQuantityComponent(
    component: Component,
    quantityName: string,
    warnings: string[],
    manufacturerPartNumber: string | null,
): CircuitJsonSourceComponent {
    warnings.push(`${component.id} (${component.kind}): missing ${quantityName}; emitted opaque simple_chip source component metadata only`);
    return {
        ...sourceComponentBase(component),
        ftype: 'simple_chip',
        ...(manufacturerPartNumber !== null ? { manufacturer_part_number: manufacturerPartNumber } : {}),
    };
}

function firstStringProperty(component: Component, names: readonly string[]): string | null {
    for (const name of names) {
        const value = component.properties[name];
        if (typeof value === 'string' && value.trim().length > 0) {
            return value;
        }
    }
    return null;
}

function inferTransistorType(component: Component): 'npn' | 'pnp' {
    const searchable = searchablePropertyText(component);
    return searchable.includes('pnp') ? 'pnp' : 'npn';
}

function inferMosfetChannel(component: Component): 'n' | 'p' {
    const searchable = searchablePropertyText(component);
    return searchable.includes('pmos') || searchable.includes('p-channel') || searchable.includes('p channel') ? 'p' : 'n';
}

function inferJfetChannel(component: Component): 'n' | 'p' {
    const searchable = searchablePropertyText(component);
    return searchable.includes('pjf') || searchable.includes('p-channel') || searchable.includes('p channel') ? 'p' : 'n';
}

function inferMosfetMode(component: Component): 'enhancement' | 'depletion' {
    const searchable = searchablePropertyText(component);
    return searchable.includes('depletion') ? 'depletion' : 'enhancement';
}

function searchablePropertyText(component: Component): string {
    const values: string[] = [component.name, component.sourceTypeName ?? ''];
    for (const value of Object.values(component.properties)) {
        values.push(typeof value === 'string' ? value : value.raw);
    }
    return values.join(' ').toLowerCase();
}

function sourceComponentId(componentId: string): string {
    return `source_component:${componentId}`;
}

function sourcePortId(componentId: string, terminalName: string): string {
    return `source_port:${componentId}:${terminalName}`;
}

function sourceNetId(nodeId: NodeId): string {
    return `source_net:${nodeId}`;
}

function sourceTraceId(nodeId: NodeId): string {
    return `source_trace:${nodeId}`;
}
