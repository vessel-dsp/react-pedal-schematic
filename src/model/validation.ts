import { parseQuantity } from './quantity';
import type {
    CircuitDocument,
    Component,
    ComponentKind,
    ParsedQuantity,
    PropertyValue,
} from './types';

export type ValidationSeverity = 'error' | 'warning';

export type ValidationCode =
    | 'value-required'
    | 'model-required'
    | 'value-unparseable'
    | 'value-out-of-range'
    | 'unit-mismatch'
    | 'unsupported-component'
    | 'duplicate-id'
    | 'degenerate-wire';

export type ValidationIssue = Readonly<{
    code: ValidationCode;
    severity: ValidationSeverity;
    message: string;
    componentId?: string;
    property?: string;
    wireId?: string;
}>;

export type QuantityRule = Readonly<{
    kind: 'quantity';
    name: string;
    required: boolean;
    aliases?: readonly string[];
    unit?: string;
    min?: number;
    max?: number;
}>;

export type StringRule = Readonly<{
    kind: 'string';
    name: string;
    required: boolean;
    aliases?: readonly string[];
}>;

export type PropertyRule = QuantityRule | StringRule;

const MODEL_ALIASES = ['Model', 'Type', 'partNumber', 'PartNumber'] as const;

// Short source-type names (last dotted segment) that represent an "ideal" component variant —
// no model name is required because the component is a mathematical abstraction.
const IDEAL_SOURCE_TYPES: ReadonlySet<string> = new Set(['IdealOpAmp']);

// Per-kind property names that, if present, satisfy the "needs a model" requirement.
// LiveSPICE stores tube Koren parameters and opamp small-signal parameters inline; when those
// are present, the parameters ARE the model definition and no separate model name is needed.
const INLINE_MODEL_PARAMETERS: Partial<Record<ComponentKind, readonly string[]>> = {
    opamp: ['Rin', 'Rout', 'Aol', 'GBP', 'SupplyVoltage'],
    triode: ['Mu', 'K', 'Kp', 'Kvb', 'Ex', 'Kg'],
    pentode: ['Mu', 'K', 'Kp', 'Kvb', 'Ex', 'Kg', 'Kg1', 'Kg2'],
};

