export const VERSION = '0.5.0';

export type {
    CircuitDocument,
    CircuitDocumentDevice,
    CircuitDocumentDeviceKind,
    Component,
    ComponentKind,
    ControlApplicabilityPredicate,
    ControlContext,
    ControlGroup,
    ControlInterface,
    ControlInterfaceAssignmentHint,
    ControlInterfaceBinding,
    ControlInterfaceConnector,
    ControlInterfacePolarity,
    ControlInterfaceRole,
    ControlOutput,
    ControlOutputSwitchMode,
    DeviceInterface,
    DeviceInterfaceBinding,
    DeviceInterfaceControl,
    DeviceInterfaceControlKind,
    DocumentMetadata,
    DocumentSource,
    PanelColumnOrder,
    PanelControlKind,
    PanelControlPlacement,
    PanelElementBinding,
    PanelElementPlacement,
    PanelFace,
    PanelGridIndexing,
    PanelGridLayout,
    PanelGridPosition,
    PanelPlacementMetadata,
    PanelRowOrder,
    ParsedQuantity,
    Point,
    PropertyObject,
    PropertyValue,
    Rotation,
    Terminal,
    Warning,
    Wire,
} from './model/types';
export { EMPTY_DOCUMENT } from './model/types';
export {
    isParsedQuantity,
    isPropertyObject,
    propertyBooleanValue,
    propertyNumericValue,
    propertyQuantityValue,
    propertyStringValue,
    propertyValueForSourceAttribute,
} from './model/properties';

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
export type {
    CircuitFormat,
    CircuitDocumentFileFormat,
    ParseCircuitDocumentOptions,
    ParseCircuitDocumentFileOptions,
    SerializeVdspCircuitDocumentOptions,
    VdspSchemaValidationIssue,
    VdspSchemaValidationResult,
} from './formats/document';
export {
    detectCircuitFormat,
    parseCircuitDocument,
    vdspFileExtension,
    isVdspFilename,
    detectCircuitDocumentFileFormat,
    vdspFilenameFromName,
    parseVdspCircuitDocument,
    validateVdspCircuitDocumentSchema,
    parseCircuitDocumentFile,
    serializeVdspCircuitDocument,
} from './formats/document';
export { parseLtspiceAsc } from './formats/ltspice/parser';

export type {
    CircuitJsonElement,
    CircuitJsonExport,
    CircuitJsonExportOptions,
    CircuitJsonExportTarget,
    CircuitJsonSourceComponent,
    CircuitJsonSourceNet,
    CircuitJsonSourcePort,
    CircuitJsonSourceTrace,
} from './formats/circuit-json/serializer';
export { serializeCircuitJsonDocument } from './formats/circuit-json/serializer';

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
    DeviceInterfaceProvenance,
    ExternalControlAssignmentHint,
    ExtractedDeviceInterface,
    ExtractedDeviceInterfaceControl,
    JackAudioRole,
    JackPort,
    JackRole,
    Knob,
    KnobControlMode,
    KnobStep,
    KnobTaper,
    KnobValue,
    LedIndicator,
    LedValue,
    Panel,
    PanelMessage,
    SliderControl,
    SliderOrientation,
    SliderRange,
    SliderValue,
    SwitchControl,
    SwitchKind,
    SwitchValue,
} from './panel';
export {
    applyControlMessage,
    defaultControlState,
    extractDeviceInterface,
    extractPanel,
    isKnobPositionOnStep,
    isKnob,
    isLed,
    isSlider,
    isSwitch,
    knobStepSize,
    nearestKnobStep,
    PANEL_PROTOCOL_VERSION,
    snapKnobPosition,
    validateMessage,
} from './panel';
