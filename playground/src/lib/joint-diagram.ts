import type { CircuitDocument, Component, Point, Wire } from '@vessel-dsp/react-component';

export type JointDiagramPort = Readonly<{
    id: string;
    terminalName: string;
    x: number;
    y: number;
}>;

export type JointDiagramNode = Readonly<{
    id: string;
    label: string;
    kind: string;
    originalOrigin: Point;
    position: Point;
    size: Readonly<{ width: number; height: number }>;
    ports: readonly JointDiagramPort[];
}>;

export type JointDiagramJunction = Readonly<{
    id: string;
    position: Point;
}>;

export type JointDiagramEndpoint =
    | Readonly<{ componentId: string; portId: string }>
    | Readonly<{ junctionId: string }>
    | Readonly<{ point: Point }>;

export type JointDiagramLink = Readonly<{
    id: string;
    source: JointDiagramEndpoint;
    target: JointDiagramEndpoint;
}>;

export type JointDiagramModel = Readonly<{
    nodes: readonly JointDiagramNode[];
    junctions: readonly JointDiagramJunction[];
    links: readonly JointDiagramLink[];
}>;

export type JointDiagramOptions = Readonly<{
    padding?: number;
}>;

const DEFAULT_BOX_SIZE = 44;
const BOX_PADDING = 10;

export function buildJointDiagramModel(
    document: CircuitDocument,
    options: JointDiagramOptions = {},
): JointDiagramModel {
    const offset = computeOffset(document, options.padding ?? 48);
    const terminalsByPoint = mapTerminals(document.components);
    const splitPoints = collectSplitPoints(document.wires, terminalsByPoint);
    const junctions = splitPoints.map((point, index) => ({
        id: `junction-${index}`,
        position: translate(point, offset),
    }));
    const junctionByPoint = new Map(splitPoints.map((point, index) => [pointKey(point), junctions[index]!]));

    return {
        nodes: document.components.map((component) => componentToNode(component, offset)),
        junctions,
        links: document.wires.flatMap((wire) =>
            splitWire(wire, splitPoints).map((segment, index) => ({
                id: `${wire.id}-${index + 1}`,
                source: endpointFor(segment.endpoints[0], terminalsByPoint, junctionByPoint, offset),
                target: endpointFor(segment.endpoints[1], terminalsByPoint, junctionByPoint, offset),
            })),
        ),
    };
}

export function movedOriginForNodePosition(node: JointDiagramNode, nextPosition: Point): Point {
    return {
        x: node.originalOrigin.x + nextPosition.x - node.position.x,
        y: node.originalOrigin.y + nextPosition.y - node.position.y,
    };
}

function componentToNode(component: Component, offset: Point): JointDiagramNode {
    const bounds = componentBounds(component);
    const position = translate({ x: bounds.minX, y: bounds.minY }, offset);
    return {
        id: component.id,
        label: component.name,
        kind: component.kind,
        originalOrigin: component.origin,
        position,
        size: { width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY },
        ports: component.terminals.map((terminal) => ({
            id: terminal.name,
            terminalName: terminal.name,
            x: terminal.position.x - bounds.minX,
            y: terminal.position.y - bounds.minY,
        })),
    };
}

function componentBounds(component: Component): { minX: number; minY: number; maxX: number; maxY: number } {
    if (component.terminals.length === 0) {
        const half = DEFAULT_BOX_SIZE / 2;
        return {
            minX: component.origin.x - half,
            minY: component.origin.y - half,
            maxX: component.origin.x + half,
            maxY: component.origin.y + half,
        };
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const terminal of component.terminals) {
        minX = Math.min(minX, terminal.position.x);
        minY = Math.min(minY, terminal.position.y);
        maxX = Math.max(maxX, terminal.position.x);
        maxY = Math.max(maxY, terminal.position.y);
    }
    if (maxX - minX < DEFAULT_BOX_SIZE) {
        const centerX = (minX + maxX) / 2;
        minX = centerX - DEFAULT_BOX_SIZE / 2;
        maxX = centerX + DEFAULT_BOX_SIZE / 2;
    } else {
        minX -= BOX_PADDING;
        maxX += BOX_PADDING;
    }
    if (maxY - minY < DEFAULT_BOX_SIZE) {
        const centerY = (minY + maxY) / 2;
        minY = centerY - DEFAULT_BOX_SIZE / 2;
        maxY = centerY + DEFAULT_BOX_SIZE / 2;
    } else {
        minY -= BOX_PADDING;
        maxY += BOX_PADDING;
    }
    return { minX, minY, maxX, maxY };
}

