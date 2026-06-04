import type { CircuitDocument, Point } from '../model/types';

export type Bounds = Readonly<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
}>;

const DEFAULT_PADDING = 60;
const FALLBACK_HALF = 160;

export function computeDocumentBounds(doc: CircuitDocument, padding: number = DEFAULT_PADDING): Bounds {
    const points: Point[] = [];

    for (const component of doc.components) {
        points.push(component.origin);
        for (const terminal of component.terminals) {
            points.push(terminal.position);
        }
    }
    for (const wire of doc.wires) {
        points.push(wire.endpoints[0], wire.endpoints[1]);
    }

    if (points.length === 0) {
        const width = FALLBACK_HALF * 2;
        return {
            minX: -FALLBACK_HALF,
            minY: -FALLBACK_HALF,
            maxX: FALLBACK_HALF,
            maxY: FALLBACK_HALF,
            width,
            height: width,
        };
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }

    const paddedMinX = minX - padding;
    const paddedMinY = minY - padding;
    const paddedMaxX = maxX + padding;
    const paddedMaxY = maxY + padding;

    return {
        minX: paddedMinX,
        minY: paddedMinY,
        maxX: paddedMaxX,
        maxY: paddedMaxY,
        width: paddedMaxX - paddedMinX,
        height: paddedMaxY - paddedMinY,
    };
}

export function viewBoxString(bounds: Bounds): string {
    return `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`;
}
