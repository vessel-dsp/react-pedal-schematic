import type { CircuitDocument } from '../model/types';
import { applyDocumentCommand, type DocumentCommand } from './commands';

export type EditorState = Readonly<{
    document: CircuitDocument;
    selectedId: string | null;
    past: readonly CircuitDocument[];
    future: readonly CircuitDocument[];
}>;

export type EditorCommand =
    | DocumentCommand
    | Readonly<{ type: 'select'; componentId: string | null }>
    | Readonly<{ type: 'undo' }>
    | Readonly<{ type: 'redo' }>;

const HISTORY_LIMIT = 200;

export function createEditorState(document: CircuitDocument): EditorState {
    return {
        document,
        selectedId: null,
        past: [],
        future: [],
    };
}

export function applyEditorCommand(state: EditorState, command: EditorCommand): EditorState {
    switch (command.type) {
        case 'select':
            return state.selectedId === command.componentId ? state : { ...state, selectedId: command.componentId };
        case 'undo':
            return undo(state);
        case 'redo':
            return redo(state);
        default:
            return applyAndPush(state, command);
    }
}

export function canUndo(state: EditorState): boolean {
    return state.past.length > 0;
}

export function canRedo(state: EditorState): boolean {
    return state.future.length > 0;
}

export function resetEditorState(document: CircuitDocument): EditorState {
    return createEditorState(document);
}

function applyAndPush(state: EditorState, command: DocumentCommand): EditorState {
    const nextDocument = applyDocumentCommand(state.document, command);
    if (nextDocument === state.document) {
        return state;
    }
    const past = [...state.past, state.document].slice(-HISTORY_LIMIT);
    const selectedId = command.type === 'delete-component' && state.selectedId === command.componentId
        ? null
        : state.selectedId;
    return {
        document: nextDocument,
        selectedId,
        past,
        future: [],
    };
}

function undo(state: EditorState): EditorState {
    const previous = state.past[state.past.length - 1];
    if (previous === undefined) {
        return state;
    }
    return {
        document: previous,
        selectedId: state.selectedId,
        past: state.past.slice(0, -1),
        future: [state.document, ...state.future],
    };
}

function redo(state: EditorState): EditorState {
    const next = state.future[0];
    if (next === undefined) {
        return state;
    }
    return {
        document: next,
        selectedId: state.selectedId,
        past: [...state.past, state.document],
        future: state.future.slice(1),
    };
}
