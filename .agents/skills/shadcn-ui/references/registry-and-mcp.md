# Registry And MCP

Sources:
- https://ui.shadcn.com/docs/registry
- https://ui.shadcn.com/docs/mcp
- https://ui.shadcn.com/docs/components-json
- https://ui.shadcn.com/schema/registry.json
- https://ui.shadcn.com/schema/registry-item.json

Use this reference when working with registries, namespaces, private component sources, MCP, or generated registry items.

## Registries

A shadcn registry distributes source files, dependencies, Tailwind config, CSS variables, and other resources through registry JSON schemas.

Registries can be configured in `components.json`:

```json
{
  "registries": {
    "@acme": "https://registry.acme.com/{name}.json"
  }
}
```

Namespaced items are installed or viewed with their namespace, for example `@acme/auth-form`.

Useful commands:

```bash
bunx --bun shadcn@latest search @shadcn -q "button"
bunx --bun shadcn@latest view @acme/auth-form
bunx --bun shadcn@latest add @acme/auth-form
```

Use the repo's package manager equivalent if it is not a Bun project.

## Remote Source Safety

Registry items are code. Before installing from non-official or private registries:

- Check the configured URL and namespace.
- Prefer `view` before `add` when possible.
- Review generated files, dependency additions, scripts, CSS, and environment requirements.
- Do not add private registry credentials to committed files. Use environment variables when the docs or registry config supports headers.

## MCP

The shadcn MCP server lets AI assistants browse, search, and install components from configured registries. It is a bridge between the assistant, registries, and the shadcn CLI.

For Codex, current docs say the CLI cannot automatically update `~/.codex/config.toml`; the user must configure the MCP server manually, then restart Codex.

Example docs pattern:

```toml
[mcp_servers.shadcn]
command = "npx"
args = ["shadcn@latest", "mcp"]
```

Adapt the command only when you know the user's Codex MCP environment supports that package manager.

## Registry Authoring

When creating or editing a registry:

- Use the current `registry.json` and `registry-item.json` schemas.
- Keep item names stable and descriptive.
- Include required dependencies and registry dependencies.
- Include CSS variables and Tailwind config only when the item actually needs them.
- Build and validate the registry output before telling users to consume it.

Verify current schema details from the official schema URLs before implementing a registry generator or publishing flow.
