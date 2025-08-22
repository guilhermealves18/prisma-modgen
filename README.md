prisma-modgen
=============

A small CLI generator that scaffolds NestJS + Prisma modules (entities, repositories, DTOs, controllers, use-cases) from a model name in a Prisma schema.

This README explains how to build, test locally (without publishing), and publish the package so you can run it with `pnpm dlx prisma-modgen`.

Quick status
------------
- Package name: `prisma-modgen`
- Exposes CLI: `prisma-modgen` (bin -> `dist/scripts/generate-module.js`)
- Build produces `dist/` with compiled CLI and templates

Prerequisites
-------------
- Node.js (v18+ recommended)
- pnpm (matching project packageManager v10)
- TypeScript (dev dependency)

Local build
-----------
From the project root:

```bash
pnpm install
pnpm build
```

This compiles TypeScript into `dist/` and copies the generator templates into `dist/scripts/templates`.

Test locally without publishing
-----------------------------
Use one of the following methods to test the CLI locally before publishing.

1) Run directly from the project (fastest for development):

```bash
pnpm exec tsx scripts/generate-module.ts -- <ModelName> --dry-run
```

2) Pack and run with `pnpm dlx` (simulates published package):

```bash
pnpm build
npm pack
pnpm dlx ./prisma-modgen-<version>.tgz -- <ModelName> --dry-run
```

3) Install from local path into another project:

```bash
# from another project
pnpm add /absolute/path/to/prisma-modgen
# then run
npx prisma-modgen -- <ModelName> --dry-run
```

Notes about `pnpm dlx` and caching
----------------------------------
Using `pnpm dlx ./file.tgz` is the most reliable way to test the exact tarball you produced. Using a relative `./` path sometimes races with pnpm's dlx cache; using the absolute path or the tarball filename in the repo root avoids ENOENT errors.

Publishing to npm
-----------------
To make `pnpm dlx prisma-modgen` available globally, publish the package to the npm registry:

1. Bump the version in `package.json` (npm will reject re-publishing the same version).
2. Ensure you are authenticated: `npm login` locally or add `NPM_TOKEN` to GitHub Secrets for CI.
3. Build and publish:

```bash
pnpm build
pnpm publish --access public
```

Or, push a properly configured tag to trigger the GitHub Actions workflow (if present) that publishes the package using `NPM_TOKEN`.

CLI usage examples
------------------
Basic dry run (no files written):

```bash
pnpm dlx ./prisma-modgen-1.0.0.tgz -- Account --dry-run
```

Generate files (writes to disk):

```bash
pnpm dlx ./prisma-modgen-1.0.0.tgz -- Account
```

Pass `--force` to overwrite existing files. Prefixing with `--` is supported when calling via `pnpm dlx` to pass arguments to the CLI.

Development notes
-----------------
- Ensure `@prisma/internals` is in `dependencies` (the CLI reads Prisma DMMF at runtime).
- The build copies templates from `scripts/templates` into `dist/scripts/templates` so the published tarball includes them.

Contributing
------------
PRs are welcome. Please keep changes small and add a test or manual verification steps when modifying the generator templates or DMMF parsing.

License
-------
MIT

