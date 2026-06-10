import { describe, expect, test } from 'bun:test';
import {
    getRulesForKind,
    hasErrors,
    validateComponent,
    validateDocument,
} from '../../src/model/validation';
import {
    EMPTY_DOCUMENT,
    type CircuitDocument,
    type Component,
    type ComponentKind,
    type Point,
    type PropertyValue,
    type Wire,
} from '../../src/model/types';

function makeComponent(
    id: string,
    kind: ComponentKind,
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
        terminals: [
            { name: 'a', position: { x: 0, y: 0 } },
            { name: 'b', position: { x: 0, y: 10 } },
        ],
        properties,
        sourceTypeName,
    };
}

function makeWire(id: string, a: Point, b: Point): Wire {
    return { id, endpoints: [a, b] };
}

function withParts(components: readonly Component[], wires: readonly Wire[] = []): CircuitDocument {
    return { ...EMPTY_DOCUMENT, components, wires };
}

describe('validateDocument', () => {
    test('empty document has no issues', () => {
        expect(validateDocument(EMPTY_DOCUMENT)).toEqual([]);
    });

    test('valid resistor with R=10k passes', () => {
        const doc = withParts([makeComponent('R1', 'resistor', { R: '10k' })]);
        expect(validateDocument(doc)).toEqual([]);
    });

    test('valid resistor accepts ParsedQuantity directly', () => {
        const doc = withParts([
            makeComponent('R1', 'resistor', { R: { raw: '10kΩ', value: 10000, unit: 'Ω' } }),
        ]);
        expect(validateDocument(doc)).toEqual([]);
    });

    test('resistor missing R emits value-required error', () => {
        const doc = withParts([makeComponent('R1', 'resistor', {})]);
        const issues = validateDocument(doc);
        expect(issues).toHaveLength(1);
        expect(issues[0]?.code).toBe('value-required');
        expect(issues[0]?.severity).toBe('error');
        expect(issues[0]?.componentId).toBe('R1');
        expect(issues[0]?.property).toBe('R');
    });

    test('resistor with R=0 emits value-out-of-range', () => {
        const doc = withParts([makeComponent('R1', 'resistor', { R: '0' })]);
        const issues = validateDocument(doc);
        expect(issues.some((i) => i.code === 'value-out-of-range')).toBe(true);
    });

    test('resistor with negative R emits value-out-of-range', () => {
        const doc = withParts([makeComponent('R1', 'resistor', { R: '-100' })]);
        const issues = validateDocument(doc);
        expect(issues.some((i) => i.code === 'value-out-of-range')).toBe(true);
    });

    test('resistor with R=2.2G emits value-out-of-range (above max)', () => {
        const doc = withParts([makeComponent('R1', 'resistor', { R: '2.2G' })]);
        const issues = validateDocument(doc);
        expect(issues.some((i) => i.code === 'value-out-of-range')).toBe(true);
    });

    test('aliases are accepted (Resistance instead of R)', () => {
        const doc = withParts([makeComponent('R1', 'resistor', { Resistance: '10k' })]);
        expect(validateDocument(doc)).toEqual([]);
    });

    test('capacitor with mismatched unit emits unit-mismatch warning, not error', () => {
        const doc = withParts([makeComponent('C1', 'capacitor', { C: '1V' })]);
        const issues = validateDocument(doc);
        const mismatch = issues.find((i) => i.code === 'unit-mismatch');
        expect(mismatch).toBeDefined();
        expect(mismatch?.severity).toBe('warning');
    });

    test('unitless quantity does not trigger unit-mismatch (lenient)', () => {
        const doc = withParts([makeComponent('R1', 'resistor', { R: '10k' })]);
        const issues = validateDocument(doc);
        expect(issues.find((i) => i.code === 'unit-mismatch')).toBeUndefined();
    });

    test('diode without model emits model-required error', () => {
        const doc = withParts([makeComponent('D1', 'diode')]);
        const issues = validateDocument(doc);
        expect(issues.some((i) => i.code === 'model-required')).toBe(true);
    });

    test('diode with model="1N4148" passes', () => {
        const doc = withParts([makeComponent('D1', 'diode', { model: '1N4148' })]);
        expect(validateDocument(doc)).toEqual([]);
    });

    test('LED without model emits model-required error', () => {
        const doc = withParts([makeComponent('LED1', 'led')]);
        const issues = validateDocument(doc);
        expect(issues.some((i) => i.code === 'model-required')).toBe(true);
    });

    test('LED with model="LED_RED" passes', () => {
        const doc = withParts([makeComponent('LED1', 'led', { model: 'LED_RED' })]);
        expect(validateDocument(doc)).toEqual([]);
    });

    test('bjt with Model alias passes', () => {
        const doc = withParts([makeComponent('Q1', 'bjt', { Model: '2N3904' })]);
        expect(validateDocument(doc)).toEqual([]);
    });

    test('opamp without model emits model-required', () => {
        const doc = withParts([makeComponent('U1', 'opamp')]);
        const issues = validateDocument(doc);
        expect(issues.some((i) => i.code === 'model-required')).toBe(true);
    });

    test('Circuit.IdealOpAmp is treated as ideal — no model required', () => {
        // LiveSPICE's IdealOpAmp has no model and no parameters; it's a math abstraction.
        const doc = withParts([
            makeComponent('U1', 'opamp', {}, 'Circuit.IdealOpAmp, Circuit, Version=1.0.0.0'),
        ]);
        const issues = validateDocument(doc);
        expect(issues.some((i) => i.code === 'model-required')).toBe(false);
    });

    test('runtime descriptor ICs do not require a model name', () => {
        const doc = withParts([
            makeComponent('U1', 'ic', { RuntimeDescriptor: 'true' }, 'Circuit.MicroBlockDelayChip'),
        ]);
        const issues = validateDocument(doc);
        expect(issues.some((i) => i.code === 'model-required')).toBe(false);
    });

    test('opamp with inline small-signal parameters does not require a model name', () => {
        // LiveSPICE's Circuit.OpAmp carries the model inline as Rin/Rout/Aol/GBP.
        const doc = withParts([
            makeComponent('U1', 'opamp', { Rin: '40 MΩ', Rout: '50 Ω', Aol: '300 k', GBP: '1 MHz' }),
        ]);
        const issues = validateDocument(doc);
        expect(issues.some((i) => i.code === 'model-required')).toBe(false);
    });

    test('pentode with inline Koren parameters does not require a model name', () => {
        // Fender 5e3's pentodes carry Mu/Kp/Kvb/Ex inline with no PartNumber.
        const doc = withParts([
            makeComponent('V1', 'pentode', { Mu: '10.7', Kp: '41.16', Kvb: '12.7', Ex: '1.5' }),
        ]);
        const issues = validateDocument(doc);
        expect(issues.some((i) => i.code === 'model-required')).toBe(false);
    });

    test('triode with neither model nor inline parameters still emits model-required', () => {
        const doc = withParts([makeComponent('V1', 'triode')]);
        const issues = validateDocument(doc);
        expect(issues.some((i) => i.code === 'model-required')).toBe(true);
    });

    test('duplicate component IDs emit duplicate-id error', () => {
        const doc = withParts([
            makeComponent('R1', 'resistor', { R: '10k' }),
            makeComponent('R1', 'resistor', { R: '20k' }),
        ]);
        const issues = validateDocument(doc);
        expect(issues.some((i) => i.code === 'duplicate-id')).toBe(true);
    });

    test('unsupported kind emits unsupported-component warning', () => {
        const doc = withParts([
            makeComponent('U?', 'unsupported', {}, 'Circuit.Components.MysteryChip'),
        ]);
        const issues = validateDocument(doc);
        const issue = issues.find((i) => i.code === 'unsupported-component');
        expect(issue).toBeDefined();
        expect(issue?.severity).toBe('warning');
        expect(issue?.message).toContain('MysteryChip');
    });

    test('degenerate wire emits warning', () => {
        const doc = withParts([], [makeWire('w1', { x: 5, y: 5 }, { x: 5, y: 5 })]);
        const issues = validateDocument(doc);
        const issue = issues.find((i) => i.code === 'degenerate-wire');
        expect(issue).toBeDefined();
        expect(issue?.severity).toBe('warning');
        expect(issue?.wireId).toBe('w1');
    });

    test('view-only kinds (label, named-wire, port) have no rules and emit no issues', () => {
        const doc = withParts([
            makeComponent('L1', 'label'),
            makeComponent('NW1', 'named-wire'),
            makeComponent('P1', 'port'),
            makeComponent('G1', 'ground'),
            makeComponent('J1', 'jack'),
        ]);
        expect(validateDocument(doc)).toEqual([]);
    });

    test('potentiometer requires R but taper is optional', () => {
        const doc = withParts([makeComponent('VR1', 'potentiometer', { R: '500k' })]);
        expect(validateDocument(doc)).toEqual([]);
    });

    test('potentiometer missing R emits error', () => {
        const doc = withParts([makeComponent('VR1', 'potentiometer', { taper: 'log' })]);
        const issues = validateDocument(doc);
        expect(issues.some((i) => i.code === 'value-required')).toBe(true);
    });

    test('voltage-source accepts negative values (no min)', () => {
        const doc = withParts([makeComponent('V1', 'voltage-source', { V: '-12V' })]);
        expect(validateDocument(doc)).toEqual([]);
    });

    test('value-unparseable emits error for garbage values', () => {
        const doc = withParts([makeComponent('R1', 'resistor', { R: 'not-a-number' })]);
        const issues = validateDocument(doc);
        expect(issues.some((i) => i.code === 'value-unparseable')).toBe(true);
    });
});