type TerminalEndpoint = Readonly<{ componentId: string; portId: string }>;

function mapTerminals(components: readonly Component[]): ReadonlyMap<string, TerminalEndpoint> {
    const terminalsByPoint = new Map<string, TerminalEndpoint>();
    for (const component of components) {
        for (const terminal of component.terminals) {
            terminalsByPoint.set(pointKey(terminal.position), {
                componentId: component.id,
                portId: terminal.name,
            });
        }
    }
    return terminalsByPoint;
}

function collectSplitPoints(
    wires: readonly Wire[],
    terminalsByPoint: ReadonlyMap<string, TerminalEndpoint>,
): readonly Point[] {
    const candidates = new Map<string, Point>();
    for (const wire of wires) {
        for (const endpoint of wire.endpoints) {
            candidates.set(pointKey(endpoint), endpoint);
        }
    }
    for (const [key] of terminalsByPoint) {
        candidates.set(key, parsePointKey(key));
    }

    const splitPoints = new Map<string, Point>();
    for (const point of candidates.values()) {
        for (const wire of wires) {
            if (pointEquals(point, wire.endpoints[0]) || pointEquals(point, wire.endpoints[1])) {
                continue;
            }
            if (pointOnSegment(point, wire.endpoints[0], wire.endpoints[1])) {
                splitPoints.set(pointKey(point), point);
            }
        }
    }
    return Array.from(splitPoints.values());
}

function splitWire(wire: Wire, splitPoints: readonly Point[]): readonly Wire[] {
    const points = splitPoints
        .filter((point) =>
            !pointEquals(point, wire.endpoints[0]) &&
            !pointEquals(point, wire.endpoints[1]) &&
            pointOnSegment(point, wire.endpoints[0], wire.endpoints[1]),
        )
        .sort((a, b) => segmentOrder(a, wire) - segmentOrder(b, wire));

    if (points.length === 0) {
        return [wire];
    }

    const segments: Wire[] = [];
    let prev = wire.endpoints[0];
    for (const point of points) {
        segments.push({ id: wire.id, endpoints: [prev, point] });
        prev = point;
    }
    segments.push({ id: wire.id, endpoints: [prev, wire.endpoints[1]] });
    return segments;
}

function endpointFor(
    point: Point,
    terminalsByPoint: ReadonlyMap<string, TerminalEndpoint>,
    junctionByPoint: ReadonlyMap<string, JointDiagramJunction>,
    offset: Point,
): JointDiagramEndpoint {
    const key = pointKey(point);
    const terminal = terminalsByPoint.get(key);
    if (terminal !== undefined) {
        return terminal;
    }
    const junction = junctionByPoint.get(key);
    if (junction !== undefined) {
        return { junctionId: junction.id };
    }
    return { point: translate(point, offset) };
}

function computeOffset(document: CircuitDocument, padding: number): Point {
    const points: Point[] = [];
    for (const component of document.components) {
        const bounds = componentBounds(component);
        points.push({ x: bounds.minX, y: bounds.minY });
        points.push({ x: bounds.maxX, y: bounds.maxY });
    }
    for (const wire of document.wires) {
        points.push(wire.endpoints[0], wire.endpoints[1]);
    }
    if (points.length === 0) {
        return { x: padding, y: padding };
    }
    const minX = Math.min(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    return { x: padding - minX, y: padding - minY };
}

function translate(point: Point, offset: Point): Point {
    return { x: point.x + offset.x, y: point.y + offset.y };
}

function segmentOrder(point: Point, wire: Wire): number {
    const [a, b] = wire.endpoints;
    if (a.x !== b.x) {
        return (point.x - a.x) / (b.x - a.x);
    }
    if (a.y !== b.y) {
        return (point.y - a.y) / (b.y - a.y);
    }
    return 0;
}

function pointOnSegment(point: Point, a: Point, b: Point): boolean {
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
    if (cross !== 0) {
        return false;
    }
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    if (minX === maxX && minY === maxY) {
        return false;
    }
    return point.x > minX && point.x < maxX && point.y >= minY && point.y <= maxY ||
        point.y > minY && point.y < maxY && point.x >= minX && point.x <= maxX;
}

function parsePointKey(key: string): Point {
    const [x, y] = key.split(',').map(Number);
    return { x: x ?? 0, y: y ?? 0 };
}

function pointEquals(a: Point, b: Point): boolean {
    return a.x === b.x && a.y === b.y;
}

function pointKey(point: Point): string {
    return `${point.x},${point.y}`;
}
