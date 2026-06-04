# Quick Start

Sources:
- https://ui.shadcn.com/llms.txt
- https://ui.shadcn.com/docs
- https://ui.shadcn.com/docs/cli
- https://ui.shadcn.com/docs/skills

Use this reference when initializing shadcn/ui, adding components, or finding the right CLI command.

## Mental Model

shadcn/ui is a source distribution system, not a runtime component package. The CLI copies TypeScript component files, dependencies, utilities, and styles into the repo. After that, the generated files are project-owned and may be edited.

The upstream docs describe core principles as open code, composition, distribution, good defaults, and AI-ready source. Preserve those properties when modifying local components.

## Project Detection

Before changing UI files, inspect:

- `components.json`, if present.
- `package.json` and lockfile to pick the package manager.
- Tailwind setup, including CSS-first Tailwind v4 entry files.
- Global CSS file where tokens are defined.
- Path aliases in `tsconfig.json`, Vite/Next config, and `components.json`.
- Existing `components/ui`, `lib/utils`, and local component variants.

If the CLI can run, collect project context first:

```bash
bunx --bun shadcn@latest info --json
```

Use the package manager equivalent in non-Bun projects:

- Bun: `bunx --bun shadcn@latest <command>`
- pnpm: `pnpm dlx shadcn@latest <command>`
- npm: `npx shadcn@latest <command>`
- yarn: `yarn dlx shadcn@latest <command>`

## Common Commands

Initialize shadcn/ui in an existing project:

```bash
bunx --bun shadcn@latest init
```

Add official components:

```bash
bunx --bun shadcn@latest add button card dialog
```

Inspect docs or source before generating complex code:

```bash
bunx --bun shadcn@latest docs button
bunx --bun shadcn@latest view button card dialog
bunx --bun shadcn@latest search @shadcn -q "form"
```

Useful CLI verbs include `init`, `add`, `search`, `view`, `docs`, `diff`, `info`, `build`, `migrate`, and `eject`. Confirm flags in current docs before migrations or broad rewrites.

## Safe Add Workflow

1. Run `info --json` or inspect `components.json`.
2. Run `view` or `docs` for unfamiliar components.
3. Add components with the CLI.
4. Review generated files and dependency changes.
5. Integrate with existing app components and design tokens.
6. Run typecheck/build and check the UI state affected by the change.

If a generated file already exists, read it before replacement. Prefer adapting the existing local component over blindly re-running `add --overwrite`.
