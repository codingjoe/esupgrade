# Creating GitHub Issues for Transformer Suggestions

This directory contains a script to create GitHub issues for all transformer suggestions documented in `BASELINE_TRANSFORMERS.md`.

## Quick Start

Simply run:

```bash
./create-issues.sh
```

This will create 26 GitHub issues (one for each unimplemented transformer) with proper titles, labels, and descriptions.

## Prerequisites

- The GitHub CLI (`gh`) must be installed and authenticated
- You must have permission to create issues in the repository

## What It Does

The script creates:
- **17 issues** for Widely Available transformers (ES2015-2020)
- **9 issues** for Newly Available transformers (ES2020-2023)

Each issue includes:
- Descriptive title (e.g., "Add optional chaining (?.) transformer")
- Appropriate labels (`enhancement`, `transformer`, `widely-available` or `newly-available`)
- Complete description with:
  - Baseline status and year
  - Before/After code examples
  - Priority level
  - MDN references
  - Link to BASELINE_TRANSFORMERS.md

## Manual Alternative

If you prefer to create issues manually or selectively, refer to `ISSUES_TO_CREATE.md` which contains detailed templates for each issue.
