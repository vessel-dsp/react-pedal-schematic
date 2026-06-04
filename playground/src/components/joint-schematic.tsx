import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import { dia, shapes } from '@joint/core';
import type { CircuitDocument } from 'react-pedal-schematic';
import {
    buildJointDiagramModel,
    movedOriginForNodePosition,
    type JointDiagramEndpoint,
    type JointDiagramLink,
    type JointDiagramModel,
    type JointDiagramNode,
} from '@/lib/joint-diagram';

type JointSchematicViewProps = Readonly<{
    document: CircuitDocument;
    className?: string;
    editMode?: boolean;
    selectedId?: string | null;
    onSelect?: (id: string | null) => void;
    onMoveComponent?: (id: string, origin: { x: number; y: number }) => void;
}>;

export function JointSchematicView(props: JointSchematicViewProps): ReactElement {
    const {
        document: circuitDocument,
        className,
        editMode = false,
        selectedId = null,
        onSelect,
        onMoveComponent,
    } = props;
    const hostRef = useRef<HTMLDivElement | null>(null);
    const onSelectRef = useRef(onSelect);
    const onMoveComponentRef = useRef(onMoveComponent);
    const model = useMemo(() => buildJointDiagramModel(circuitDocument), [circuitDocument]);

    useEffect(() => {
        onSelectRef.current = onSelect;
    }, [onSelect]);

    useEffect(() => {
        onMoveComponentRef.current = onMoveComponent;
    }, [onMoveComponent]);

    useEffect(() => {
        const host = hostRef.current;
        if (host === null) {
            return;
        }

        host.replaceChildren();
        const paperHost = globalThis.document.createElement('div');
        paperHost.style.width = '100%';
        paperHost.style.height = '100%';
        host.appendChild(paperHost);

        const graph = new dia.Graph({}, { cellNamespace: shapes });
        const nodesById = new Map(model.nodes.map((node) => [node.id, node]));
        let drag: {
            id: string;
            node: JointDiagramNode;
            cell: dia.Element;
            startClient: { x: number; y: number };
            startPosition: { x: number; y: number };
        } | null = null;
        const moveDrag = (event: MouseEvent): void => {
            if (drag === null) {
                return;
            }
            const position = positionForDrag(drag, event);
            drag.cell.position(position.x, position.y);
        };
        const finishDrag = (event: Readonly<{ clientX: number | undefined; clientY: number | undefined }>): void => {
            const activeDrag = drag;
            drag = null;
            globalThis.document.removeEventListener('mousemove', moveDrag);
            globalThis.document.removeEventListener('mouseup', finishDrag);
            if (
                activeDrag === null ||
                !editMode ||
                onMoveComponentRef.current === undefined
            ) {
                return;
            }
            const position = positionForDrag(activeDrag, event);
            activeDrag.cell.position(position.x, position.y);
            const origin = movedOriginForNodePosition(activeDrag.node, position);
            if (origin.x !== activeDrag.node.originalOrigin.x || origin.y !== activeDrag.node.originalOrigin.y) {
                onMoveComponentRef.current(activeDrag.id, origin);
            }
        };
        const startDrag = (id: string, cell: dia.Element, event: Readonly<{ clientX: number | undefined; clientY: number | undefined }>): void => {
            const node = nodesById.get(id);
            if (node === undefined) {
                return;
            }
            onSelectRef.current?.(id);
            if (!editMode) {
                return;
            }
            const position = cell.position();
            globalThis.document.removeEventListener('mousemove', moveDrag);
            globalThis.document.removeEventListener('mouseup', finishDrag);
            drag = {
                id,
                node,
                cell,
                startClient: {
                    x: event.clientX ?? 0,
                    y: event.clientY ?? 0,
                },
                startPosition: { x: position.x, y: position.y },
            };
            globalThis.document.addEventListener('mousemove', moveDrag);
            globalThis.document.addEventListener('mouseup', finishDrag);
        };
        const handleNativeMouseDown = (event: MouseEvent): void => {
            const target = event.target instanceof globalThis.Element
                ? event.target.closest('.joint-element[model-id]')
                : null;
            const id = target?.getAttribute('model-id');
            if (id === null || id === undefined) {
                return;
            }
            const cell = graph.getCell(id);
            if (cell === undefined || !cell.isElement()) {
                return;
            }
            startDrag(id, cell, event);
        };
        const paper = new dia.Paper({
            el: paperHost,
            model: graph,
            width: paperHost.clientWidth,
            height: paperHost.clientHeight,
            gridSize: 10,
            drawGrid: {
                name: 'mesh',
                args: { color: 'rgba(148, 163, 184, 0.18)', thickness: 1 },
            },
            background: { color: 'transparent' },
            async: true,
            cellViewNamespace: shapes,
            interactive: false,
        });

        graph.resetCells(createCells(model, selectedId));
        paperHost.addEventListener('mousedown', handleNativeMouseDown);

        const selectElement = (elementView: dia.ElementView): void => {
            const id = String(elementView.model.id);
            if (nodesById.has(id)) {
                onSelectRef.current?.(id);
            }
        };

        paper.on('element:pointerdown', (elementView, event) => {
            const id = String(elementView.model.id);
            const node = nodesById.get(id);
            if (node === undefined) {
                return;
            }
            onSelectRef.current?.(id);
            if (!editMode) {
                return;
            }
            startDrag(id, elementView.model, event);
        });
        paper.on('element:pointermove', (elementView, event) => {
            if (drag === null || String(elementView.model.id) !== drag.id) {
                return;
            }
            const nextPosition = {
                x: drag.startPosition.x + (event.clientX ?? drag.startClient.x) - drag.startClient.x,
                y: drag.startPosition.y + (event.clientY ?? drag.startClient.y) - drag.startClient.y,
            };
            elementView.model.position(nextPosition.x, nextPosition.y);
        });
        paper.on('element:pointerclick', selectElement);
        paper.on('blank:pointerclick', () => {
            onSelectRef.current?.(null);
        });
        paper.on('element:pointerup', (elementView, event) => {
            const id = String(elementView.model.id);
            const node = nodesById.get(id);
            if (node !== undefined) {
                onSelectRef.current?.(id);
            }
            finishDrag(event);
        });

        const resizeObserver = new ResizeObserver(() => {
            paper.setDimensions(paperHost.clientWidth, paperHost.clientHeight);
        });
        resizeObserver.observe(host);

        return () => {
            paperHost.removeEventListener('mousedown', handleNativeMouseDown);
            globalThis.document.removeEventListener('mousemove', moveDrag);
            globalThis.document.removeEventListener('mouseup', finishDrag);
            resizeObserver.disconnect();
            paper.remove();
            if (paperHost.parentNode === host) {
                host.removeChild(paperHost);
            }
        };
    }, [editMode, model]);

    return <div ref={hostRef} className={className} />;
}

