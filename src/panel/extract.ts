import type { CircuitDocument, Component, ParsedQuantity, PropertyValue } from '../model/types';
import type {
    JackPort,
    JackRole,
    Knob,
    KnobTaper,
    LedIndicator,
    Panel,
    SliderControl,
    SliderOrientation,
    SliderRange,
    SwitchControl,
    SwitchKind,
} from './types';
import { buildKnobSteps, snapKnobPosition } from './knobs';

// extractPanel inspects a CircuitDocument and emits the typed Panel descriptor
// that drives the runtime control surface. It's a pure read over the existing
// schematic model — no parsing of the source format, no UI knowledge.
export function extractPanel(doc: CircuitDocument): Panel {
    const knobs: Knob[] = [];
    const sliders: SliderControl[] = [];
    const switches: SwitchControl[] = [];
    const leds: LedIndicator[] = [];
    const jacks: JackPort[] = [];

    for (const component of doc.components) {
        switch (component.kind) {
            case 'potentiometer': {
                if (isSliderControl(component)) {
                    sliders.push(toSlider(component));
                } else {
                    knobs.push(toKnob(component));
                }
                break;
            }
            case 'switch': {
                switches.push(toSwitch(component));
                break;
            }
            case 'led': {
                leds.push(toLed(component));
                break;
            }
            case 'jack': {
                jacks.push(toJack(component));
                break;
            }
            default:
                break;
        }
    }

    return { knobs, sliders, switches, leds, jacks };
}

function toKnob(component: Component): Knob {
    const taper = resolveTaper(propertyString(component, 'Sweep') ?? propertyString(component, 'Taper'));
    const stepLabels = parseStepLabels(propertyStringAny(component, ['StepLabels', 'Steps']));
    const explicitStepCount = parseStepCount(propertyStringAny(component, ['StepCount', 'Detents', 'Positions', 'Steps']));
    const steps = buildKnobSteps(stepLabels.length >= 2 ? stepLabels.length : explicitStepCount ?? 0, stepLabels);
    const rawDefaultPosition = clamp01(parseNumeric(component.properties.Wipe) ?? 0.5);
    const defaultPosition = steps === undefined ? rawDefaultPosition : snapKnobPosition({ steps }, rawDefaultPosition);
    const resistance = quantityProperty(component, 'Resistance');
    const gangGroup = propertyString(component, 'Group') ?? undefined;
    const description = propertyString(component, 'Description') ?? undefined;
    return {
        id: component.id,
        name: component.name,
        taper,
        controlMode: steps === undefined ? 'continuous' : 'stepped',
        defaultPosition,
        ...(steps !== undefined ? { steps } : {}),
        ...(resistance !== undefined ? { resistance } : {}),
        ...(gangGroup !== undefined && gangGroup.length > 0 ? { gangGroup } : {}),
        ...(description !== undefined && description.length > 0 ? { description } : {}),
    };
}

function toSlider(component: Component): SliderControl {
    const defaultPosition = clamp01(parseNumeric(component.properties.Wipe) ?? 0.5);
    const orientation = resolveSliderOrientation(propertyStringAny(component, ['Orientation', 'SliderOrientation']));
    const range = sliderRange(component);
    const gangGroup = propertyString(component, 'Group') ?? undefined;
    const description = propertyString(component, 'Description') ?? undefined;
    return {
        id: component.id,
        name: component.name,
        defaultPosition,
        orientation,
        ...(range !== undefined ? { range } : {}),
        ...(gangGroup !== undefined && gangGroup.length > 0 ? { gangGroup } : {}),
        ...(description !== undefined && description.length > 0 ? { description } : {}),
    };
}

function toSwitch(component: Component): SwitchControl {
    const switchKind = resolveSwitchKind(component);
    const { poles, positions } = switchGeometry(switchKind);
    const defaultPosition = clampInt(parseNumeric(component.properties.Position) ?? 0, 0, positions - 1);
    const gangGroup = propertyString(component, 'Group') ?? undefined;
    const partNumber = propertyString(component, 'PartNumber') ?? undefined;
    const description = propertyString(component, 'Description') ?? undefined;
    return {
        id: component.id,
        name: component.name,
        switchKind,
        poles,
        positions,
        defaultPosition,
        ...(gangGroup !== undefined && gangGroup.length > 0 ? { gangGroup } : {}),
        ...(partNumber !== undefined && partNumber.length > 0 ? { partNumber } : {}),
        ...(description !== undefined && description.length > 0 ? { description } : {}),
    };
}

function toLed(component: Component): LedIndicator {
    const color = propertyString(component, 'Color') ?? inferLedColor(component);
    const partNumber = propertyString(component, 'PartNumber') ?? undefined;
    const description = propertyString(component, 'Description') ?? undefined;
    return {
        id: component.id,
        name: component.name,
        ...(color !== undefined ? { color } : {}),
        ...(partNumber !== undefined && partNumber.length > 0 ? { partNumber } : {}),
        ...(description !== undefined && description.length > 0 ? { description } : {}),
    };
}

function toJack(component: Component): JackPort {
    const role = resolveJackRole(component);
    const impedance = quantityProperty(component, 'Impedance');
    const description = propertyString(component, 'Description') ?? undefined;
    const sourceTypeName = component.sourceTypeName ?? undefined;
    return {
        id: component.id,
        name: component.name,
        role,
        ...(impedance !== undefined ? { impedance } : {}),
        ...(sourceTypeName !== undefined ? { sourceTypeName } : {}),
        ...(description !== undefined && description.length > 0 ? { description } : {}),
    };
}

function isSliderControl(component: Component): boolean {
    const style = propertyStringAny(component, ['ControlStyle', 'ControlType', 'PanelControl', 'UiControl', 'Style']);
    if (style === null) {
        return false;
    }
    const lower = style.toLowerCase();
    return lower.includes('slider') || lower.includes('fader');
}

