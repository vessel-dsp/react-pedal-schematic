import { parseQuantity } from '../model/quantity';
import type { CircuitDocument, Component, ComponentKind, Point, PropertyValue } from '../model/types';
import { buildComponent } from './factory';

export type DocumentCommand =
    | Readonly<{ type: 'delete-component'; componentId: string }>
    | Readonly<{ type: 'rename-component'; componentId: string; newName: string }>
    | Readonly<{ type: 'set-property'; componentId: string; propertyName: string; value: string }>
    | Readonly<{ type: 'remove-property'; componentId: string; propertyName: string }>
    | Readonly<{ type: 'move-component'; componentId: string; origin: Point }>
    | Readonly<{
        type: 'add-component';
        kind: ComponentKind;
        origin: Point;
        sourceTypeName?: string | null;
    }>;

export function applyDocumentCommand(doc: CircuitDocument, command: DocumentCommand): CircuitDocument {
    switch (command.type) {
        case 'delete-component':
            return deleteComponent(doc, command.componentId);
        case 'rename-component':
            return renameComponent(doc, command.componentId, command.newName);
        case 'set-property':
            return setProperty(doc, command.componentId, command.propertyName, command.value);
        case 'remove-property':
            return removeProperty(doc, command.componentId, command.propertyName);
        case 'move-component':
            return moveComponent(doc, command.componentId, command.origin);
        case 'add-component':
            return addComponent(doc, command.kind, command.origin, command.sourceTypeName ?? null);
    }
}

function addComponent(
    doc: CircuitDocument,
    kind: ComponentKind,
    origin: Point,
    sourceTypeName: string | null,
): CircuitDocument {
    const existingIds = new Set(doc.components.map((c) => c.id));
    const component = buildComponent({ kind, origin, sourceTypeName, existingIds });
    return { ...doc, components: [...doc.components, component] };
}

function moveComponent(doc: CircuitDocument, componentId: string, origin: Point): CircuitDocument {
    const target = doc.components.find((c) => c.id === componentId);
    if (target === undefined || (target.origin.x === origin.x && target.origin.y === origin.y)) {
        return doc;
    }
    const dx = origin.x - target.origin.x;
    const dy = origin.y - target.origin.y;
    const terminalMoves = new Map<string, Point>();
    for (const terminal of target.terminals) {
        const newPosition = { x: terminal.position.x + dx, y: terminal.position.y + dy };
        terminalMoves.set(pointKey(terminal.position), newPosition);
    }

    const components = doc.components.map((c) => {
        if (c.id !== componentId) {
            return c;
        }
        const terminals = c.terminals.map((t) => ({
            name: t.name,
            position: terminalMoves.get(pointKey(t.position)) ?? { x: t.position.x + dx, y: t.position.y + dy },
        }));
        return { ...c, origin, terminals };
    });

    const wires = doc.wires.map((w) => {
        const newA = terminalMoves.get(pointKey(w.endpoints[0]));
        const newB = terminalMoves.get(pointKey(w.endpoints[1]));
        if (newA === undefined && newB === undefined) {
            return w;
        }
        return {
            ...w,
            endpoints: [newA ?? w.endpoints[0], newB ?? w.endpoints[1]] as readonly [Point, Point],
        };
    });

    return { ...doc, components, wires };
}

function pointKey(p: Point): string {
    return `${p.x},${p.y}`;
}

function deleteComponent(doc: CircuitDocument, componentId: string): CircuitDocument {
    const components = doc.components.filter((c) => c.id !== componentId);
    if (components.length === doc.components.length) {
        return doc;
    }
    return { ...doc, components };
}

function renameComponent(doc: CircuitDocument, componentId: string, newName: string): CircuitDocument {
    const trimmed = newName.trim();
    if (trimmed.length === 0) {
        return doc;
    }
    let changed = false;
    const components = doc.components.map((c) => {
        if (c.id !== componentId || c.name === trimmed) {
            return c;
        }
        changed = true;
        return { ...c, name: trimmed };
    });
    return changed ? { ...doc, components } : doc;
}

function setProperty(
    doc: CircuitDocument,
    componentId: string,
    propertyName: string,
    rawValue: string,
): CircuitDocument {
    const trimmedName = propertyName.trim();
    if (trimmedName.length === 0) {
        return doc;
    }
    let changed = false;
    const components = doc.components.map((c) => {
        if (c.id !== componentId) {
            return c;
        }
        const next: PropertyValue = nextValue(c, trimmedName, rawValue);
        if (propertyEquals(c.properties[trimmedName], next)) {
            return c;
        }
        changed = true;
        return { ...c, properties: { ...c.properties, [trimmedName]: next } };
    });
    return changed ? { ...doc, components } : doc;
}

function removeProperty(doc: CircuitDocument, componentId: string, propertyName: string): CircuitDocument {
    let changed = false;
    const components = doc.components.map((c) => {
        if (c.id !== componentId || c.properties[propertyName] === undefined) {
            return c;
        }
        changed = true;
        const { [propertyName]: _omitted, ...rest } = c.properties;
        return { ...c, properties: rest };
    });
    return changed ? { ...doc, components } : doc;
}

function nextValue(component: Component, propertyName: string, rawValue: string): PropertyValue {
    const existing = component.properties[propertyName];
    const existingWasQuantity = existing !== undefined && typeof existing !== 'string';
    if (existingWasQuantity) {
        const parsed = parseQuantity(rawValue);
        if (parsed !== null) {
            return parsed;
        }
        return rawValue;
    }
    const parsed = parseQuantity(rawValue);
    if (parsed !== null && parsed.unit.length > 0) {
        return parsed;
    }
    return rawValue;
}

function propertyEquals(a: PropertyValue | undefined, b: PropertyValue): boolean {
    if (a === undefined) {
        return false;
    }
    if (typeof a === 'string' && typeof b === 'string') {
        return a === b;
    }
    if (typeof a !== 'string' && typeof b !== 'string') {
        return a.raw === b.raw && a.value === b.value && a.unit === b.unit;
    }
    return false;
}
