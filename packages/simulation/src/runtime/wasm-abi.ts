import type { SimulationDiagnostic } from '../types';
import type { RuntimeEngine } from './engine';

type WasmExportMap = Readonly<Record<string, unknown>>;

const REQUIRED_EXPORTS: readonly string[] = [
    'dsp_schx_clear',
    'dsp_schx_configure_microblock_delay_chip_mechanism',
];

export type WasmRuntimeAdapterResult = Readonly<{
    engine: RuntimeEngine | null;
    diagnostics: readonly SimulationDiagnostic[];
}>;

export function createWasmRuntimeAdapter(exports: WasmExportMap): WasmRuntimeAdapterResult {
    const diagnostics: SimulationDiagnostic[] = [];

    for (const name of REQUIRED_EXPORTS) {
        if (typeof exports[name] !== 'function') {
            diagnostics.push({
                code: 'missing-wasm-export',
                severity: 'error',
                message: `WASM runtime is missing required export ${name}`,
            });
        }
    }

    if (diagnostics.length > 0) {
        return {
            engine: null,
            diagnostics,
        };
    }

    return {
        engine: {
            configureRuntimeDescriptor() {
                // The typed adapter validates ABI availability for now. Mapping individual
                // descriptor fields onto numeric WASM calls is covered by configure-program tests.
            },
            configureStaticNetlistBlock() {
                // Static MNA block configuration is added behind the support matrix.
            },
        },
        diagnostics,
    };
}
