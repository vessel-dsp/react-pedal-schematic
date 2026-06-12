import { describe, expect, test } from 'bun:test';
import { EMPTY_DOCUMENT, type CircuitDocument } from '../../packages/core/src/model/types';
import { buildJointDiagramModel, movedOriginForNodePosition } from '../../playground/src/lib/joint-diagram';

describe('buildJointDiagramModel', () => {
    test('maps component terminals into JointJS-style ports', () => {
        const doc: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'R1',
                kind: 'resistor',
                name: 'R1',
                origin: { x: 0, y: 0 },
                rotation: 0,
                flipped: false,
                terminals: [
                    { name: 'a', position: { x: 20, y: 0 } },
                    { name: 'b', position: { x: -20, y: 0 } },
                ],
                properties: {},
                sourceTypeName: null,
            }],
        };

        const model = buildJointDiagramModel(doc, { padding: 0 });
        expect(model.nodes).toHaveLength(1);
        expect(model.nodes[0]?.originalOrigin).toEqual({ x: 0, y: 0 });
        expect(model.nodes[0]?.ports.map((p) => p.id)).toEqual(['a', 'b']);
        expect(model.nodes[0]?.ports.map((p) => p.terminalName)).toEqual(['a', 'b']);
    });

    test('translates a moved JointJS node position back into a circuit component origin', () => {
        const doc: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'R1',
                kind: 'resistor',
                name: 'R1',
                origin: { x: 10, y: 20 },
                rotation: 0,
                flipped: false,
                terminals: [
                    { name: 'a', position: { x: 30, y: 20 } },
                    { name: 'b', position: { x: -10, y: 20 } },
                ],
                properties: {},
                sourceTypeName: null,
            }],
        };
        const node = buildJointDiagramModel(doc, { padding: 0 }).nodes[0]!;
        expect(movedOriginForNodePosition(node, {
            x: node.position.x + 15,
            y: node.position.y - 5,
        })).toEqual({ x: 25, y: 15 });
    });

    test('splits a wire at a terminal touching the wire body so JointJS can render an inferred junction', () => {
        const doc: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'R2',
                kind: 'resistor',
                name: 'R2',
                origin: { x: -100, y: 20 },
                rotation: 0,
                flipped: false,
                terminals: [{ name: 'a', position: { x: -100, y: 0 } }],
                properties: {},
                sourceTypeName: null,
            }],
            wires: [{
                id: 'main',
                endpoints: [{ x: -130, y: 0 }, { x: 0, y: 0 }],
            }],
        };

        const model = buildJointDiagramModel(doc, { padding: 0 });
        expect(model.links).toEqual([
            {
                id: 'main-1',
                source: { point: { x: 0, y: 22 } },
                target: { componentId: 'R2', portId: 'a' },
            },
            {
                id: 'main-2',
                source: { componentId: 'R2', portId: 'a' },
                target: { point: { x: 130, y: 22 } },
            },
        ]);
        expect(model.junctions).toEqual([{ id: 'junction-0', position: { x: 30, y: 22 } }]);
    });
});
