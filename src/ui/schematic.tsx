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
import { findHangingEndpoints } from '../preview/hanging';
import { findJunctions } from '../preview/junctions';
import { computeLabelTextBoxLayout, shouldRenderLabelTextBox } from '../preview/label-layout';
import { collectPorts, findNearestPort, findNearestWireBodyHit, type Port, type WireBodyHit } from '../preview/ports';
import { findChainCorners, findWireChain } from '../preview/wire-chains';
import { buildRenderableWires } from '../preview/renderable-wires';
import { orthogonalPath, pointsToSvg } from '../preview/routing';
import { findSnap } from '../preview/snap';
import { symbolFor } from '../preview/symbols';
import type { CircuitDocument, Component, Point, PropertyValue, Wire } from '../model/types';
import { extractPanel } from '../panel/extract';
import { nearestKnobStep } from '../panel/knobs';
import type { ControlState, ControlValue, KnobStep, SliderControl } from '../panel/types';

export type SchematicViewProps = Readonly<{
    document: CircuitDocument;
    className?: string;
    style?: CSSProperties;
    padding?: number;
    showLabels?: boolean;
    wireFlow?: WireFlowMode;
    editMode?: boolean;
    selectedId?: string | null;
    selectedWireId?: string | null;
    onSelect?: (id: string | null) => void;
    onSelectWire?: (wireId: string | null) => void;
    onMoveComponent?: (id: string, origin: Point) => void;
    onCanvasDrop?: (event: DragEvent<SVGSVGElement>, origin: Point) => void;
    onCreateWire?: (from: Point, to: Point) => void;
    onSplitWire?: (wireId: string, at: Point) => void;
    onMergeCorner?: (at: Point) => void;
    snapTo?: number;
    snapRadius?: number;
    minZoom?: number;
    maxZoom?: number;
    showHangingEndpoints?: boolean;
    controlState?: ControlState;
    controlOverlay?: (ctx: ControlOverlayContext) => ReactNode;
}>;

