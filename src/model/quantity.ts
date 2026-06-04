import type { ParsedQuantity } from './types';

const SI_PREFIXES: Readonly<Record<string, number>> = {
    f: 1e-15,
    p: 1e-12,
    n: 1e-9,
    u: 1e-6,
    'µ': 1e-6, // MICRO SIGN
    'μ': 1e-6, // GREEK SMALL LETTER MU — LiveSPICE writes "μF" with this codepoint
    m: 1e-3,
    k: 1e3,
    K: 1e3,
    M: 1e6,
    G: 1e9,
    T: 1e12,
};

const UNIT_ALIASES: Readonly<Record<string, string>> = {
    F: 'F',
    f: 'F',
    H: 'H',
    h: 'H',
    V: 'V',
    v: 'V',
    A: 'A',
    a: 'A',
    W: 'W',
    w: 'W',
    'Ω': 'Ω', // GREEK CAPITAL LETTER OMEGA — canonical form
    'Ω': 'Ω', // OHM SIGN — LiveSPICE writes "Ω" with this codepoint; canonicalize
    ohm: 'Ω',
    Ohm: 'Ω',
    OHM: 'Ω',
    ohms: 'Ω',
    Hz: 'Hz',
    HZ: 'Hz',
    hz: 'Hz',
    s: 's',
    S: 's',
};

const QUANTITY_REGEX = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)([A-Za-zµμΩΩ]*)$/;
const SPICE_MEG = /^(?:Meg|MEG|meg)/;

export function parseQuantity(input: string): ParsedQuantity | null {
    const raw = input.trim();
    if (raw.length === 0) {
        return null;
    }

    const compact = raw.replace(/\s+/g, '');
    const match = compact.match(QUANTITY_REGEX);
    if (!match) {
        return null;
    }

    const numStr = match[1];
    const suffix = match[2] ?? '';
    if (numStr === undefined) {
        return null;
    }

    const baseValue = Number.parseFloat(numStr);
    if (!Number.isFinite(baseValue)) {
        return null;
    }

    const parsed = parseSuffix(suffix);

    return {
        raw,
        value: baseValue * parsed.multiplier,
        unit: parsed.unit,
    };
}

function parseSuffix(suffix: string): { multiplier: number; unit: string } {
    if (suffix.length === 0) {
        return { multiplier: 1, unit: '' };
    }

    // SPICE convention: "Meg" / "MEG" / "meg" = 1e6, distinct from milli "m".
    // Match before the single-char prefix loop so "meg" doesn't get read as milli + "eg".
    const megMatch = SPICE_MEG.exec(suffix);
    if (megMatch) {
        const rest = suffix.slice(megMatch[0].length);
        if (rest.length === 0) {
            return { multiplier: 1e6, unit: '' };
        }
        const restUnit = UNIT_ALIASES[rest];
        return { multiplier: 1e6, unit: restUnit ?? rest };
    }

    const first = suffix.charAt(0);
    const rest = suffix.slice(1);
    const prefixMultiplier = SI_PREFIXES[first];

    if (prefixMultiplier !== undefined) {
        if (rest.length === 0) {
            return { multiplier: prefixMultiplier, unit: '' };
        }
        const restUnit = UNIT_ALIASES[rest];
        if (restUnit !== undefined) {
            return { multiplier: prefixMultiplier, unit: restUnit };
        }
    }

    const fullUnit = UNIT_ALIASES[suffix];
    if (fullUnit !== undefined) {
        return { multiplier: 1, unit: fullUnit };
    }

    return { multiplier: 1, unit: suffix };
}
