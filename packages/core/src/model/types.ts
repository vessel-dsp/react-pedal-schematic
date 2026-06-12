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

export type PropertyObject = Readonly<{
    readonly [key: string]: PropertyValue;
}>;

export type PropertyValue =
    | ParsedQuantity
    | string
    | number
    | boolean
    | null
    | readonly PropertyValue[]
    | PropertyObject;

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

export type DocumentSource = Readonly<Record<string, string>>;

export type ControlInterfaceRole =
    | 'external-control'
    | 'tempo-tap'
    | 'trigger'
    | 'reset'
    | 'sampler-trigger'
    | 'expression'
    | 'unknown';

export type ControlInterfaceConnector =
    | '1/4-inch-mono-ts'
    | '1/4-inch-trs'
    | '3.5mm-mono-ts'
    | '3.5mm-trs'
    | 'proprietary'
    | 'unknown';

export type ControlInterfaceAssignmentHint =
    | 'momentary'
    | 'latching'
    | 'momentary-or-latching'
    | 'continuous';

export type ControlInterfacePolarity =
    | 'normally-open'
    | 'normally-closed'
    | 'expression'
    | 'unknown';

export type ControlInterfaceBinding = Readonly<{
    sourceComponentId?: string;
    controlId?: string;
    controlName?: string;
    property?: string;
}>;

export type ControlInterface = Readonly<{
    id: string;
    name: string;
    role: ControlInterfaceRole;
    componentId?: string;
    controlRole?: string;
    interface?: string;
    connector?: ControlInterfaceConnector;
    assignmentHint?: ControlInterfaceAssignmentHint;
    polarity?: ControlInterfacePolarity;
    binding?: ControlInterfaceBinding;
    description?: string;
}>;

export type CircuitDocumentDeviceKind =
    | 'audio-pedal'
    | 'control-accessory'
    | 'utility'
    | 'unknown';

export type CircuitDocumentDevice = Readonly<{
    id?: string;
    version?: number;
    kind: CircuitDocumentDeviceKind;
    family?: string;
    model?: string;
    audioProcessing?: boolean;
}>;

export type ControlOutputSwitchMode = 'momentary' | 'latching';

export type ControlOutput = Readonly<{
    id: string;
    name: string;
    role: ControlInterfaceRole;
    connector?: ControlInterfaceConnector;
    switchMode?: ControlOutputSwitchMode;
    polarity?: ControlInterfacePolarity;
    inactiveValue?: number;
    activeValue?: number;
    componentId?: string;
    description?: string;
}>;

export type ControlContext = Readonly<{
    id: string;
    name: string;
    role: string;
    description?: string;
}>;

export type ControlGroup = Readonly<{
    id: string;
    name: string;
    role: string;
    contextIds?: readonly string[];
    description?: string;
}>;

export type DeviceInterfaceControlKind =
    | 'knob'
    | 'slider'
    | 'switch'
    | 'selector'
    | 'footswitch'
    | 'led'
    | 'jack';

export type DeviceInterfaceBinding = Readonly<{
    componentId: string;
    controlId?: string;
    controlName?: string;
    property?: string;
    externalInterfaceId?: string;
}>;

export type ControlApplicabilityPredicate = Readonly<{
    allOf?: readonly string[];
    anyOf?: readonly string[];
}>;

export type DeviceInterfaceControl = Readonly<{
    id: string;
    label: string;
    kind: DeviceInterfaceControlKind;
    role: string;
    groupId?: string;
    order?: number;
    binding?: DeviceInterfaceBinding;
    appliesWhen?: ControlApplicabilityPredicate;
    description?: string;
}>;

export type DeviceInterface = Readonly<{
    controls: readonly DeviceInterfaceControl[];
}>;

export type PanelGridIndexing = 'one-based' | 'zero-based';

export type PanelRowOrder = 'top-to-bottom' | 'bottom-to-top';

export type PanelColumnOrder = 'left-to-right' | 'right-to-left';

export type PanelGridLayout = Readonly<{
    kind: 'stompbox-grid';
    rows: number;
    columns: number;
    indexing: PanelGridIndexing;
    rowOrder?: PanelRowOrder;
    columnOrder?: PanelColumnOrder;
}>;

export type PanelControlKind = 'knob' | 'slider' | 'switch' | 'led' | 'jack';

export type PanelGridPosition = Readonly<{
    row: number;
    column: number;
    rowSpan?: number;
    columnSpan?: number;
}>;

export type PanelElementBinding = Readonly<{
    componentId: string;
    controlId?: string;
    controlName?: string;
    property?: string;
}>;

export type PanelElementPlacement = Readonly<{
    bind: PanelElementBinding;
    kind: PanelControlKind;
    grid: PanelGridPosition;
    label?: string;
    interfaceControlId?: string;
}>;

/** @deprecated Use PanelElementPlacement. */
export type PanelControlPlacement = PanelElementPlacement;

export type PanelFace = Readonly<{
    id: string;
    label?: string;
    layout: PanelGridLayout;
    elements: readonly PanelElementPlacement[];
}>;

export type PanelPlacementMetadata = Readonly<{
    faces: readonly PanelFace[];
}>;

export type Warning = Readonly<{
    code: string;
    message: string;
    componentId?: string;
    wireId?: string;
}>;

export type CircuitDocument = Readonly<{
    metadata: DocumentMetadata;
    source?: DocumentSource;
    device?: CircuitDocumentDevice;
    controlGroups?: readonly ControlGroup[];
    controlContexts?: readonly ControlContext[];
    deviceInterface?: DeviceInterface;
    panel?: PanelPlacementMetadata;
    controlInterfaces?: readonly ControlInterface[];
    controlOutputs?: readonly ControlOutput[];
    components: readonly Component[];
    wires: readonly Wire[];
    directives: readonly string[];
    warnings: readonly Warning[];
    rawAttributes: Readonly<Record<string, string>>;
}>;

export const EMPTY_DOCUMENT: CircuitDocument = {
    metadata: { name: '', description: '', partNumber: '' },
    source: {},
    components: [],
    wires: [],
    directives: [],
    warnings: [],
    rawAttributes: {},
};
