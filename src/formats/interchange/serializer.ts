import { getPinNode, resolveConnectivity, type Connectivity } from '../../model/connectivity';
import type {
    CircuitDocument,
    Component,
    DocumentSource,
    Point,
    PropertyValue,
    Terminal,
    Warning,
    Wire,
} from '../../model/types';

export type InterchangeSourceFormat = string;

export type SerializeInterchangeYamlOptions = Readonly<{
    filename?: string;
    source?: DocumentSource | null;
    sourceFormat?: InterchangeSourceFormat | null;
}>;

type YamlScalar = string | number | boolean | null;
type YamlValue = YamlScalar | readonly YamlValue[] | { readonly [key: string]: YamlValue };
type MutableYamlObject = Record<string, YamlValue>;

export function serializeInterchangeYaml(
    doc: CircuitDocument,
    options: SerializeInterchangeYamlOptions = {},
): string {
    const connectivity = resolveConnectivity(doc);
    const root: MutableYamlObject = {
        schema: 'circuit-interchange/v1',
        metadata: {
            name: doc.metadata.name,
            description: doc.metadata.description,
            partNumber: doc.metadata.partNumber,
        },
        source: sourceBlock(doc.source, options),
        components: doc.components.map((component) => componentBlock(component, connectivity)),
        nodes: nodeBlocks(connectivity),
        wires: doc.wires.map(wireBlock),
        directives: doc.directives,
        diagnostics: doc.warnings.map(warningBlock),
        rawAttributes: doc.rawAttributes,
    };

    return `${emitYaml(root, 0)}\n`;
}

function sourceBlock(
    documentSource: DocumentSource | undefined,
    options: SerializeInterchangeYamlOptions,
): MutableYamlObject {
    const source: MutableYamlObject = {};
    for (const [key, value] of Object.entries(documentSource ?? {})) {
        source[key] = value;
    }
    for (const [key, value] of Object.entries(options.source ?? {})) {
        source[key] = value;
    }
    if (options.sourceFormat !== undefined && options.sourceFormat !== null) {
        source.format = options.sourceFormat;
    }
    if (options.sourceFormat === null) {
        delete source.format;
    }
    if (options.filename !== undefined && options.filename.length > 0) {
        source.filename = options.filename;
    }
    return source;
}

function componentBlock(component: Component, connectivity: Connectivity): MutableYamlObject {
    return {
        id: component.id,
        kind: component.kind,
        name: component.name,
        sourceTypeName: component.sourceTypeName,
        origin: pointBlock(component.origin),
        rotation: component.rotation,
        flipped: component.flipped,
        terminals: component.terminals.map((terminal) => terminalBlock(component, terminal, connectivity)),
        properties: propertiesBlock(component.properties),
    };
}

function terminalBlock(
    component: Component,
    terminal: Terminal,
    connectivity: Connectivity,
): MutableYamlObject {
    return {
        name: terminal.name,
        node: getPinNode(connectivity, {
            componentId: component.id,
            terminalName: terminal.name,
        }) ?? null,
        position: pointBlock(terminal.position),
    };
}

function propertiesBlock(properties: Readonly<Record<string, PropertyValue>>): MutableYamlObject {
    const out: MutableYamlObject = {};
    for (const [key, value] of Object.entries(properties)) {
        out[key] = propertyValueBlock(value);
    }
    return out;
}

function propertyValueBlock(value: PropertyValue): YamlValue {
    if (typeof value === 'string') {
        return value;
    }
    return {
        raw: value.raw,
        value: value.value,
        unit: value.unit,
    };
}

function nodeBlocks(connectivity: Connectivity): readonly MutableYamlObject[] {
    return Array.from(connectivity.nodeMembers.entries())
        .sort(([a], [b]) => a - b)
        .map(([id, members]) => ({
            id,
            role: id === connectivity.groundNodeId ? 'ground' : 'signal',
            members: members.map((member) => ({
                componentId: member.componentId,
                terminalName: member.terminalName,
            })),
        }));
}

