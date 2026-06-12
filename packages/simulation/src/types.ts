import type { ComponentKind, NodeId, ParsedQuantity, PropertyValue } from '@vessel-dsp/core';

export type SimulationSupportLevel =
    | 'unsupported'
    | 'static-netlist'
    | 'realtime-runtime-descriptor'
    | 'realtime-mna';

export type SimulationDiagnosticSeverity = 'warning' | 'error';

export type SimulationDiagnostic = Readonly<{
    code:
        | 'missing-ground'
        | 'unsupported-component'
        | 'missing-value'
        | 'missing-model'
        | 'unsupported-directive'
        | 'floating-node'
        | 'missing-runtime-descriptor-type'
        | 'missing-wasm-export'
        | 'runtime-engine-error';
    severity: SimulationDiagnosticSeverity;
    message: string;
    componentId?: string;
    nodeId?: NodeId;
    directive?: string;
}>;

export type SimulationNode = Readonly<{
    id: NodeId;
    members: readonly string[];
}>;

export type StaticNetlistSimulationBlock = Readonly<{
    id: string;
    kind: 'static-netlist';
    componentKind: ComponentKind;
    supportLevel: SimulationSupportLevel;
    nodes: readonly NodeId[];
    value: ParsedQuantity | null;
    model: string | null;
    properties: Readonly<Record<string, PropertyValue>>;
}>;

export type RuntimeDescriptorSimulationBlock = Readonly<{
    id: string;
    kind: 'runtime-descriptor';
    descriptorType: string;
    sourceTypeName: string | null;
    nodes: readonly NodeId[];
    properties: Readonly<Record<string, PropertyValue>>;
}>;

export type SimulationBlock = StaticNetlistSimulationBlock | RuntimeDescriptorSimulationBlock;

export type SimulationProgram = Readonly<{
    version: 'simulation-program/v1';
    nodes: readonly SimulationNode[];
    groundNodeId: NodeId | null;
    blocks: readonly SimulationBlock[];
}>;

export type SimulationReadiness = Readonly<{
    ready: boolean;
    diagnostics: readonly SimulationDiagnostic[];
    componentSupport: ReadonlyMap<string, SimulationSupportLevel>;
}>;

export type SimulationCompileResult = Readonly<{
    program: SimulationProgram;
    diagnostics: readonly SimulationDiagnostic[];
}>;