export type ControlOverlayContext = Readonly<{
    document: CircuitDocument;
    controlState: ControlState;
    componentPositions: ReadonlyMap<string, Point>;
    viewBox: Readonly<{
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
}>;

export type WireFlowMode = 'none' | 'all';

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

type WireSnapTarget =
    | Readonly<{ kind: 'port'; port: VisualPort }>
    | Readonly<{ kind: 'wire-body'; hit: WireBodyHit }>;

type WireCreateState = Readonly<{
    pointerId: number;
    fromComponentId: string;
    fromTerminalName: string;
    from: Point;
    fromModel: Point;
    cursor: Point;
    snappedTo: WireSnapTarget | null;
}>;

type VisualPort = Port & Readonly<{
    modelPosition: Point;
}>;

function snapTargetVisualPoint(target: WireSnapTarget): Point {
    return target.kind === 'port' ? target.port.position : target.hit.position;
}

function snapTargetModelPoint(target: WireSnapTarget): Point {
    return target.kind === 'port' ? target.port.modelPosition : target.hit.position;
}

const PAN_THRESHOLD = 3;
const SCHEMATIC_TEXT_FONT =
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
const COMPONENT_CARD_LABEL_RATIO = 0.25;
const COMPONENT_CARD_LABEL_FONT_SIZE = 5.5;
const COMPONENT_CARD_LABEL_MAX_WIDTH_PADDING = 5;
const COMPONENT_CARD_STROKE_WIDTH = 0.75;
const COMPONENT_CARD_SELECTED_STROKE_WIDTH = 1.25;
const EMPTY_CONTROL_STATE: ControlState = Object.freeze({});
const CONTROL_ACCENT = 'var(--cpe-control-accent, #2563eb)';

export function SchematicView(props: SchematicViewProps): ReactElement {
    const {
        document,
        className,
        style,
        padding,
        showLabels = true,
        wireFlow = 'none',
        editMode = false,
        selectedId = null,
        selectedWireId = null,
        onSelect,
        onSelectWire,
        onMoveComponent,
        onCanvasDrop,
        onCreateWire,
        onSplitWire,
        onMergeCorner,
        snapTo = 10,
        snapRadius = 12,
        minZoom = 0.1,
        maxZoom = 10,
        showHangingEndpoints = true,
        controlState = EMPTY_CONTROL_STATE,
        controlOverlay,
    } = props;

    const contentBounds = useMemo(() => computeDocumentBounds(document, padding), [document, padding]);
    const modelPorts = useMemo(() => collectPorts(document.components), [document.components]);
    const panel = useMemo(() => extractPanel(document), [document]);
    const ledColors = useMemo(() => {
        const colors = new Map<string, string>();
        for (const led of panel.leds) {
            colors.set(led.id, led.color ?? 'red');
        }
        return colors;
    }, [panel]);
    const knobSteps = useMemo(() => {
        const stepsById = new Map<string, readonly KnobStep[]>();
        for (const knob of panel.knobs) {
            if (knob.steps !== undefined) {
                stepsById.set(knob.id, knob.steps);
            }
        }
        return stepsById;
    }, [panel]);
    const sliderControls = useMemo(() => {
        const slidersById = new Map<string, SliderControl>();
        for (const slider of panel.sliders ?? []) {
            slidersById.set(slider.id, slider);
        }
        return slidersById;
    }, [panel]);
    const initialBoundsRef = useRef<Bounds>(contentBounds);
    const [viewBox, setViewBox] = useState<Bounds>(contentBounds);

    useEffect(() => {
        initialBoundsRef.current = contentBounds;
    }, [contentBounds]);

    const svgRef = useRef<SVGSVGElement | null>(null);
    const [drag, setDrag] = useState<DragState | null>(null);
    const [pan, setPan] = useState<PanState | null>(null);
    const [wireCreate, setWireCreate] = useState<WireCreateState | null>(null);

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
            return;
        }
        if (wireCreate !== null && wireCreate.pointerId === event.pointerId) {
            const cursor = svgPoint(event);
            if (cursor === null) {
                return;
            }
            const portHit = findNearestPort(visualPorts, cursor, snapRadius, {
                componentId: wireCreate.fromComponentId,
                terminalName: wireCreate.fromTerminalName,
            });
            // Prefer a port match; fall back to snapping onto a wire's body so
            // dropping there auto-forms a T-junction via the connectivity layer.
            const snappedTo: WireSnapTarget | null = portHit !== null
                ? { kind: 'port', port: portHit }
                : (() => {
                    const hit = findNearestWireBodyHit(document.wires, cursor, snapRadius, null);
                    return hit === null ? null : { kind: 'wire-body', hit };
                })();
            setWireCreate({ ...wireCreate, cursor, snappedTo });
        }
    }

    function handleSvgPointerUp(event: PointerEvent<SVGSVGElement>): void {
        if (pan !== null && pan.pointerId === event.pointerId) {
            event.currentTarget.releasePointerCapture(event.pointerId);
            const wasPan = pan.active;
            setPan(null);
            if (!wasPan) {
                onSelect?.(null);
                onSelectWire?.(null);
            }
            return;
        }
        if (wireCreate !== null && wireCreate.pointerId === event.pointerId) {
            event.currentTarget.releasePointerCapture(event.pointerId);
            const target = wireCreate.snappedTo;
            const from = wireCreate.fromModel;
            setWireCreate(null);
            if (target !== null && onCreateWire) {
                onCreateWire(from, snapTargetModelPoint(target));
            }
        }
    }

    function handlePortPointerDown(port: VisualPort, event: PointerEvent<SVGCircleElement>): void {
        if (!editMode || onCreateWire === undefined) {
            return;
        }
        event.stopPropagation();
        const cursor = svgPoint(event);
        if (cursor === null) {
            return;
        }
        const svg = svgRef.current;
        if (svg !== null) {
            svg.setPointerCapture(event.pointerId);
        }
        setWireCreate({
            pointerId: event.pointerId,
            fromComponentId: port.componentId,
            fromTerminalName: port.terminalName,
            from: port.position,
            fromModel: port.modelPosition,
            cursor,
            snappedTo: null,
        });
    }

    function handleWirePointerDown(wireId: string, event: PointerEvent<SVGGElement>): void {
        event.stopPropagation();
        if (event.shiftKey && onSplitWire !== undefined) {
            const cursor = svgPoint(event);
            if (cursor === null) {
                return;
            }
            onSplitWire(wireId, snap(cursor, snapTo));
            return;
        }
        if (onSelectWire) {
            onSelectWire(wireId);
        }
    }

    function handleCornerPointerDown(at: Point, event: PointerEvent<SVGCircleElement>): void {
        event.stopPropagation();
        if (event.shiftKey && onMergeCorner !== undefined) {
            onMergeCorner(at);
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
    const visualTerminalMap = buildVisualTerminalMap(renderComponents, renderWires);
    const visualPorts = buildVisualPorts(modelPorts, visualTerminalMap);
    const visualComponents = renderComponents.map((component) => withVisualTerminalPositions(component, visualTerminalMap));
    const visualWires = renderWires
        .map((wire) => remapWireForVisualTerminals(wire, visualTerminalMap))
        .filter((wire) => !pointEquals(wire.endpoints[0], wire.endpoints[1]));
    const renderableWires = buildRenderableWires(renderDocument)
        .map((wire) => remapWireForVisualTerminals(wire, visualTerminalMap))
        .filter((wire) => !pointEquals(wire.endpoints[0], wire.endpoints[1]));
    const terminalPositions = visualComponents.flatMap((c) => c.terminals.map((t) => t.position));
    const junctions = findJunctions(visualWires, terminalPositions);
    const hangingEndpoints = showHangingEndpoints
        ? findHangingEndpoints({ ...renderDocument, components: visualComponents, wires: visualWires })
        : [];
    const selectedChain: ReadonlySet<string> = useMemo(() => {
        if (selectedWireId === null) {
            return new Set();
        }
        return new Set(findWireChain(selectedWireId, document));
    }, [selectedWireId, document]);
    const chainCorners = useMemo(() => findChainCorners(document), [document]);
    const componentPositions = useMemo(
        () => new Map(visualComponents.map((c) => [c.id, c.origin] as const)),
        [visualComponents],
    );
    const overlayViewBox = {
        x: viewBox.minX,
        y: viewBox.minY,
        width: viewBox.width,
        height: viewBox.height,
    };

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
                        flow={wireFlow === 'all'}
                        selected={selectedChain.has(wire.id)}
                        interactive={onSelectWire !== undefined}
                        onPointerDown={(event) => handleWirePointerDown(wire.id, event)}
                    />
                ))}
            </g>
            <g>
                {visualComponents.map((renderComponent) => {
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
                            controlValue={isDragging ? undefined : controlState[renderComponent.id]}
                            ledColor={ledColors.get(renderComponent.id) ?? 'red'}
                            knobSteps={knobSteps.get(renderComponent.id)}
                            sliderControl={sliderControls.get(renderComponent.id)}
                            onPointerDown={(event) => handleComponentPointerDown(sourceComponent, event)}
                            onPointerMove={handleComponentPointerMove}
                            onPointerUp={handleComponentPointerUp}
                        />
                    );
                })}
            </g>
            {controlOverlay !== undefined && (
                <g data-control-overlay="true" pointerEvents="none">
                    {controlOverlay({
                        document: renderDocument,
                        controlState,
                        componentPositions,
                        viewBox: overlayViewBox,
                    })}
                </g>
            )}
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
            <g pointerEvents="none" data-hanging-endpoints>
                {hangingEndpoints.map((endpoint, index) => (
                    <circle
                        key={`hanging-${endpoint.wireId}-${endpoint.endpointIndex}-${index}`}
                        cx={endpoint.point.x}
                        cy={endpoint.point.y}
                        r={6}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth={1.5}
                        strokeOpacity={0.9}
                    >
                        <title>Hanging wire endpoint (not connected to any terminal or wire)</title>
                    </circle>
                ))}
            </g>
            {editMode && onCreateWire !== undefined && (
                <g data-ports-layer>
                    {visualPorts.map((port) => (
                        <PortHandle
                            key={`port-${port.componentId}-${port.terminalName}`}
                            position={port.position}
                            onPointerDown={(event) => handlePortPointerDown(port, event)}
                        />
                    ))}
                </g>
            )}
            {editMode && onMergeCorner !== undefined && (
                <g data-corners-layer>
                    {chainCorners.map((corner, index) => (
                        <CornerHandle
                            key={`corner-${corner.x}-${corner.y}-${index}`}
                            position={corner}
                            onPointerDown={(event) => handleCornerPointerDown(corner, event)}
                        />
                    ))}
                </g>
            )}
            {wireCreate !== null && (
                <GhostWire
                    from={wireCreate.from}
                    to={wireCreate.snappedTo ? snapTargetVisualPoint(wireCreate.snappedTo) : wireCreate.cursor}
                    locked={wireCreate.snappedTo !== null}
                />
            )}
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
        fontFamily: SCHEMATIC_TEXT_FONT,
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

