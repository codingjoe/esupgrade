# esupgrade

The package includes transformers for upgrading JavaScript syntax.

## Categories

- [Widely Available](./src/widelyAvailable/): Transformers for features available in all major browsers for at least 30 months.
- [Newly Available](./src/newlyAvailable/): Transformers for features available in all major browsers for 0-30 months.

For a full list of transformations, see [README.md](./README.md).

## Package Structure

- [bin/](./bin/): Command-line interface script.
- [src/](./src/): Source code and transformers.
- [tests/](./tests/): Test suite.

For contributing guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Instructions

Use EOF syntax to run node scripts directly from the command line. For example:

```bash
node --input-type=module <<'EOF'
import { transform } from './src/index.js';

const sample = "const v = $(input).val();";
const res = transform(sample);
console.log('modified:', res.modified);
console.log('code:\n' + res.code);
EOF
```

## Writing Transformers

Transformers must only apply to types that are statically verifiable. Use `NodeTest` from
`src/types.js` to guard transformations:

- `new NodeTest(node).isIterable()` — array literals, `new Array()`, `Array.from()`, and `Array.of()`. Use this when the transformation is array-specific (e.g., index access, `.at()`).
- `new NodeTest(node).hasIndexOfAndIncludes()` — arrays and strings (includes string literals and array method chains like `.map()`, `.filter()`). Use this when the transformation applies to both arrays and strings.

Never apply a transformation based solely on structural shape (e.g., a `.length` property or bracket access) without first verifying the receiver is a known type. An unknown identifier such as `arr` cannot be assumed to be an array and must not be transformed.

