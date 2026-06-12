import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

async function importDist(path) {
    return import(pathToFileURL(resolve(path)).href);
}

const core = await importDist('packages/core/dist/index.js');
const react = await importDist('packages/react-component/dist/index.js');
const reactUi = await importDist('packages/react-component/dist/ui.js');
const simulation = await importDist('packages/simulation/dist/index.js');
const simulationRuntime = await importDist('packages/simulation/dist/runtime/index.js');

if (typeof core.parseCircuitDocument !== 'function') {
    throw new Error('packages/core/dist/index.js does not export parseCircuitDocument');
}

if ('SchematicView' in core) {
    throw new Error('packages/core/dist/index.js must stay headless and not export SchematicView');
}

if (typeof react.SchematicView !== 'function') {
    throw new Error('packages/react-component/dist/index.js does not export SchematicView');
}

if (typeof react.SimulationStatus !== 'function') {
    throw new Error('packages/react-component/dist/index.js does not export SimulationStatus');
}

if (react.SchematicView !== reactUi.SchematicView) {
    throw new Error('packages/react-component ./ui subpath must export the same SchematicView');
}

if (react.SimulationStatus !== reactUi.SimulationStatus) {
    throw new Error('packages/react-component ./ui subpath must export the same SimulationStatus');
}

if (react.parseCircuitDocument !== core.parseCircuitDocument) {
    throw new Error('packages/react-component/dist/index.js does not re-export core helpers');
}

if (typeof simulation.analyzeSimulationReadiness !== 'function') {
    throw new Error('packages/simulation/dist/index.js does not export analyzeSimulationReadiness');
}

if (typeof simulationRuntime.configureRuntimeProgram !== 'function') {
    throw new Error('packages/simulation/dist/runtime/index.js does not export configureRuntimeProgram');
}

console.log('dist entrypoints ok');