function resolveSliderOrientation(value: string | null): SliderOrientation {
    if (value?.toLowerCase().includes('horizontal')) {
        return 'horizontal';
    }
    return 'vertical';
}

function sliderRange(component: Component): SliderRange | undefined {
    const min = parseNumericAny(component, ['RangeMin', 'Min', 'Minimum']);
    const max = parseNumericAny(component, ['RangeMax', 'Max', 'Maximum']);
    if (min === undefined || max === undefined || min >= max) {
        return undefined;
    }
    const unit = propertyStringAny(component, ['Unit', 'RangeUnit']) ?? undefined;
    const center = parseNumericAny(component, ['Center', 'CenterValue', 'RangeCenter']);
    return {
        min,
        max,
        ...(unit !== undefined && unit.length > 0 ? { unit } : {}),
        ...(center !== undefined ? { center } : {}),
    };
}

function resolveTaper(value: string | null | undefined): KnobTaper {
    if (value === null || value === undefined) {
        return 'unknown';
    }
    const lower = value.toLowerCase();
    if (lower.includes('log') && lower.includes('rev')) {
        return 'reverse-log';
    }
    if (lower.includes('log') || lower.includes('audio')) {
        return 'log';
    }
    if (lower.includes('lin')) {
        return 'linear';
    }
    return 'unknown';
}

function resolveSwitchKind(component: Component): SwitchKind {
    const short = shortType(component.sourceTypeName);
    if (short === null) {
        return inferFromTerminals(component.terminals.length);
    }
    const upper = short.toUpperCase();
    if (upper === 'SPDT') return 'spdt';
    if (upper === 'SP3T') return 'sp3t';
    if (upper === 'SP4T') return 'sp4t';
    if (upper === '3PDT') return '3pdt';
    if (upper === 'TOGGLE') return 'toggle';
    if (upper === 'ROTARY') return 'rotary';
    if (upper === 'SWITCH') return 'spst';
    return inferFromTerminals(component.terminals.length);
}

function inferFromTerminals(count: number): SwitchKind {
    if (count <= 2) return 'spst';
    if (count === 3) return 'spdt';
    if (count === 9) return '3pdt';
    return 'unknown';
}

function switchGeometry(kind: SwitchKind): { poles: number; positions: number } {
    switch (kind) {
        case 'spst':
        case 'toggle':
            return { poles: 1, positions: 2 };
        case 'spdt':
            return { poles: 1, positions: 2 };
        case 'sp3t':
            return { poles: 1, positions: 3 };
        case 'sp4t':
            return { poles: 1, positions: 4 };
        case '3pdt':
            return { poles: 3, positions: 2 };
        case 'rotary':
            return { poles: 1, positions: 6 };
        case 'unknown':
            return { poles: 1, positions: 2 };
    }
}

function resolveJackRole(component: Component): JackRole {
    const short = shortType(component.sourceTypeName);
    if (short === null) {
        return 'unknown';
    }
    const upper = short.toUpperCase();
    if (upper === 'INPUT' || upper === 'INPUTJACK') return 'input';
    if (upper === 'SPEAKER' || upper === 'OUTPUTJACK') return 'output';
    if (upper === 'SEND') return 'send';
    if (upper === 'RETURN') return 'return';
    if (upper === 'EXPRESSION' || upper === 'EXP') return 'expression';
    return 'unknown';
}

function inferLedColor(component: Component): string | undefined {
    // Common pedal LED colors are usually red / amber / green. Try the part number.
    const part = propertyString(component, 'PartNumber')?.toLowerCase() ?? '';
    if (part.includes('red')) return 'red';
    if (part.includes('green')) return 'green';
    if (part.includes('amber')) return 'amber';
    if (part.includes('blue')) return 'blue';
    if (part.includes('yellow')) return 'yellow';
    if (part.includes('white')) return 'white';
    return undefined;
}

function shortType(sourceTypeName: string | null): string | null {
    if (sourceTypeName === null) {
        return null;
    }
    const match = sourceTypeName.match(/Circuit\.(?:Components\.)?([A-Za-z0-9_]+)/);
    if (match?.[1] !== undefined) {
        return match[1];
    }
    const ltspice = sourceTypeName.match(/^ltspice:([A-Za-z0-9_]+)/);
    return ltspice?.[1] ?? null;
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

function quantityProperty(component: Component, name: string): ParsedQuantity | undefined {
    const value = component.properties[name];
    if (value === undefined || typeof value === 'string') {
        return undefined;
    }
    return value;
}

function parseNumeric(value: PropertyValue | undefined): number | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value === 'string') {
        const n = Number.parseFloat(value);
        return Number.isFinite(n) ? n : undefined;
    }
    return Number.isFinite(value.value) ? value.value : undefined;
}

function parseNumericAny(component: Component, names: readonly string[]): number | undefined {
    for (const name of names) {
        const value = parseNumeric(component.properties[name]);
        if (value !== undefined) {
            return value;
        }
    }
    return undefined;
}

function parseStepLabels(value: string | null): readonly string[] {
    if (value === null) {
        return [];
    }
    const parts = value
        .split(/[,;|]/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    return parts.length >= 2 ? parts : [];
}

function parseStepCount(value: string | null): number | undefined {
    if (value === null) {
        return undefined;
    }
    const trimmed = value.trim();
    if (!/^\d+(?:\.0+)?$/.test(trimmed)) {
        return undefined;
    }
    const count = Number(trimmed);
    return Number.isInteger(count) && count >= 2 ? count : undefined;
}

function clamp01(v: number): number {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
}

function clampInt(v: number, lo: number, hi: number): number {
    const n = Math.trunc(v);
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
}