function buildVisualTerminalMap(components: readonly Component[], wires: readonly Wire[]): ReadonlyMap<string, Point> {
    const terminals = new Map<string, Point>();
    for (const component of components) {
        if (component.kind === 'label') {
            continue;
        }
        const box = computeComponentBox(component);
        for (const terminal of component.terminals) {
            const wireDirection = findAttachedWireDirection(terminal.position, wires);
            terminals.set(
                pointKey(terminal.position),
                projectTerminalToCardEdge(terminal.position, component.origin, box, wireDirection),
            );
        }
    }
    return terminals;
}

function buildVisualPorts(ports: readonly Port[], visualTerminals: ReadonlyMap<string, Point>): readonly VisualPort[] {
    return ports.map((port) => ({
        ...port,
        modelPosition: port.position,
        position: visualTerminals.get(pointKey(port.position)) ?? port.position,
    }));
}

function withVisualTerminalPositions(
    component: Component,
    visualTerminals: ReadonlyMap<string, Point>,
): Component {
    if (component.terminals.length === 0) {
        return component;
    }
    let changed = false;
    const terminals = component.terminals.map((terminal) => {
        const position = visualTerminals.get(pointKey(terminal.position)) ?? terminal.position;
        if (!pointEquals(position, terminal.position)) {
            changed = true;
        }
        return { name: terminal.name, position };
    });
    return changed ? { ...component, terminals } : component;
}

