# esupgrade Write Mode

Use this skill to upgrade JavaScript syntax in place.

## When to use

- A task asks to modernize JavaScript syntax.
- A task asks to apply supported Baseline upgrades to source files.
- A task asks for codemod-style updates without manual rewrites.

## Steps

1. Run esupgrade in write mode on the target files.

   ```console
   npx esupgrade --write <files-or-directories>
   ```

1. Review the diff and keep intended changes.

1. Run tests and project hooks before committing.

## Notes

- Use narrower file paths first to reduce unrelated edits.
- Use `npx esupgrade --help` to inspect available options such as `--baseline` and `--check`.
