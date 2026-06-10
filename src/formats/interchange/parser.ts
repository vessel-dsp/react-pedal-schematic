import type {
    CircuitDocument,
    Component,
    ComponentKind,
    DocumentSource,
    PanelColumnOrder,
    PanelControlKind,
    PanelGridIndexing,
    PanelPlacementMetadata,
    PanelRowOrder,
    ParsedQuantity,
    Point,
    PropertyValue,
    Rotation,
    Terminal,
    Warning,
    Wire,
} from '../../model/types';

type YamlScalar = string | number | boolean | null;
type YamlValue = YamlScalar | readonly YamlValue[] | YamlObject;
type YamlObject = { [key: string]: YamlValue };

type YamlLine = Readonly<{
    indent: number;
    text: string;
    lineNumber: number;
}>;

type Cursor = {
    index: number;
};

type ParsedPair = Readonly<{
    key: string;
    rest: string;
}>;

const INTERCHANGE_SCHEMA = 'circuit-interchange/v1';

export function parseInterchangeYaml(source: string): CircuitDocument {
    const value = parseYamlSubset(source);
    const root = expectObject(value, 'root');
    const schema = expectString(root.schema, 'schema');
    if (schema !== INTERCHANGE_SCHEMA) {
        throw new Error(`unsupported interchange schema: ${schema}`);
    }

    const panel = parsePanel(root.panel);

    return {
        metadata: parseMetadata(root.metadata),
        source: parseSource(root.source),
        ...(panel === undefined ? {} : { panel }),
        components: parseComponents(root.components),
        wires: parseWires(root.wires),
        directives: parseStringArray(root.directives, 'directives'),
        warnings: parseWarnings(root.diagnostics),
        rawAttributes: parseStringRecord(root.rawAttributes, 'rawAttributes'),
    };
}

function parseYamlSubset(source: string): YamlValue {
    const lines = tokenize(source);
    if (lines.length === 0) {
        throw new Error('interchange YAML is empty');
    }
    const cursor: Cursor = { index: 0 };
    const first = lines[0];
    if (first === undefined) {
        throw new Error('interchange YAML is empty');
    }
    const value = parseBlock(lines, cursor, first.indent);
    if (cursor.index < lines.length) {
        const line = lines[cursor.index];
        throw new Error(`line ${line?.lineNumber ?? cursor.index + 1}: unexpected trailing content`);
    }
    return value;
}

function tokenize(source: string): readonly YamlLine[] {
    const lines: YamlLine[] = [];
    const rawLines = source.replace(/^﻿/, '').split(/\r?\n/);
    rawLines.forEach((rawLine, index) => {
        if (rawLine.trim().length === 0) {
            return;
        }
        const indentText = rawLine.match(/^\s*/)?.[0] ?? '';
        if (indentText.includes('\t')) {
            throw new Error(`line ${index + 1}: tabs are not supported in interchange YAML`);
        }
        lines.push({
            indent: indentText.length,
            text: rawLine.slice(indentText.length),
            lineNumber: index + 1,
        });
    });
    return lines;
}

function parseBlock(lines: readonly YamlLine[], cursor: Cursor, indent: number): YamlValue {
    const line = lines[cursor.index];
    if (line === undefined) {
        return {};
    }
    if (line.indent !== indent) {
        throw new Error(`line ${line.lineNumber}: expected indentation ${indent}, got ${line.indent}`);
    }
    if (line.text === '-' || line.text.startsWith('- ')) {
        return parseArray(lines, cursor, indent);
    }
    return parseObject(lines, cursor, indent);
}

function parseObject(lines: readonly YamlLine[], cursor: Cursor, indent: number): YamlObject {
    const out: YamlObject = {};
    while (cursor.index < lines.length) {
        const line = lines[cursor.index];
        if (line === undefined || line.indent < indent) {
            break;
        }
        if (line.indent > indent) {
            throw new Error(`line ${line.lineNumber}: unexpected indentation ${line.indent}`);
        }
        if (line.text === '-' || line.text.startsWith('- ')) {
            break;
        }

        const pair = parsePair(line.text, line.lineNumber);
        cursor.index += 1;
        out[pair.key] = pair.rest.length > 0
            ? parseInlineValue(pair.rest, line.lineNumber)
            : parseNestedValue(lines, cursor, indent, line.lineNumber);
    }
    return out;
}