function remapWireForVisualTerminals(wire: Wire, visualTerminals: ReadonlyMap<string, Point>): Wire {
    const a = visualTerminals.get(pointKey(wire.endpoints[0])) ?? wire.endpoints[0];
    const b = visualTerminals.get(pointKey(wire.endpoints[1])) ?? wire.endpoints[1];
    if (pointEquals(a, wire.endpoints[0]) && pointEquals(b, wire.endpoints[1])) {
        return wire;
    }
    return { ...wire, endpoints: [a, b] };
}

function findAttachedWireDirection(position: Point, wires: readonly Wire[]): Point | null {
    for (const wire of wires) {
        const a = wire.endpoints[0];
        const b = wire.endpoints[1];
        if (pointEquals(position, a)) {
            return { x: b.x - a.x, y: b.y - a.y };
        }
        if (pointEquals(position, b)) {
            return { x: a.x - b.x, y: a.y - b.y };
        }
    }
    return null;
}

function projectTerminalToCardEdge(position: Point, origin: Point, box: Bounds, wireDirection: Point | null): Point {
    const localX = position.x - origin.x;
    const localY = position.y - origin.y;
    if (localX === 0 && localY === 0 && wireDirection === null) {
        return position;
    }

    const onEdge =
        position.x === box.minX ||
        position.x === box.maxX ||
        position.y === box.minY ||
        position.y === box.maxY;
    if (onEdge) {
        return position;
    }

    const outside =
        position.x < box.minX ||
        position.x > box.maxX ||
        position.y < box.minY ||
        position.y > box.maxY;
    if (outside) {
        return {
            x: clamp(position.x, box.minX, box.maxX),
            y: clamp(position.y, box.minY, box.maxY),
        };
    }

    if (wireDirection !== null && (wireDirection.x !== 0 || wireDirection.y !== 0)) {
        return projectTowardCardEdge(position, wireDirection, box);
    }

    const candidates: readonly Point[] = [
        { x: box.minX, y: position.y },
        { x: box.maxX, y: position.y },
        { x: position.x, y: box.minY },
        { x: position.x, y: box.maxY },
    ];
    return candidates.reduce((best, candidate) => (
        distanceSquared(position, candidate) < distanceSquared(position, best) ? candidate : best
    ));
}

function projectTowardCardEdge(position: Point, direction: Point, box: Bounds): Point {
    if (Math.abs(direction.x) >= Math.abs(direction.y)) {
        return {
            x: direction.x < 0 ? box.minX : box.maxX,
            y: clamp(position.y, box.minY, box.maxY),
        };
    }
    return {
        x: clamp(position.x, box.minX, box.maxX),
        y: direction.y < 0 ? box.minY : box.maxY,
    };
}

function distanceSquared(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}

