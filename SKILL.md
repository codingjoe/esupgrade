---
name: esupgrade
description: Auto-update JavaScript and TypeScript syntax to new ECMAScript features based on browser support.
---

Use the CLI with `npx` on files, directories, or standard input:

```console
npx esupgrade [--baseline <newly-available|widely-available>] [--check] [--write] <files-or-directories|->
```

- Use `--check` to preview changes and fail when updates are needed.
- Use `-` to read from standard input and write the transformed code to standard output.
- Use `--write` to apply updates in place for file inputs.
- Use `--baseline` to choose `newly-available` or `widely-available` (default).