function parseArray(lines: readonly YamlLine[], cursor: Cursor, indent: number): readonly YamlValue[] {
    const out: YamlValue[] = [];
    while (cursor.index < lines.length) {
        const line = lines[cursor.index];
        if (line === undefined || line.indent < indent) {
            break;
        }
        if (line.indent > indent) {
            throw new Error(`line ${line.lineNumber}: unexpected indentation ${line.indent}`);
        }
        if (line.text !== '-' && !line.text.startsWith('- ')) {
            break;
        }

        const rest = line.text === '-' ? '' : line.text.slice(2);
        cursor.index += 1;
        if (rest.length === 0) {
            out.push(parseNestedValue(lines, cursor, indent, line.lineNumber));
        } else if (looksLikePair(rest)) {
            out.push(parseObjectItem(rest, lines, cursor, indent + 2, line.lineNumber));
        } else {
            out.push(parseInlineValue(rest, line.lineNumber));
        }
    }
    return out;
}

function parseObjectItem(
    firstPairText: string,
    lines: readonly YamlLine[],
    cursor: Cursor,
    indent: number,
    lineNumber: number,
): YamlObject {
    const out: YamlObject = {};
    const firstPair = parsePair(firstPairText, lineNumber);
    out[firstPair.key] = firstPair.rest.length > 0
        ? parseInlineValue(firstPair.rest, lineNumber)
        : parseNestedValue(lines, cursor, indent, lineNumber);

    while (cursor.index < lines.length) {
        const line = lines[cursor.index];
        if (line === undefined || line.indent < indent) {
            break;
        }
        if (line.indent > indent) {
            throw new Error(`line ${line.lineNumber}: unexpected indentation ${line.indent}`);
        }
        if (line.text === '-' || line.text.startsWith('- ')) {
            break;
        }

        const pair = parsePair(line.text, line.lineNumber);
        cursor.index += 1;
        out[pair.key] = pair.rest.length > 0
            ? parseInlineValue(pair.rest, line.lineNumber)
            : parseNestedValue(lines, cursor, indent, line.lineNumber);
    }

    return out;
}

function parseNestedValue(
    lines: readonly YamlLine[],
    cursor: Cursor,
    parentIndent: number,
    lineNumber: number,
): YamlValue {
    const next = lines[cursor.index];
    if (next === undefined || next.indent <= parentIndent) {
        return {};
    }
    if (next.indent !== parentIndent + 2) {
        throw new Error(`line ${next.lineNumber}: expected indentation ${parentIndent + 2} after line ${lineNumber}`);
    }
    return parseBlock(lines, cursor, next.indent);
}

function parsePair(text: string, lineNumber: number): ParsedPair {
    const colonIndex = findPairColon(text);
    if (colonIndex <= 0) {
        throw new Error(`line ${lineNumber}: expected key/value pair`);
    }
    const keyText = text.slice(0, colonIndex);
    const restText = text.slice(colonIndex + 1);
    return {
        key: parseKey(keyText, lineNumber),
        rest: restText.startsWith(' ') ? restText.slice(1) : restText,
    };
}

function looksLikePair(text: string): boolean {
    return findPairColon(text) > 0;
}

function findPairColon(text: string): number {
    if (text.startsWith('"')) {
        const end = findJsonStringEnd(text);
        return end >= 0 && text[end + 1] === ':' ? end + 1 : -1;
    }
    return text.indexOf(':');
}

function findJsonStringEnd(text: string): number {
    let escaped = false;
    for (let index = 1; index < text.length; index += 1) {
        const char = text[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (char === '"') {
            return index;
        }
    }
    return -1;
}

function parseKey(text: string, lineNumber: number): string {
    if (!text.startsWith('"')) {
        return text;
    }
    try {
        const parsed = JSON.parse(text);
        if (typeof parsed === 'string') {
            return parsed;
        }
    } catch {
        // Fall through to the consistent parser error below.
    }
    throw new Error(`line ${lineNumber}: invalid quoted key`);
}

function parseInlineValue(text: string, lineNumber: number): YamlValue {
    if (text === '[]') {
        return [];
    }
    if (text === '{}') {
        return {};
    }
    if (text === 'null') {
        return null;
    }
    if (text === 'true') {
        return true;
    }
    if (text === 'false') {
        return false;
    }
    if (text.startsWith('"')) {
        try {
            const parsed = JSON.parse(text);
            if (typeof parsed === 'string') {
                return parsed;
            }
        } catch {
            // Fall through to the consistent parser error below.
        }
        throw new Error(`line ${lineNumber}: invalid quoted scalar`);
    }
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
        return Number(text);
    }
    return text;
}

