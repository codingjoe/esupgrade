import { describe, test, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { execSync, spawnSync } from "node:child_process"
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

  test("should display help when no files specified", () => {
    const result = spawnSync(process.execPath, [CLI_PATH], {
      encoding: "utf8",
    })

    assert.match(result.stderr, /Error: No files specified/)
    // Commander shows help and exits with 0
    assert.strictEqual(result.status, 0)
  })

  test("should transform a single file with --write", () => {
    const testFile = path.join(tempDir, "test.js")
    const originalCode = `var x = 1;`
    fs.writeFileSync(testFile, originalCode)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--write"], {
      encoding: "utf8",
    })

    const transformedCode = fs.readFileSync(testFile, "utf8")
    assert.match(transformedCode, /const x = 1/)
    assert.match(result.stdout, /✓ 1 file\(s\) upgraded/)
    assert.strictEqual(result.status, 0)
  })

  test("should transform files with widely-available baseline by default", () => {
    const testFile = path.join(tempDir, "test.js")
    const originalCode = `var x = 1;\nconst p = new Promise((resolve) => resolve(getData()));`
    fs.writeFileSync(testFile, originalCode)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--write"], {
      encoding: "utf8",
    })

    const transformedCode = fs.readFileSync(testFile, "utf8")
    assert.match(transformedCode, /const x = 1/)
    assert.doesNotMatch(transformedCode, /Promise\.try/) // Promise.try not in widely-available
    assert.strictEqual(result.status, 0)
  })

  test("should transform files with newly-available baseline", () => {
    const testFile = path.join(tempDir, "test.js")
    const originalCode = `var x = 1;\nconst p = new Promise((resolve) => resolve(getData()));`
    fs.writeFileSync(testFile, originalCode)

    const result = spawnSync(
      process.execPath,
      [CLI_PATH, testFile, "--baseline", "newly-available", "--write"],
      {
        encoding: "utf8",
      },
    )

    const transformedCode = fs.readFileSync(testFile, "utf8")
    assert.match(transformedCode, /const x = 1/)
    assert.match(transformedCode, /Promise\.try/) // Promise.try in newly-available
    assert.strictEqual(result.status, 0)
  })

  test("should check files without writing with --check", () => {
    const testFile = path.join(tempDir, "test.js")
    const originalCode = `var x = 1;`
    fs.writeFileSync(testFile, originalCode)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--check"], {
      encoding: "utf8",
    })

    const fileContent = fs.readFileSync(testFile, "utf8")
    assert.strictEqual(fileContent, originalCode) // File unchanged
    assert.match(result.stdout, /✗/)
    assert.match(result.stdout, /1 file\(s\) need upgrading/)
    assert.strictEqual(result.status, 1) // Exit with code 1 when changes needed
  })

  test("should exit with 0 when --check and no changes needed", () => {
    const testFile = path.join(tempDir, "test.js")
    const originalCode = `const x = 1;`
    fs.writeFileSync(testFile, originalCode)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--check"], {
      encoding: "utf8",
    })

    const fileContent = fs.readFileSync(testFile, "utf8")
    assert.strictEqual(fileContent, originalCode) // File unchanged
    assert.match(result.stdout, /All files are up to date/)
    assert.strictEqual(result.status, 0)
  })

  test("should support both --check and --write together", () => {
    const testFile = path.join(tempDir, "test.js")
    const originalCode = `var x = 1;`
    fs.writeFileSync(testFile, originalCode)

    const result = spawnSync(
      process.execPath,
      [CLI_PATH, testFile, "--check", "--write"],
      {
        encoding: "utf8",
      },
    )

    const transformedCode = fs.readFileSync(testFile, "utf8")
    assert.match(transformedCode, /const x = 1/)
    assert.match(result.stdout, /✗/)
    assert.match(result.stdout, /Changes have been written/)
    assert.strictEqual(result.status, 1) // Still exit 1 with --check
  })

  test("should process directory recursively", () => {
    const subDir = path.join(tempDir, "src")
    fs.mkdirSync(subDir)

    const file1 = path.join(tempDir, "test1.js")
    const file2 = path.join(subDir, "test2.js")
    fs.writeFileSync(file1, `var x = 1;`)
    fs.writeFileSync(file2, `var y = 2;`)

    const result = spawnSync(process.execPath, [CLI_PATH, tempDir, "--write"], {
      encoding: "utf8",
    })

    const transformed1 = fs.readFileSync(file1, "utf8")
    const transformed2 = fs.readFileSync(file2, "utf8")
    assert.match(transformed1, /const x = 1/)
    assert.match(transformed2, /const y = 2/)
    assert.match(result.stdout, /2 file\(s\) upgraded/)
    assert.strictEqual(result.status, 0)
  })

  test("should handle files with no changes needed", () => {
    const nodeModules = path.join(tempDir, "node_modules")
    const gitDir = path.join(tempDir, ".git")
    fs.mkdirSync(nodeModules)
    fs.mkdirSync(gitDir)

    const file1 = path.join(tempDir, "test.js")
    const file2 = path.join(nodeModules, "test.js")
    const file3 = path.join(gitDir, "test.js")
    fs.writeFileSync(file1, `var x = 1;`)
    fs.writeFileSync(file2, `var y = 2;`)
    fs.writeFileSync(file3, `var z = 3;`)

    const result = spawnSync(process.execPath, [CLI_PATH, tempDir, "--write"], {
      encoding: "utf8",
    })

    // Should only process file1 in tempDir, not in node_modules or .git
    assert.strictEqual(result.status, 0)
  })

  test("should process multiple file extensions", () => {
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

    assert.match(result.stdout, /4 file\(s\) upgraded/)
    assert.strictEqual(result.status, 0)
  })

  test("should handle TypeScript file extensions", () => {
    const tsFile = path.join(tempDir, "test.ts")
    const tsxFile = path.join(tempDir, "test.tsx")

    fs.writeFileSync(tsFile, `var a = 1;`)
    fs.writeFileSync(tsxFile, `var b = 2;`)

    const result = spawnSync(process.execPath, [CLI_PATH, tempDir, "--write"], {
      encoding: "utf8",
    })

    assert.strictEqual(result.status, 0)
  })

  test("should error on invalid baseline", () => {
    const testFile = path.join(tempDir, "test.js")
    fs.writeFileSync(testFile, `var x = 1;`)

    const result = spawnSync(
      process.execPath,
      [CLI_PATH, testFile, "--baseline", "invalid"],
      {
        encoding: "utf8",
      },
    )

    assert.match(result.stderr, /error/)
    assert.strictEqual(result.status, 1)
  })

  test("should error on non-existent file", () => {
    const result = spawnSync(
      process.execPath,
      [CLI_PATH, path.join(tempDir, "nonexistent.js")],
      {
        encoding: "utf8",
      },
    )

    assert.match(result.stderr, /Error: Cannot access/)
    assert.strictEqual(result.status, 1)
  })

  test("should show detailed changes with --check", () => {
    const testFile = path.join(tempDir, "test.js")
    const originalCode = `var x = 1;\nvar y = 2;`
    fs.writeFileSync(testFile, originalCode)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--check"], {
      encoding: "utf8",
    })

    assert.match(result.stdout, /var to const/)
    assert.strictEqual(result.status, 1)
  })

  test("should process multiple files specified as arguments", () => {
    const file1 = path.join(tempDir, "test1.js")
    const file2 = path.join(tempDir, "test2.js")
    fs.writeFileSync(file1, `var x = 1;`)
    fs.writeFileSync(file2, `var y = 2;`)

    const result = spawnSync(process.execPath, [CLI_PATH, file1, file2, "--write"], {
      encoding: "utf8",
    })

    const transformed1 = fs.readFileSync(file1, "utf8")
    const transformed2 = fs.readFileSync(file2, "utf8")
    assert.match(transformed1, /const x = 1/)
    assert.match(transformed2, /const y = 2/)
    assert.match(result.stdout, /2 file\(s\) upgraded/)
    assert.strictEqual(result.status, 0)
  })

  test("should handle files with no changes needed", () => {
    const testFile = path.join(tempDir, "test.js")
    const originalCode = `const x = 1;`
    fs.writeFileSync(testFile, originalCode)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--write"], {
      encoding: "utf8",
    })

    const fileContent = fs.readFileSync(testFile, "utf8")
    assert.strictEqual(fileContent, originalCode)
    assert.match(result.stdout, /All files are up to date/)
    assert.strictEqual(result.status, 0)
  })

  test("should show no changes message for individual files", () => {
    const testFile = path.join(tempDir, "test.js")
    const originalCode = `const x = 1;`
    fs.writeFileSync(testFile, originalCode)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--write"], {
      encoding: "utf8",
    })

    assert.match(result.stdout, /All files are up to date/)
    assert.strictEqual(result.status, 0)
  })

  test("should handle empty directory", () => {
    const emptyDir = path.join(tempDir, "empty")
    fs.mkdirSync(emptyDir)

    const result = spawnSync(process.execPath, [CLI_PATH, emptyDir, "--write"], {
      encoding: "utf8",
    })

    assert.match(result.stdout, /No JavaScript files found/)
    assert.strictEqual(result.status, 0)
  })

  test("should group changes by type in --check output", () => {
    const testFile = path.join(tempDir, "test.js")
    const originalCode = `var x = 1;\nvar y = 2;\nvar z = 3;`
    fs.writeFileSync(testFile, originalCode)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--check"], {
      encoding: "utf8",
    })

    assert.match(result.stdout, /var to const/)
    assert.strictEqual(result.status, 1)
  })

  test("should handle syntax errors gracefully", () => {
    const testFile = path.join(tempDir, "test.js")
    const invalidCode = `var x = {{{;`
    fs.writeFileSync(testFile, invalidCode)

    const result = spawnSync(process.execPath, [CLI_PATH, testFile, "--write"], {
      encoding: "utf8",
    })

    assert.match(result.stderr, /✗ Error:/)
    assert.strictEqual(result.status, 0) // CLI continues despite errors
  })

  test("should handle mixed directory and file arguments", () => {
    const subDir = path.join(tempDir, "src")
    fs.mkdirSync(subDir)

    const file1 = path.join(tempDir, "test1.js")
    const file2 = path.join(subDir, "test2.js")
    fs.writeFileSync(file1, `var x = 1;`)
    fs.writeFileSync(file2, `var y = 2;`)

    const result = spawnSync(process.execPath, [CLI_PATH, file1, subDir, "--write"], {
      encoding: "utf8",
    })

    const file1Content = fs.readFileSync(file1, "utf8")
    const file2Content = fs.readFileSync(file2, "utf8")
    assert.match(file1Content, /const x = 1/)
    assert.match(file2Content, /const y = 2/)
    assert.match(result.stdout, /2 file\(s\) upgraded/)
    assert.strictEqual(result.status, 0)
  })
})
