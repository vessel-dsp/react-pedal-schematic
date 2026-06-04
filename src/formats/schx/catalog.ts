import type { ComponentKind, Point } from '../../model/types';

export type SchxTerminalLocal = Readonly<{ name: string; local: Point }>;

export type SchxComponentDef = Readonly<{
    shortType: string;
    kind: ComponentKind;
    terminals: readonly SchxTerminalLocal[];
    quantityProps: readonly string[];
}>;

const TWO_TERMINAL_AB: readonly SchxTerminalLocal[] = [
    { name: 'a', local: { x: 0, y: 20 } },
    { name: 'b', local: { x: 0, y: -20 } },
];

const TWO_TERMINAL_DIODE: readonly SchxTerminalLocal[] = [
    { name: 'anode', local: { x: 0, y: 20 } },
    { name: 'cathode', local: { x: 0, y: -20 } },
];

const TWO_TERMINAL_SOURCE: readonly SchxTerminalLocal[] = [
    { name: '+', local: { x: 0, y: 20 } },
    { name: '-', local: { x: 0, y: -20 } },
];

const SINGLE_TERMINAL: readonly SchxTerminalLocal[] = [
    { name: 't', local: { x: 0, y: 0 } },
];

const BJT_TERMINALS: readonly SchxTerminalLocal[] = [
    { name: 'collector', local: { x: 0, y: 20 } },
    { name: 'base', local: { x: -20, y: 0 } },
    { name: 'emitter', local: { x: 10, y: -20 } },
];

const JFET_TERMINALS: readonly SchxTerminalLocal[] = [
    { name: 'drain', local: { x: 0, y: 20 } },
    { name: 'gate', local: { x: -20, y: 0 } },
    { name: 'source', local: { x: 0, y: -20 } },
];

const LIVE_SPICE_JUNCTION_FET_TERMINALS: readonly SchxTerminalLocal[] = [
    { name: 'drain', local: { x: 10, y: 20 } },
    { name: 'gate', local: { x: -20, y: 0 } },
    { name: 'source', local: { x: 10, y: -20 } },
];

const MOSFET_TERMINALS: readonly SchxTerminalLocal[] = [
    { name: 'drain', local: { x: 0, y: 20 } },
    { name: 'gate', local: { x: -20, y: 0 } },
    { name: 'source', local: { x: 0, y: -20 } },
    { name: 'body', local: { x: 10, y: 0 } },
];

const OPAMP_TERMINALS: readonly SchxTerminalLocal[] = [
    { name: 'vin+', local: { x: -30, y: 10 } },
    { name: 'vin-', local: { x: -30, y: -10 } },
    { name: 'vout', local: { x: 30, y: 0 } },
    { name: 'vcc', local: { x: 0, y: 20 } },
    { name: 'vee', local: { x: 0, y: -20 } },
];

const TRIODE_TERMINALS: readonly SchxTerminalLocal[] = [
    { name: 'plate', local: { x: 0, y: 20 } },
    { name: 'grid', local: { x: -20, y: 0 } },
    { name: 'cathode', local: { x: -10, y: -20 } },
];

const PENTODE_TERMINALS: readonly SchxTerminalLocal[] = [
    { name: 'plate', local: { x: 0, y: 20 } },
    { name: 'screen', local: { x: 10, y: 10 } },
    { name: 'grid', local: { x: -20, y: 0 } },
    { name: 'cathode', local: { x: -10, y: -20 } },
    { name: 'suppressor', local: { x: 10, y: -10 } },
];

const POT_TERMINALS: readonly SchxTerminalLocal[] = [
    { name: 'a', local: { x: -10, y: 40 } },
    { name: 'wiper', local: { x: 10, y: 0 } },
    { name: 'b', local: { x: -10, y: -40 } },
];

const TRANSFORMER_TERMINALS: readonly SchxTerminalLocal[] = [
    { name: 'p+', local: { x: -10, y: 20 } },
    { name: 'p-', local: { x: -10, y: -20 } },
    { name: 's+', local: { x: 10, y: 20 } },
    { name: 's-', local: { x: 10, y: -20 } },
];

const CENTER_TAP_TRANSFORMER_TERMINALS: readonly SchxTerminalLocal[] = [
    ...TRANSFORMER_TERMINALS,
    { name: 'sct', local: { x: 10, y: 0 } },
];