describe('validateComponent', () => {
    test('returns empty for kinds with no rules', () => {
        const c = makeComponent('L1', 'label');
        expect(validateComponent(c)).toEqual([]);
    });

    test('accepts explicit rules override', () => {
        const c = makeComponent('R1', 'resistor', { foo: '10k' });
        const issues = validateComponent(c, [
            { kind: 'quantity', name: 'foo', required: true, unit: 'Ω' },
        ]);
        expect(issues).toEqual([]);
    });
});

describe('getRulesForKind', () => {
    test('returns rules for resistor', () => {
        const rules = getRulesForKind('resistor');
        expect(rules).toHaveLength(1);
        expect(rules[0]?.name).toBe('R');
        expect(rules[0]?.required).toBe(true);
    });

    test('returns empty for label', () => {
        expect(getRulesForKind('label')).toEqual([]);
    });
});

describe('hasErrors', () => {
    test('true when any issue has error severity', () => {
        expect(hasErrors([
            { code: 'duplicate-id', severity: 'error', message: 'x' },
            { code: 'unit-mismatch', severity: 'warning', message: 'y' },
        ])).toBe(true);
    });

    test('false when only warnings', () => {
        expect(hasErrors([
            { code: 'unit-mismatch', severity: 'warning', message: 'y' },
        ])).toBe(false);
    });

    test('false for empty list', () => {
        expect(hasErrors([])).toBe(false);
    });
});
