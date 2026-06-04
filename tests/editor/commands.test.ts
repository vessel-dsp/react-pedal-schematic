import { describe, expect, test } from 'bun:test';
import { applyDocumentCommand } from '../../src/editor/commands';
import { EMPTY_DOCUMENT, type Component, type ComponentKind, type PropertyValue } from '../../src/model/types';

function makeComponent(
    id: string,
    kind: ComponentKind,
    properties: Record<string, PropertyValue> = {},
): Component {
    return {
        id,
        kind,
        name: id,
        origin: { x: 0, y: 0 },
        rotation: 0,
        flipped: false,
        terminals: [],
        properties,
        sourceTypeName: null,
    };
}

describe('applyDocumentCommand', () => {
    test('delete-component removes the matching component', () => {
        const doc = {
            ...EMPTY_DOCUMENT,
            components: [makeComponent('R1', 'resistor'), makeComponent('C1', 'capacitor')],
        };
        const next = applyDocumentCommand(doc, { type: 'delete-component', componentId: 'R1' });
        expect(next.components.map((c) => c.id)).toEqual(['C1']);
    });

    test('delete-component returns the same reference when nothing matches', () => {
        const doc = { ...EMPTY_DOCUMENT, components: [makeComponent('R1', 'resistor')] };
        const next = applyDocumentCommand(doc, { type: 'delete-component', componentId: 'missing' });
        expect(next).toBe(doc);
    });

    test('rename-component updates name', () => {
        const doc = { ...EMPTY_DOCUMENT, components: [makeComponent('R1', 'resistor')] };
        const next = applyDocumentCommand(doc, { type: 'rename-component', componentId: 'R1', newName: 'Rload' });
        expect(next.components[0]?.name).toBe('Rload');
    });

    test('rename-component trims whitespace', () => {
        const doc = { ...EMPTY_DOCUMENT, components: [makeComponent('R1', 'resistor')] };
        const next = applyDocumentCommand(doc, { type: 'rename-component', componentId: 'R1', newName: '  Rload  ' });
        expect(next.components[0]?.name).toBe('Rload');
    });

    test('rename-component returns the same reference when name unchanged', () => {
        const doc = { ...EMPTY_DOCUMENT, components: [makeComponent('R1', 'resistor')] };
        const next = applyDocumentCommand(doc, { type: 'rename-component', componentId: 'R1', newName: 'R1' });
        expect(next).toBe(doc);
    });

    test('rename-component ignores empty names', () => {
        const doc = { ...EMPTY_DOCUMENT, components: [makeComponent('R1', 'resistor')] };
        const next = applyDocumentCommand(doc, { type: 'rename-component', componentId: 'R1', newName: '   ' });
        expect(next).toBe(doc);
    });

    test('set-property parses numeric values into ParsedQuantity when existing was a quantity', () => {
        const doc = {
            ...EMPTY_DOCUMENT,
            components: [makeComponent('R1', 'resistor', {
                R: { raw: '10kΩ', value: 10000, unit: 'Ω' },
            })],
        };
        const next = applyDocumentCommand(doc, {
            type: 'set-property',
            componentId: 'R1',
            propertyName: 'R',
            value: '22k',
        });
        const r = next.components[0]?.properties.R;
        expect(typeof r).toBe('object');
        expect(r).toMatchObject({ value: 22000 });
    });

    test('set-property keeps raw string when value is unparseable', () => {
        const doc = {
            ...EMPTY_DOCUMENT,
            components: [makeComponent('R1', 'resistor', {
                R: { raw: '10k', value: 10000, unit: '' },
            })],
        };
        const next = applyDocumentCommand(doc, {
            type: 'set-property',
            componentId: 'R1',
            propertyName: 'R',
            value: 'not-a-number',
        });
        expect(next.components[0]?.properties.R).toBe('not-a-number');
    });

    test('set-property stores plain strings as strings when no quantity precedent', () => {
        const doc = { ...EMPTY_DOCUMENT, components: [makeComponent('D1', 'diode')] };
        const next = applyDocumentCommand(doc, {
            type: 'set-property',
            componentId: 'D1',
            propertyName: 'model',
            value: '1N4148',
        });
        expect(next.components[0]?.properties.model).toBe('1N4148');
    });

    test('set-property returns same reference when nothing changes', () => {
        const doc = {
            ...EMPTY_DOCUMENT,
            components: [makeComponent('R1', 'resistor', { R: { raw: '10k', value: 10000, unit: '' } })],
        };
        const next = applyDocumentCommand(doc, {
            type: 'set-property',
            componentId: 'R1',
            propertyName: 'R',
            value: '10k',
        });
        expect(next).toBe(doc);
    });

    test('remove-property drops the named key', () => {
        const doc = {
            ...EMPTY_DOCUMENT,
            components: [makeComponent('R1', 'resistor', { R: '10k', tolerance: '5%' })],
        };
        const next = applyDocumentCommand(doc, {
            type: 'remove-property',
            componentId: 'R1',
            propertyName: 'tolerance',
        });
        expect(next.components[0]?.properties).toEqual({ R: '10k' });
    });

    test('remove-property is a no-op when key missing', () => {
        const doc = { ...EMPTY_DOCUMENT, components: [makeComponent('R1', 'resistor', { R: '10k' })] };
        const next = applyDocumentCommand(doc, {
            type: 'remove-property',
            componentId: 'R1',
            propertyName: 'tolerance',
        });
        expect(next).toBe(doc);
    });

    test('move-component updates origin and shifts terminals by the delta', () => {
        const component = makeComponent('R1', 'resistor');
        const componentWithTerminals: Component = {
            ...component,
            terminals: [
                { name: 'a', position: { x: 0, y: -20 } },
                { name: 'b', position: { x: 0, y: 20 } },
            ],
        };
        const doc = { ...EMPTY_DOCUMENT, components: [componentWithTerminals] };
        const next = applyDocumentCommand(doc, {
            type: 'move-component',
            componentId: 'R1',
            origin: { x: 50, y: 30 },
        });
        const moved = next.components[0]!;
        expect(moved.origin).toEqual({ x: 50, y: 30 });
        expect(moved.terminals[0]?.position).toEqual({ x: 50, y: 10 });
        expect(moved.terminals[1]?.position).toEqual({ x: 50, y: 50 });
    });

    test('move-component returns same reference when target equals current origin', () => {
        const doc = { ...EMPTY_DOCUMENT, components: [makeComponent('R1', 'resistor')] };
        const next = applyDocumentCommand(doc, {
            type: 'move-component',
            componentId: 'R1',
            origin: { x: 0, y: 0 },
        });
        expect(next).toBe(doc);
    });

    test('add-component appends a new component using catalog terminals', () => {
        const doc = { ...EMPTY_DOCUMENT };
        const next = applyDocumentCommand(doc, {
            type: 'add-component',
            kind: 'resistor',
            origin: { x: 50, y: 30 },
        });
        expect(next.components).toHaveLength(1);
        const added = next.components[0]!;
        expect(added.kind).toBe('resistor');
        expect(added.origin).toEqual({ x: 50, y: 30 });
        expect(added.terminals).toEqual([
            { name: 'a', position: { x: 50, y: 10 } },
            { name: 'b', position: { x: 50, y: 50 } },
        ]);
    });

    test('add-component generates unique ids based on existing components', () => {
        const doc = {
            ...EMPTY_DOCUMENT,
            components: [makeComponent('R1', 'resistor'), makeComponent('R2', 'resistor')],
        };
        const next = applyDocumentCommand(doc, {
            type: 'add-component',
            kind: 'resistor',
            origin: { x: 0, y: 0 },
        });
        expect(next.components[2]?.id).toBe('R3');
    });

    test('move-component shifts wire endpoints attached to the moved terminals', () => {
        const componentWithTerminals: Component = {
            ...makeComponent('R1', 'resistor'),
            terminals: [
                { name: 'a', position: { x: 0, y: -20 } },
                { name: 'b', position: { x: 0, y: 20 } },
            ],
        };
        const doc = {
            ...EMPTY_DOCUMENT,
            components: [componentWithTerminals],
            wires: [
                { id: 'w1', endpoints: [{ x: 0, y: -20 }, { x: 100, y: -20 }] as const },
                { id: 'w2', endpoints: [{ x: 0, y: 20 }, { x: 0, y: 100 }] as const },
                { id: 'w3', endpoints: [{ x: 50, y: 50 }, { x: 60, y: 50 }] as const },
            ],
        };
        const next = applyDocumentCommand(doc, {
            type: 'move-component',
            componentId: 'R1',
            origin: { x: 30, y: 30 },
        });
        // Wire w1: endpoint (0,-20) → (30, 10) (the moved 'a' terminal); other end unchanged.
        expect(next.wires[0]?.endpoints[0]).toEqual({ x: 30, y: 10 });
        expect(next.wires[0]?.endpoints[1]).toEqual({ x: 100, y: -20 });
        // Wire w2: endpoint (0,20) → (30, 50) (the moved 'b' terminal); other end unchanged.
        expect(next.wires[1]?.endpoints[0]).toEqual({ x: 30, y: 50 });
        expect(next.wires[1]?.endpoints[1]).toEqual({ x: 0, y: 100 });
        // Wire w3 doesn't touch R1, returned unchanged.
        expect(next.wires[2]).toBe(doc.wires[2]);
    });

    test('tidy-layout moves overlapping components through the document command path', () => {
        const r1: Component = {
            ...makeComponent('R1', 'resistor'),
            terminals: [
                { name: 'a', position: { x: 0, y: -20 } },
                { name: 'b', position: { x: 0, y: 20 } },
            ],
        };
        const r2: Component = {
            ...makeComponent('R2', 'resistor'),
            origin: { x: 10, y: 0 },
            terminals: [
                { name: 'a', position: { x: 10, y: -20 } },
                { name: 'b', position: { x: 10, y: 20 } },
            ],
        };
        const doc = { ...EMPTY_DOCUMENT, components: [r1, r2] };

        const next = applyDocumentCommand(doc, { type: 'tidy-layout' });

        expect(next).not.toBe(doc);
        expect(next.components[0]?.origin).toEqual({ x: 0, y: 0 });
        expect(next.components[1]?.origin).not.toEqual({ x: 10, y: 0 });
    });
});
