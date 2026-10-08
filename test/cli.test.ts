import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import pkg from "../package.json" with { type: "json" };

describe("cli", () => {
  it("src/cli.ts contains shebang", () => {
    const content = readFileSync(new URL("../src/cli.ts", import.meta.url), "utf-8");
    expect(content.startsWith("#!/usr/bin/env node\n")).toBe(true);
  });

  it("prints version with --version", () => {
    const output = execFileSync(process.execPath, ["src/cli.ts", "--version"], {
      encoding: "utf-8",
    });
    expect(output.trim()).toBe(pkg.version);
  });

  it("prints help with --help", () => {
    const output = execFileSync(process.execPath, ["src/cli.ts", "--help"], {
      encoding: "utf-8",
    });
    expect(output).toContain(`Usage: ${pkg.name}`);
    expect(output).toContain("--port");
  });

  it("dist/cli.mjs contains shebang and runs as executable", () => {
    const distUrl = new URL("../dist/cli.mjs", import.meta.url);
    if (!existsSync(distUrl)) {
      return;
    }
    const content = readFileSync(distUrl, "utf-8");
    expect(content.startsWith("#!/usr/bin/env node\n")).toBe(true);

    const distPath = fileURLToPath(distUrl);
    const output = execFileSync(distPath, ["--version"], {
      encoding: "utf-8",
    });
    expect(output.trim()).toBe(pkg.version);
  });
});
