---
name: esupgrade
description: Safely auto-update JavaScript and TypeScript syntax to new ECMAScript features based on browser support.
---

Use the CLI with `npx` on files or directories:

```console
npx esupgrade [--baseline <baseline-year>] [--check] [--write] <files-or-directories>
```

- Use `--check` to preview changes and fail when updates are needed.
- Use `--write` to apply updates in place.
- Use `--baseline` to target the baseline you need.