const KIND_RULES: Partial<Record<ComponentKind, readonly PropertyRule[]>> = {
    resistor: [{
        kind: 'quantity', name: 'R', required: true, unit: 'Ω',
        min: 1e-9, max: 1e9, aliases: ['Resistance', 'resistance', 'r'],
    }],
    'variable-resistor': [{
        kind: 'quantity', name: 'R', required: true, unit: 'Ω',
        min: 1e-9, max: 1e9, aliases: ['Resistance', 'resistance', 'r'],
    }],
    potentiometer: [
        {
            kind: 'quantity', name: 'R', required: true, unit: 'Ω',
            min: 1e-9, max: 1e9, aliases: ['Resistance', 'totalResistance'],
        },
        { kind: 'string', name: 'taper', required: false, aliases: ['Taper'] },
    ],
    capacitor: [{
        kind: 'quantity', name: 'C', required: true, unit: 'F',
        min: 1e-15, max: 1, aliases: ['Capacitance', 'capacitance', 'c'],
    }],
    inductor: [{
        kind: 'quantity', name: 'L', required: true, unit: 'H',
        min: 1e-12, max: 100, aliases: ['Inductance', 'inductance', 'l'],
    }],
    'voltage-source': [{
        kind: 'quantity', name: 'V', required: true, unit: 'V',
        aliases: ['Voltage', 'voltage', 'v'],
    }],
    'current-source': [{
        kind: 'quantity', name: 'I', required: true, unit: 'A',
        aliases: ['Current', 'current', 'i'],
    }],
    battery: [{
        kind: 'quantity', name: 'V', required: true, unit: 'V',
        aliases: ['Voltage', 'voltage', 'v'],
    }],
    rail: [{
        kind: 'quantity', name: 'V', required: true, unit: 'V',
        aliases: ['Voltage', 'voltage', 'v'],
    }],
    diode: [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    led: [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    bjt: [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    jfet: [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    mosfet: [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    opamp: [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    triode: [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    pentode: [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    'tube-diode': [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    optocoupler: [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    transformer: [{ kind: 'string', name: 'model', required: false, aliases: [...MODEL_ALIASES] }],
    ota: [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    bbd: [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    'delay-ic': [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    'power-amp': [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    regulator: [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    'analog-switch': [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    flipflop: [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
    ic: [{ kind: 'string', name: 'model', required: true, aliases: [...MODEL_ALIASES] }],
};

export function getRulesForKind(kind: ComponentKind): readonly PropertyRule[] {
    return KIND_RULES[kind] ?? [];
}

export function validateComponent(
    component: Component,
    rules: readonly PropertyRule[] = getRulesForKind(component.kind),
): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const rule of rules) {
        const value = findProperty(component, rule);

        if (value === undefined) {
            if (rule.required && !isRequirementWaived(component, rule)) {
                issues.push(missingPropertyIssue(component, rule));
            }
            continue;
        }

        if (rule.kind === 'string') {
            if (typeof value !== 'string' || value.trim().length === 0) {
                if (rule.required && !isRequirementWaived(component, rule)) {
                    issues.push(missingPropertyIssue(component, rule));
                }
            }
            continue;
        }

        const quantity = coerceQuantity(value);
        if (quantity === null) {
            if (typeof value === 'string' && isRawQuantityExpression(value)) {
                continue;
            }
            issues.push({
                code: 'value-unparseable',
                severity: 'error',
                message: `${component.id}: property "${rule.name}" could not be parsed as a quantity`,
                componentId: component.id,
                property: rule.name,
            });
            continue;
        }

        if (rule.unit !== undefined && rule.unit.length > 0 && quantity.unit.length > 0 && quantity.unit !== rule.unit) {
            issues.push({
                code: 'unit-mismatch',
                severity: 'warning',
                message: `${component.id}: property "${rule.name}" has unit "${quantity.unit}" but expected "${rule.unit}"`,
                componentId: component.id,
                property: rule.name,
            });
        }

        if (rule.min !== undefined && quantity.value < rule.min) {
            issues.push({
                code: 'value-out-of-range',
                severity: 'error',
                message: `${component.id}: property "${rule.name}" value ${quantity.value} is below minimum ${rule.min}`,
                componentId: component.id,
                property: rule.name,
            });
        }
        if (rule.max !== undefined && quantity.value > rule.max) {
            issues.push({
                code: 'value-out-of-range',
                severity: 'error',
                message: `${component.id}: property "${rule.name}" value ${quantity.value} is above maximum ${rule.max}`,
                componentId: component.id,
                property: rule.name,
            });
        }
    }

    return issues;
}

export function validateDocument(doc: CircuitDocument): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const seen = new Set<string>();

    for (const component of doc.components) {
        if (seen.has(component.id)) {
            issues.push({
                code: 'duplicate-id',
                severity: 'error',
                message: `Duplicate component id "${component.id}"`,
                componentId: component.id,
            });
        }
        seen.add(component.id);

        if (component.kind === 'unsupported') {
            issues.push({
                code: 'unsupported-component',
                severity: 'warning',
                message: `${component.id}: unsupported source type ${component.sourceTypeName ?? 'unknown'}`,
                componentId: component.id,
            });
            continue;
        }

        for (const issue of validateComponent(component)) {
            issues.push(issue);
        }
    }

    for (const wire of doc.wires) {
        const [a, b] = wire.endpoints;
        if (a.x === b.x && a.y === b.y) {
            issues.push({
                code: 'degenerate-wire',
                severity: 'warning',
                message: `Wire "${wire.id}" has identical endpoints`,
                wireId: wire.id,
            });
        }
    }

    return issues;
}

export function hasErrors(issues: readonly ValidationIssue[]): boolean {
    return issues.some((issue) => issue.severity === 'error');
}

function isRequirementWaived(component: Component, rule: PropertyRule): boolean {
    // Only the "model" string requirement has a waiver path today.
    if (rule.kind !== 'string' || rule.name !== 'model') {
        return false;
    }
    if (component.kind === 'ic' && component.properties.RuntimeDescriptor === 'true') {
        return true;
    }
    const shortType = shortSourceType(component.sourceTypeName);
    if (shortType !== null && IDEAL_SOURCE_TYPES.has(shortType)) {
        return true;
    }
    const inline = INLINE_MODEL_PARAMETERS[component.kind] ?? [];
    return inline.some((name) => component.properties[name] !== undefined);
}

function shortSourceType(sourceTypeName: string | null): string | null {
    if (sourceTypeName === null) {
        return null;
    }
    const head = sourceTypeName.split(',')[0]?.trim() ?? '';
    if (head.length === 0) {
        return null;
    }
    const lastDot = head.lastIndexOf('.');
    return lastDot >= 0 ? head.slice(lastDot + 1) : head;
}

function findProperty(component: Component, rule: PropertyRule): PropertyValue | undefined {
    const candidates = [rule.name, ...(rule.aliases ?? [])];
    for (const name of candidates) {
        const value = component.properties[name];
        if (value !== undefined) {
            return value;
        }
    }
    return undefined;
}

function coerceQuantity(value: PropertyValue): ParsedQuantity | null {
    if (typeof value === 'string') {
        return parseQuantity(value);
    }
    return value;
}

function isRawQuantityExpression(value: string): boolean {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return false;
    }
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return true;
    }
    return /^(AC|DC)\b/i.test(trimmed) ||
        /^(SINE|PULSE|PWL|EXP|SFFM|AM|WAVEFILE)\s*\(/i.test(trimmed);
}

function missingPropertyIssue(component: Component, rule: PropertyRule): ValidationIssue {
    return {
        code: rule.kind === 'string' ? 'model-required' : 'value-required',
        severity: 'error',
        message: `${component.id} (${component.kind}): missing required property "${rule.name}"`,
        componentId: component.id,
        property: rule.name,
    };
}
