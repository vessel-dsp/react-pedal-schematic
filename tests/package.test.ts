import { describe, expect, test } from 'bun:test';
import {
    VERSION,
    extractDeviceInterface,
    parseCircuitDocument,
    serializeCircuitJsonDocument,
} from '@vessel-dsp/core';
import {
    SchematicView,
    SimulationStatus,
    UI_VERSION,
    VERSION as REACT_CORE_VERSION,
    extractDeviceInterface as extractReactDeviceInterface,
    parseCircuitDocument as parseReactCircuitDocument,
    serializeCircuitJsonDocument as serializeReactCircuitJsonDocument,
} from '@vessel-dsp/react-component';
import {
    SchematicView as SchematicViewSubpath,
    SimulationStatus as SimulationStatusSubpath,
} from '@vessel-dsp/react-component/ui';
import { rewriteRelativeEsmSpecifiers } from '../scripts/fix-dist-imports';

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(path: string): Promise<JsonRecord> {
    const value = await Bun.file(new URL(path, import.meta.url)).json();
    if (!isRecord(value)) {
        throw new Error(`${path} did not parse to an object`);
    }
    return value;
}

async function readRootPackageJson(): Promise<JsonRecord> {
    return readJson('../package.json');
}

async function readPackageJson(packageDir: string): Promise<JsonRecord> {
    return readJson(`../packages/${packageDir}/package.json`);
}

