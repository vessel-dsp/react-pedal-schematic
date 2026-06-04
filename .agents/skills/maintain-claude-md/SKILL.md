---
name: maintain-claude-md
description: Verify and update CLAUDE.md when it drifts from the actual codebase. Use when starting a new session, when CLAUDE.md claims contradict what you observe, or after significant architectural changes. This skill ensures the AI context document stays accurate so future sessions don't inherit wrong information.
---

# CLAUDE.md Maintenance

CLAUDE.md is the project context document that guides all AI coding sessions for the ggi-core project. When it drifts from reality, every subsequent agent session inherits misinformation — leading to failed commands, dead file links, and wasted time.

**This skill defines how to detect drift and correct it for ggi-core.**

---

## When to Run This Check

Trigger this skill when:

1. **Starting a fresh session** — verify key claims before trusting CLAUDE.md
2. **A command from CLAUDE.md fails** (e.g., `yarn dev:frontend` → "Script not found")
3. **A file path from CLAUDE.md doesn't exist** (e.g., `backend/src/routes/...`)
4. **After a significant architectural change** (new service, framework update, database change)
5. **User reports incorrect project structure** in their prompt

---

## Verification Checklist

Verify each of these categories against the actual filesystem. Run commands to confirm — don't trust CLAUDE.md alone.

### 1. Architecture & Structure

| Check | Command |
|-------|---------|
| Monorepo structure? | `ls backend/ frontend/` |
| Backend framework? | `grep -r "express\|fastify\|hono" backend/package.json` |
| Database? | `grep -r "mariadb\|mysql\|prisma\|kysely" backend/package.json` |
| Deployment target? | `cat Dockerfile compose.yaml cloudbuild.yaml` |
| Frontend framework? | `grep -r "react\|vite\|daisyui" frontend/package.json` |

### 2. Key Commands

| Check | Command |
|-------|---------|
| Dev server commands | `grep '"dev' package.json backend/package.json frontend/package.json` |
| Test commands | `grep '"test' package.json backend/package.json` |
| Build commands | `grep '"build' package.json backend/package.json frontend/package.json` |
| Lint/format commands | `grep '"lint\|"format' package.json` |
| All scripts | `grep -A 30 '"scripts"' package.json backend/package.json frontend/package.json` |

**Red flag**: If CLAUDE.md references a script that doesn't appear in any package.json, it's wrong.

### 3. File Paths

Every file link in CLAUDE.md must exist:

```bash
# Check all paths referenced in CLAUDE.md
grep -oE '\[.*\]\(\[^(]++\)' CLAUDE.md | grep -oE '\([^)]+\)' | tr -d '()' | while read path; do
  if [ -f "$path" ] || [ -d "$path" ]; then
    echo "✅ $path"
  else
    echo "❌ $path"
  fi
done
```

Also check key files individually:

| Claim | Verify |
|-------|--------|
| Backend routes exist | `ls backend/src/index.ts` |
| Auth middleware exists | `ls backend/src/middleware/auth.ts` |
| Database schema exists | `ls backend/prisma/schema.prisma` |
| Services exist | `ls backend/src/services/` |
| Frontend components exist | `ls frontend/src/components/` |
| API client exists | `ls frontend/src/api/client.ts` |

### 4. Testing Setup

| Check | Command |
|-------|---------|
| Test framework | `grep 'jest\|vitest' backend/package.json` |
| Test config | `ls backend/jest.config.cjs` |
| Test files exist | `find backend/tests -name "*.test.ts"` |
| Fixtures exist | `ls backend/tests/__fixtures__/` |

### 5. Dependencies

| Check | Command |
|-------|---------|
| Package manager | Check for `yarn.lock`, `package-lock.json` |
| Key backend deps | `grep -E "express|prisma|@prisma|kysely" backend/package.json` |
| Key frontend deps | `grep -E "react|vite|daisyui|tailwindcss" frontend/package.json` |
| Firebase | `grep "firebase" backend/package.json frontend/package.json` |

### 6. Feature Status

| Check | Command |
|-------|--------|
| Insurnet service | `ls backend/src/services/insurnet-service.ts` |
| Alipay service | `ls backend/src/services/alipay-service.ts` |
| WhatsApp service | `ls backend/src/services/wati-service.ts` |
| Database migrations | `ls backend/prisma/migrations/` |

---

## Drift Patterns to Watch For

### Pattern 1: Wrong Package Manager

**Symptom**: CLAUDE.md says "npm" but project uses Yarn

**Fix**:
- Update all commands from `npm run` → `yarn`
- Update dependency installation from `npm i` → `yarn add`

### Pattern 2: Outdated File Paths

**Symptom**: CLAUDE.md references old paths like `src/routes/` instead of `backend/src/`

**Fix**:
- Update all paths to include workspace prefixes: `backend/src/...`, `frontend/src/...`
- Check monorepo structure hasn't changed