function pointEquals(a: Point, b: Point): boolean {
    return a.x === b.x && a.y === b.y;
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

function formatNumber(value: number): string {
    if (Object.is(value, -0)) {
        return '0';
    }
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function roundOpacity(value: number): number {
    return Number(value.toFixed(3));
}

function WireGlyph(props: {
    wire: Wire;
    flow: boolean;
    selected?: boolean;
    interactive?: boolean;
    onPointerDown?: (event: PointerEvent<SVGGElement>) => void;
}): ReactElement {
    const { wire, flow, selected = false, interactive = false, onPointerDown } = props;
    const path = orthogonalPath(wire.endpoints[0], wire.endpoints[1]);
    const points = pointsToSvg(path);
    const cursor: CSSProperties = interactive ? { cursor: 'pointer' } : {};
    return (
        <g
            data-wire-id={wire.id}
            onPointerDown={onPointerDown}
            style={cursor}
        >
            {/* Wider transparent hit target so clicking thin wires is easy. */}
            {interactive && (
                <polyline
                    points={points}
                    stroke="transparent"
                    strokeWidth={8}
                    fill="none"
                />
            )}
            <polyline
                points={points}
                stroke={selected ? 'var(--cpe-wire-selected, #2563eb)' : flow ? 'var(--cpe-wire-flow-base, #cbd5e1)' : 'currentColor'}
                strokeWidth={selected ? 1.8 : 0.95}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
            {flow && (
                <polyline
                    data-wire-flow="true"
                    aria-hidden="true"
                    points={points}
                    stroke="var(--cpe-wire-flow, #7dd3fc)"
                    strokeWidth={2.1}
                    strokeOpacity={0.62}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="6 10"
                    fill="none"
                    pointerEvents="none"
                >
                    <animate
                        attributeName="stroke-dashoffset"
                        from="0"
                        to="-16"
                        dur="850ms"
                        repeatCount="indefinite"
                    />
                </polyline>
            )}
        </g>
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

function CornerHandle(props: {
    position: Point;
    onPointerDown: (event: PointerEvent<SVGCircleElement>) => void;
}): ReactElement {
    // Corners are routing bends, not junctions, so by EDA convention they get
    // no visible dot in the schematic itself. The handle is invisible at rest
    // and lights up on hover so the bend stays interactive without polluting
    // the printed-schematic look.
    const { position, onPointerDown } = props;
    return (
        <circle
            data-corner-handle
            cx={position.x}
            cy={position.y}
            r={6}
            fill="transparent"
            stroke="currentColor"
            strokeOpacity={0}
            strokeWidth={1.5}
            strokeDasharray="2 2"
            style={{ cursor: 'pointer' }}
            onPointerDown={onPointerDown}
            onPointerEnter={(event) => {
                event.currentTarget.setAttribute('stroke-opacity', '0.7');
                event.currentTarget.setAttribute('fill', 'var(--cpe-bg, white)');
            }}
            onPointerLeave={(event) => {
                event.currentTarget.setAttribute('stroke-opacity', '0');
                event.currentTarget.setAttribute('fill', 'transparent');
            }}
        >
            <title>Shift+click to remove this bend</title>
        </circle>
    );
}

function PortHandle(props: {
    position: Point;
    onPointerDown: (event: PointerEvent<SVGCircleElement>) => void;
}): ReactElement {
    const { position, onPointerDown } = props;
    return (
        <circle
            data-port-handle
            cx={position.x}
            cy={position.y}
            r={5}
            fill="transparent"
            stroke="currentColor"
            strokeOpacity={0}
            strokeWidth={1.5}
            style={{ cursor: 'crosshair' }}
            onPointerDown={onPointerDown}
            onPointerEnter={(event) => {
                event.currentTarget.setAttribute('stroke-opacity', '0.6');
                event.currentTarget.setAttribute('fill', 'var(--cpe-bg, white)');
            }}
            onPointerLeave={(event) => {
                event.currentTarget.setAttribute('stroke-opacity', '0');
                event.currentTarget.setAttribute('fill', 'transparent');
            }}
        >
            <title>Drag to another terminal to create a wire</title>
        </circle>
    );
}

function GhostWire(props: {
    from: Point;
    to: Point;
    locked: boolean;
    snapKind?: 'port' | 'wire-body' | null;
}): ReactElement {
    const { from, to, locked, snapKind = null } = props;
    const path = orthogonalPath(from, to);
    const points = pointsToSvg(path);
    return (
        <g pointerEvents="none" data-ghost-wire>
            <polyline
                points={points}
                stroke={locked ? 'var(--cpe-wire-selected, #2563eb)' : 'currentColor'}
                strokeOpacity={locked ? 0.95 : 0.55}
                strokeWidth={locked ? 1.6 : 1.1}
                strokeDasharray={locked ? undefined : '4 3'}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
            {locked && snapKind !== 'wire-body' && (
                <>
                    <circle cx={to.x} cy={to.y} r={6} fill="none" stroke="var(--cpe-wire-selected, #2563eb)" strokeWidth={1.4} />
                    <circle cx={to.x} cy={to.y} r={2.5} fill="var(--cpe-wire-selected, #2563eb)" />
                </>
            )}
            {locked && snapKind === 'wire-body' && (
                // T-junction preview: dashed outer ring + filled center dot
                // matches the post-commit junction look so the user knows
                // "dropping here forms a T-junction on the wire under the
                // cursor."
                <>
                    <circle cx={to.x} cy={to.y} r={7} fill="none" stroke="var(--cpe-wire-selected, #2563eb)" strokeWidth={1.4} strokeDasharray="2 2" />
                    <circle cx={to.x} cy={to.y} r={2.5} fill="var(--cpe-wire-selected, #2563eb)" />
                </>
            )}
        </g>
    );
}

type ComponentGlyphProps = Readonly<{
    component: Component;
    showLabel: boolean;
    selected: boolean;
    editMode: boolean;
    isDragging: boolean;
    controlValue: ControlValue | undefined;
    ledColor: string;
    knobSteps: readonly KnobStep[] | undefined;
    sliderControl: SliderControl | undefined;
    onPointerDown: (event: PointerEvent<SVGGElement>) => void;
    onPointerMove: (event: PointerEvent<SVGGElement>) => void;
    onPointerUp: (event: PointerEvent<SVGGElement>) => void;
}>;

function ComponentGlyph(props: ComponentGlyphProps): ReactElement {
    const {
        component,
        showLabel,
        selected,
        editMode,
        isDragging,
        controlValue,
        ledColor,
        knobSteps,
        sliderControl,
        onPointerDown,
        onPointerMove,
        onPointerUp,
    } = props;

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

    const def = symbolFor(component.kind, component.sourceTypeName, component.properties);
    const isUnsupported = component.kind === 'unsupported';
    const box = computeComponentBox(component);
    const kindColor = colorForKind(component.kind);
    const iconHeight = box.height * (1 - COMPONENT_CARD_LABEL_RATIO);
    const labelHeight = box.height * COMPONENT_CARD_LABEL_RATIO;
    const labelY = box.minY + iconHeight;
    const clipId = componentCardClipId(component.id);
    const cardStrokeWidth = selected ? COMPONENT_CARD_SELECTED_STROKE_WIDTH : COMPONENT_CARD_STROKE_WIDTH;
    const symbolTransform = `rotate(${-component.rotation * 90})${
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
            <defs>
                <clipPath id={clipId}>
                    <rect
                        data-component-card-clip="true"
                        x={box.minX}
                        y={box.minY}
                        width={box.width}
                        height={box.height}
                        rx={5}
                    />
                </clipPath>
            </defs>
            <rect
                data-component-card="true"
                x={box.minX}
                y={box.minY}
                width={box.width}
                height={box.height}
                rx={5}
                stroke={kindColor}
                strokeWidth={cardStrokeWidth}
                strokeOpacity={selected ? 1 : 0.8}
                strokeDasharray={isUnsupported ? '4 3' : undefined}
                fill={kindColor}
                fillOpacity={0.16}
            />
            <g clipPath={`url(#${clipId})`} pointerEvents="none">
                <svg
                    data-component-icon-area="true"
                    x={box.minX}
                    y={box.minY}
                    width={box.width}
                    height={iconHeight}
                    viewBox={def.viewBox}
                    preserveAspectRatio="xMidYMid meet"
                    overflow="hidden"
                    style={{ overflow: 'hidden' }}
                >
                    <g
                        transform={symbolTransform}
                        stroke="currentColor"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        dangerouslySetInnerHTML={{ __html: def.content }}
                    />
                    <LiveControlGlyph
                        component={component}
                        value={controlValue}
                        symbolTransform={symbolTransform}
                        ledColor={ledColor}
                        knobSteps={knobSteps}
                        sliderControl={sliderControl}
                    />
                </svg>
                <rect
                    data-component-label-area="true"
                    x={box.minX}
                    y={labelY}
                    width={box.width}
                    height={labelHeight}
                    rx={0}
                    fill={kindColor}
                    fillOpacity={0.95}
                    stroke="currentColor"
                    strokeOpacity={0}
                />
                {showLabel && (
                    <ComponentCardLabel
                        x={(box.minX + box.maxX) / 2}
                        y={labelY + labelHeight / 2}
                        name={component.name}
                        maxWidth={box.width - COMPONENT_CARD_LABEL_MAX_WIDTH_PADDING}
                    />
                )}
            </g>
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
        </g>
    );
}

function LiveControlGlyph(props: {
    component: Component;
    value: ControlValue | undefined;
    symbolTransform: string;
    ledColor: string;
    knobSteps: readonly KnobStep[] | undefined;
    sliderControl: SliderControl | undefined;
}): ReactElement | null {
    const { component, value, symbolTransform, ledColor, knobSteps, sliderControl } = props;
    if (value === undefined) {
        return null;
    }
    if (component.kind === 'led' && value.kind === 'led') {
        return <LiveLedGlyph id={component.id} value={value} color={ledColor} />;
    }
    if (component.kind === 'potentiometer' && value.kind === 'knob') {
        return <LiveKnobGlyph id={component.id} position={value.position} symbolTransform={symbolTransform} steps={knobSteps} />;
    }
    if (component.kind === 'potentiometer' && value.kind === 'slider') {
        return (
            <LiveSliderGlyph
                id={component.id}
                position={value.position}
                orientation={sliderControl?.orientation ?? 'vertical'}
                symbolTransform={symbolTransform}
            />
        );
    }
    if (component.kind === 'switch' && value.kind === 'switch') {
        return <LiveSwitchGlyph component={component} position={value.position} symbolTransform={symbolTransform} />;
    }
    return null;
}

function LiveSliderGlyph(props: {
    id: string;
    position: number;
    orientation: SliderControl['orientation'];
    symbolTransform: string;
}): ReactElement {
    const position = clamp(props.position, 0, 1);
    const horizontal = props.orientation === 'horizontal';
    const thumb = horizontal ? -12 + position * 24 : 12 - position * 24;
    return (
        <g
            data-control-kind="slider"
            data-control-id={props.id}
            data-control-position={position}
            data-control-orientation={props.orientation}
            transform={props.symbolTransform}
            pointerEvents="none"
        >
            {horizontal ? (
                <>
                    <line x1={-12} y1={0} x2={12} y2={0} stroke={CONTROL_ACCENT} strokeWidth={1.6} strokeLinecap="round" opacity={0.75} />
                    <line x1={formatNumber(thumb)} y1={-7} x2={formatNumber(thumb)} y2={7} stroke={CONTROL_ACCENT} strokeWidth={3} strokeLinecap="round" />
                </>
            ) : (
                <>
                    <line x1={0} y1={12} x2={0} y2={-12} stroke={CONTROL_ACCENT} strokeWidth={1.6} strokeLinecap="round" opacity={0.75} />
                    <line x1={-7} y1={formatNumber(thumb)} x2={7} y2={formatNumber(thumb)} stroke={CONTROL_ACCENT} strokeWidth={3} strokeLinecap="round" />
                </>
            )}
        </g>
    );
}

function LiveLedGlyph(props: {
    id: string;
    value: Extract<ControlValue, { kind: 'led' }>;
    color: string;
}): ReactElement {
    const intensity = props.value.on ? clamp(props.value.intensity ?? 1, 0, 1) : 0;
    return (
        <g
            data-control-kind="led"
            data-control-id={props.id}
            data-control-on={props.value.on ? 'true' : undefined}
            pointerEvents="none"
        >
            {props.value.on && intensity > 0 && (
                <circle
                    data-led-glow="true"
                    cx={0}
                    cy={0}
                    r={16}
                    fill={props.color}
                    opacity={roundOpacity(0.18 * intensity)}
                />
            )}
            <circle
                data-led-fill="true"
                cx={0}
                cy={0}
                r={8}
                fill={props.color}
                opacity={props.value.on ? roundOpacity(0.75 * intensity) : 0.08}
            />
        </g>
    );
}

function LiveKnobGlyph(props: {
    id: string;
    position: number;
    symbolTransform: string;
    steps: readonly KnobStep[] | undefined;
}): ReactElement {
    const position = clamp(props.position, 0, 1);
    const activeStep = nearestKnobStep(props.steps, position);
    const angle = -120 + position * 240;
    return (
        <g
            data-control-kind="knob"
            data-control-id={props.id}
            data-control-position={position}
            data-control-step-count={props.steps?.length}
            data-control-step-index={activeStep?.index}
            data-control-step-label={activeStep?.label}
            transform={`${props.symbolTransform} rotate(${formatNumber(angle)})`}
            pointerEvents="none"
        >
            <line
                x1={0}
                y1={0}
                x2={0}
                y2={-15}
                stroke={CONTROL_ACCENT}
                strokeWidth={2}
                strokeLinecap="round"
            />
            <circle cx={0} cy={-15} r={2.4} fill={CONTROL_ACCENT} />
        </g>
    );
}

function LiveSwitchGlyph(props: {
    component: Component;
    position: number;
    symbolTransform: string;
}): ReactElement {
    const active = activeSwitchTerminals(props.component, props.position);
    const position = Math.max(0, Math.trunc(props.position));
    return (
        <g
            data-control-kind="switch"
            data-control-id={props.component.id}
            data-control-position={position}
            transform={props.symbolTransform}
            pointerEvents="none"
        >
            {active.length === 0 ? (
                <circle
                    data-control-active-terminal="true"
                    cx={0}
                    cy={0}
                    r={4}
                    fill={CONTROL_ACCENT}
                    opacity={0.85}
                />
            ) : active.map((terminal) => {
                const local = localTerminalPoint(props.component, terminal);
                return (
                    <circle
                        key={terminal.name}
                        data-control-active-terminal="true"
                        data-control-terminal-name={terminal.name}
                        cx={local.x}
                        cy={local.y}
                        r={4}
                        fill={CONTROL_ACCENT}
                        opacity={0.9}
                    />
                );
            })}
        </g>
    );
}

function activeSwitchTerminals(component: Component, position: number): readonly Component['terminals'][number][] {
    const normalized = Math.max(0, Math.trunc(position));
    const byName = new Map(component.terminals.map((terminal) => [terminal.name, terminal] as const));
    const collector = byName.get('collector');
    const emitter = byName.get('emitter');
    if (collector !== undefined && emitter !== undefined) {
        return [normalized === 0 ? collector : emitter];
    }

    const threePdt = activeThreePdtTerminals(byName, normalized);
    if (threePdt.length > 0) {
        return threePdt;
    }

    const nonCommon = component.terminals.filter((terminal) => !isCommonSwitchTerminalName(terminal.name));
    return nonCommon[normalized] === undefined ? [] : [nonCommon[normalized]];
}

function activeThreePdtTerminals(
    terminals: ReadonlyMap<string, Component['terminals'][number]>,
    position: number,
): readonly Component['terminals'][number][] {
    const suffix = position === 0 ? 'a' : 'b';
    const active: Component['terminals'][number][] = [];
    for (const pole of [1, 2, 3]) {
        const terminal = terminals.get(`t${pole}${suffix}`);
        if (terminal === undefined) {
            return [];
        }
        active.push(terminal);
    }
    return active;
}

function isCommonSwitchTerminalName(name: string): boolean {
    return name === 'base' || /^p\d+$/.test(name) || name === 'pole' || name === 'common';
}

function localTerminalPoint(component: Component, terminal: Component['terminals'][number]): Point {
    return {
        x: terminal.position.x - component.origin.x,
        y: terminal.position.y - component.origin.y,
    };
}

function componentCardClipId(componentId: string): string {
    return `component-card-clip-${componentId.replace(/[^A-Za-z0-9_-]/g, '-')}`;
}

function ComponentCardLabel(props: {
    x: number;
    y: number;
    name: string;
    maxWidth: number;
}): ReactElement {
    const estimatedWidth = props.name.length * COMPONENT_CARD_LABEL_FONT_SIZE * 0.62;
    const textLength = estimatedWidth > props.maxWidth ? props.maxWidth : undefined;
    return (
        <text
            data-component-card-label="true"
            x={props.x}
            y={props.y}
            fill="var(--cpe-component-label-fg, white)"
            fontFamily={SCHEMATIC_TEXT_FONT}
            fontSize={COMPONENT_CARD_LABEL_FONT_SIZE}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="middle"
            textLength={textLength}
            lengthAdjust={textLength === undefined ? undefined : 'spacingAndGlyphs'}
            pointerEvents="none"
        >
            {props.name}
        </text>
    );
}

function LabelGlyph({ component, selected }: { component: Component; selected: boolean }): ReactElement {
    const text = stringValue(component.properties.Text) ?? component.name;
    const subtext = stringValue(component.properties.Subtext);
    if (shouldRenderLabelTextBox(text, subtext)) {
        return <LabelTextBox origin={component.origin} text={text} subtext={subtext} selected={selected} />;
    }
    // Estimate the bounding box of the rendered text so the whole label
    // area is clickable, not just the painted glyphs. Width grows with the
    // visible string length; height depends on whether a subtext line is
    // present. The hit rect is invisible at rest and shows a dashed
    // selection outline when selected.
    const longest = Math.max(text.length, subtext?.length ?? 0, 4);
    const hitWidth = Math.min(Math.max(longest * 8 + 16, 60), 200);
    const hitX = component.origin.x - hitWidth / 2;
    const hitY = component.origin.y - 14;
    const hitHeight = subtext === null ? 22 : 38;
    return (
        <g>
            <rect
                data-component-label-hit="true"
                x={hitX}
                y={hitY}
                width={hitWidth}
                height={hitHeight}
                rx={4}
                fill="transparent"
                stroke={selected ? 'currentColor' : 'none'}
                strokeWidth={selected ? 1.5 : 0}
                strokeDasharray={selected ? '3 3' : undefined}
            />
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
                fontFamily={SCHEMATIC_TEXT_FONT}
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
            fontFamily={SCHEMATIC_TEXT_FONT}
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
