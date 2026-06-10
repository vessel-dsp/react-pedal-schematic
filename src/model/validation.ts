import { parseQuantity } from './quantity';
import { extractPanel } from '../panel/extract';
import type {
    CircuitDocument,
    Component,
    ComponentKind,
    PanelControlKind,
    PanelElementPlacement,
    PanelFace,
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
    | 'invalid-jack-role'
    | 'invalid-jack-interface'
    | 'descriptor-control-empty'
    | 'descriptor-mode-label-mismatch'
    | 'panel-binding-unresolved'
    | 'panel-control-unresolved'
    | 'panel-kind-mismatch'
    | 'panel-cell-collision'
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

const RUNTIME_DESCRIPTOR_CONTROL_PROPERTIES = [
    'TimeControl',
    'FeedbackControl',
    'MixControl',
    'LevelControl',
    'ToneControl',
    'ModRateControl',
    'ModDepthControl',
    'ModeControl',
    'TempoTapControl',
    'TapTempoControl',
    'TempoControl',
    'DirectOutputJack',
    'DirectOutJack',
    'DirectOutputControl',
    'DirectOutControl',
] as const;

type ResolvedPanelElement = Readonly<{
    id: string;
    componentId: string;
    kind: PanelControlKind;
}>;

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

        for (const issue of validateSemanticMetadata(component)) {
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

    for (const issue of validatePanel(doc, seen)) {
        issues.push(issue);
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

function validateSemanticMetadata(component: Component): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (component.kind === 'jack') {
        issues.push(...validateJackSemanticMetadata(component));
    }

    if (component.kind === 'ic' && component.properties.RuntimeDescriptor === 'true') {
        issues.push(...validateRuntimeDescriptorMetadata(component));
    }

    return issues;
}

function validateJackSemanticMetadata(component: Component): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const property of ['Role', 'ControlRole'] as const) {
        const value = propertyString(component, property);
        if (value !== null && value.trim().length > 0 && !isRecognizedJackRole(value)) {
            issues.push({
                code: 'invalid-jack-role',
                severity: 'warning',
                message: `${component.id}: jack ${property} "${value}" is not a recognized panel role`,
                componentId: component.id,
                property,
            });
        }
    }

    const interfaceName = propertyString(component, 'Interface');
    if (interfaceName !== null && interfaceName.trim().length > 0 && !isRecognizedJackInterface(interfaceName)) {
        issues.push({
            code: 'invalid-jack-interface',
            severity: 'warning',
            message: `${component.id}: jack Interface "${interfaceName}" is not a recognized panel interface`,
            componentId: component.id,
            property: 'Interface',
        });
    }

    return issues;
}

function validateRuntimeDescriptorMetadata(component: Component): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const property of RUNTIME_DESCRIPTOR_CONTROL_PROPERTIES) {
        const value = propertyString(component, property);
        if (value !== null && value.trim().length === 0) {
            issues.push({
                code: 'descriptor-control-empty',
                severity: 'warning',
                message: `${component.id}: runtime descriptor property "${property}" must not be empty`,
                componentId: component.id,
                property,
            });
        }
    }

    const labels = parseStringList(propertyStringAny(component, ['ModeLabels', 'ModeOptions']));
    const stepCount = parsePositiveInteger(propertyStringAny(component, ['ModeStepCount', 'ModeSteps', 'ModeCount']));
    if (labels.length > 0 && stepCount !== undefined && labels.length !== stepCount) {
        issues.push({
            code: 'descriptor-mode-label-mismatch',
            severity: 'warning',
            message: `${component.id}: ModeLabels has ${labels.length} labels but ModeStepCount is ${stepCount}`,
            componentId: component.id,
            property: 'ModeLabels',
        });
    }

    return issues;
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

function propertyString(component: Component, name: string): string | null {
    const value = component.properties[name];
    if (value === undefined) {
        return null;
    }
    return typeof value === 'string' ? value : value.raw;
}