function parseMetadata(value: YamlValue | undefined): CircuitDocument['metadata'] {
    const metadata = optionalObject(value, 'metadata');
    return {
        name: scalarText(metadata.name),
        description: scalarText(metadata.description),
        partNumber: scalarText(metadata.partNumber),
    };
}

function parseSource(value: YamlValue | undefined): DocumentSource {
    return parseStringRecord(value, 'source');
}

function parsePanel(value: YamlValue | undefined): PanelPlacementMetadata | undefined {
    if (value === undefined) {
        return undefined;
    }
    const panel = expectObject(value, 'panel');
    const layout = parsePanelLayout(panel.layout);
    return {
        layout,
        controls: parsePanelControls(panel.controls, layout),
    };
}

function parsePanelLayout(value: YamlValue | undefined): PanelPlacementMetadata['layout'] {
    const layout = expectObject(value, 'panel.layout');
    const rowOrder = parseOptionalPanelRowOrder(layout.rowOrder, 'panel.layout.rowOrder');
    const columnOrder = parseOptionalPanelColumnOrder(layout.columnOrder, 'panel.layout.columnOrder');
    return {
        kind: parsePanelLayoutKind(layout.kind, 'panel.layout.kind'),
        rows: expectPositiveInteger(layout.rows, 'panel.layout.rows'),
        columns: expectPositiveInteger(layout.columns, 'panel.layout.columns'),
        indexing: parsePanelGridIndexing(layout.indexing, 'panel.layout.indexing'),
        ...(rowOrder === undefined ? {} : { rowOrder }),
        ...(columnOrder === undefined ? {} : { columnOrder }),
    };
}

function parsePanelControls(
    value: YamlValue | undefined,
    layout: PanelPlacementMetadata['layout'],
): PanelPlacementMetadata['controls'] {
    return optionalArray(value, 'panel.controls').map((item, index) => {
        const path = `panel.controls[${index}]`;
        const control = expectObject(item, path);
        const label = parseOptionalString(control.label, `${path}.label`);
        return {
            componentId: expectString(control.componentId, `${path}.componentId`),
            controlKind: parsePanelControlKind(control.controlKind, `${path}.controlKind`),
            grid: parsePanelGridPosition(control.grid, `${path}.grid`, layout),
            ...(label === undefined ? {} : { label }),
        };
    });
}

function parsePanelGridPosition(
    value: YamlValue | undefined,
    path: string,
    layout: PanelPlacementMetadata['layout'],
): PanelPlacementMetadata['controls'][number]['grid'] {
    const grid = expectObject(value, path);
    const rowSpan = parseOptionalPositiveInteger(grid.rowSpan, `${path}.rowSpan`);
    const columnSpan = parseOptionalPositiveInteger(grid.columnSpan, `${path}.columnSpan`);
    const row = expectNonNegativeInteger(grid.row, `${path}.row`);
    const column = expectNonNegativeInteger(grid.column, `${path}.column`);
    validateGridAxis(row, rowSpan ?? 1, layout.rows, layout.indexing, `${path}.row`, 'row');
    validateGridAxis(column, columnSpan ?? 1, layout.columns, layout.indexing, `${path}.column`, 'column');
    return {
        row,
        column,
        ...(rowSpan === undefined ? {} : { rowSpan }),
        ...(columnSpan === undefined ? {} : { columnSpan }),
    };
}

function validateGridAxis(
    value: number,
    span: number,
    size: number,
    indexing: PanelGridIndexing,
    path: string,
    axisName: 'row' | 'column',
): void {
    const min = indexing === 'one-based' ? 1 : 0;
    const occupiedEnd = indexing === 'one-based' ? value + span - 1 : value + span;
    if (value < min || occupiedEnd > size) {
        const maxLabel = indexing === 'one-based' ? String(size) : String(size - 1);
        throw new Error(`${path}: expected ${indexing} ${axisName} coordinate within ${min}..${maxLabel}`);
    }
}

function parsePanelLayoutKind(value: YamlValue | undefined, path: string): 'stompbox-grid' {
    const kind = expectString(value, path);
    if (kind === 'stompbox-grid') {
        return kind;
    }
    throw new Error(`${path}: expected stompbox-grid`);
}

function parsePanelGridIndexing(value: YamlValue | undefined, path: string): PanelGridIndexing {
    const indexing = expectString(value, path);
    if (indexing === 'one-based' || indexing === 'zero-based') {
        return indexing;
    }
    throw new Error(`${path}: expected one-based or zero-based`);
}

