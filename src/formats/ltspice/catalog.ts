import type { ComponentKind, Point } from '../../model/types';

export type LtspiceTerminalDef = Readonly<{ name: string; local: Point }>;

export type LtspiceSymbolDef = Readonly<{
    symbolName: string;
    kind: ComponentKind;
    terminals: readonly LtspiceTerminalDef[];
    valueProperty: string | null;
    modelFromValue: boolean;
}>;

const TWO_PIN_LTSPICE: readonly LtspiceTerminalDef[] = [
    { name: 'a', local: { x: 16, y: 0 } },
    { name: 'b', local: { x: 16, y: 64 } },
];

const TWO_PIN_SOURCE: readonly LtspiceTerminalDef[] = [
    { name: '+', local: { x: 0, y: 0 } },
    { name: '-', local: { x: 0, y: 96 } },
];

const TWO_PIN_DIODE: readonly LtspiceTerminalDef[] = [
    { name: 'anode', local: { x: 0, y: 0 } },
    { name: 'cathode', local: { x: 0, y: 64 } },
];

const THREE_PIN_TRANSISTOR: readonly LtspiceTerminalDef[] = [
    { name: 'collector', local: { x: 16, y: 0 } },
    { name: 'base', local: { x: 0, y: 32 } },
    { name: 'emitter', local: { x: 16, y: 64 } },
];

const THREE_PIN_FET: readonly LtspiceTerminalDef[] = [
    { name: 'drain', local: { x: 16, y: 0 } },
    { name: 'gate', local: { x: 0, y: 32 } },
    { name: 'source', local: { x: 16, y: 64 } },
];

const FOUR_PIN_MOSFET: readonly LtspiceTerminalDef[] = [
    { name: 'drain', local: { x: 16, y: 0 } },
    { name: 'gate', local: { x: 0, y: 32 } },
    { name: 'source', local: { x: 16, y: 64 } },
    { name: 'body', local: { x: 32, y: 32 } },
];

const DEFS: readonly LtspiceSymbolDef[] = [
    { symbolName: 'res', kind: 'resistor', terminals: TWO_PIN_LTSPICE, valueProperty: 'R', modelFromValue: false },
    { symbolName: 'res2', kind: 'resistor', terminals: TWO_PIN_LTSPICE, valueProperty: 'R', modelFromValue: false },
    { symbolName: 'cap', kind: 'capacitor', terminals: TWO_PIN_LTSPICE, valueProperty: 'C', modelFromValue: false },
    { symbolName: 'cap2', kind: 'capacitor', terminals: TWO_PIN_LTSPICE, valueProperty: 'C', modelFromValue: false },
    { symbolName: 'ind', kind: 'inductor', terminals: TWO_PIN_LTSPICE, valueProperty: 'L', modelFromValue: false },
    { symbolName: 'diode', kind: 'diode', terminals: TWO_PIN_DIODE, valueProperty: null, modelFromValue: true },
    { symbolName: 'led', kind: 'led', terminals: TWO_PIN_DIODE, valueProperty: null, modelFromValue: true },
    { symbolName: 'zener', kind: 'diode', terminals: TWO_PIN_DIODE, valueProperty: null, modelFromValue: true },
    { symbolName: 'voltage', kind: 'voltage-source', terminals: TWO_PIN_SOURCE, valueProperty: 'V', modelFromValue: false },
    { symbolName: 'current', kind: 'current-source', terminals: TWO_PIN_SOURCE, valueProperty: 'I', modelFromValue: false },
    { symbolName: 'npn', kind: 'bjt', terminals: THREE_PIN_TRANSISTOR, valueProperty: null, modelFromValue: true },
    { symbolName: 'pnp', kind: 'bjt', terminals: THREE_PIN_TRANSISTOR, valueProperty: null, modelFromValue: true },
    { symbolName: 'njf', kind: 'jfet', terminals: THREE_PIN_FET, valueProperty: null, modelFromValue: true },
    { symbolName: 'pjf', kind: 'jfet', terminals: THREE_PIN_FET, valueProperty: null, modelFromValue: true },
    { symbolName: 'nmos', kind: 'mosfet', terminals: FOUR_PIN_MOSFET, valueProperty: null, modelFromValue: true },
    { symbolName: 'pmos', kind: 'mosfet', terminals: FOUR_PIN_MOSFET, valueProperty: null, modelFromValue: true },
];

const BY_SYMBOL = new Map<string, LtspiceSymbolDef>(DEFS.map((def) => [def.symbolName, def]));

export function normalizeLtspiceSymbolName(symbolName: string): string {
    const pathParts = symbolName.replaceAll('\\', '/').split('/');
    const base = pathParts[pathParts.length - 1] ?? symbolName;
    return base.replace(/\.asy$/i, '').toLowerCase();
}

export function lookupLtspiceSymbolDef(symbolName: string): LtspiceSymbolDef | undefined {
    return BY_SYMBOL.get(normalizeLtspiceSymbolName(symbolName));
}

export function mapLtspiceTerminal(local: Point, placement: Point, orientation: string): Point {
    const mirrored = orientation.toUpperCase().startsWith('M');
    const degrees = parseOrientationDegrees(orientation);
    const x = mirrored ? -local.x : local.x;
    const y = local.y;

    switch (degrees) {
        case 0:
            return { x: placement.x + x, y: placement.y + y };
        case 90:
            return { x: placement.x + y, y: placement.y - x };
        case 180:
            return { x: placement.x - x, y: placement.y - y };
        case 270:
            return { x: placement.x - y, y: placement.y + x };
    }
}

function parseOrientationDegrees(orientation: string): 0 | 90 | 180 | 270 {
    const match = orientation.toUpperCase().match(/[MR](0|90|180|270)$/);
    if (match?.[1] === '90') {
        return 90;
    }
    if (match?.[1] === '180') {
        return 180;
    }
    if (match?.[1] === '270') {
        return 270;
    }
    return 0;
}
