import { afterEach, beforeEach, describe, test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const CLI_PATH = path.join(process.cwd(), "bin", "esupgrade.js")

describe("CLI", () => {
  let tempDir

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "esupgrade-test-"))
  })

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test("display help when no files specified", () => {
    const result = spawnSync(process.execPath, [CLI_PATH], {
      encoding: "utf8",
    })

    assert.match(
      result.stderr,
      /error: missing required argument 'files'/,
      "displays error for no files",
    )
    assert.equal(result.status, 1, "exits with 1 when showing help")
  })

  test("transform a single file with --write", () => {
    const testFile = path.join(tempDir, "test.js")
    fs.writeFileSync(testFile, `var x = 1;`)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--write"], {
      encoding: "utf8",
    })

    assert.match(
      fs.readFileSync(testFile, "utf8"),
      /const x = 1/,
      "transforms var to const",
    )
    assert.match(result.stdout, /✓ 1 file upgraded/, "reports 1 file upgraded")
    assert.equal(result.status, 0, "exits successfully")
  })

  test("transform files with widely-available baseline by default", () => {
    const testFile = path.join(tempDir, "test.js")
    fs.writeFileSync(
      testFile,
      `var x = 1;\nconst p = new Promise((resolve) => resolve(getData()));`,
    )

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--write"], {
      encoding: "utf8",
    })

    const transformedCode = fs.readFileSync(testFile, "utf8")
    assert.match(transformedCode, /const x = 1/, "transforms var to const")
    assert.doesNotMatch(
      transformedCode,
      /Promise\.try/,
      "excludes Promise.try for widely-available baseline",
    )
    assert.equal(result.status, 0, "exits successfully")
  })

  test("transform files with newly-available baseline", () => {
    const testFile = path.join(tempDir, "test.js")
    fs.writeFileSync(
      testFile,
      `var x = 1;\nconst p = new Promise((resolve) => resolve(getData()));`,
    )

    const result = spawnSync(
      process.execPath,
      [CLI_PATH, testFile, "--baseline", "newly-available", "--write"],
      {
        encoding: "utf8",
      },
    )

    const transformedCode = fs.readFileSync(testFile, "utf8")
    assert.match(transformedCode, /const x = 1/, "transforms var to const")
    assert.match(
      transformedCode,
      /Promise\.try/,
      "includes Promise.try for newly-available baseline",
    )
    assert.equal(result.status, 0, "exits successfully")
  })

  test("check files without writing with --check", () => {
    const testFile = path.join(tempDir, "test.js")
    const originalCode = `var x = 1;`
    fs.writeFileSync(testFile, originalCode)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--check"], {
      encoding: "utf8",
    })

    assert.equal(
      fs.readFileSync(testFile, "utf8"),
      originalCode,
      "leaves file unchanged",
    )
    assert.match(result.stdout, /✗/, "indicates changes needed")
    assert.match(
      result.stdout,
      /1 file needs upgrading/,
      "reports 1 file needs upgrading",
    )
    assert.equal(result.status, 1, "exits with 1 when changes needed")
  })

  test("exit with 0 when --check and no changes needed", () => {
    const testFile = path.join(tempDir, "test.js")
    const originalCode = `const x = 1;`
    fs.writeFileSync(testFile, originalCode)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--check"], {
      encoding: "utf8",
    })

    assert.equal(
      fs.readFileSync(testFile, "utf8"),
      originalCode,
      "leaves file unchanged",
    )
    assert.match(
      result.stdout,
      /All files are up to date/,
      "reports all files up to date",
    )
    assert.equal(result.status, 0, "exits with 0")
  })

  test("support both --check and --write together", () => {
    const testFile = path.join(tempDir, "test.js")
    fs.writeFileSync(testFile, `var x = 1;`)

    const result = spawnSync(
      process.execPath,
      [CLI_PATH, testFile, "--check", "--write"],
      {
        encoding: "utf8",
      },
    )

    assert.match(
      fs.readFileSync(testFile, "utf8"),
      /const x = 1/,
      "transforms var to const",
    )
    assert.match(result.stdout, /✗/, "indicates changes needed")
    assert.match(result.stdout, /Changes have been written/, "reports changes written")
    assert.equal(result.status, 1, "exits with 1 with --check")
  })

  test("process directory recursively", () => {
    const subDir = path.join(tempDir, "src")
    fs.mkdirSync(subDir)

    const file1 = path.join(tempDir, "test1.js")
    const file2 = path.join(subDir, "test2.js")
    fs.writeFileSync(file1, `var x = 1;`)
    fs.writeFileSync(file2, `var y = 2;`)

    const result = spawnSync(process.execPath, [CLI_PATH, tempDir, "--write"], {
      encoding: "utf8",
    })

    assert.match(fs.readFileSync(file1, "utf8"), /const x = 1/, "transforms file1")
    assert.match(fs.readFileSync(file2, "utf8"), /const y = 2/, "transforms file2")
    assert.match(result.stdout, /2 files upgraded/, "reports 2 files upgraded")
    assert.equal(result.status, 0, "exits successfully")
  })

  test("skip node_modules and .git directories", () => {
    const nodeModules = path.join(tempDir, "node_modules")
    const gitDir = path.join(tempDir, ".git")
    fs.mkdirSync(nodeModules)
    fs.mkdirSync(gitDir)

    const file1 = path.join(tempDir, "test.js")
    fs.writeFileSync(file1, `var x = 1;`)
    fs.writeFileSync(path.join(nodeModules, "test.js"), `var y = 2;`)
    fs.writeFileSync(path.join(gitDir, "test.js"), `var z = 3;`)

    const result = spawnSync(process.execPath, [CLI_PATH, tempDir, "--write"], {
      encoding: "utf8",
    })

    assert.equal(result.status, 0, "exits successfully skipping ignored dirs")
  })

  test("process multiple file extensions", () => {
    const jsFile = path.join(tempDir, "test.js")
    const mjsFile = path.join(tempDir, "test.mjs")
    const cjsFile = path.join(tempDir, "test.cjs")
    const jsxFile = path.join(tempDir, "test.jsx")

    fs.writeFileSync(jsFile, `var a = 1;`)
    fs.writeFileSync(mjsFile, `var b = 2;`)
    fs.writeFileSync(cjsFile, `var c = 3;`)
    fs.writeFileSync(jsxFile, `var d = 4;`)

    const result = spawnSync(process.execPath, [CLI_PATH, tempDir, "--write"], {
      encoding: "utf8",
    })

    assert.match(result.stdout, /4 files upgraded/, "reports 4 files upgraded")
    assert.equal(result.status, 0, "exits successfully")
  })

  test("handle TypeScript file extensions", () => {
    const tsFile = path.join(tempDir, "test.ts")
    const tsxFile = path.join(tempDir, "test.tsx")

    fs.writeFileSync(tsFile, `var a = 1;`)
    fs.writeFileSync(tsxFile, `var b = 2;`)

    const result = spawnSync(process.execPath, [CLI_PATH, tempDir, "--write"], {
      encoding: "utf8",
    })

    assert.equal(result.status, 0, "exits successfully for TS files")
  })

  test("error on invalid baseline", () => {
    const testFile = path.join(tempDir, "test.js")
    fs.writeFileSync(testFile, `var x = 1;`)

    const result = spawnSync(
      process.execPath,
      [CLI_PATH, testFile, "--baseline", "invalid"],
      {
        encoding: "utf8",
      },
    )

    assert.match(result.stderr, /error/, "displays error for invalid baseline")
    assert.equal(result.status, 1, "exits with 1")
  })

  test("error on non-existent file", () => {
    const result = spawnSync(
      process.execPath,
      [CLI_PATH, path.join(tempDir, "nonexistent.js")],
      {
        encoding: "utf8",
      },
    )

    assert.match(
      result.stderr,
      /Error: Cannot access/,
      "displays error for non-existent file",
    )
    assert.equal(result.status, 1, "exits with 1")
  })

  test("show detailed changes with --check", () => {
    const testFile = path.join(tempDir, "test.js")
    fs.writeFileSync(testFile, `var x = 1;\nvar y = 2;`)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--check"], {
      encoding: "utf8",
    })

    assert.match(result.stdout, /var to const/, "shows var to const changes")
    assert.equal(result.status, 1, "exits with 1")
  })

  test("process multiple files specified as arguments", () => {
    const file1 = path.join(tempDir, "test1.js")
    const file2 = path.join(tempDir, "test2.js")
    fs.writeFileSync(file1, `var x = 1;`)
    fs.writeFileSync(file2, `var y = 2;`)

    const result = spawnSync(process.execPath, [CLI_PATH, file1, file2, "--write"], {
      encoding: "utf8",
    })

    assert.match(fs.readFileSync(file1, "utf8"), /const x = 1/, "transforms file1")
    assert.match(fs.readFileSync(file2, "utf8"), /const y = 2/, "transforms file2")
    assert.match(result.stdout, /2 files upgraded/, "reports 2 files upgraded")
    assert.equal(result.status, 0, "exits successfully")
  })

  test("handle files with no changes needed", () => {
    const testFile = path.join(tempDir, "test.js")
    const originalCode = `const x = 1;`
    fs.writeFileSync(testFile, originalCode)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--write"], {
      encoding: "utf8",
    })

    assert.equal(
      fs.readFileSync(testFile, "utf8"),
      originalCode,
      "leaves file unchanged",
    )
    assert.match(
      result.stdout,
      /All files are up to date/,
      "reports all files up to date",
    )
    assert.equal(result.status, 0, "exits successfully")
  })

  test("show no changes message for individual files", () => {
    const testFile = path.join(tempDir, "test.js")
    const originalCode = `const x = 1;`
    fs.writeFileSync(testFile, originalCode)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--write"], {
      encoding: "utf8",
    })

    assert.match(
      result.stdout,
      /All files are up to date/,
      "reports all files up to date",
    )
    assert.equal(result.status, 0, "exits successfully")
  })

  test("handle empty directory", () => {
    const emptyDir = path.join(tempDir, "empty")
    fs.mkdirSync(emptyDir)

    const result = spawnSync(process.execPath, [CLI_PATH, emptyDir, "--write"], {
      encoding: "utf8",
    })

    assert.match(
      result.stdout,
      /No JavaScript files found/,
      "reports no JS files found",
    )
    assert.equal(result.status, 0, "exits successfully")
  })

  test("group changes by type in --check output", () => {
    const testFile = path.join(tempDir, "test.js")
    fs.writeFileSync(testFile, `var x = 1;\nvar y = 2;\nvar z = 3;`)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--check"], {
      encoding: "utf8",
    })

    assert.match(result.stdout, /var to const/, "shows var to const changes")
    assert.equal(result.status, 1, "exits with 1")
  })

  test("exit with 1 on syntax errors", () => {
    const testFile = path.join(tempDir, "test.js")
    fs.writeFileSync(testFile, `var x = {{{;`)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--write"], {
      encoding: "utf8",
    })

    assert.match(result.stderr, /✗ Error:/, "displays error for syntax issues")
    assert.equal(result.status, 1, "exits with 1 on errors")
  })

  test("exit with 1 on parsing errors with --check", () => {
    const testFile = path.join(tempDir, "test.js")
    fs.writeFileSync(testFile, `const a;\na = 'asdf'`)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--check"], {
      encoding: "utf8",
    })

    assert.match(result.stderr, /✗ Error:/, "displays error for parsing issues")
    assert.equal(result.status, 1, "exits with 1 on errors with --check")
  })

  test("exit with 1 on parsing errors without --check", () => {
    const testFile = path.join(tempDir, "test.js")
    fs.writeFileSync(testFile, `const a;\na = 'asdf'`)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile], {
      encoding: "utf8",
    })

    assert.match(result.stderr, /✗ Error:/, "displays error for parsing issues")
    assert.equal(result.status, 1, "exits with 1 on errors without --check")
  })

  test("exit with 1 on errors even with valid files", () => {
    const validFile = path.join(tempDir, "valid.js")
    const invalidFile = path.join(tempDir, "invalid.js")
    fs.writeFileSync(validFile, `var x = 1;`)
    fs.writeFileSync(invalidFile, `const a;\na = 'asdf'`)

    const result = spawnSync(
      process.execPath,
      [CLI_PATH, validFile, invalidFile, "--check"],
      {
        encoding: "utf8",
      },
    )

    assert.match(result.stderr, /✗ Error:/, "displays error for invalid file")
    assert.match(result.stdout, /valid\.js/, "processes valid file")
    assert.equal(result.status, 1, "exits with 1 when any file has errors")
  })

  test("handle mixed directory and file arguments", () => {
    const subDir = path.join(tempDir, "src")
    fs.mkdirSync(subDir)

    const file1 = path.join(tempDir, "test1.js")
    const file2 = path.join(subDir, "test2.js")
    fs.writeFileSync(file1, `var x = 1;`)
    fs.writeFileSync(file2, `var y = 2;`)

    const result = spawnSync(process.execPath, [CLI_PATH, file1, subDir, "--write"], {
      encoding: "utf8",
    })

    assert.match(fs.readFileSync(file1, "utf8"), /const x = 1/, "transforms file1")
    assert.match(fs.readFileSync(file2, "utf8"), /const y = 2/, "transforms file2")
    assert.match(result.stdout, /2 files upgraded/, "reports 2 files upgraded")
    assert.equal(result.status, 0, "exits successfully")
  })

  test("show individual file markers for mixed results", () => {
    const file1 = path.join(tempDir, "test1.js")
    const file2 = path.join(tempDir, "test2.js")
    fs.writeFileSync(file1, `var x = 1;`)
    fs.writeFileSync(file2, `const y = 2;`) // Already upgraded

    const result = spawnSync(process.execPath, [CLI_PATH, file1, file2, "--write"], {
      encoding: "utf8",
    })

    assert.match(result.stdout, /✓/, "shows check mark for modified file")
    assert.match(result.stdout, /test2\.js/, "shows unmodified file path")
    assert.equal(result.status, 0, "exits successfully")
  })

  test("exit with 1 on file write errors", () => {
    const testFile = path.join(tempDir, "test.js")
    fs.writeFileSync(testFile, `var x = 1;`)
    // Make file read-only to trigger write error
    fs.chmodSync(testFile, 0o444)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--write"], {
      encoding: "utf8",
    })

    assert.match(result.stderr, /✗ Error:/, "displays error for write issues")
    assert.equal(result.status, 1, "exits with 1 on write errors")
  })
})