function parseOptionalPanelRowOrder(value: YamlValue | undefined, path: string): PanelRowOrder | undefined {
    if (value === undefined) {
        return undefined;
    }
    const order = expectString(value, path);
    if (order === 'top-to-bottom' || order === 'bottom-to-top') {
        return order;
    }
    throw new Error(`${path}: expected top-to-bottom or bottom-to-top`);
}

function parseOptionalPanelColumnOrder(value: YamlValue | undefined, path: string): PanelColumnOrder | undefined {
    if (value === undefined) {
        return undefined;
    }
    const order = expectString(value, path);
    if (order === 'left-to-right' || order === 'right-to-left') {
        return order;
    }
    throw new Error(`${path}: expected left-to-right or right-to-left`);
}

function parsePanelControlKind(value: YamlValue | undefined, path: string): PanelControlKind {
    const kind = expectString(value, path);
    switch (kind) {
        case 'knob':
        case 'slider':
        case 'switch':
        case 'led':
        case 'jack':
            return kind;
        default:
            throw new Error(`${path}: expected knob, slider, switch, led, or jack`);
    }
}

function parseComponents(value: YamlValue | undefined): readonly Component[] {
    return optionalArray(value, 'components').map((item, index) => {
        const path = `components[${index}]`;
        const component = expectObject(item, path);
        return {
            id: expectString(component.id, `${path}.id`),
            kind: parseComponentKind(component.kind, `${path}.kind`),
            name: expectString(component.name, `${path}.name`),
            origin: parsePoint(component.origin, `${path}.origin`),
            rotation: parseRotation(component.rotation, `${path}.rotation`),
            flipped: expectBoolean(component.flipped, `${path}.flipped`),
            terminals: parseTerminals(component.terminals, `${path}.terminals`),
            properties: parseProperties(component.properties, `${path}.properties`),
            sourceTypeName: parseNullableString(component.sourceTypeName, `${path}.sourceTypeName`),
        };
    });
}

function parseTerminals(value: YamlValue | undefined, path: string): readonly Terminal[] {
    return optionalArray(value, path).map((item, index) => {
        const terminalPath = `${path}[${index}]`;
        const terminal = expectObject(item, terminalPath);
        return {
            name: expectString(terminal.name, `${terminalPath}.name`),
            position: parsePoint(terminal.position, `${terminalPath}.position`),
        };
    });
}

function parseProperties(value: YamlValue | undefined, path: string): Readonly<Record<string, PropertyValue>> {
    const properties = optionalObject(value, path);
    const out: Record<string, PropertyValue> = {};
    for (const [key, child] of Object.entries(properties)) {
        out[key] = parsePropertyValue(child, `${path}.${key}`);
    }
    return out;
}

function parsePropertyValue(value: YamlValue, path: string): PropertyValue {
    if (isParsedQuantityValue(value)) {
        return {
            raw: expectString(value.raw, `${path}.raw`),
            value: expectNumber(value.value, `${path}.value`),
            unit: expectString(value.unit, `${path}.unit`),
        };
    }
    if (isScalar(value)) {
        return scalarText(value);
    }
    throw new Error(`${path}: expected scalar property value or parsed quantity`);
}

function isParsedQuantityValue(value: YamlValue): value is ParsedQuantity {
    if (!isYamlObject(value)) {
        return false;
    }
    return 'raw' in value && 'value' in value && 'unit' in value;
}

function parseWires(value: YamlValue | undefined): readonly Wire[] {
    return optionalArray(value, 'wires').map((item, index) => {
        const path = `wires[${index}]`;
        const wire = expectObject(item, path);
        const points = expectArray(wire.points, `${path}.points`);
        if (points.length !== 2) {
            throw new Error(`${path}.points: expected exactly two points`);
        }
        const first = parsePoint(points[0], `${path}.points[0]`);
        const second = parsePoint(points[1], `${path}.points[1]`);
        return {
            id: expectString(wire.id, `${path}.id`),
            endpoints: [first, second],
        };
    });
}

function parseWarnings(value: YamlValue | undefined): readonly Warning[] {
    return optionalArray(value, 'diagnostics').map((item, index) => {
        const path = `diagnostics[${index}]`;
        const warning = expectObject(item, path);
        const out: Warning = {
            code: expectString(warning.code, `${path}.code`),
            message: expectString(warning.message, `${path}.message`),
            ...(warning.componentId === undefined
                ? {}
                : { componentId: expectString(warning.componentId, `${path}.componentId`) }),
            ...(warning.wireId === undefined
                ? {}
                : { wireId: expectString(warning.wireId, `${path}.wireId`) }),
        };
        return out;
    });
}

