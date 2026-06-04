# Components And Patterns

Sources:
- https://ui.shadcn.com/llms.txt
- https://ui.shadcn.com/docs/components
- https://ui.shadcn.com/docs/forms
- https://ui.shadcn.com/docs/skills

Use this reference when composing app screens with shadcn/ui components.

## Component Selection

Prefer standard shadcn/ui components for common app controls:

- Commands: `Button`, `ButtonGroup`, `Toggle`, `ToggleGroup`, `DropdownMenu`, `Command`.
- Form inputs: `Field`, `Input`, `Textarea`, `Checkbox`, `RadioGroup`, `Select`, `Switch`, `Slider`, `Label`.
- Navigation/layout: `Sidebar`, `NavigationMenu`, `Tabs`, `Breadcrumb`, `Separator`, `Resizable`, `ScrollArea`.
- Overlays: `Dialog`, `AlertDialog`, `Sheet`, `Drawer`, `Popover`, `Tooltip`, `HoverCard`, `ContextMenu`.
- Feedback: `Alert`, `Sonner`, `Progress`, `Spinner`, `Skeleton`, `Badge`, `Empty`.
- Display: `Card`, `Table`, `DataTable`, `Chart`, `Avatar`, `AspectRatio`, `Typography`, `Item`, `Kbd`.

Run `shadcn docs <component>` or check the official component page before using unfamiliar APIs.

## Composition Rules

- Preserve generated component APIs unless there is a strong local reason to change them.
- Keep forwarded refs, `asChild` support, slots, data attributes, and accessibility props intact.
- Do not replace Radix/Base primitives with plain `div` structures when keyboard or screen-reader behavior matters.
- Import icons from the configured icon library. shadcn defaults commonly use lucide; confirm with `components.json`.
- Follow existing local variants and sizes for visual consistency.

## Forms

Use the project's established form stack. Common shadcn/ui docs cover React Hook Form, TanStack Form, and Formisch.

For modern shadcn/ui patterns:

- Use `Field` and `FieldGroup` for labels, descriptions, errors, and grouped controls when available.
- Use `ToggleGroup` for option sets.
- Use semantic error text and `aria-invalid` patterns already present in local components.
- Keep inputs controlled or uncontrolled consistently with the surrounding code.

## App UI Guidance

Build the actual app/workflow screen, not a marketing landing page, unless requested.

Use cards for repeated items, data panels, or framed tools. Avoid nesting cards inside cards and avoid treating whole page sections as floating cards.

Buttons should contain icons when the action is familiar and an icon exists. Use text or icon+text for commands that need clarity. Add tooltips for icon-only controls that are not obvious.

Use dense, scannable layouts for operational tools: clear navigation, predictable controls, stable dimensions, and responsive behavior.

## Tables And Data

Use `Table` for simple tabular display. Use `DataTable` patterns with TanStack Table when sorting, filtering, pagination, row selection, or column visibility are needed.

For charts, shadcn/ui chart components are based on Recharts. Keep chart colors tied to semantic `chart-*` tokens where the project uses those tokens.

## Verification

After UI edits, verify:

- TypeScript compiles.
- Interactive controls respond to keyboard and pointer input.
- Dialogs, popovers, menus, and sheets trap or restore focus correctly.
- Text fits in buttons, table cells, cards, and sidebars at mobile and desktop widths.
- Dark mode remains legible when present.
