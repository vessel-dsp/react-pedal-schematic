---
name: shadcn-ui
description: Build and modify React/Tailwind interfaces with shadcn/ui. Use when installing or configuring shadcn/ui, running the shadcn CLI, editing components.json, theming with CSS variables or Tailwind v4, adding or customizing copied shadcn/ui components, composing accessible Radix/Base UI patterns, building forms/dialogs/tables/charts, or working with shadcn registries and MCP-backed component sources.
---

# shadcn/ui

Use this skill for source-owned shadcn/ui work in React and Tailwind projects. shadcn/ui distributes component source into the project; after installation, treat those components as local code and preserve project customizations.

## Workflow

1. Detect project context before adding code.
   - Inspect `package.json`, lockfiles, `components.json`, global CSS, Tailwind config or Tailwind v4 CSS entry, aliases, and the existing `components/ui` location.
   - If the CLI can run, prefer `shadcn info --json` through the repo's package manager. For Bun projects use `bunx --bun shadcn@latest info --json`.
2. Add or update components.
   - Prefer the shadcn CLI for official components, blocks, and registry items when install changes are acceptable.
   - For Bun projects use commands like `bunx --bun shadcn@latest add button card dialog`; adapt the package manager to the repo.
   - Do not overwrite customized local UI components without reading the generated diff or existing file.
3. Compose the UI using local conventions.
   - Import from configured aliases rather than assumed paths.
   - Keep Radix/Base accessibility behavior, slots, refs, and keyboard interactions intact.
   - Use the local `cn()` helper and existing variant patterns instead of one-off class branching when available.
4. Verify the result.
   - Run the repo's relevant typecheck, lint, format, build, or targeted UI tests.
   - For visual work, check responsive layout, focus states, keyboard interaction, and dark mode when present.

## References

- Read `references/quick-start.md` for CLI install/add/search/docs/info workflows.
- Read `references/config-and-theming.md` for `components.json`, aliases, CSS variables, Tailwind v4, dark mode, and token changes.
- Read `references/components-and-patterns.md` for component composition, form, overlay, table, chart, and app UI patterns.
- Read `references/registry-and-mcp.md` for registry items, namespaces, MCP setup, and remote component safety.

For substantial install or configuration changes, verify current upstream docs first from `https://ui.shadcn.com/llms.txt`.
