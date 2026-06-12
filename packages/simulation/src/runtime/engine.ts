import type {
    RuntimeDescriptorSimulationBlock,
    SimulationDiagnostic,
    SimulationProgram,
    StaticNetlistSimulationBlock,
} from '../types';

export type RuntimeEngine = Readonly<{
    configureRuntimeDescriptor?: (block: RuntimeDescriptorSimulationBlock) => void;
    configureStaticNetlistBlock?: (block: StaticNetlistSimulationBlock) => void;
}>;

export function configureRuntimeProgram(
    engine: RuntimeEngine,
    program: SimulationProgram,
): readonly SimulationDiagnostic[] {
    const diagnostics: SimulationDiagnostic[] = [];

    for (const block of program.blocks) {
        try {
            if (block.kind === 'runtime-descriptor') {
                engine.configureRuntimeDescriptor?.(block);
            } else {
                engine.configureStaticNetlistBlock?.(block);
            }
        } catch (error) {
            diagnostics.push({
                code: 'runtime-engine-error',
                severity: 'error',
                message: `${block.id}: ${error instanceof Error ? error.message : String(error)}`,
                componentId: block.id,
            });
        }
    }

    return diagnostics;
}