function parseStringArray(value: YamlValue | undefined, path: string): readonly string[] {
    return optionalArray(value, path).map((item, index) => scalarText(item, `${path}[${index}]`));
}

function parseStringRecord(value: YamlValue | undefined, path: string): Readonly<Record<string, string>> {
    const record = optionalObject(value, path);
    const out: Record<string, string> = {};
    for (const [key, child] of Object.entries(record)) {
        out[key] = scalarText(child, `${path}.${key}`);
    }
    return out;
}

function parsePoint(value: YamlValue | undefined, path: string): Point {
    const point = expectObject(value, path);
    return {
        x: expectNumber(point.x, `${path}.x`),
        y: expectNumber(point.y, `${path}.y`),
    };
}

function parseRotation(value: YamlValue | undefined, path: string): Rotation {
    const rotation = expectNumber(value, path);
    if (rotation === 0 || rotation === 1 || rotation === 2 || rotation === 3) {
        return rotation;
    }
    throw new Error(`${path}: expected rotation 0, 1, 2, or 3`);
}

function parseNullableString(value: YamlValue | undefined, path: string): string | null {
    if (value === null || value === undefined) {
        return null;
    }
    return expectString(value, path);
}

function parseComponentKind(value: YamlValue | undefined, path: string): ComponentKind {
    const kind = expectString(value, path);
    switch (kind) {
        case 'resistor':
        case 'capacitor':
        case 'inductor':
        case 'diode':
        case 'led':
        case 'bjt':
        case 'jfet':
        case 'mosfet':
        case 'opamp':
        case 'ota':
        case 'triode':
        case 'pentode':
        case 'tube-diode':
        case 'transformer':
        case 'potentiometer':
        case 'variable-resistor':
        case 'switch':
        case 'optocoupler':
        case 'voltage-source':
        case 'current-source':
        case 'battery':
        case 'ground':
        case 'rail':
        case 'jack':
        case 'bbd':
        case 'delay-ic':
        case 'power-amp':
        case 'regulator':
        case 'analog-switch':
        case 'flipflop':
        case 'ic':
        case 'label':
        case 'named-wire':
        case 'port':
        case 'unsupported':
            return kind;
        default:
            throw new Error(`${path}: unsupported component kind "${kind}"`);
    }
}

function optionalObject(value: YamlValue | undefined, path: string): YamlObject {
    if (value === undefined) {
        return {};
    }
    return expectObject(value, path);
}

function optionalArray(value: YamlValue | undefined, path: string): readonly YamlValue[] {
    if (value === undefined) {
        return [];
    }
    return expectArray(value, path);
}

function expectObject(value: YamlValue | undefined, path: string): YamlObject {
    if (isYamlObject(value)) {
        return value;
    }
    throw new Error(`${path}: expected object`);
}

function expectArray(value: YamlValue | undefined, path: string): readonly YamlValue[] {
    if (Array.isArray(value)) {
        return value;
    }
    throw new Error(`${path}: expected array`);
}

function expectString(value: YamlValue | undefined, path: string): string {
    if (typeof value === 'string') {
        return value;
    }
    throw new Error(`${path}: expected string`);
}

function expectNumber(value: YamlValue | undefined, path: string): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    throw new Error(`${path}: expected number`);
}

function expectPositiveInteger(value: YamlValue | undefined, path: string): number {
    const number = expectNumber(value, path);
    if (Number.isInteger(number) && number > 0) {
        return number;
    }
    throw new Error(`${path}: expected positive integer`);
}

function expectNonNegativeInteger(value: YamlValue | undefined, path: string): number {
    const number = expectNumber(value, path);
    if (Number.isInteger(number) && number >= 0) {
        return number;
    }
    throw new Error(`${path}: expected non-negative integer`);
}

function parseOptionalPositiveInteger(value: YamlValue | undefined, path: string): number | undefined {
    if (value === undefined) {
        return undefined;
    }
    return expectPositiveInteger(value, path);
}

function parseOptionalString(value: YamlValue | undefined, path: string): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    return expectString(value, path);
}

function expectBoolean(value: YamlValue | undefined, path: string): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    throw new Error(`${path}: expected boolean`);
}

function scalarText(value: YamlValue | undefined, path = 'value'): string {
    if (value === undefined || value === null) {
        return '';
    }
    if (isScalar(value)) {
        return String(value);
    }
    throw new Error(`${path}: expected scalar`);
}

function isScalar(value: YamlValue): value is YamlScalar {
    return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isYamlObject(value: YamlValue | undefined): value is YamlObject {
    return value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value);
}
