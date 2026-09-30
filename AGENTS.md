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
- `new NodeTest(node).isVarLetOrConstDeclaration()` — `var`, `let`, and `const` declarations. Use this before rewriting or removing a declaration, because `using` and `await using` declarations dispose a resource when the scope exits.

Never apply a transformation based solely on structural shape (e.g., a `.length` property or bracket access) without first verifying the receiver is a known type. An unknown identifier such as `arr` cannot be assumed to be an array and must not be transformed.

Every transformer also declares a pre-filter in `src/prefilters.js`, so files that
cannot contain the pattern skip the syntax tree walk. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Writing Docs

### README.md

We add one new section per transformation:

1. Headline + MDN link
2. One diff-based example.
3. Notable exception, which are not transformed.

We MUST NOT add any comments about "what it does".
The functionality documentation is fully covered by the diff-based example.
