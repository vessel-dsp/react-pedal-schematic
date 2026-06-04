import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type DragEvent,
    type PointerEvent,
    type ReactElement,
    type ReactNode,
    type WheelEvent,
} from 'react';
import { computeComponentBox } from '../preview/box-layout';
import { computeDocumentBounds, type Bounds, viewBoxString } from '../preview/bounds';
import { colorForKind } from '../preview/colors';
import { findJunctions } from '../preview/junctions';
import { computeLabelTextBoxLayout, shouldRenderLabelTextBox } from '../preview/label-layout';
import { buildRenderableWires } from '../preview/renderable-wires';
import { orthogonalPath, pointsToSvg } from '../preview/routing';
import { findSnap } from '../preview/snap';
import { symbolFor } from '../preview/symbols';
import type { CircuitDocument, Component, Point, PropertyValue, Wire } from '../model/types';

export type SchematicViewProps = Readonly<{
    document: CircuitDocument;
    className?: string;
    style?: CSSProperties;
    padding?: number;
    showLabels?: boolean;
    editMode?: boolean;
    selectedId?: string | null;
    onSelect?: (id: string | null) => void;
    onMoveComponent?: (id: string, origin: Point) => void;
    onCanvasDrop?: (event: DragEvent<SVGSVGElement>, origin: Point) => void;
    snapTo?: number;
    snapRadius?: number;
    minZoom?: number;
    maxZoom?: number;
}>;

type DragState = Readonly<{
    componentId: string;
    pointerId: number;
    offset: Point;
    currentOrigin: Point;
    snappedTo: Point | null;
}>;

type PanState = Readonly<{
    pointerId: number;
    startScreen: Point;
    initial: Bounds;
    active: boolean;
}>;

const PAN_THRESHOLD = 3;

