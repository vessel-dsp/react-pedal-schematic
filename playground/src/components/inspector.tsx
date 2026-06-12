import { useState, type ChangeEvent } from 'react';
import {
    isParsedQuantity,
    propertyStringValue,
} from '@vessel-dsp/react-component';
import type {
    Component,
    DocumentCommand,
    PropertyValue,
} from '@vessel-dsp/react-component';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export type InspectorProps = Readonly<{
    component: Component | null;
    dispatch: (command: DocumentCommand) => void;
    editMode: boolean;
    className?: string | undefined;
}>;

export function Inspector(props: InspectorProps): React.ReactElement {
    const { component, dispatch, editMode, className } = props;

    if (component === null) {
        return (
            <Card className={cn('h-full', className)}>
                <CardHeader>
                    <CardTitle className="text-base">Inspector</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    Select a component to edit its properties.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn('h-full', className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{component.id}</CardTitle>
                    <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        {component.kind}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <NameField component={component} dispatch={dispatch} disabled={!editMode} />
                <MetaRow component={component} />
                <Separator />
                <PropertyEditor component={component} dispatch={dispatch} disabled={!editMode} />
                <Separator />
                <div className="flex justify-end">
                    <Button
                        variant="destructive"
                        size="sm"
                        disabled={!editMode}
                        onClick={() => dispatch({ type: 'delete-component', componentId: component.id })}
                    >
                        Delete component
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function NameField(props: { component: Component; dispatch: InspectorProps['dispatch']; disabled: boolean }): React.ReactElement {
    const { component, dispatch, disabled } = props;
    const [draft, setDraft] = useState<string>(component.name);
    const dirty = draft !== component.name;

    function commit(): void {
        if (!dirty) {
            return;
        }
        dispatch({ type: 'rename-component', componentId: component.id, newName: draft });
    }

    return (
        <div className="space-y-1.5">
            <Label htmlFor="cpe-name" className="text-xs uppercase tracking-wide text-muted-foreground">
                Name
            </Label>
            <Input
                id="cpe-name"
                value={draft}
                disabled={disabled}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.currentTarget.blur();
                    } else if (e.key === 'Escape') {
                        setDraft(component.name);
                        e.currentTarget.blur();
                    }
                }}
            />
        </div>
    );
}

function MetaRow({ component }: { component: Component }): React.ReactElement {
    return (
        <div className="grid grid-cols-2 gap-2 text-xs">
            <Meta label="Origin" value={`(${component.origin.x}, ${component.origin.y})`} />
            <Meta label="Rotation" value={`${component.rotation * 90}°${component.flipped ? ' flipped' : ''}`} />
            <Meta label="Terminals" value={String(component.terminals.length)} />
            <Meta label="Source" value={component.sourceTypeName === null ? '—' : shortType(component.sourceTypeName)} />
        </div>
    );
}

function Meta({ label, value }: { label: string; value: string }): React.ReactElement {
    return (
        <div className="space-y-0.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="font-mono text-xs text-foreground">{value}</div>
        </div>
    );
}

function shortType(fullType: string): string {
    const match = fullType.match(/Circuit\.(?:Components\.)?([A-Za-z0-9_]+)/);
    return match?.[1] ?? fullType;
}

function PropertyEditor(props: {
    component: Component;
    dispatch: InspectorProps['dispatch'];
    disabled: boolean;
}): React.ReactElement {
    const { component, dispatch, disabled } = props;
    const entries = Object.entries(component.properties);
    return (
        <div className="space-y-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Properties</div>
            {entries.length === 0 && (
                <p className="text-xs text-muted-foreground">No properties.</p>
            )}
            {entries.map(([key, value]) => (
                <PropertyField
                    key={key}
                    componentId={component.id}
                    propertyName={key}
                    value={value}
                    dispatch={dispatch}
                    disabled={disabled}
                />
            ))}
        </div>
    );
}

function PropertyField(props: {
    componentId: string;
    propertyName: string;
    value: PropertyValue;
    dispatch: InspectorProps['dispatch'];
    disabled: boolean;
}): React.ReactElement {
    const { componentId, propertyName, value, dispatch, disabled } = props;
    const display = propertyStringValue(value) ?? JSON.stringify(value);
    const [draft, setDraft] = useState<string>(display);

    if (draft !== display && document.activeElement?.getAttribute('data-prop') !== propertyName) {
        setDraft(display);
    }

    function commit(): void {
        if (draft === display) {
            return;
        }
        dispatch({ type: 'set-property', componentId, propertyName, value: draft });
    }

    const subtitle = isParsedQuantity(value) ? `${value.value}${value.unit ? ' ' + value.unit : ''}` : 'text';

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <Label
                    htmlFor={`cpe-prop-${propertyName}`}
                    className="text-xs font-medium text-foreground"
                >
                    {propertyName}
                </Label>
                <span className="font-mono text-[10px] text-muted-foreground">{subtitle}</span>
            </div>
            <div className="flex gap-2">
                <Input
                    id={`cpe-prop-${propertyName}`}
                    data-prop={propertyName}
                    value={draft}
                    disabled={disabled}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.currentTarget.blur();
                        } else if (e.key === 'Escape') {
                            setDraft(display);
                            e.currentTarget.blur();
                        }
                    }}
                    className="font-mono text-xs"
                />
                <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => dispatch({ type: 'remove-property', componentId, propertyName })}
                    title="Remove property"
                >
                    ×
                </Button>
            </div>
        </div>
    );
}