async function readPackageTsconfig(packageDir: string): Promise<JsonRecord> {
    return readJson(`../packages/${packageDir}/tsconfig.json`);
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

function runtimeDependencies(pkg: JsonRecord): JsonRecord {
    return isRecord(pkg.dependencies) ? pkg.dependencies : {};
}

function devDependencies(pkg: JsonRecord): JsonRecord {
    return isRecord(pkg.devDependencies) ? pkg.devDependencies : {};
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

function expectNoReactRuntimeDependency(pkg: JsonRecord): void {
    const deps = runtimeDependencies(pkg);
    expect(deps.react).toBeUndefined();
    expect(deps['react-dom']).toBeUndefined();
}

describe('workspace package contract', () => {
    test('root manifest is a private Bun workspace', async () => {
        const pkg = await readRootPackageJson();

        expect(pkg.name).toBe('@vessel-dsp/workspace');
        expect(pkg.private).toBe(true);
        expect(pkg.packageManager).toBe('bun@1.2.2');
        expect(pkg.publishConfig).toBeUndefined();
        expect(pkg.exports).toBeUndefined();
        expect(pkg.files).toBeUndefined();
        expect(pkg.workspaces).toEqual(['packages/*']);
    });

    test('core package publishes the broad headless API under @vessel-dsp/core', async () => {
        const pkg = await readPackageJson('core');

        expect(pkg.name).toBe('@vessel-dsp/core');
        expect(pkg.version).toBe(VERSION);
        expect(pkg.private).not.toBe(true);
        expect(pkg.type).toBe('module');
        expect(pkg.sideEffects).toBe(false);
        expect(pkg.main).toBe('./dist/index.js');
        expect(pkg.module).toBe('./dist/index.js');
        expect(pkg.types).toBe('./dist/index.d.ts');
        expectExport(pkg.exports, '.', {
            importPath: './dist/index.js',
            typesPath: './dist/index.d.ts',
        });
        expectNoReactRuntimeDependency(pkg);
    });

    test('React package publishes @vessel-dsp/react-component and depends on core', async () => {
        const pkg = await readPackageJson('react-component');
        const deps = runtimeDependencies(pkg);

        expect(pkg.name).toBe('@vessel-dsp/react-component');
        expect(pkg.version).toBe(UI_VERSION);
        expect(pkg.private).not.toBe(true);
        expect(deps['@vessel-dsp/core']).toBe('workspace:*');
        expect(pkg.main).toBe('./dist/index.js');
        expect(pkg.module).toBe('./dist/index.js');
        expect(pkg.types).toBe('./dist/index.d.ts');
        expectExport(pkg.exports, '.', {
            importPath: './dist/index.js',
            typesPath: './dist/index.d.ts',
        });
        expectExport(pkg.exports, './ui', {
            importPath: './dist/ui.js',
            typesPath: './dist/ui.d.ts',
        });

        expect(isRecord(pkg.peerDependencies)).toBe(true);
        if (isRecord(pkg.peerDependencies)) {
            expect(pkg.peerDependencies.react).toBe('^18.0.0 || ^19.0.0');
            expect(pkg.peerDependencies['react-dom']).toBe('^18.0.0 || ^19.0.0');
        }
    });

    test('simulation package is private until its adapter contract is stable', async () => {
        const pkg = await readPackageJson('simulation');
        const deps = runtimeDependencies(pkg);

        expect(pkg.name).toBe('@vessel-dsp/simulation');
        expect(pkg.private).toBe(true);
        expect(deps['@vessel-dsp/core']).toBe('workspace:*');
        expectExport(pkg.exports, '.', {
            importPath: './dist/index.js',
            typesPath: './dist/index.d.ts',
        });
        expectExport(pkg.exports, './runtime', {
            importPath: './dist/runtime/index.js',
            typesPath: './dist/runtime/index.d.ts',
        });
        expectNoReactRuntimeDependency(pkg);
    });

    test('core and simulation package tsconfigs do not include DOM libs', async () => {
        for (const packageDir of ['core', 'simulation']) {
            const tsconfig = await readPackageTsconfig(packageDir);
            const compilerOptions = isRecord(tsconfig.compilerOptions) ? tsconfig.compilerOptions : {};
            expect(compilerOptions.lib).toEqual(['ES2022']);
        }
    });

    test('Circuit JSON and tscircuit tooling stay dev-only at the workspace root', async () => {
        const root = await readRootPackageJson();
        const rootDevDeps = devDependencies(root);

        expect(rootDevDeps['circuit-json']).toBeDefined();
        expect(rootDevDeps.zod).toBeDefined();

        for (const packageDir of ['core', 'react-component', 'simulation']) {
            const pkg = await readPackageJson(packageDir);
            const deps = runtimeDependencies(pkg);
            expect(deps['circuit-json']).toBeUndefined();
            expect(deps['circuit-to-svg']).toBeUndefined();
            expect(deps['@tscircuit/core']).toBeUndefined();
            expect(deps.zod).toBeUndefined();
        }
    });

    test('package scripts build and dry-run publish packages in dependency order', async () => {
        const root = await readRootPackageJson();
        const scripts = isRecord(root.scripts) ? root.scripts : {};

        expect(scripts.build).toContain('packages/core');
        expect(scripts.build).toContain('packages/react-component');
        expect(scripts.build).toContain('packages/simulation');
        expect(scripts['pack:dry-run']).toContain('packages/core');
        expect(scripts['pack:dry-run']).toContain('packages/react-component');
    });

    test('declares the MIT license and includes docs in publishable packages', async () => {
        for (const packageDir of ['core', 'react-component']) {
            const pkg = await readPackageJson(packageDir);
            expect(pkg.license).toBe('MIT');
            expect(Array.isArray(pkg.files)).toBe(true);
            expect(pkg.files).toContain('LICENSE.md');
            expect(pkg.files).toContain('README.md');
        }
    });

    test('publishes package homepage and GitHub repository metadata for npm package pages', async () => {
        for (const packageDir of ['core', 'react-component']) {
            const pkg = await readPackageJson(packageDir);

            expect(pkg.homepage).toBe('https://vessel-dsp.github.io/core/');

            expect(isRecord(pkg.repository)).toBe(true);
            if (isRecord(pkg.repository)) {
                expect(pkg.repository.type).toBe('git');
                expect(pkg.repository.url).toBe('git+https://github.com/vessel-dsp/core.git');
            }

            expect(isRecord(pkg.bugs)).toBe(true);
            if (isRecord(pkg.bugs)) {
                expect(pkg.bugs.url).toBe('https://github.com/vessel-dsp/core/issues');
            }
        }
    });
});

describe('published import surface', () => {
    test('React package root is the React UI surface plus core helpers', () => {
        expect(SchematicView).toBe(SchematicViewSubpath);
        expect(SimulationStatus).toBe(SimulationStatusSubpath);
        expect(parseReactCircuitDocument).toBe(parseCircuitDocument);
        expect(serializeReactCircuitJsonDocument).toBe(serializeCircuitJsonDocument);
        expect(extractReactDeviceInterface).toBe(extractDeviceInterface);
        expect(REACT_CORE_VERSION).toBe(VERSION);
    });
});

describe('npm publish workflow', () => {
    test('publishes core before React', async () => {
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

        const corePublishIndex = workflow.indexOf('npm publish --workspace @vessel-dsp/core');
        const reactPublishIndex = workflow.indexOf('npm publish --workspace @vessel-dsp/react-component');
        expect(corePublishIndex).toBeGreaterThan(-1);
        expect(reactPublishIndex).toBeGreaterThan(corePublishIndex);
        expect(workflow).toContain('NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}');
    });
});

describe('README package metadata', () => {
    test('shows npm badges for the canonical packages', async () => {
        const readme = await readReadme();

        expect(readme).toContain('[![core npm version](https://img.shields.io/npm/v/%40vessel-dsp%2Fcore.svg)]');
        expect(readme).toContain('(https://www.npmjs.com/package/@vessel-dsp/core)');
        expect(readme).toContain('[![react npm version](https://img.shields.io/npm/v/%40vessel-dsp%2Freact-component.svg)]');
        expect(readme).toContain('(https://www.npmjs.com/package/@vessel-dsp/react-component)');
    });
});

describe('release metadata', () => {
    test('pins the current package release and changelog entry', async () => {
        const core = await readPackageJson('core');
        const react = await readPackageJson('react-component');
        const changelog = await readChangelog();

        expect(core.version).toBe('0.5.0');
        expect(react.version).toBe('0.5.0');
        expect(VERSION).toBe('0.5.0');
        expect(UI_VERSION).toBe('0.5.0');
        expect(changelog).toStartWith('# Changelog\n\n## 0.5.0\n\n');
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
            new URL('file:///Users/example/project/packages/react-component/dist/ui/index.js'),
            new Set([
                '/Users/example/project/packages/react-component/dist/index.js',
                '/Users/example/project/packages/react-component/dist/ui/formats/document.js',
                '/Users/example/project/packages/react-component/dist/ui/side-effect.js',
            ]),
        );

        expect(rewritten).toContain("export * from '../index.js';");
        expect(rewritten).toContain("from './formats/document.js';");
        expect(rewritten).toContain("import './side-effect.js';");
        expect(rewritten).toContain("from 'react';");
        expect(rewritten).toContain("from './ready.js';");
    });
});
