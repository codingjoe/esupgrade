---
name: esupgrade-write
description: Use `npx esupgrade --write` to apply focused in-place syntax upgrades to existing JavaScript files while keeping diffs intentional.
---

# Skill: esupgrade-write

## Description

Apply `esupgrade` write mode to modernize JavaScript syntax in existing files.
Use this skill when a task asks for codemod-style syntax upgrades with
`npx esupgrade --write`.

## When to use

- Modernize JavaScript syntax in existing files.
- Apply `esupgrade` transforms across selected paths.
- Upgrade syntax while preserving behavior.

## Inputs

- Target paths: `<files-or-directories>`
- Optional flags: `--baseline`, `--check`

## Steps

1. Confirm the repository is in a clean git state.

1. Run:

    ```console
    npx esupgrade --write <files-or-directories>
    ```

1. Inspect the diff with `git diff`.

1. Keep changes that match the task and revert unrelated edits.

1. Run project checks before committing.

## Output format

Return a short summary with:

- Command executed
- Files changed
- Check commands and results
- Reverted files and reason

## Best practices

- Start with narrow path scopes to keep diffs focused.
- Use `npx esupgrade --help` to inspect command options.
