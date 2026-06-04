import { useMemo, useReducer, useState } from 'react';
import {
    applyEditorCommand,
    canRedo,
    canUndo,
    createEditorState,
    detectCircuitFormat,
    parseCircuitDocument,
    serializeSchx,
    toNetlistView,
    validateDocument,
    VERSION,
    type EditorCommand,
    type EditorState,
    type NetlistView,
    type Point,
    type ValidationIssue,
    type Warning,
} from 'circuit-preview-editor';
import { SchematicView } from 'circuit-preview-editor/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FIXTURES, FIXTURE_GROUPS, findFixture } from '@/lib/fixtures';
import { Inspector } from '@/components/inspector';
import { SymbolPalette, readPalettePayload } from '@/components/symbol-palette';
import canvasDotBg from '@/assets/canvas-dot-bg.png';

type EditorReducer = (state: EditorState, command: EditorCommand) => EditorState;

const editorReducer: EditorReducer = (state, command) => applyEditorCommand(state, command);

export function App(): React.ReactElement {
    const [fixtureId, setFixtureId] = useState<string>(FIXTURES[0]?.id ?? '');

    return (
        <FixtureSession
            key={fixtureId}
            fixtureId={fixtureId}
            onFixtureChange={setFixtureId}
        />
    );
}

function FixtureSession(props: {
    fixtureId: string;
    onFixtureChange: (id: string) => void;
}): React.ReactElement {
    const { fixtureId, onFixtureChange } = props;
    const fixture = findFixture(fixtureId);
    const initialDocument = useMemo(
        () => (fixture
            ? parseCircuitDocument(fixture.source, { filename: fixture.filename })
            : parseCircuitDocument('<?xml version="1.0"?><Schematic></Schematic>', { format: 'schx' })),
        [fixture],
    );

    const [editorState, dispatch] = useReducer(editorReducer, initialDocument, createEditorState);
    const document = editorState.document;
    const view: NetlistView = useMemo(() => toNetlistView(document), [document]);
    const issues: readonly ValidationIssue[] = useMemo(() => validateDocument(document), [document]);
    const selectedComponent = editorState.selectedId
        ? document.components.find((c) => c.id === editorState.selectedId) ?? null
        : null;

    return (
        <PlaygroundShell
            fixtureId={fixtureId}
            fixture={fixture}
            onFixtureChange={onFixtureChange}
            editorState={editorState}
            dispatch={dispatch}
            document={document}
            view={view}
            issues={issues}
            selectedComponent={selectedComponent}
        />
    );
}

type PlaygroundShellProps = Readonly<{
    fixtureId: string;
    fixture: ReturnType<typeof findFixture>;
    onFixtureChange: (id: string) => void;
    editorState: EditorState;
    dispatch: React.Dispatch<EditorCommand>;
    document: EditorState['document'];
    view: NetlistView;
    issues: readonly ValidationIssue[];
    selectedComponent: ReturnType<typeof findComponent>;
}>;