function propertyStringAny(component: Component, names: readonly string[]): string | null {
    for (const name of names) {
        const value = propertyString(component, name);
        if (value !== null) {
            return value;
        }
    }
    return null;
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

function isRecognizedJackRole(value: string): boolean {
    const normalized = normalizeToken(value);
    return [
        'input',
        'audio-input',
        'in',
        'direct-output',
        'direct-out',
        'dry-output',
        'dry-out',
        'output',
        'audio-output',
        'out',
        'send',
        'return',
        'expression',
        'exp',
        'expression-pedal',
        'tempo-tap',
        'tap-tempo',
        'tempo-in',
        'tap',
        'tempo',
        'external-control',
        'external-control-input',
        'control-input',
        'remote',
        'footswitch',
        'trigger',
        'reset',
    ].includes(normalized);
}

function isRecognizedJackInterface(value: string): boolean {
    const normalized = normalizeToken(value);
    return isRecognizedJackRole(value) ||
        [
            'audio',
            'audio-port',
            'control',
            'control-port',
            'tap-tempo-input',
        ].includes(normalized);
}

function parseStringList(value: string | null): readonly string[] {
    if (value === null) {
        return [];
    }
    return value
        .split(/[,;|]/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}

function parsePositiveInteger(value: string | null): number | undefined {
    if (value === null) {
        return undefined;
    }
    const trimmed = value.trim();
    if (!/^\d+(?:\.0+)?$/.test(trimmed)) {
        return undefined;
    }
    const count = Number(trimmed);
    return Number.isInteger(count) && count > 0 ? count : undefined;
}

function normalizeToken(value: string): string {
    return value.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function validatePanel(
    doc: CircuitDocument,
    componentIds: ReadonlySet<string>,
): readonly ValidationIssue[] {
    if (doc.panel === undefined) {
        return [];
    }

    const issues: ValidationIssue[] = [];
    const resolvedElements = resolvePanelElements(doc);

    for (const face of doc.panel.faces) {
        for (const element of face.elements) {
            const componentId = element.bind.componentId;
            if (!componentIds.has(componentId)) {
                issues.push({
                    code: 'panel-binding-unresolved',
                    severity: 'warning',
                    message: `Panel element on face "${face.id}" references missing component "${componentId}"`,
                    componentId,
                });
                continue;
            }

            const resolved = resolvePanelElement(resolvedElements, element);
            if (element.bind.controlId !== undefined && resolved === undefined) {
                issues.push({
                    code: 'panel-control-unresolved',
                    severity: 'warning',
                    message: `Panel element on face "${face.id}" references missing control "${element.bind.controlId}" on component "${componentId}"`,
                    componentId,
                    property: element.bind.controlId,
                });
                continue;
            }

            if (resolved !== undefined && resolved.kind !== element.kind) {
                issues.push({
                    code: 'panel-kind-mismatch',
                    severity: 'warning',
                    message: `Panel element on face "${face.id}" binds component "${componentId}" as ${element.kind} but resolved kind is ${resolved.kind}`,
                    componentId,
                });
            }
        }

        for (const issue of validatePanelCellCollisions(face)) {
            issues.push(issue);
        }
    }

    return issues;
}

function resolvePanelElements(doc: CircuitDocument): readonly ResolvedPanelElement[] {
    const panel = extractPanel(doc);
    const resolved: ResolvedPanelElement[] = [];

    for (const knob of panel.knobs) {
        resolved.push({
            id: knob.id,
            componentId: componentIdFromPanelElementId(knob.id),
            kind: knob.id.endsWith(':mode') && knob.controlMode === 'stepped' ? 'switch' : 'knob',
        });
    }
    for (const slider of panel.sliders ?? []) {
        resolved.push({
            id: slider.id,
            componentId: componentIdFromPanelElementId(slider.id),
            kind: 'slider',
        });
    }
    for (const switchControl of panel.switches) {
        resolved.push({
            id: switchControl.id,
            componentId: componentIdFromPanelElementId(switchControl.id),
            kind: 'switch',
        });
    }
    for (const led of panel.leds) {
        resolved.push({
            id: led.id,
            componentId: componentIdFromPanelElementId(led.id),
            kind: 'led',
        });
    }
    for (const jack of panel.jacks) {
        resolved.push({
            id: jack.id,
            componentId: jack.sourceComponentId ?? componentIdFromPanelElementId(jack.id),
            kind: 'jack',
        });
    }

    return resolved;
}

function resolvePanelElement(
    resolvedElements: readonly ResolvedPanelElement[],
    element: PanelElementPlacement,
): ResolvedPanelElement | undefined {
    if (element.bind.controlId !== undefined) {
        return resolvedElements.find((resolved) =>
            resolved.componentId === element.bind.componentId && resolved.id === element.bind.controlId,
        );
    }

    return resolvedElements.find((resolved) =>
        resolved.componentId === element.bind.componentId && resolved.id === element.bind.componentId,
    );
}

function componentIdFromPanelElementId(id: string): string {
    const separator = id.indexOf(':');
    return separator <= 0 ? id : id.slice(0, separator);
}

function validatePanelCellCollisions(face: PanelFace): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const occupied = new Map<string, PanelElementPlacement>();

    for (const element of face.elements) {
        const rowSpan = element.grid.rowSpan ?? 1;
        const columnSpan = element.grid.columnSpan ?? 1;
        for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
            for (let columnOffset = 0; columnOffset < columnSpan; columnOffset += 1) {
                const row = element.grid.row + rowOffset;
                const column = element.grid.column + columnOffset;
                const key = `${row}:${column}`;
                if (occupied.has(key)) {
                    issues.push({
                        code: 'panel-cell-collision',
                        severity: 'warning',
                        message: `Panel face "${face.id}" has overlapping elements at row ${row}, column ${column}`,
                        componentId: element.bind.componentId,
                    });
                    continue;
                }
                occupied.set(key, element);
            }
        }
    }

    return issues;
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
