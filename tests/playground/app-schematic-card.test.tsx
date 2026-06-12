import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    createEditorState,
    EMPTY_DOCUMENT,
    parseSchx,
    toNetlistView,
    validateDocument,
    type CircuitDocument,
    type EditorCommand,
} from '@vessel-dsp/react-component';
import {
    parseFixtureDocument,
    PlaygroundShell,
    SchematicCanvasPanel,
    SchematicCard,
    SchematicLeftPanel,
    SchematicRightPanel,
    SchematicWorkspace,
    commandForSchematicShortcut,
    handleSchematicShortcutEvent,
    sourceTextForFormat,
} from '../../playground/src/App';
import type { Fixture } from '../../playground/src/lib/fixtures';

const emptySchx = '<?xml version="1.0"?><Schematic></Schematic>';
type ShortcutEventInput = Readonly<{
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
}>;

function shortcutEvent(input: ShortcutEventInput): Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'> {
    return {
        key: input.key,
        ctrlKey: input.ctrlKey ?? false,
        metaKey: input.metaKey ?? false,
        shiftKey: input.shiftKey ?? false,
        altKey: input.altKey ?? false,
    };
}

function shortcutHandlingEvent(
    input: ShortcutEventInput,
    preventDefault: () => void,
    target: EventTarget | null = null,
): Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'target' | 'preventDefault'> {
    return {
        ...shortcutEvent(input),
        target,
        preventDefault,
    };
}

function keyboardTarget(tagName: string, isContentEditable: boolean): EventTarget {
    const target = new EventTarget();
    Object.defineProperty(target, 'tagName', { value: tagName, enumerable: true });
    Object.defineProperty(target, 'isContentEditable', { value: isContentEditable, enumerable: true });
    return target;
}