export function PlaygroundShell(props: PlaygroundShellProps): React.ReactElement {
    const { fixture, onFixtureChange, fixtureId, editorState, dispatch, document, view, issues, selectedComponent } = props;
    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b border-border">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight">circuit-preview-editor</h1>
                        <p className="text-sm text-muted-foreground">
                            Web circuit editor library for audio electronics — playground &amp; docs.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">v{VERSION}</Badge>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Bundled fixtures</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <Select value={fixtureId} onValueChange={onFixtureChange}>
                                    <SelectTrigger className="sm:w-72">
                                        <SelectValue placeholder="Choose a fixture" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FIXTURE_GROUPS.map((group) => {
                                            const items = FIXTURES.filter((f) => f.group === group.id);
                                            if (items.length === 0) {
                                                return null;
                                            }
                                            return (
                                                <SelectGroup key={group.id}>
                                                    <SelectLabel>{group.label}</SelectLabel>
                                                    {items.map((f) => (
                                                        <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                                {fixture && (
                                    <p className="hidden text-sm text-muted-foreground sm:block">{fixture.description}</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Tabs defaultValue="schematic" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="schematic">Schematic</TabsTrigger>
                        <TabsTrigger value="netlist">
                            Netlist <Badge variant="secondary" className="ml-2">{view.components.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="warnings">
                            Warnings <IssueBadge count={issues.length + document.warnings.length + view.warnings.length} />
                        </TabsTrigger>
                        <TabsTrigger value="raw">{rawTabLabel(fixture)}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="schematic" className="m-0">
                        <div className="grid gap-4 lg:grid-cols-[240px_1fr_320px]">
                            <SymbolPalette />
                            <SchematicCard
                                editorState={editorState}
                                dispatch={dispatch}
                                selectedComponent={selectedComponent}
                            />
                            <Inspector
                                component={selectedComponent}
                                dispatch={(cmd) => dispatch(cmd)}
                                editMode={true}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="netlist" className="m-0">
                        <NetlistPanel netlist={view} />
                    </TabsContent>

                    <TabsContent value="warnings" className="m-0">
                        <WarningsPanel
                            parseWarnings={document.warnings}
                            validationIssues={issues}
                            netlistWarnings={view.warnings}
                        />
                    </TabsContent>

                    <TabsContent value="raw" className="m-0">
                        <Card>
                            <CardContent className="p-0">
                                <pre className="max-h-140 overflow-auto whitespace-pre-wrap wrap-break-word rounded-md bg-muted p-4 font-mono text-xs text-muted-foreground">
                                    {rawSource(fixture, document)}
                                </pre>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}

function rawTabLabel(fixture: ReturnType<typeof findFixture>): string {
    if (fixture === undefined) {
        return 'Raw source';
    }
    const format = detectCircuitFormat(fixture.filename);
    if (format === 'schx') {
        return 'Raw .schx';
    }
    if (format === 'ltspice-asc') {
        return 'Raw .asc';
    }
    return 'Raw source';
}

function rawSource(
    fixture: ReturnType<typeof findFixture>,
    document: EditorState['document'],
): string {
    if (fixture === undefined) {
        return '';
    }
    if (detectCircuitFormat(fixture.filename) === 'schx') {
        return serializeSchx(document);
    }
    return fixture.source;
}

function findComponent(state: EditorState): EditorState['document']['components'][number] | null {
    if (state.selectedId === null) {
        return null;
    }
    return state.document.components.find((c) => c.id === state.selectedId) ?? null;
}

export function SchematicCard(props: {
    editorState: EditorState;
    dispatch: React.Dispatch<EditorCommand>;
    selectedComponent: ReturnType<typeof findComponent>;
}): React.ReactElement {
    const { editorState, dispatch, selectedComponent } = props;
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Edit canvas</CardTitle>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={!canUndo(editorState)}
                        onClick={() => dispatch({ type: 'undo' })}
                    >
                        Undo
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={!canRedo(editorState)}
                        onClick={() => dispatch({ type: 'redo' })}
                    >
                        Redo
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => dispatch({ type: 'tidy-layout' })}
                    >
                        Tidy up
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        disabled={selectedComponent === null}
                        onClick={() => selectedComponent && dispatch({
                            type: 'delete-component',
                            componentId: selectedComponent.id,
                        })}
                    >
                        Delete
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-2 sm:p-4">
                <SchematicView
                    document={editorState.document}
                    className="block h-140 w-full rounded-md border border-border bg-card text-foreground [--cpe-bg:var(--card)]"
                    style={{
                        backgroundImage: `url(${canvasDotBg})`,
                        backgroundRepeat: 'repeat',
                        backgroundPosition: '0 0',
                    }}
                    editMode={true}
                    selectedId={editorState.selectedId}
                    onSelect={(id) => dispatch({ type: 'select', componentId: id })}
                    onMoveComponent={(id, origin) => handleMove(dispatch, id, origin)}
                    onCanvasDrop={(event, origin) => handleCanvasDrop(dispatch, event, origin)}
                />
                <SelectionInfo selectedComponent={selectedComponent} />
            </CardContent>
        </Card>
    );
}

function handleMove(dispatch: React.Dispatch<EditorCommand>, id: string, origin: Point): void {
    dispatch({ type: 'move-component', componentId: id, origin });
}

function handleCanvasDrop(
    dispatch: React.Dispatch<EditorCommand>,
    event: React.DragEvent,
    origin: Point,
): void {
    const payload = readPalettePayload(event);
    if (payload === null) {
        return;
    }
    dispatch({
        type: 'add-component',
        kind: payload.kind,
        origin,
        sourceTypeName: payload.sourceTypeName,
    });
}

function SelectionInfo(props: { selectedComponent: ReturnType<typeof findComponent> }): React.ReactElement {
    const { selectedComponent } = props;
    if (selectedComponent === null) {
        return (
            <p className="mt-2 text-xs text-muted-foreground">
                Drag a symbol from the library, or click any component to select. Background click deselects.
            </p>
        );
    }
    return (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span><span className="font-medium text-foreground">Selected:</span> {selectedComponent.id}</span>
            <span>kind: <span className="font-mono">{selectedComponent.kind}</span></span>
            <span>origin: <span className="font-mono">({selectedComponent.origin.x}, {selectedComponent.origin.y})</span></span>
            <span>terminals: <span className="font-mono">{selectedComponent.terminals.length}</span></span>
        </div>
    );
}

function IssueBadge({ count }: { count: number }): React.ReactElement {
    const variant = count === 0 ? 'secondary' : 'destructive';
    return <Badge variant={variant} className="ml-2">{count}</Badge>;
}

function NetlistPanel({ netlist }: { netlist: NetlistView }): React.ReactElement {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">
                    Flat netlist projection
                    <span className="ml-3 text-sm font-normal text-muted-foreground">
                        {netlist.nodeCount} nodes · ground = {netlist.groundNodeId ?? '—'}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/60 text-left text-muted-foreground">
                                <th className="px-4 py-2 font-medium">SPICE</th>
                                <th className="px-4 py-2 font-medium">ID</th>
                                <th className="px-4 py-2 font-medium">Kind</th>
                                <th className="px-4 py-2 font-medium">Nodes</th>
                                <th className="px-4 py-2 font-medium">Value</th>
                                <th className="px-4 py-2 font-medium">Model</th>
                            </tr>
                        </thead>
                        <tbody>
                            {netlist.components.map((c) => (
                                <tr key={c.id} className="border-b border-border/60 last:border-b-0">
                                    <td className="px-4 py-2 font-mono text-xs">
                                        {c.spiceLetter ?? <span className="text-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-4 py-2 font-mono text-xs">{c.id}</td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{c.kind}</td>
                                    <td className="px-4 py-2 font-mono text-xs">[{c.nodes.join(', ')}]</td>
                                    <td className="px-4 py-2 font-mono text-xs">{c.value?.raw ?? ''}</td>
                                    <td className="px-4 py-2 font-mono text-xs">{c.model ?? ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

function WarningsPanel(props: {
    parseWarnings: readonly Warning[];
    validationIssues: readonly ValidationIssue[];
    netlistWarnings: readonly string[];
}): React.ReactElement {
    const { parseWarnings, validationIssues, netlistWarnings } = props;
    const empty =
        parseWarnings.length === 0 && validationIssues.length === 0 && netlistWarnings.length === 0;
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Diagnostics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {empty && <p className="text-sm text-muted-foreground">No warnings or validation issues.</p>}
                {parseWarnings.length > 0 && (
                    <Section title="Parser warnings" count={parseWarnings.length}>
                        {parseWarnings.map((w, i) => (
                            <DiagnosticRow key={`p-${i}`} code={w.code} message={w.message} severity="warning" />
                        ))}
                    </Section>
                )}
                {validationIssues.length > 0 && (
                    <Section title="Validation issues" count={validationIssues.length}>
                        {validationIssues.map((issue, i) => (
                            <DiagnosticRow
                                key={`v-${i}`}
                                code={issue.code}
                                message={issue.message}
                                severity={issue.severity}
                            />
                        ))}
                    </Section>
                )}
                {netlistWarnings.length > 0 && (
                    <Section title="Netlist warnings" count={netlistWarnings.length}>
                        {netlistWarnings.map((message, i) => (
                            <DiagnosticRow key={`n-${i}`} code="netlist" message={message} severity="warning" />
                        ))}
                    </Section>
                )}
            </CardContent>
        </Card>
    );
}

function Section(props: { title: string; count: number; children: React.ReactNode }): React.ReactElement {
    return (
        <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-medium">
                {props.title}
                <Badge variant="secondary">{props.count}</Badge>
            </h3>
            <div className="space-y-2">{props.children}</div>
        </div>
    );
}

function DiagnosticRow(props: { code: string; message: string; severity: 'error' | 'warning' }): React.ReactElement {
    return (
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
            <Badge variant={props.severity === 'error' ? 'destructive' : 'outline'}>{props.code}</Badge>
            <p className="text-sm text-foreground">{props.message}</p>
        </div>
    );
}
