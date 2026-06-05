export const VERSION = '0.2.1';

export type {
    CircuitDocument,
    Component,
    ComponentKind,
    DocumentMetadata,
    ParsedQuantity,
    Point,
    PropertyValue,
    Rotation,
    Terminal,
    Warning,
    Wire,
} from './model/types';
export { EMPTY_DOCUMENT } from './model/types';

export { parseQuantity } from './model/quantity';

export type { Connectivity, NodeId, PinRef } from './model/connectivity';
export { getPinNode, pinKey, resolveConnectivity } from './model/connectivity';

export type { NetlistComponent, NetlistView, SpiceLetter } from './model/netlist';
export { getSpiceLetter, getSpiceNodeOrder, kindForSpiceLetter, toNetlistView } from './model/netlist';

export type {
    PropertyRule,
    QuantityRule,
    StringRule,
    ValidationCode,
    ValidationIssue,
    ValidationSeverity,
} from './model/validation';
export { getRulesForKind, hasErrors, validateComponent, validateDocument } from './model/validation';

export { parseSchx } from './formats/schx/parser';
export { serializeSchx } from './formats/schx/serializer';
export { parseSpiceNetlist } from './formats/spice/parser';
export { serializeSpiceNetlist } from './formats/spice/serializer';
export type { InterchangeSourceFormat, SerializeInterchangeYamlOptions } from './formats/interchange/serializer';
export { parseInterchangeYaml } from './formats/interchange/parser';
export { serializeInterchangeYaml } from './formats/interchange/serializer';
export type { CircuitFormat, ParseCircuitDocumentOptions } from './formats/document';
export { detectCircuitFormat, parseCircuitDocument } from './formats/document';
export { parseLtspiceAsc } from './formats/ltspice/parser';

export type { CreateComponentArgs, DocumentCommand, EditorCommand, EditorState } from './editor';
export {
    applyDocumentCommand,
    applyEditorCommand,
    buildComponent,
    canRedo,
    canUndo,
    createEditorState,
    resetEditorState,
    tidyDocumentLayout,
} from './editor';
export type { TidyLayoutOptions } from './editor';

export type { Bounds } from './preview/bounds';
export { computeDocumentBounds, viewBoxString } from './preview/bounds';
export { colorForKind } from './preview/colors';
export type { SymbolDef } from './preview/symbols';
export { symbolFor, COMPONENT_KINDS } from './preview/symbols';
export type { HangingEndpoint } from './preview/hanging';
export { findHangingEndpoints } from './preview/hanging';
export type { Port, WireBodyHit } from './preview/ports';
export { collectPorts, findNearestPort, findNearestWireBodyHit } from './preview/ports';
export { findChainCorners, findWireChain } from './preview/wire-chains';

export type {
    ControlState,
    ControlValue,
    JackPort,
    JackRole,
    Knob,
    KnobTaper,
    KnobValue,
    LedIndicator,
    LedValue,
    Panel,
    PanelMessage,
    SwitchControl,
    SwitchKind,
    SwitchValue,
} from './panel';
export {
    applyControlMessage,
    defaultControlState,
    extractPanel,
    isKnob,
    isLed,
    isSwitch,
    PANEL_PROTOCOL_VERSION,
    validateMessage,
} from './panel';