const VOLTAGE_DEFINITION_TERMINALS: readonly SchxTerminalLocal[] = [
    { name: '+', local: { x: 0, y: -50 } },
    { name: '-', local: { x: 0, y: 50 } },
];

const DEFS: readonly SchxComponentDef[] = [
    { shortType: 'Resistor', kind: 'resistor', terminals: TWO_TERMINAL_AB, quantityProps: ['Resistance'] },
    { shortType: 'Capacitor', kind: 'capacitor', terminals: TWO_TERMINAL_AB, quantityProps: ['Capacitance'] },
    { shortType: 'Inductor', kind: 'inductor', terminals: TWO_TERMINAL_AB, quantityProps: ['Inductance'] },
    { shortType: 'Conductor', kind: 'unsupported', terminals: TWO_TERMINAL_AB, quantityProps: [] },
    { shortType: 'Buffer', kind: 'unsupported', terminals: TWO_TERMINAL_AB, quantityProps: [] },
    { shortType: 'Diode', kind: 'diode', terminals: TWO_TERMINAL_DIODE, quantityProps: ['IS', 'Is', 'N', 'n', 'Rs'] },
    { shortType: 'TubeDiode', kind: 'tube-diode', terminals: TWO_TERMINAL_DIODE, quantityProps: [] },
    { shortType: 'BipolarJunctionTransistor', kind: 'bjt', terminals: BJT_TERMINALS, quantityProps: ['IS', 'BF', 'BR', 'Is', 'Vt', 'Bf', 'Br', 'n'] },
    { shortType: 'NpnBjt', kind: 'bjt', terminals: BJT_TERMINALS, quantityProps: ['Is', 'Vt', 'Bf', 'Br'] },
    { shortType: 'PnpBjt', kind: 'bjt', terminals: BJT_TERMINALS, quantityProps: ['Is', 'Vt', 'Bf', 'Br'] },
    { shortType: 'Bjt', kind: 'bjt', terminals: BJT_TERMINALS, quantityProps: ['Is', 'Vt', 'Bf', 'Br'] },
    { shortType: 'NjfJfet', kind: 'jfet', terminals: JFET_TERMINALS, quantityProps: ['Is', 'Beta', 'Vt', 'Lambda'] },
    { shortType: 'PjfJfet', kind: 'jfet', terminals: JFET_TERMINALS, quantityProps: ['Is', 'Beta', 'Vt', 'Lambda'] },
    { shortType: 'Jfet', kind: 'jfet', terminals: JFET_TERMINALS, quantityProps: ['Is', 'Beta', 'Vt', 'Lambda'] },
    { shortType: 'JunctionFieldEffectTransistor', kind: 'jfet', terminals: LIVE_SPICE_JUNCTION_FET_TERMINALS, quantityProps: ['IS', 'Is', 'n', 'Vt0', 'Vt', 'Beta', 'Lambda'] },
    { shortType: 'NMosfet', kind: 'mosfet', terminals: MOSFET_TERMINALS, quantityProps: ['Vto', 'Kp', 'Lambda'] },
    { shortType: 'PMosfet', kind: 'mosfet', terminals: MOSFET_TERMINALS, quantityProps: ['Vto', 'Kp', 'Lambda'] },
    { shortType: 'Mosfet', kind: 'mosfet', terminals: MOSFET_TERMINALS, quantityProps: ['Vto', 'Kp', 'Lambda'] },
    { shortType: 'OpAmp', kind: 'opamp', terminals: OPAMP_TERMINALS, quantityProps: ['SupplyVoltage'] },
    { shortType: 'IdealOpAmp', kind: 'opamp', terminals: OPAMP_TERMINALS, quantityProps: [] },
    { shortType: 'Triode', kind: 'triode', terminals: TRIODE_TERMINALS, quantityProps: ['Mu', 'K', 'Kp', 'Kvb', 'Ex'] },
    { shortType: 'Pentode', kind: 'pentode', terminals: PENTODE_TERMINALS, quantityProps: ['Mu', 'K', 'Kp', 'Kvb', 'Ex'] },
    { shortType: 'Transformer', kind: 'transformer', terminals: TRANSFORMER_TERMINALS, quantityProps: ['Lp', 'Ls', 'k'] },
    { shortType: 'CenterTapTransformer', kind: 'transformer', terminals: CENTER_TAP_TRANSFORMER_TERMINALS, quantityProps: ['Turns'] },
    { shortType: 'Potentiometer', kind: 'potentiometer', terminals: POT_TERMINALS, quantityProps: ['Resistance', 'Wipe', 'Sweep'] },
    { shortType: 'VariableResistor', kind: 'variable-resistor', terminals: TWO_TERMINAL_AB, quantityProps: ['Resistance'] },
    { shortType: 'Switch', kind: 'switch', terminals: TWO_TERMINAL_AB, quantityProps: [] },
    { shortType: 'SPDT', kind: 'switch', terminals: BJT_TERMINALS, quantityProps: [] },
    { shortType: 'SP3T', kind: 'switch', terminals: BJT_TERMINALS, quantityProps: [] },
    { shortType: 'SP4T', kind: 'switch', terminals: BJT_TERMINALS, quantityProps: [] },
    { shortType: 'VoltageSource', kind: 'voltage-source', terminals: TWO_TERMINAL_SOURCE, quantityProps: ['Voltage'] },
    { shortType: 'CurrentSource', kind: 'current-source', terminals: TWO_TERMINAL_SOURCE, quantityProps: ['Current'] },
    { shortType: 'Battery', kind: 'battery', terminals: TWO_TERMINAL_SOURCE, quantityProps: ['Voltage'] },
    { shortType: 'Rail', kind: 'rail', terminals: SINGLE_TERMINAL, quantityProps: ['Voltage'] },
    { shortType: 'Ground', kind: 'ground', terminals: SINGLE_TERMINAL, quantityProps: [] },
    { shortType: 'VoltageDefinition', kind: 'unsupported', terminals: VOLTAGE_DEFINITION_TERMINALS, quantityProps: [] },
    { shortType: 'Input', kind: 'jack', terminals: TWO_TERMINAL_AB, quantityProps: ['V0dBFS'] },
    { shortType: 'Speaker', kind: 'jack', terminals: TWO_TERMINAL_AB, quantityProps: ['Impedance', 'V0dBFS'] },
    { shortType: 'NamedWire', kind: 'named-wire', terminals: SINGLE_TERMINAL, quantityProps: [] },
    { shortType: 'Label', kind: 'label', terminals: [], quantityProps: [] },
    { shortType: 'Port', kind: 'port', terminals: SINGLE_TERMINAL, quantityProps: [] },
];

