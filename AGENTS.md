# Repository Guidelines

## Project Structure & Module Organization

Feature control definitions live in `feature-controls/`, with one yml file per feature control. Service code lives in `src/`. Tests are colocated as `*.test.js`.

## Build, Test, and Development Commands

- `npm install`: install dependencies and set up Husky.
- `npm run dev`: run the local watcher.
- `npm test`: run Vitest with coverage.
- `npm run lint` / `npm run lint:fix`: check or fix linting.
- `npm run format:check` / `npm run format`: check or apply formatting.

## Coding Style & Naming Conventions

Use ES modules, 2-space indentation, single quotes, and no semicolons as enforced locally. Always run `npm run format` after making changes

## Domain Language

Use `CONTEXT.md` as the source of truth for example grant configuration language. Prefer those terms in configuration, tests, docs, and generated changes.

## Developer Addenda

Developers can add their own `AGENTS.local.md` and should be read as an addendum to this file. Keep that file local to your machine and do not commit it.
