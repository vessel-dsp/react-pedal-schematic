import type { ComponentKind, PropertyValue } from '@vessel-dsp/core';
import type { SimulationSupportLevel } from './types';

export type SupportProbe = Readonly<{
    kind: ComponentKind;
    properties: Readonly<Record<string, PropertyValue>>;
    sourceTypeName: string | null;
}>;

const STATIC_NETLIST_KINDS: ReadonlySet<ComponentKind> = new Set<ComponentKind>([
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
    'label',
    'named-wire',
    'port',
]);

export function supportLevelForComponent(component: SupportProbe): SimulationSupportLevel {
    if (component.kind === 'ic' && isRuntimeDescriptor(component.properties)) {
        return 'realtime-runtime-descriptor';
    }

    if (STATIC_NETLIST_KINDS.has(component.kind)) {
        return 'static-netlist';
    }

    return 'unsupported';
}

export function isRuntimeDescriptor(properties: Readonly<Record<string, PropertyValue>>): boolean {
    const raw = properties.RuntimeDescriptor;
    return raw === true || raw === 'true';
}
