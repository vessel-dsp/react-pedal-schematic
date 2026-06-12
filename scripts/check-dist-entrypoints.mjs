import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

async function importDist(path) {
    return import(pathToFileURL(resolve(path)).href);
}

const core = await importDist('packages/core/dist/index.js');

if (typeof core.parseCircuitDocument !== 'function') {
    throw new Error('packages/core/dist/index.js does not export parseCircuitDocument');
}

if (typeof core.serializeCircuitJsonDocument !== 'function') {
    throw new Error('packages/core/dist/index.js does not export serializeCircuitJsonDocument');
}

if (typeof core.parseCircuitJsonDocument !== 'function') {
    throw new Error('packages/core/dist/index.js does not export parseCircuitJsonDocument');
}

if (typeof core.serializeLtspiceAsc !== 'function') {
    throw new Error('packages/core/dist/index.js does not export serializeLtspiceAsc');
}

if (typeof core.convertCircuitDocumentFile !== 'function') {
    throw new Error('packages/core/dist/index.js does not export convertCircuitDocumentFile');
}

if ('SchematicView' in core) {
    throw new Error('packages/core/dist/index.js must stay headless and not export SchematicView');
}

console.log('dist entrypoints ok');