function positionForDrag(
    drag: {
        startClient: { x: number; y: number };
        startPosition: { x: number; y: number };
    },
    event: Readonly<{ clientX: number | undefined; clientY: number | undefined }>,
): { x: number; y: number } {
    return {
        x: drag.startPosition.x + (event.clientX ?? drag.startClient.x) - drag.startClient.x,
        y: drag.startPosition.y + (event.clientY ?? drag.startClient.y) - drag.startClient.y,
    };
}

function createCells(model: JointDiagramModel, selectedId: string | null): dia.Cell[] {
    return [
        ...model.nodes.map((node) => createComponentCell(node, node.id === selectedId)),
        ...model.junctions.map((junction) => {
            const cell = new shapes.standard.Circle({ id: junction.id });
            cell.position(junction.position.x - 3, junction.position.y - 3);
            cell.resize(6, 6);
            cell.attr({
                body: {
                    fill: '#111827',
                    stroke: '#111827',
                    strokeWidth: 0,
                },
                label: { text: '' },
            });
            return cell;
        }),
        ...model.links.map(createLinkCell),
    ];
}

function createComponentCell(node: JointDiagramNode, selected: boolean): dia.Cell {
    const cell = new shapes.standard.Rectangle({ id: node.id });
    cell.position(node.position.x, node.position.y);
    cell.resize(node.size.width, node.size.height);
    cell.attr({
        body: {
            fill: '#ffffff',
            stroke: selected ? '#111827' : '#8a8a8a',
            strokeWidth: selected ? 2.25 : 1.5,
            rx: 8,
            ry: 8,
        },
        label: {
            text: node.label,
            fill: '#111827',
            fontSize: 12,
            fontWeight: 700,
            refY: '100%',
            y: 14,
        },
    });
    cell.prop('ports/groups/terminal', {
        position: { name: 'absolute' },
        markup: [{ tagName: 'circle', selector: 'portBody' }],
        attrs: {
            portBody: {
                magnet: true,
                r: 3.5,
                fill: '#111827',
                stroke: '#111827',
                strokeWidth: 0,
            },
        },
    });
    cell.prop('ports/items', node.ports.map((port) => ({
        id: port.id,
        group: 'terminal',
        args: { x: port.x, y: port.y },
    })));
    return cell;
}

function createLinkCell(linkModel: JointDiagramLink): dia.Cell {
    const link = new shapes.standard.Link({ id: linkModel.id });
    link.source(toJointEndpoint(linkModel.source));
    link.target(toJointEndpoint(linkModel.target));
    link.router('manhattan', {
        step: 10,
        padding: 12,
    });
    link.connector('rounded', { radius: 4 });
    link.attr({
        line: {
            stroke: '#111827',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            sourceMarker: { d: '' },
            targetMarker: { d: '' },
        },
    });
    return link;
}

function toJointEndpoint(endpoint: JointDiagramEndpoint): dia.Link.EndJSON {
    if ('componentId' in endpoint) {
        return { id: endpoint.componentId, port: endpoint.portId };
    }
    if ('junctionId' in endpoint) {
        return { id: endpoint.junctionId };
    }
    return endpoint.point;
}
