import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = await import(pathToFileURL(resolve('dist/ui/index.js')).href);
const core = await import(pathToFileURL(resolve('dist/index.js')).href);

if (typeof root.SchematicView !== 'function') {
    throw new Error('dist/ui/index.js does not export SchematicView');
}

if (typeof root.parseCircuitDocument !== 'function') {
    throw new Error('dist/ui/index.js does not re-export parseCircuitDocument');
}

if (typeof core.parseCircuitDocument !== 'function') {
    throw new Error('dist/index.js does not export parseCircuitDocument');
}

if ('SchematicView' in core) {
    throw new Error('dist/index.js must stay headless and not export SchematicView');
}

console.log('dist entrypoints ok');