export function SchematicView(props: SchematicViewProps): ReactElement {
    const {
        document,
        className,
        style,
        padding,
        showLabels = true,
        editMode = false,
        selectedId = null,
        onSelect,
        onMoveComponent,
        onCanvasDrop,
        snapTo = 10,
        snapRadius = 12,
        minZoom = 0.1,
        maxZoom = 10,
    } = props;

    const contentBounds = useMemo(() => computeDocumentBounds(document, padding), [document, padding]);
    const initialBoundsRef = useRef<Bounds>(contentBounds);
    const [viewBox, setViewBox] = useState<Bounds>(contentBounds);

    useEffect(() => {
        initialBoundsRef.current = contentBounds;
    }, [contentBounds]);

    const svgRef = useRef<SVGSVGElement | null>(null);
    const [drag, setDrag] = useState<DragState | null>(null);
    const [pan, setPan] = useState<PanState | null>(null);

    function svgPoint(
        event: PointerEvent<SVGElement> | WheelEvent<SVGElement> | DragEvent<SVGElement>,
    ): Point | null {
        const svg = svgRef.current;
        if (svg === null) {
            return null;
        }
        const ctm = svg.getScreenCTM();
        if (ctm === null) {
            return null;
        }
        const pt = svg.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;
        const transformed = pt.matrixTransform(ctm.inverse());
        return { x: transformed.x, y: transformed.y };
    }

    function svgScale(): { x: number; y: number } {
        const svg = svgRef.current;
        if (svg === null) {
            return { x: 1, y: 1 };
        }
        const rect = svg.getBoundingClientRect();
        return { x: viewBox.width / rect.width, y: viewBox.height / rect.height };
    }

    function handleWheel(event: WheelEvent<SVGSVGElement>): void {
        event.preventDefault();
        const cursor = svgPoint(event);
        if (cursor === null) {
            return;
        }
        const factor = Math.exp(event.deltaY * 0.0015);
        const scale = viewBox.width / initialBoundsRef.current.width;
        const nextScale = clamp(scale * factor, minZoom, maxZoom);
        const realFactor = nextScale / scale;
        const newWidth = viewBox.width * realFactor;
        const newHeight = viewBox.height * realFactor;
        const newMinX = cursor.x - (cursor.x - viewBox.minX) * realFactor;
        const newMinY = cursor.y - (cursor.y - viewBox.minY) * realFactor;
        setViewBox({
            minX: newMinX,
            minY: newMinY,
            maxX: newMinX + newWidth,
            maxY: newMinY + newHeight,
            width: newWidth,
            height: newHeight,
        });
    }

    function handleBackgroundPointerDown(event: PointerEvent<SVGSVGElement>): void {
        if (event.target !== event.currentTarget) {
            return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        setPan({
            pointerId: event.pointerId,
            startScreen: { x: event.clientX, y: event.clientY },
            initial: viewBox,
            active: false,
        });
    }

    function handleSvgPointerMove(event: PointerEvent<SVGSVGElement>): void {
        if (pan !== null && pan.pointerId === event.pointerId) {
            const dx = event.clientX - pan.startScreen.x;
            const dy = event.clientY - pan.startScreen.y;
            if (!pan.active && Math.hypot(dx, dy) < PAN_THRESHOLD) {
                return;
            }
            const scale = svgScale();
            const newMinX = pan.initial.minX - dx * scale.x;
            const newMinY = pan.initial.minY - dy * scale.y;
            setViewBox({
                minX: newMinX,
                minY: newMinY,
                maxX: newMinX + pan.initial.width,
                maxY: newMinY + pan.initial.height,
                width: pan.initial.width,
                height: pan.initial.height,
            });
            if (!pan.active) {
                setPan({ ...pan, active: true });
            }
        }
    }

    function handleSvgPointerUp(event: PointerEvent<SVGSVGElement>): void {
        if (pan !== null && pan.pointerId === event.pointerId) {
            event.currentTarget.releasePointerCapture(event.pointerId);
            const wasPan = pan.active;
            setPan(null);
            if (!wasPan && onSelect) {
                onSelect(null);
            }
        }
    }

    function handleComponentPointerDown(component: Component, event: PointerEvent<SVGGElement>): void {
        event.stopPropagation();
        if (onSelect) {
            onSelect(component.id);
        }
        if (!editMode || !onMoveComponent) {
            return;
        }
        const point = svgPoint(event);
        if (point === null) {
            return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({
            componentId: component.id,
            pointerId: event.pointerId,
            offset: { x: point.x - component.origin.x, y: point.y - component.origin.y },
            currentOrigin: component.origin,
            snappedTo: null,
        });
    }

    function handleComponentPointerMove(event: PointerEvent<SVGGElement>): void {
        if (drag === null || event.pointerId !== drag.pointerId) {
            return;
        }
        const point = svgPoint(event);
        if (point === null) {
            return;
        }
        const raw = { x: point.x - drag.offset.x, y: point.y - drag.offset.y };
        const snapped = snap(raw, snapTo);
        const target = document.components.find((c) => c.id === drag.componentId);
        if (target === undefined) {
            return;
        }
        const result = findSnap(target, snapped, document.components, snapRadius, document.wires);
        setDrag({ ...drag, currentOrigin: result.origin, snappedTo: result.snappedTo });
    }

    function handleComponentPointerUp(event: PointerEvent<SVGGElement>): void {
        if (drag === null || event.pointerId !== drag.pointerId) {
            return;
        }
        event.currentTarget.releasePointerCapture(event.pointerId);
        const finalOrigin = drag.currentOrigin;
        const startingComponent = document.components.find((c) => c.id === drag.componentId);
        setDrag(null);
        if (onMoveComponent && startingComponent && (
            startingComponent.origin.x !== finalOrigin.x || startingComponent.origin.y !== finalOrigin.y
        )) {
            onMoveComponent(drag.componentId, finalOrigin);
        }
    }

    function handleCanvasDragOver(event: DragEvent<SVGSVGElement>): void {
        if (onCanvasDrop === undefined) {
            return;
        }
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
    }

    function handleCanvasDrop(event: DragEvent<SVGSVGElement>): void {
        if (onCanvasDrop === undefined) {
            return;
        }
        event.preventDefault();
        const point = svgPoint(event);
        if (point === null) {
            return;
        }
        onCanvasDrop(event, snap(point, snapTo));
    }

    const isPanning = pan !== null && pan.active;
    const cursorStyle: CSSProperties = isPanning
        ? { cursor: 'grabbing' }
        : { cursor: 'default' };

    function zoomBy(factor: number): void {
        const initial = initialBoundsRef.current;
        const scale = viewBox.width / initial.width;
        const nextScale = clamp(scale * factor, minZoom, maxZoom);
        const realFactor = nextScale / scale;
        const cx = viewBox.minX + viewBox.width / 2;
        const cy = viewBox.minY + viewBox.height / 2;
        const newWidth = viewBox.width * realFactor;
        const newHeight = viewBox.height * realFactor;
        const newMinX = cx - newWidth / 2;
        const newMinY = cy - newHeight / 2;
        setViewBox({
            minX: newMinX,
            minY: newMinY,
            maxX: newMinX + newWidth,
            maxY: newMinY + newHeight,
            width: newWidth,
            height: newHeight,
        });
    }

    function fitToView(): void {
        setViewBox(initialBoundsRef.current);
    }
    const renderComponents = document.components.map((component) => {
        if (drag?.componentId !== component.id) {
            return component;
        }
        return withOrigin(component, drag.currentOrigin);
    });
    const renderWires = document.wires.map((wire) => remapWireForDrag(wire, drag, document));
    const renderDocument: CircuitDocument = {
        ...document,
        components: renderComponents,
        wires: renderWires,
    };
    const renderableWires = buildRenderableWires(renderDocument);
    const terminalPositions = renderComponents.flatMap((c) => c.terminals.map((t) => t.position));
    const junctions = findJunctions(renderWires, terminalPositions);

    return (
        <div className={className} style={{ position: 'relative', ...style }}>
        <svg
            ref={svgRef}
            viewBox={viewBoxString(viewBox)}
            preserveAspectRatio="xMidYMid meet"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Schematic preview"
            style={{ width: '100%', height: '100%', display: 'block', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none', ...cursorStyle }}
            onPointerDown={handleBackgroundPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerCancel={handleSvgPointerUp}
            onWheel={handleWheel}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
        >
            <g>
                {renderableWires.map((wire) => (
                    <WireGlyph
                        key={wire.id}
                        wire={wire}
                    />
                ))}
            </g>
            <g>
                {renderComponents.map((renderComponent) => {
                    const isDragging = drag?.componentId === renderComponent.id;
                    const sourceComponent = document.components.find((c) => c.id === renderComponent.id) ?? renderComponent;
                    return (
                        <ComponentGlyph
                            key={renderComponent.id}
                            component={renderComponent}
                            showLabel={showLabels}
                            selected={selectedId === renderComponent.id}
                            editMode={editMode}
                            isDragging={isDragging}
                            onPointerDown={(event) => handleComponentPointerDown(sourceComponent, event)}
                            onPointerMove={handleComponentPointerMove}
                            onPointerUp={handleComponentPointerUp}
                        />
                    );
                })}
            </g>
            <g pointerEvents="none">
                {junctions.map((point, index) => (
                    <circle
                        key={`junction-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r={3}
                        fill="currentColor"
                    />
                ))}
            </g>
            {drag?.snappedTo && (
                <SnapIndicator point={drag.snappedTo} />
            )}
        </svg>
        <CanvasControls
            onZoomIn={() => zoomBy(1 / 1.5)}
            onZoomOut={() => zoomBy(1.5)}
            onFit={fitToView}
        />
        </div>
    );
}

function CanvasControls(props: {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFit: () => void;
}): ReactElement {
    const groupStyle: CSSProperties = {
        position: 'absolute',
        bottom: 12,
        left: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        zIndex: 1,
    };
    return (
        <div style={groupStyle}>
            <CanvasButton label="Zoom in" onClick={props.onZoomIn}>+</CanvasButton>
            <CanvasButton label="Zoom out" onClick={props.onZoomOut}>−</CanvasButton>
            <CanvasButton label="Fit to view" onClick={props.onFit}>⊡</CanvasButton>
        </div>
    );
}

function CanvasButton(props: { label: string; onClick: () => void; children: ReactNode }): ReactElement {
    const style: CSSProperties = {
        width: 28,
        height: 28,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--cpe-bg, white)',
        color: 'currentColor',
        border: '1px solid currentColor',
        borderRadius: 4,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1,
        opacity: 0.85,
    };
    return (
        <button
            type="button"
            aria-label={props.label}
            title={props.label}
            onClick={props.onClick}
            style={style}
        >
            {props.children}
        </button>
    );
}

function remapWireForDrag(wire: Wire, drag: DragState | null, document: CircuitDocument): Wire {
    if (drag === null) {
        return wire;
    }
    const original = document.components.find((c) => c.id === drag.componentId);
    if (original === undefined) {
        return wire;
    }
    const dx = drag.currentOrigin.x - original.origin.x;
    const dy = drag.currentOrigin.y - original.origin.y;
    const movedSet = new Map<string, Point>();
    for (const terminal of original.terminals) {
        movedSet.set(
            pointKey(terminal.position),
            { x: terminal.position.x + dx, y: terminal.position.y + dy },
        );
    }
    const a = movedSet.get(pointKey(wire.endpoints[0])) ?? wire.endpoints[0];
    const b = movedSet.get(pointKey(wire.endpoints[1])) ?? wire.endpoints[1];
    if (a === wire.endpoints[0] && b === wire.endpoints[1]) {
        return wire;
    }
    return { ...wire, endpoints: [a, b] };
}

function pointKey(p: Point): string {
    return `${p.x},${p.y}`;
}

function withOrigin(component: Component, origin: Point): Component {
    const dx = origin.x - component.origin.x;
    const dy = origin.y - component.origin.y;
    const terminals = component.terminals.map((t) => ({
        name: t.name,
        position: { x: t.position.x + dx, y: t.position.y + dy },
    }));
    return { ...component, origin, terminals };
}

function snap(point: Point, step: number): Point {
    if (step <= 0) {
        return point;
    }
    return {
        x: Math.round(point.x / step) * step,
        y: Math.round(point.y / step) * step,
    };
}

function clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function WireGlyph({ wire }: { wire: Wire }): ReactElement {
    const path = orthogonalPath(wire.endpoints[0], wire.endpoints[1]);
    return (
        <polyline
            points={pointsToSvg(path)}
            stroke="currentColor"
            strokeWidth={0.95}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        />
    );
}

function SnapIndicator({ point }: { point: Point }): ReactElement {
    return (
        <g pointerEvents="none">
            <circle cx={point.x} cy={point.y} r={8} fill="none" stroke="currentColor" strokeOpacity={0.85} strokeWidth={1.5} />
            <circle cx={point.x} cy={point.y} r={3} fill="currentColor" />
        </g>
    );
}

type ComponentGlyphProps = Readonly<{
    component: Component;
    showLabel: boolean;
    selected: boolean;
    editMode: boolean;
    isDragging: boolean;
    onPointerDown: (event: PointerEvent<SVGGElement>) => void;
    onPointerMove: (event: PointerEvent<SVGGElement>) => void;
    onPointerUp: (event: PointerEvent<SVGGElement>) => void;
}>;

function ComponentGlyph(props: ComponentGlyphProps): ReactElement {
    const { component, showLabel, selected, editMode, isDragging, onPointerDown, onPointerMove, onPointerUp } = props;

    if (component.kind === 'label') {
        return (
            <g
                data-component-id={component.id}
                data-component-kind="label"
                data-selected={selected || undefined}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={editMode ? { cursor: isDragging ? 'grabbing' : 'grab' } : { cursor: 'pointer' }}
            >
                <LabelGlyph component={component} selected={selected} />
            </g>
        );
    }

    const def = symbolFor(component.kind, component.sourceTypeName);
    const isUnsupported = component.kind === 'unsupported';
    const box = computeComponentBox(component);
    const kindColor = colorForKind(component.kind);
    const symbolTransform = `translate(${component.origin.x},${component.origin.y}) rotate(${-component.rotation * 90})${
        component.flipped ? ' scale(1, -1)' : ''
    }`;

    return (
        <g
            data-component-id={component.id}
            data-component-kind={component.kind}
            data-selected={selected || undefined}
            opacity={isUnsupported ? 0.7 : isDragging ? 0.85 : 1}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={editMode ? { cursor: isDragging ? 'grabbing' : 'grab' } : { cursor: 'pointer' }}
        >
            <rect
                x={box.minX}
                y={box.minY}
                width={box.width}
                height={box.height}
                rx={5}
                stroke={kindColor}
                strokeWidth={selected ? 2 : 1.25}
                strokeOpacity={selected ? 1 : 0.8}
                strokeDasharray={isUnsupported ? '4 3' : undefined}
                fill={kindColor}
                fillOpacity={0.22}
            />
            <g
                transform={symbolTransform}
                pointerEvents="none"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                dangerouslySetInnerHTML={{ __html: def.content }}
            />
            {component.terminals.map((terminal, index) => (
                <circle
                    key={`${terminal.name}-${index}`}
                    cx={terminal.position.x}
                    cy={terminal.position.y}
                    r={2.5}
                    fill="currentColor"
                    pointerEvents="none"
                />
            ))}
            {showLabel && (
                <HaloText
                    x={(box.minX + box.maxX) / 2}
                    y={box.maxY + 12}
                    fontSize={11}
                    fontWeight={600}
                >
                    {component.name}
                </HaloText>
            )}
        </g>
    );
}

function LabelGlyph({ component, selected }: { component: Component; selected: boolean }): ReactElement {
    const text = stringValue(component.properties.Text) ?? component.name;
    const subtext = stringValue(component.properties.Subtext);
    if (shouldRenderLabelTextBox(text, subtext)) {
        return <LabelTextBox origin={component.origin} text={text} subtext={subtext} selected={selected} />;
    }
    return (
        <g>
            {selected && (
                <rect
                    x={component.origin.x - 80}
                    y={component.origin.y - 14}
                    width={160}
                    height={subtext === null ? 22 : 38}
                    rx={4}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                />
            )}
            <HaloText x={component.origin.x} y={component.origin.y} fontSize={14} fontWeight={700}>
                {text}
            </HaloText>
            {subtext !== null && (
                <HaloText
                    x={component.origin.x}
                    y={component.origin.y + 16}
                    fontSize={10}
                    fontWeight={400}
                    opacity={0.65}
                >
                    {subtext}
                </HaloText>
            )}
        </g>
    );
}

function LabelTextBox(props: {
    origin: Point;
    text: string;
    subtext: string | null;
    selected: boolean;
}): ReactElement {
    const layout = computeLabelTextBoxLayout(props.text, props.subtext);
    const textX = props.origin.x + layout.paddingX;
    const textY = props.origin.y + layout.paddingY + layout.fontSize;

    return (
        <g>
            <rect
                data-label-textbox="true"
                x={props.origin.x}
                y={props.origin.y}
                width={layout.width}
                height={layout.height}
                rx={4}
                fill="var(--cpe-bg, white)"
                fillOpacity={0.9}
                stroke="currentColor"
                strokeWidth={props.selected ? 1.5 : 0.8}
                strokeOpacity={props.selected ? 0.75 : 0.22}
            />
            <text
                x={textX}
                y={textY}
                fill="currentColor"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontSize={layout.fontSize}
                fontWeight={500}
                textAnchor="start"
                opacity={0.82}
                pointerEvents="none"
            >
                {layout.lines.map((line, index) => (
                    <tspan
                        key={`${index}-${line}`}
                        data-label-line="true"
                        x={textX}
                        dy={index === 0 ? 0 : layout.lineHeight}
                    >
                        {line.length === 0 ? ' ' : line}
                    </tspan>
                ))}
            </text>
        </g>
    );
}

function HaloText(props: {
    x: number;
    y: number;
    fontSize: number;
    fontWeight: number;
    opacity?: number;
    children: ReactNode;
}): ReactElement {
    const style: CSSProperties = {
        paintOrder: 'stroke',
        stroke: 'var(--cpe-bg, white)',
        strokeWidth: 3,
        strokeLinejoin: 'round',
    };
    return (
        <text
            x={props.x}
            y={props.y}
            fill="currentColor"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize={props.fontSize}
            fontWeight={props.fontWeight}
            textAnchor="middle"
            opacity={props.opacity ?? 1}
            style={style}
            pointerEvents="none"
        >
            {props.children}
        </text>
    );
}

function stringValue(value: PropertyValue | undefined): string | null {
    if (value === undefined) {
        return null;
    }
    if (typeof value === 'string') {
        return value;
    }
    return value.raw;
}
