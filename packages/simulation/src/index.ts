export const SIMULATION_VERSION = '0.5.0';

export type {
    RuntimeDescriptorSimulationBlock,
    SimulationBlock,
    SimulationCompileResult,
    SimulationDiagnostic,
    SimulationDiagnosticSeverity,
    SimulationNode,
    SimulationProgram,
    SimulationReadiness,
    SimulationSupportLevel,
    StaticNetlistSimulationBlock,
} from './types';
export { compileSimulationProgram } from './compile';
export type { SupportProbe } from './support-matrix';
export { isRuntimeDescriptor, supportLevelForComponent } from './support-matrix';
export { analyzeSimulationReadiness } from './readiness';
