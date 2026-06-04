import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    createEditorState,
    parseSchx,
    toNetlistView,
    validateDocument,
    type EditorCommand,
} from 'react-pedal-schematic';
import { PlaygroundShell, SchematicCard } from '../../playground/src/App';

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
});
