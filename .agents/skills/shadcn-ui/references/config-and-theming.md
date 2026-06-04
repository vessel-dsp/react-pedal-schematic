# Config And Theming

Sources:
- https://ui.shadcn.com/docs/components-json
- https://ui.shadcn.com/docs/theming
- https://ui.shadcn.com/docs/tailwind-v4
- https://ui.shadcn.com/docs/dark-mode

Use this reference when editing `components.json`, aliases, global CSS, Tailwind setup, or theme tokens.

## components.json

`components.json` tells the CLI how to install and import generated code. Read it before adding components.

Common fields:

- `style`: selected component style or preset.
- `rsc`: whether the project uses React Server Components.
- `tsx`: whether generated components should use TypeScript JSX.
- `tailwind.config`: Tailwind config path. In Tailwind v4 projects this may be empty.
- `tailwind.css`: global CSS file where Tailwind and theme tokens live.
- `tailwind.baseColor`: base palette used by generated defaults.
- `tailwind.cssVariables`: whether components use semantic CSS variables.
- `tailwind.prefix`: class prefix if configured.
- `aliases.components`, `aliases.ui`, `aliases.lib`, `aliases.hooks`, `aliases.utils`: install and import locations.
- `iconLibrary`: icon source for generated components.
- `registries`: optional namespaced registries.

Never assume `@/components/ui` or `@/lib/utils`; use the configured aliases.

## CSS Variables

The docs recommend CSS variables for theming. With `tailwind.cssVariables: true`, components use semantic utilities such as:

- `bg-background`
- `text-foreground`
- `bg-primary`
- `text-primary-foreground`
- `border-border`
- `ring-ring`

Change the app look by editing token definitions in the configured global CSS instead of rewriting every component class.

Common token pairs include:

- `background` / `foreground`
- `card` / `card-foreground`
- `popover` / `popover-foreground`
- `primary` / `primary-foreground`
- `secondary` / `secondary-foreground`
- `muted` / `muted-foreground`
- `accent` / `accent-foreground`
- `destructive` / `destructive-foreground`
- `border`, `input`, `ring`
- `chart-*`
- `sidebar-*`

shadcn/ui themes commonly use OKLCH values. Keep existing color format unless there is a clear reason to migrate.

## Dark Mode

Dark mode normally overrides the same semantic variables under a `.dark` selector or project-specific dark-mode selector. When adding tokens, add matching dark values if the project already supports dark mode.

Avoid hard-coded light-only Tailwind colors in reusable UI components. Prefer semantic tokens unless the project has intentionally opted out of CSS variables.

## Tailwind v4

Tailwind v4 projects are usually CSS-first and may not have a traditional `tailwind.config.js`. Look in the configured global CSS for imports, theme variables, and custom variants before editing config files.

When adding new tokens in v4, place them with the existing token declarations and use the project's established pattern for `@theme`, `@custom-variant`, and CSS variable mapping.

## Variants And Utilities

Most shadcn/ui projects include a `cn()` helper, typically backed by `clsx` and `tailwind-merge`. Use it for conditional classes.

For reusable component variants, prefer the project's existing variant approach, often `class-variance-authority`, instead of scattering repeated class strings through screens.