function wireBlock(wire: Wire): MutableYamlObject {
    return {
        id: wire.id,
        points: wire.endpoints.map(pointBlock),
    };
}

function warningBlock(warning: Warning): MutableYamlObject {
    const out: MutableYamlObject = {
        code: warning.code,
        message: warning.message,
    };
    if (warning.componentId !== undefined) {
        out.componentId = warning.componentId;
    }
    if (warning.wireId !== undefined) {
        out.wireId = warning.wireId;
    }
    return out;
}

function pointBlock(point: Point): MutableYamlObject {
    return {
        x: point.x,
        y: point.y,
    };
}

function emitYaml(value: YamlValue, indent: number): string {
    if (isScalar(value)) {
        return `${spaces(indent)}${formatScalar(value)}`;
    }
    if (isYamlArray(value)) {
        return emitArray(value, indent);
    }
    return emitObject(value, indent);
}

function emitObject(value: { readonly [key: string]: YamlValue }, indent: number): string {
    const entries = Object.entries(value);
    if (entries.length === 0) {
        return `${spaces(indent)}{}`;
    }

    const lines: string[] = [];
    for (const [key, child] of entries) {
        if (isScalar(child)) {
            lines.push(`${spaces(indent)}${formatKey(key)}: ${formatScalar(child)}`);
            continue;
        }
        if (isYamlArray(child)) {
            if (child.length === 0) {
                lines.push(`${spaces(indent)}${formatKey(key)}: []`);
            } else {
                lines.push(`${spaces(indent)}${formatKey(key)}:`);
                lines.push(emitArray(child, indent + 2));
            }
            continue;
        }
        const nestedEntries = Object.entries(child);
        if (nestedEntries.length === 0) {
            lines.push(`${spaces(indent)}${formatKey(key)}: {}`);
        } else {
            lines.push(`${spaces(indent)}${formatKey(key)}:`);
            lines.push(emitObject(child, indent + 2));
        }
    }
    return lines.join('\n');
}

function emitArray(value: readonly YamlValue[], indent: number): string {
    if (value.length === 0) {
        return `${spaces(indent)}[]`;
    }

    const lines: string[] = [];
    for (const item of value) {
        if (isScalar(item)) {
            lines.push(`${spaces(indent)}- ${formatScalar(item)}`);
            continue;
        }
        if (isYamlArray(item)) {
            lines.push(`${spaces(indent)}-`);
            lines.push(emitArray(item, indent + 2));
            continue;
        }
        const rendered = emitObject(item, indent + 2).split('\n');
        const first = rendered[0];
        if (first === undefined) {
            lines.push(`${spaces(indent)}- {}`);
            continue;
        }
        lines.push(`${spaces(indent)}- ${first.trimStart()}`);
        for (const line of rendered.slice(1)) {
            lines.push(line);
        }
    }
    return lines.join('\n');
}

function isScalar(value: YamlValue): value is YamlScalar {
    return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isYamlArray(value: YamlValue): value is readonly YamlValue[] {
    return Array.isArray(value);
}

function formatKey(key: string): string {
    return isPlainScalar(key) ? key : JSON.stringify(key);
}

function formatScalar(value: YamlScalar): string {
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (isPlainScalar(value) && !isReservedScalar(value) && !looksLikeNumber(value)) {
        return value;
    }
    return JSON.stringify(value);
}

function isPlainScalar(value: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_./\-]*$/.test(value);
}

function isReservedScalar(value: string): boolean {
    const lower = value.toLowerCase();
    return lower === 'null' || lower === 'true' || lower === 'false';
}

function looksLikeNumber(value: string): boolean {
    // Quote values that look like bare numbers (would be parsed as numbers by YAML)
    // This includes scientific notation like "1e-12", "1.0e-7"
    // But NOT version strings like "v1" or "1.0" that are meant to be strings
    return /^-?(?:\d+\.\d*|\d*\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(value);
}

function spaces(count: number): string {
    return ' '.repeat(count);
}
