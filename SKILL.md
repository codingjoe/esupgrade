---
name: esupgrade
description: Auto-update JavaScript and TypeScript syntax to new ECMAScript features based on browser support.
license: BSD-2-Clause. Read LICENSE file for details.
metadata:
  author: codingjoe <security@codingjoe.dev>
allowed-tools: Bash(npx -y esupgrade *) Bash(npm i -g npx) READ
compatibility: Requires Node.js 24 or later and npx.
---

Use the CLI with `npx` on files or directories:

```console
npx -y esupgrade [--baseline <newly-available|widely-available>] [--check] [--write] <files-or-directories>
```

- Use `--check` to preview changes and fail when updates are needed.
- Use `--write` to apply updates in place.
- Use `--baseline` to choose `newly-available` or `widely-available` (default).
