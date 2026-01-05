When writing code, you MUST ALWAYS follow the [naming guidelines](https://raw.githubusercontent.com/codingjoe/naming-things/refs/heads/main/README.md).

All code must be fully tested with a 100% coverage. Unreachable code must be removed.
Follow the [CONTRIBUTING.md](./CONTRIBUTING.md) guidelines for testing and linting.
The test suite will fail if the line coverage is below 100%.
The test coverage will be written to stdout or the `lcov.info` file in the project root.

All transformers must be documented in the README.md.

Use class syntax for all object-oriented code.
Use named functions instead of anonymous functions whenever possible.
Use `#` for private methods.

Avoid overly complex functions. Break them into smaller functions if necessary.

Write docstrings with jsdoc type annotations for all functions, classes, and methods.
Docstrings should be written in present tense imperative mood.
They must start with a capital letter and end with a period.
Docstrings must describe the external behavior of the function, class, or method.
Docstrings should avoid redundant phrases like "This function" or "This method".
Class docstrings must not repeat the class name or start with a verb since they don't do anything themselves.
Avoid code comments unless they describe behavior of 3rd party code or complex algorithms.
