export type Point = Readonly<{ x: number; y: number }>;

export type Rotation = 0 | 1 | 2 | 3;

export type ParsedQuantity = Readonly<{
    raw: string;
    value: number;
    unit: string;
}>;

export type ComponentKind =
    | 'resistor'
    | 'capacitor'
    | 'inductor'
    | 'diode'
    | 'led'
    | 'bjt'
    | 'jfet'
    | 'mosfet'
    | 'opamp'
    | 'ota'
    | 'triode'
    | 'pentode'
    | 'tube-diode'
    | 'transformer'
    | 'potentiometer'
    | 'variable-resistor'
    | 'switch'
    | 'optocoupler'
    | 'voltage-source'
    | 'current-source'
    | 'battery'
    | 'ground'
    | 'rail'
    | 'jack'
    | 'bbd'
    | 'delay-ic'
    | 'power-amp'
    | 'regulator'
    | 'analog-switch'
    | 'flipflop'
    | 'ic'
    | 'label'
    | 'named-wire'
    | 'port'
    | 'unsupported';

export type Terminal = Readonly<{
    name: string;
    position: Point;
}>;

export type PropertyValue = ParsedQuantity | string;

export type Component = Readonly<{
    id: string;
    kind: ComponentKind;
    name: string;
    origin: Point;
    rotation: Rotation;
    flipped: boolean;
    terminals: readonly Terminal[];
    properties: Readonly<Record<string, PropertyValue>>;
    sourceTypeName: string | null;
}>;

export type Wire = Readonly<{
    id: string;
    endpoints: readonly [Point, Point];
}>;

export type DocumentMetadata = Readonly<{
    name: string;
    description: string;
    partNumber: string;
}>;

export type Warning = Readonly<{
    code: string;
    message: string;
    componentId?: string;
    wireId?: string;
}>;

export type CircuitDocument = Readonly<{
    metadata: DocumentMetadata;
    components: readonly Component[];
    wires: readonly Wire[];
    directives: readonly string[];
    warnings: readonly Warning[];
    rawAttributes: Readonly<Record<string, string>>;
}>;

export const EMPTY_DOCUMENT: CircuitDocument = {
    metadata: { name: '', description: '', partNumber: '' },
    components: [],
    wires: [],
    directives: [],
    warnings: [],
    rawAttributes: {},
};
