import { describe, expect, test } from 'bun:test';
import {
    SchematicView,
    UI_VERSION,
    VERSION,
    parseCircuitDocument,
    serializeCircuitJsonDocument,
} from '@vessel-dsp/react-pedal-schematic';
import {
    VERSION as CORE_VERSION,
    parseCircuitDocument as parseCoreCircuitDocument,
    serializeCircuitJsonDocument as serializeCoreCircuitJsonDocument,
} from '@vessel-dsp/react-pedal-schematic/core';
import { SchematicView as SchematicViewSubpath } from '@vessel-dsp/react-pedal-schematic/ui';
import { rewriteRelativeEsmSpecifiers } from '../scripts/fix-dist-imports';

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readPackageJson(): Promise<JsonRecord> {
    const value = await Bun.file(new URL('../package.json', import.meta.url)).json();
    if (!isRecord(value)) {
        throw new Error('package.json did not parse to an object');
    }
    return value;
}

async function readPublishWorkflow(): Promise<string> {
    return Bun.file(new URL('../.github/workflows/publish.yml', import.meta.url)).text();
}

async function readReadme(): Promise<string> {
    return Bun.file(new URL('../README.md', import.meta.url)).text();
}

async function readChangelog(): Promise<string> {
    return Bun.file(new URL('../CHANGELOG.md', import.meta.url)).text();
}

function expectExport(
    exportsField: unknown,
    exportName: string,
    expected: { readonly importPath: string; readonly typesPath: string },
): void {
    expect(isRecord(exportsField)).toBe(true);
    if (!isRecord(exportsField)) {
        return;
    }

    const target = exportsField[exportName];
    expect(isRecord(target)).toBe(true);
    if (!isRecord(target)) {
        return;
    }

    expect(target.import).toBe(expected.importPath);
    expect(target.types).toBe(expected.typesPath);
}

describe('npm package contract', () => {
    test('is publishable under the React package name', async () => {
        const pkg = await readPackageJson();

        expect(pkg.name).toBe('@vessel-dsp/react-pedal-schematic');
        expect(pkg.private).not.toBe(true);
        expect(pkg.type).toBe('module');
        expect(pkg.version).toBe(VERSION);
        expect(pkg.version).toBe(UI_VERSION);
    });

    test('exports the React root, headless core, and ui compatibility subpath', async () => {
        const pkg = await readPackageJson();

        expect(pkg.main).toBe('./dist/ui/index.js');
        expect(pkg.module).toBe('./dist/ui/index.js');
        expect(pkg.types).toBe('./dist/ui/index.d.ts');
        expectExport(pkg.exports, '.', {
            importPath: './dist/ui/index.js',
            typesPath: './dist/ui/index.d.ts',
        });
        expectExport(pkg.exports, './core', {
            importPath: './dist/index.js',
            typesPath: './dist/index.d.ts',
        });
        expectExport(pkg.exports, './ui', {
            importPath: './dist/ui/index.js',
            typesPath: './dist/ui/index.d.ts',
        });
    });

    test('keeps React as a peer dependency instead of bundling it', async () => {
        const pkg = await readPackageJson();

        expect(isRecord(pkg.peerDependencies)).toBe(true);
        if (isRecord(pkg.peerDependencies)) {
            expect(pkg.peerDependencies.react).toBe('^18.0.0 || ^19.0.0');
            expect(pkg.peerDependencies['react-dom']).toBe('^18.0.0 || ^19.0.0');
        }

        expect(isRecord(pkg.dependencies) && 'react' in pkg.dependencies).toBe(false);
        expect(isRecord(pkg.dependencies) && 'react-dom' in pkg.dependencies).toBe(false);
    });

    test('keeps Circuit JSON and tscircuit tooling dev-only', async () => {
        const pkg = await readPackageJson();

        expect(isRecord(pkg.devDependencies)).toBe(true);
        if (isRecord(pkg.devDependencies)) {
            expect(pkg.devDependencies['circuit-json']).toBeDefined();
            expect(pkg.devDependencies.zod).toBeDefined();
        }

        const runtimeDependencies = isRecord(pkg.dependencies) ? pkg.dependencies : {};
        expect(runtimeDependencies['circuit-json']).toBeUndefined();
        expect(runtimeDependencies['circuit-to-svg']).toBeUndefined();
        expect(runtimeDependencies['@tscircuit/core']).toBeUndefined();
        expect(runtimeDependencies.zod).toBeUndefined();
    });

    test('runs checks and a library build before npm packing', async () => {
        const pkg = await readPackageJson();

        expect(isRecord(pkg.scripts)).toBe(true);
        if (!isRecord(pkg.scripts)) {
            return;
        }

        expect(pkg.scripts.prepack).toContain('bun run typecheck');
        expect(pkg.scripts.prepack).toContain('bun test');
        expect(pkg.scripts.prepack).toContain('bun run build');
        expect(pkg.scripts.build).toContain('scripts/fix-dist-imports.ts');
        expect(pkg.scripts.build).toContain('bun run check:dist');
        expect(pkg.scripts['check:dist']).toBe('node scripts/check-dist-entrypoints.mjs');
        expect(pkg.scripts['pack:dry-run']).toBe('npm pack --dry-run');
    });

    test('declares the MIT license and includes the license file', async () => {
        const pkg = await readPackageJson();

        expect(pkg.license).toBe('MIT');
        expect(Array.isArray(pkg.files)).toBe(true);
        expect(pkg.files).toContain('LICENSE.md');
    });

    test('publishes package homepage and GitHub repository metadata for the npm package page', async () => {
        const pkg = await readPackageJson();

        expect(pkg.homepage).toBe('https://vessel-dsp.github.io/react-pedal-schematic/');

        expect(isRecord(pkg.repository)).toBe(true);
        if (isRecord(pkg.repository)) {
            expect(pkg.repository.type).toBe('git');
            expect(pkg.repository.url).toBe('git+https://github.com/vessel-dsp/react-pedal-schematic.git');
        }

        expect(isRecord(pkg.bugs)).toBe(true);
        if (isRecord(pkg.bugs)) {
            expect(pkg.bugs.url).toBe('https://github.com/vessel-dsp/react-pedal-schematic/issues');
        }
    });
});