const BY_SHORT_TYPE = new Map<string, SchxComponentDef>(DEFS.map((d) => [d.shortType, d]));
const BY_KIND = new Map<ComponentKind, SchxComponentDef>(
    DEFS.reduce<Array<[ComponentKind, SchxComponentDef]>>((acc, def) => {
        if (!acc.some(([k]) => k === def.kind)) {
            acc.push([def.kind, def]);
        }
        return acc;
    }, []),
);

export function shortenSchxType(fullType: string): string {
    if (fullType.includes('Circuit.Components.Diode')) {
        return 'TubeDiode';
    }
    const match = fullType.match(/Circuit\.(?:Components\.)?([A-Za-z0-9_]+)/);
    return match?.[1] ?? fullType;
}

export function lookupSchxDef(shortType: string): SchxComponentDef | undefined {
    return BY_SHORT_TYPE.get(shortType);
}

export function defaultDefForKind(kind: ComponentKind): SchxComponentDef | undefined {
    return BY_KIND.get(kind);
}

const CIRCUIT_ASSEMBLY = 'Circuit, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null';
export const SCHX_SYMBOL_ELEMENT_TYPE = `Circuit.Symbol, ${CIRCUIT_ASSEMBLY}`;
export const SCHX_WIRE_ELEMENT_TYPE = `Circuit.Wire, ${CIRCUIT_ASSEMBLY}`;

export function fullSchxType(shortType: string): string {
    if (shortType === 'TubeDiode') {
        return `Circuit.Components.Diode, ${CIRCUIT_ASSEMBLY}`;
    }
    const namespace = shortType === 'Pentode' ? 'Circuit.Components' : 'Circuit';
    return `${namespace}.${shortType}, ${CIRCUIT_ASSEMBLY}`;
}
