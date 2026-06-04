import { useRef, useState, type DragEvent } from 'react';
import { colorForKind, symbolFor, type ComponentKind } from 'react-pedal-schematic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type PaletteItem = Readonly<{
    id: string;
    kind: ComponentKind;
    sourceTypeName: string | null;
    label: string;
}>;

export type PaletteGroup = Readonly<{
    id: string;
    label: string;
    items: readonly PaletteItem[];
}>;

export const PALETTE_DATA_TYPE = 'application/x-cpe-symbol';

export type PalettePayload = Readonly<{
    kind: ComponentKind;
    sourceTypeName: string | null;
}>;

export function readPalettePayload(event: DragEvent | globalThis.DragEvent): PalettePayload | null {
    const raw = event.dataTransfer?.getData(PALETTE_DATA_TYPE);
    if (raw === undefined || raw === null || raw === '') {
        return null;
    }
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (
            typeof parsed === 'object' &&
            parsed !== null &&
            typeof (parsed as { kind?: unknown }).kind === 'string'
        ) {
            const candidate = parsed as { kind: ComponentKind; sourceTypeName?: string | null };
            return {
                kind: candidate.kind,
                sourceTypeName: candidate.sourceTypeName ?? null,
            };
        }
    } catch {
        return null;
    }
    return null;
}

export function applyPaletteDragImage(
    event: Pick<DragEvent | globalThis.DragEvent, 'dataTransfer'>,
    preview: Element | null,
): void {
    const dataTransfer = event.dataTransfer;
    if (preview === null || dataTransfer === null || typeof dataTransfer.setDragImage !== 'function') {
        return;
    }
    dataTransfer.setDragImage(preview, 20, 20);
}

const PALETTE_GROUPS: readonly PaletteGroup[] = [
    {
        id: 'passives',
        label: 'Passives',
        items: [
            { id: 'resistor', kind: 'resistor', sourceTypeName: 'Circuit.Resistor, Circuit', label: 'Resistor' },
            { id: 'capacitor', kind: 'capacitor', sourceTypeName: 'Circuit.Capacitor, Circuit', label: 'Capacitor' },
            { id: 'inductor', kind: 'inductor', sourceTypeName: 'Circuit.Inductor, Circuit', label: 'Inductor' },
            { id: 'potentiometer', kind: 'potentiometer', sourceTypeName: 'Circuit.Potentiometer, Circuit', label: 'Potentiometer' },
            { id: 'variable-resistor', kind: 'variable-resistor', sourceTypeName: 'Circuit.VariableResistor, Circuit', label: 'Trimpot' },
            { id: 'transformer', kind: 'transformer', sourceTypeName: 'Circuit.Transformer, Circuit', label: 'Transformer' },
        ],
    },
    {
        id: 'semiconductors',
        label: 'Semiconductors',
        items: [
            { id: 'diode', kind: 'diode', sourceTypeName: 'Circuit.Diode, Circuit', label: 'Diode' },
            { id: 'led', kind: 'led', sourceTypeName: null, label: 'LED' },
            { id: 'bjt-npn', kind: 'bjt', sourceTypeName: 'Circuit.NpnBjt, Circuit', label: 'BJT (NPN)' },
            { id: 'bjt-pnp', kind: 'bjt', sourceTypeName: 'Circuit.PnpBjt, Circuit', label: 'BJT (PNP)' },
            { id: 'jfet-n', kind: 'jfet', sourceTypeName: 'Circuit.NjfJfet, Circuit', label: 'JFET (N)' },
            { id: 'jfet-p', kind: 'jfet', sourceTypeName: 'Circuit.PjfJfet, Circuit', label: 'JFET (P)' },
            { id: 'mosfet-n', kind: 'mosfet', sourceTypeName: 'Circuit.NMosfet, Circuit', label: 'MOSFET (N)' },
            { id: 'mosfet-p', kind: 'mosfet', sourceTypeName: 'Circuit.PMosfet, Circuit', label: 'MOSFET (P)' },
        ],
    },
    {
        id: 'tubes',
        label: 'Tubes',
        items: [
            { id: 'triode', kind: 'triode', sourceTypeName: 'Circuit.Triode, Circuit', label: 'Triode' },
            { id: 'pentode', kind: 'pentode', sourceTypeName: 'Circuit.Components.Pentode, Circuit', label: 'Pentode' },
            { id: 'tube-diode', kind: 'tube-diode', sourceTypeName: 'Circuit.Components.Diode, Circuit', label: 'Tube diode' },
        ],
    },
    {
        id: 'ics',
        label: 'Op-amps & ICs',
        items: [
            { id: 'opamp', kind: 'opamp', sourceTypeName: 'Circuit.OpAmp, Circuit', label: 'Op-amp' },
            { id: 'opamp-ideal', kind: 'opamp', sourceTypeName: 'Circuit.IdealOpAmp, Circuit', label: 'Ideal op-amp' },
            { id: 'optocoupler', kind: 'optocoupler', sourceTypeName: null, label: 'Optocoupler' },
        ],
    },
    {
        id: 'switches',
        label: 'Switches & relays',
        items: [
            { id: 'switch-spst', kind: 'switch', sourceTypeName: 'Circuit.Switch, Circuit', label: 'Switch (SPST)' },
            { id: 'switch-spdt', kind: 'switch', sourceTypeName: 'Circuit.SPDT, Circuit', label: 'Switch (SPDT)' },
            { id: 'switch-3pdt', kind: 'switch', sourceTypeName: 'Circuit.SP3T, Circuit', label: 'Switch (SP3T)' },
        ],
    },
    {
        id: 'sources',
        label: 'Sources & references',
        items: [
            { id: 'voltage-source', kind: 'voltage-source', sourceTypeName: 'Circuit.VoltageSource, Circuit', label: 'Voltage source' },
            { id: 'current-source', kind: 'current-source', sourceTypeName: 'Circuit.CurrentSource, Circuit', label: 'Current source' },
            { id: 'battery', kind: 'battery', sourceTypeName: 'Circuit.Battery, Circuit', label: 'Battery' },
            { id: 'rail', kind: 'rail', sourceTypeName: 'Circuit.Rail, Circuit', label: 'Voltage rail' },
            { id: 'ground', kind: 'ground', sourceTypeName: 'Circuit.Ground, Circuit', label: 'Ground' },
        ],
    },
    {
        id: 'io',
        label: 'IO & metadata',
        items: [
            { id: 'jack-input', kind: 'jack', sourceTypeName: 'Circuit.Input, Circuit', label: 'Input jack' },
            { id: 'jack-output', kind: 'jack', sourceTypeName: 'Circuit.Speaker, Circuit', label: 'Output jack' },
            { id: 'port', kind: 'port', sourceTypeName: 'Circuit.Port, Circuit', label: 'Test point' },
            { id: 'named-wire', kind: 'named-wire', sourceTypeName: 'Circuit.NamedWire, Circuit', label: 'Named wire' },
            { id: 'label', kind: 'label', sourceTypeName: 'Circuit.Label, Circuit', label: 'Label' },
        ],
    },
];