describe('published import surface', () => {
    test('root import is the React UI surface plus core helpers', () => {
        expect(SchematicView).toBe(SchematicViewSubpath);
        expect(parseCircuitDocument).toBe(parseCoreCircuitDocument);
        expect(serializeCircuitJsonDocument).toBe(serializeCoreCircuitJsonDocument);
        expect(VERSION).toBe(CORE_VERSION);
    });
});

describe('npm publish workflow', () => {
    test('publishes the scoped package to npm with the configured token', async () => {
        const workflow = await readPublishWorkflow();

        expect(workflow).toContain('name: Publish to npm');
        expect(workflow).toContain('workflow_dispatch:');
        expect(workflow).toContain('push:');
        expect(workflow).toContain('tags:');
        expect(workflow).toContain("- 'v*'");
        expect(workflow).not.toContain('release:');
        expect(workflow).toContain('id-token: write');
        expect(workflow).toContain('oven-sh/setup-bun@v2');
        expect(workflow).toContain('actions/setup-node@v4');
        expect(workflow).toContain('registry-url: https://registry.npmjs.org');
        expect(workflow).toContain("scope: '@vessel-dsp'");
        expect(workflow).toContain('bun install --frozen-lockfile');
        expect(workflow).toContain('bun run pack:dry-run');
        expect(workflow).toContain('npm publish --access public --provenance');
        expect(workflow).toContain('NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}');
    });
});

describe('README package metadata', () => {
    test('shows the npm version badge for the scoped package', async () => {
        const readme = await readReadme();

        expect(readme).toContain('[![npm version](https://img.shields.io/npm/v/%40vessel-dsp%2Freact-pedal-schematic.svg)]');
        expect(readme).toContain('(https://www.npmjs.com/package/@vessel-dsp/react-pedal-schematic)');
    });
});

describe('release metadata', () => {
    test('pins the current package release and changelog entry', async () => {
        const pkg = await readPackageJson();
        const changelog = await readChangelog();

        expect(pkg.version).toBe('0.2.5');
        expect(VERSION).toBe('0.2.5');
        expect(UI_VERSION).toBe('0.2.5');
        expect(changelog).toStartWith('# Changelog\n\n## 0.2.5\n\n');
    });
});

describe('dist import rewriting', () => {
    test('adds .js extensions to relative ESM specifiers that point at emitted files', () => {
        const rewritten = rewriteRelativeEsmSpecifiers(
            [
                "export * from '../index';",
                "import { parseCircuitDocument } from './formats/document';",
                "import './side-effect';",
                "import external from 'react';",
                "import already from './ready.js';",
            ].join('\n'),
            new URL('file:///Users/example/project/dist/ui/index.js'),
            new Set([
                '/Users/example/project/dist/index.js',
                '/Users/example/project/dist/ui/formats/document.js',
                '/Users/example/project/dist/ui/side-effect.js',
            ]),
        );

        expect(rewritten).toContain("export * from '../index.js';");
        expect(rewritten).toContain("from './formats/document.js';");
        expect(rewritten).toContain("import './side-effect.js';");
        expect(rewritten).toContain("from 'react';");
        expect(rewritten).toContain("from './ready.js';");
    });
});