### Pattern 3: Missing Services

**Symptom**: CLAUDE.md doesn't mention a service that exists in code

**Fix**:
- Add missing service documentation
- Update API routes section

### Pattern 4: Wrong Database Info

**Symptom**: CLAUDE.md says "direct MySQL" but actually uses Kysely + Prisma

**Fix**:
- Update database section to reflect Kysely for queries, Prisma for migrations
- Update schema location

### Pattern 5: Deployment Changes

**Symptom**: CLAUDE.md describes old deployment process

**Fix**:
- Update deployment section with current GCP Cloud Run setup
- Update environment variables

---

## Updating CLAUDE.md

### Principles

1. **Verify before writing** — every fact must be confirmed with filesystem commands
2. **Update the source file** — `CLAUDE.md`
3. **Preserve correct sections** — don't overwrite accurate content
4. **Keep it actionable** — commands, paths, and patterns must work when copy-pasted
5. **Mark uncertainty** — if you can't verify something, note it rather than guess

### Process

1. **Read CLAUDE.md** in full
2. **Run verification commands** for each section
3. **Build discrepancy list** — what's wrong, what's missing, what's correct
4. **Show discrepancies to user** — "I found X issues in CLAUDE.md. Here's what needs fixing:"
5. **Get approval** for changes if user is present
6. **Apply changes** via edit (targeted replacements) or write (full rewrite if >50% is wrong)
7. **Verify again** — re-run checks on the updated file

### Discrepancy Report Format

Present findings to the user like this:

```
## CLAUDE.md Drift Report

### Architecture
- ❌ Claims "Single repo" → Reality: Yarn monorepo with backend/ + frontend/
- ❌ Claims "Hono backend" → Reality: Express backend
- ❌ Claims "D1 database" → Reality: MariaDB with Kysely + Prisma

### Commands (X broken)
- ❌ `npm run dev` → doesn't exist, use `yarn dev`
- ❌ `npm test` → doesn't exist, use `yarn test`

### File Paths (X dead links)
- ❌ src/routes/*.ts → backend/src/index.ts
- ❌ worker/auth.ts → backend/src/middleware/auth.ts
- ...

### Missing Sections
- ⚠️ No detailed API routes documentation
- ⚠️ No deployment scripts explanation
- ⚠️ No testing fixtures documentation

Want me to fix CLAUDE.md now?
```

---

## After Fixing

### Commit Convention

```bash
git add CLAUDE.md
git commit -m "docs: align CLAUDE.md with actual ggi-core architecture"
```

### Summary of Changes

Include in commit or PR description:

```markdown
## CLAUDE.md Updates

### Architecture
- Updated monorepo structure description
- Corrected backend framework (Express, not Hono)
- Updated database info (MariaDB + Kysely/Prisma, not D1)

### Commands Fixed
- `npm run` → `yarn`
- Added missing workspace commands

### File Paths Fixed
- All paths updated to include workspace prefixes
- Corrected service file locations

### New Sections Added
- Detailed API routes
- Deployment process (GCP Cloud Run)
- Testing setup with fixtures

### Removed
- References to non-existent frameworks/services
- Outdated deployment info
```

---

## Prevention

### When Making Changes

After any significant change to the project:

1. **Feature added** → Update "Key Feature Status" table
2. **Route added** → Verify it appears in backend/src/index.ts and document
3. **Command changed** → Update "Key Commands" section
4. **Dependency added/removed** → Update "Dependencies" section
5. **Architecture changed** → Full verification (this skill)

### Periodic Check

Run this verification at the start of every significant session. It takes ~2 minutes and prevents hours of wasted time from following bad instructions.

---

## Quick Reference: Current Project Reality

As of this skill's update, the ggi-core project is:

| Aspect | Reality |
|--------|---------|
| Structure | Yarn monorepo with backend/ + frontend/ |
| Backend | Express 5.x, MariaDB via Kysely (queries) + Prisma (migrations) |
| Frontend | React 19 + Vite, daisyUI 5 + Tailwind CSS 4 |
| Auth | Firebase Admin SDK server-side, Firebase client SDK frontend |
| Services | Insurnet web scraping, Alipay payments, WhatsApp notifications |
| Testing | Jest + ts-jest + Supertest for backend |
| Package manager | Yarn |
| Deployment | Google Cloud Run (staging/prod) |
| Dev command | `yarn dev` (concurrent backend + frontend) |
| Test command | `cd backend && yarn test` |
| Lint/Format | Biome, `yarn lint:fix` / `yarn format` |
| Context file | `CLAUDE.md` |
| Database | MariaDB with Prisma schema, Kysely for queries |
| Key scripts | `yarn dev`, `yarn dev:backend`, `yarn dev:frontend`, `yarn lint:fix` |