export function SymbolPalette(): React.ReactElement {
    const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(
        () => new Set(['passives', 'semiconductors']),
    );

    function toggleGroup(id: string): void {
        setOpenGroups((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    return (
        <Card className="h-fit max-h-[calc(100vh-12rem)] overflow-hidden lg:sticky lg:top-4">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Symbol library</CardTitle>
                <p className="text-xs text-muted-foreground">Drag a symbol onto the canvas.</p>
            </CardHeader>
            <CardContent
                data-symbol-library-scroll="true"
                className="max-h-[calc(100vh-18rem)] space-y-2 overflow-y-auto pb-4 pr-3"
            >
                {PALETTE_GROUPS.map((group) => (
                    <PaletteGroupSection
                        key={group.id}
                        group={group}
                        open={openGroups.has(group.id)}
                        onToggle={() => toggleGroup(group.id)}
                    />
                ))}
            </CardContent>
        </Card>
    );
}

function PaletteGroupSection(props: {
    group: PaletteGroup;
    open: boolean;
    onToggle: () => void;
}): React.ReactElement {
    const { group, open, onToggle } = props;
    return (
        <div className="rounded-md border border-border bg-muted/30">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
                <span>{group.label}</span>
                <span aria-hidden className="font-mono text-[10px]">{open ? '▾' : '▸'}</span>
            </button>
            {open && (
                <div className="flex flex-col gap-1 border-t border-border px-2 py-2">
                    {group.items.map((item) => (
                        <PaletteTile key={item.id} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
}

function PaletteTile({ item }: { item: PaletteItem }): React.ReactElement {
    const dragPreviewRef = useRef<SVGSVGElement | null>(null);

    function handleDragStart(event: DragEvent<HTMLDivElement>): void {
        const payload: PalettePayload = { kind: item.kind, sourceTypeName: item.sourceTypeName };
        event.dataTransfer.setData(PALETTE_DATA_TYPE, JSON.stringify(payload));
        event.dataTransfer.effectAllowed = 'copy';
        applyPaletteDragImage(event, dragPreviewRef.current);
    }

    const symbol = symbolFor(item.kind, item.sourceTypeName);
    const color = colorForKind(item.kind);
    return (
        <div
            draggable
            onDragStart={handleDragStart}
            title={`${item.label} — drag onto canvas`}
            className="group flex cursor-grab select-none items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs text-muted-foreground transition hover:border-foreground/40 hover:text-foreground active:cursor-grabbing"
        >
            <svg
                viewBox={symbol.viewBox}
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 shrink-0 text-foreground"
                aria-hidden
            >
                <TileBox viewBox={symbol.viewBox} color={color} />
                <g
                    stroke="currentColor"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    dangerouslySetInnerHTML={{ __html: symbol.content }}
                />
            </svg>
            <span className="line-clamp-1">{item.label}</span>
            <svg
                ref={dragPreviewRef}
                data-drag-preview="symbol"
                viewBox={symbol.viewBox}
                xmlns="http://www.w3.org/2000/svg"
                className="pointer-events-none fixed -left-[1000px] -top-[1000px] h-10 w-10 text-foreground"
                aria-hidden
            >
                <g
                    stroke="currentColor"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    dangerouslySetInnerHTML={{ __html: symbol.content }}
                />
            </svg>
        </div>
    );
}

function TileBox({ viewBox, color }: { viewBox: string; color: string }): React.ReactElement {
    const box = parseViewBox(viewBox);
    return (
        <rect
            x={box.x + 1}
            y={box.y + 1}
            width={box.w - 2}
            height={box.h - 2}
            rx={4}
            stroke={color}
            strokeWidth={1.25}
            strokeOpacity={0.8}
            fill={color}
            fillOpacity={0.18}
        />
    );
}

function parseViewBox(vb: string): { x: number; y: number; w: number; h: number } {
    const parts = vb.split(/\s+/).map(Number);
    return {
        x: parts[0] ?? 0,
        y: parts[1] ?? 0,
        w: parts[2] ?? 50,
        h: parts[3] ?? 50,
    };
}
