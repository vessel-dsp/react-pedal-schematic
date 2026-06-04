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
} from '@vessel-dsp/react-pedal-schematic';
import {
    PlaygroundShell,
    SchematicCanvasPanel,
    SchematicCard,
    SchematicLeftPanel,
    SchematicRightPanel,
    SchematicWorkspace,
} from '../../playground/src/App';

const emptySchx = '<?xml version="1.0"?><Schematic></Schematic>';

describe('playground Schematic tab', () => {
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

    test('renders a Source tab with the intermediary YAML document', () => {
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

        expect(markup).toContain('trigger-source');
        expect(markup).toContain('Source');
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
        expect(markup).toContain('@vessel-dsp/react-pedal-schematic');
        expect(markup).toContain('npm install @vessel-dsp/react-pedal-schematic');
        expect(markup).not.toContain('github:indiejoseph/react-pedal-schematic');
        expect(markup).toContain('SchematicView');
        expect(markup).toContain('parseCircuitDocument');
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
        expect(markup).not.toContain('unsupported-component');
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
