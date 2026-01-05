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