describe('playground Schematic tab', () => {
    test('renders a GitHub star button in the playground header', () => {
        const editorState = createEditorState(parseSchx(emptySchx));
        const document = editorState.document;
        const dispatch = (_command: EditorCommand): void => {};
        const noop = (): void => {};

        const markup = renderToStaticMarkup(
            createElement(PlaygroundShell, {
                fixtureId: 'empty',
                fixture: undefined,
                onFixtureChange: noop,
                editorState,
                dispatch,
                document,
                view: toNetlistView(document),
                issues: validateDocument(document),
                selectedComponent: null,
            }),
        );

        expect(markup).toContain('aria-label="Star @vessel-dsp/react-component on GitHub"');
        expect(markup).toContain('href="https://github.com/vessel-dsp/react-component"');
        expect(markup).toContain('target="_blank"');
        expect(markup).toContain('rel="noreferrer"');
        expect(markup).toContain('Star');
    });

    test('does not expose the JointJS experiment as a playground tab', () => {
        const editorState = createEditorState(parseSchx(emptySchx));
        const document = editorState.document;
        const dispatch = (_command: EditorCommand): void => {};
        const noop = (): void => {};

        const markup = renderToStaticMarkup(
            createElement(PlaygroundShell, {
                fixtureId: 'empty',
                fixture: undefined,
                onFixtureChange: noop,
                editorState,
                dispatch,
                document,
                view: toNetlistView(document),
                issues: validateDocument(document),
                selectedComponent: null,
            }),
        );

        expect(markup).not.toContain('JointJS');
    });

    test('uses the library schematic SVG renderer', () => {
        const editorState = createEditorState(parseSchx(emptySchx));
        const dispatch = (_command: EditorCommand): void => {};

        const markup = renderToStaticMarkup(
            createElement(SchematicCard, {
                editorState,
                dispatch,
                selectedComponent: null,
            }),
        );

        expect(markup).toContain('aria-label="Schematic preview"');
    });

    test('renders a tidy layout command in the schematic toolbar', () => {
        const editorState = createEditorState(parseSchx(emptySchx));
        const dispatch = (_command: EditorCommand): void => {};

        const markup = renderToStaticMarkup(
            createElement(SchematicCard, {
                editorState,
                dispatch,
                selectedComponent: null,
            }),
        );

        expect(markup).toContain('Tidy up');
    });

    test('maps schematic keyboard shortcuts to editor commands', () => {
        expect(commandForSchematicShortcut(shortcutEvent({ key: 'z', ctrlKey: true }))).toEqual({ type: 'undo' });
        expect(commandForSchematicShortcut(shortcutEvent({ key: 'z', metaKey: true }))).toEqual({ type: 'undo' });
        expect(commandForSchematicShortcut(shortcutEvent({ key: 'Z', ctrlKey: true, shiftKey: true }))).toEqual({ type: 'redo' });
        expect(commandForSchematicShortcut(shortcutEvent({ key: 'Z', metaKey: true, shiftKey: true }))).toEqual({ type: 'redo' });
        expect(commandForSchematicShortcut(shortcutEvent({ key: 'f', ctrlKey: true }))).toEqual({ type: 'tidy-layout' });
        expect(commandForSchematicShortcut(shortcutEvent({ key: 'f', metaKey: true }))).toEqual({ type: 'tidy-layout' });
    });

    test('ignores non-schematic keyboard shortcuts', () => {
        expect(commandForSchematicShortcut(shortcutEvent({ key: 'z' }))).toBeNull();
        expect(commandForSchematicShortcut(shortcutEvent({ key: 'f' }))).toBeNull();
        expect(commandForSchematicShortcut(shortcutEvent({ key: 'z', ctrlKey: true, altKey: true }))).toBeNull();
    });

    test('dispatches schematic shortcut commands and prevents the browser default', () => {
        const commands: EditorCommand[] = [];
        let preventDefaultCount = 0;

        const handled = handleSchematicShortcutEvent(
            shortcutHandlingEvent({ key: 'f', metaKey: true }, () => {
                preventDefaultCount += 1;
            }),
            (command) => commands.push(command),
        );

        expect(handled).toBe(true);
        expect(commands).toEqual([{ type: 'tidy-layout' }]);
        expect(preventDefaultCount).toBe(1);
    });

    test('does not steal schematic shortcuts from editable inspector fields', () => {
        const commands: EditorCommand[] = [];
        let preventDefaultCount = 0;

        const handled = handleSchematicShortcutEvent(
            shortcutHandlingEvent(
                { key: 'z', ctrlKey: true },
                () => {
                    preventDefaultCount += 1;
                },
                keyboardTarget('INPUT', false),
            ),
            (command) => commands.push(command),
        );

        expect(handled).toBe(false);
        expect(commands).toEqual([]);
        expect(preventDefaultCount).toBe(0);
    });

    test('renders a wire flow toggle in the schematic toolbar', () => {
        const editorState = createEditorState(parseSchx(emptySchx));
        const dispatch = (_command: EditorCommand): void => {};

        const markup = renderToStaticMarkup(
            createElement(SchematicCard, {
                editorState,
                dispatch,
                selectedComponent: null,
            }),
        );

        expect(markup).toContain('Signal flow');
        expect(markup).toContain('aria-pressed="false"');
        expect(markup).not.toContain('data-wire-flow="true"');
    });

    test('renders the symbol library palette in the schematic tab', () => {
        const editorState = createEditorState(parseSchx(emptySchx));
        const document = editorState.document;
        const dispatch = (_command: EditorCommand): void => {};
        const noop = (): void => {};

        const markup = renderToStaticMarkup(
            createElement(PlaygroundShell, {
                fixtureId: 'empty',
                fixture: undefined,
                onFixtureChange: noop,
                editorState,
                dispatch,
                document,
                view: toNetlistView(document),
                issues: validateDocument(document),
                selectedComponent: null,
            }),
        );

        expect(markup).toContain('Symbol library');
        expect(markup).toContain('Passives');
        expect(markup).toContain('Semiconductors');
    });

    test('renders Source as a generated .vdsp document by default', () => {
        const fixture: Fixture = {
            id: 'empty-schx',
            title: 'Empty SCHX',
            description: 'Small editable LiveSPICE fixture.',
            filename: 'empty.schx',
            source: emptySchx,
            group: 'custom',
        };
        const editorState = createEditorState(parseSchx(emptySchx));
        const document = editorState.document;
        const dispatch = (_command: EditorCommand): void => {};
        const noop = (): void => {};

        const markup = renderToStaticMarkup(
            createElement(PlaygroundShell, {
                fixtureId: fixture.id,
                fixture,
                onFixtureChange: noop,
                editorState,
                dispatch,
                document,
                view: toNetlistView(document),
                issues: validateDocument(document),
                selectedComponent: null,
            }),
        );

        expect(markup).toContain('trigger-source');
        expect(markup).toContain('Source');
        expect(markup).toContain('data-source-format-select="true"');
        expect(markup).toContain('data-source-format-value=".vdsp"');
        expect(markup).toContain('data-source-output-view="true"');
        expect(markup).toContain('schema: circuit-interchange/v2');
        expect(markup).toContain('filename: empty.vdsp');
        expect(markup).not.toContain('data-source-vdsp-apply="true"');
        expect(markup).not.toContain('Export');
    });

    test('does not render a raw source tab or raw source editor', () => {
        const fixture: Fixture = {
            id: 'empty-schx',
            title: 'Empty SCHX',
            description: 'Small editable LiveSPICE fixture.',
            filename: 'empty.schx',
            source: emptySchx,
            group: 'custom',
        };
        const editorState = createEditorState(parseSchx(emptySchx));
        const document = editorState.document;
        const dispatch = (_command: EditorCommand): void => {};
        const noop = (): void => {};

        const markup = renderToStaticMarkup(
            createElement(PlaygroundShell, {
                fixtureId: fixture.id,
                fixture,
                onFixtureChange: noop,
                editorState,
                dispatch,
                document,
                view: toNetlistView(document),
                issues: validateDocument(document),
                selectedComponent: null,
            }),
        );

        expect(markup).not.toContain('trigger-raw');
        expect(markup).not.toContain('Raw .schx');
        expect(markup).not.toContain('Raw .vdsp');
        expect(markup).not.toContain('Raw .asc');
        expect(markup).not.toContain('data-raw-schx-editor="true"');
        expect(markup).not.toContain('data-raw-schx-apply="true"');
        expect(markup).not.toContain('data-raw-source-readonly="true"');
    });

    test('renders .vdsp fixtures as parsed documents with generated source output', () => {
        const fixture: Fixture = {
            id: 'simple-rc-vdsp',
            title: 'Simple RC filter (.vdsp)',
            description: 'Hand-written minimal RC circuit in .vdsp format.',
            filename: 'simple-rc-vdsp.vdsp',
            source: `schema: circuit-interchange/v2
metadata:
  name: RC Low-Pass Filter
  description: ''
  partNumber: ''
source:
  format: interchange
  filename: simple-rc-vdsp.vdsp
components: []
nodes: []
wires: []
directives: []
diagnostics: []
rawAttributes: {}`,
            group: 'custom',
        };
        const document = parseFixtureDocument(fixture);
        const editorState = createEditorState(document);
        const dispatch = (_command: EditorCommand): void => {};
        const noop = (): void => {};

        const markup = renderToStaticMarkup(
            createElement(PlaygroundShell, {
                fixtureId: fixture.id,
                fixture,
                onFixtureChange: noop,
                editorState,
                dispatch,
                document,
                view: toNetlistView(document),
                issues: validateDocument(document),
                selectedComponent: null,
            }),
        );

        expect(document.metadata.name).toBe('RC Low-Pass Filter');
        expect(markup).toContain('data-source-output-view="true"');
        expect(markup).toContain('data-source-format-value=".vdsp"');
        expect(markup).toContain('schema: circuit-interchange/v2');
        expect(markup).toContain('filename: simple-rc-vdsp.vdsp');
        expect(markup).not.toContain('Raw .vdsp');
    });

    test('converts Source output when the selected format changes', () => {
        const document = {
            ...EMPTY_DOCUMENT,
            metadata: { ...EMPTY_DOCUMENT.metadata, name: 'Copyable Source' },
        };

        const schx = sourceTextForFormat('schx', undefined, document);
        const vdsp = sourceTextForFormat('vdsp', undefined, document);
        const spice = sourceTextForFormat('spice', undefined, document);

        expect(schx).toContain('<Schematic');
        expect(vdsp).toContain('schema: circuit-interchange/v2');
        expect(vdsp).toContain('filename: copyable-source.vdsp');
        expect(spice).toContain('.TITLE Copyable Source');
        expect(spice).toContain('.END');
    });

    test('renders React integration documentation on the GH Pages surface', () => {
        const editorState = createEditorState(parseSchx(emptySchx));
        const document = editorState.document;
        const dispatch = (_command: EditorCommand): void => {};
        const noop = (): void => {};

        const markup = renderToStaticMarkup(
            createElement(PlaygroundShell, {
                fixtureId: 'empty',
                fixture: undefined,
                onFixtureChange: noop,
                editorState,
                dispatch,
                document,
                view: toNetlistView(document),
                issues: validateDocument(document),
                selectedComponent: null,
            }),
        );

        expect(markup).toContain('trigger-integration');
        expect(markup).toContain('React integration');
        expect(markup).toContain('@vessel-dsp/react-component');
        expect(markup).toContain('npm install @vessel-dsp/react-component');
        expect(markup).not.toContain('github:indiejoseph/react-pedal-schematic');
        expect(markup).toContain('SchematicView');
        expect(markup).toContain('parseCircuitDocument');
    });

    test('renders simulation readiness with missing runtime state', () => {
        const editorState = createEditorState(parseSchx(emptySchx));
        const document = editorState.document;
        const dispatch = (_command: EditorCommand): void => {};
        const noop = (): void => {};

        const markup = renderToStaticMarkup(
            createElement(PlaygroundShell, {
                fixtureId: 'empty',
                fixture: undefined,
                onFixtureChange: noop,
                editorState,
                dispatch,
                document,
                view: toNetlistView(document),
                issues: validateDocument(document),
                selectedComponent: null,
            }),
        );

        expect(markup).toContain('trigger-simulation');
        expect(markup).toContain('Simulation');
        expect(markup).toContain('@vessel-dsp/simulation');
        expect(markup).toContain('data-simulation-status-state="missing-runtime"');
        expect(markup).toContain('No runtime adapter');
    });

    test('renders simulation blockers for unsupported components', () => {
        const document: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'U1',
                kind: 'unsupported',
                name: 'U1',
                origin: { x: 0, y: 0 },
                rotation: 0,
                flipped: false,
                terminals: [],
                properties: { InstName: 'U1' },
                sourceTypeName: 'ltspice:unknown-runtime',
            }],
        };
        const editorState = createEditorState(document);
        const dispatch = (_command: EditorCommand): void => {};
        const noop = (): void => {};

        const markup = renderToStaticMarkup(
            createElement(PlaygroundShell, {
                fixtureId: 'unsupported',
                fixture: undefined,
                onFixtureChange: noop,
                editorState,
                dispatch,
                document,
                view: toNetlistView(document),
                issues: validateDocument(document),
                selectedComponent: null,
            }),
        );

        expect(markup).toContain('data-simulation-status-state="unsupported"');
        expect(markup).toContain('data-simulation-diagnostic-code="unsupported-component"');
        expect(markup).toContain('U1: ltspice:unknown-runtime is not supported by simulation V1');
    });

    test('does not render a Live Panel playground tab or demo', () => {
        const editorState = createEditorState(parseSchx(emptySchx));
        const document = editorState.document;
        const dispatch = (_command: EditorCommand): void => {};
        const noop = (): void => {};

        const markup = renderToStaticMarkup(
            createElement(PlaygroundShell, {
                fixtureId: 'empty',
                fixture: undefined,
                onFixtureChange: noop,
                editorState,
                dispatch,
                document,
                view: toNetlistView(document),
                issues: validateDocument(document),
                selectedComponent: null,
            }),
        );

        expect(markup).not.toContain('trigger-live-panel');
        expect(markup).not.toContain('Live Panel');
        expect(markup).not.toContain('data-live-panel-demo="true"');
    });

    test('renders the current editor document only in the schematic workspace', () => {
        const document: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'CURRENT_PANEL_MARKER',
                kind: 'resistor',
                name: 'R_PANEL',
                origin: { x: 0, y: 0 },
                rotation: 0,
                flipped: false,
                terminals: [
                    { name: 'a', position: { x: 0, y: -20 } },
                    { name: 'b', position: { x: 0, y: 20 } },
                ],
                properties: { Resistance: '10 kΩ' },
                sourceTypeName: 'Circuit.Resistor, Circuit',
            }],
        };
        const editorState = createEditorState(document);
        const dispatch = (_command: EditorCommand): void => {};
        const noop = (): void => {};

        const markup = renderToStaticMarkup(
            createElement(PlaygroundShell, {
                fixtureId: 'current',
                fixture: undefined,
                onFixtureChange: noop,
                editorState,
                dispatch,
                document,
                view: toNetlistView(document),
                issues: validateDocument(document),
                selectedComponent: null,
            }),
        );

        const renderedMarkers = markup.match(/data-component-id="CURRENT_PANEL_MARKER"/g) ?? [];
        expect(renderedMarkers).toHaveLength(1);
    });

    test('deduplicates repeated unsupported-component diagnostics in the warnings UI', () => {
        const document: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'U1',
                kind: 'unsupported',
                name: 'U1',
                origin: { x: 0, y: 0 },
                rotation: 0,
                flipped: false,
                terminals: [],
                properties: { InstName: 'U1' },
                sourceTypeName: 'ltspice:lm13700_ns',
            }],
            warnings: [{
                code: 'unknown-ltspice-symbol',
                message: 'U1: unsupported LTspice symbol "AutoGenerated\\\\LM13700_NS"',
                componentId: 'U1',
            }],
        };
        const editorState = createEditorState(document);
        const view = toNetlistView(document);
        const issues = validateDocument(document);
        const dispatch = (_command: EditorCommand): void => {};
        const noop = (): void => {};

        expect(document.warnings).toHaveLength(1);
        expect(issues).toHaveLength(1);
        expect(view.warnings).toHaveLength(1);

        const markup = renderToStaticMarkup(
            createElement(PlaygroundShell, {
                fixtureId: 'empty',
                fixture: undefined,
                onFixtureChange: noop,
                editorState,
                dispatch,
                document,
                view,
                issues,
                selectedComponent: null,
            }),
        );

        expect(markup).toMatch(/Warnings[\s\S]*?>1<\/span>/);
        expect(markup).toContain('unknown-ltspice-symbol');
        expect(markup).toContain('data-simulation-diagnostic-code="unsupported-component"');
        expect(markup).not.toContain('U1: unsupported source type ltspice:lm13700_ns');
        expect(markup).not.toContain('skipped from netlist');
    });

    test('exposes context-backed standalone schematic panels with custom class names', () => {
        const editorState = createEditorState(parseSchx(emptySchx));
        const dispatch = (_command: EditorCommand): void => {};

        const markup = renderToStaticMarkup(
            createElement(
                SchematicWorkspace,
                {
                    editorState,
                    dispatch,
                    selectedComponent: null,
                    className: 'custom-workspace',
                },
                createElement(SchematicRightPanel, { className: 'right-slot' }),
                createElement(SchematicCanvasPanel, { className: 'canvas-slot', canvasClassName: 'canvas-view' }),
                createElement(SchematicLeftPanel, { className: 'left-slot', contentClassName: 'left-scroll-slot' }),
            ),
        );

        expect(markup).toContain('data-schematic-workspace="true"');
        expect(markup).toContain('custom-workspace');
        expect(markup).toContain('right-slot');
        expect(markup).toContain('canvas-slot');
        expect(markup).toContain('canvas-view');
        expect(markup).toContain('left-slot');
        expect(markup).toContain('left-scroll-slot');
        expect(markup.indexOf('Inspector')).toBeLessThan(markup.indexOf('Edit canvas'));
        expect(markup.indexOf('Edit canvas')).toBeLessThan(markup.indexOf('Symbol library'));
    });
});
