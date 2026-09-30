# Contributing

To run tests locally, follow these steps:

```console
npm ci
npm test
```

We use pre-commit hooks to lint and format code before committing.

To install the pre-commit hooks, run:

```console
uvx pre-commit install
```

Or instead run the linters once with:

```console
uvx pre-commit run --all-files
```

## Naming conversions

When writing code, please follow the [naming guidelines](https://raw.githubusercontent.com/codingjoe/naming-things/refs/heads/main/README.md).

## Baselines release dates

The `baselineDate` can be found on
https://github.com/web-platform-dx/web-features named `baseline_low_date`.

## Pre-filters

Every transformer needs a pre-filter in `src/prefilters.js` and a sample in
`tests/prefilters.test.js`. A pre-filter lists conditions on the source text,
and each condition must be necessary: when the source text misses a condition,
the transformer cannot change the tree. The test suite transforms every sample
with and without pre-filters and compares the results, so an unsound condition
fails the tests.
