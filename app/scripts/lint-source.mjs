import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { transformWithEsbuild } from "vite";

const roots = ["src", "scripts", "test"];
const extensions = new Set([".js", ".jsx", ".mjs"]);
const failures = [];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return extensions.has(path.extname(entry.name)) ? [fullPath] : [];
  }));
  return nested.flat();
}

for (const root of roots) {
  for (const file of await sourceFiles(root)) {
    const source = await readFile(file, "utf8");
    if (/^(<<<<<<<|=======|>>>>>>>)/m.test(source)) failures.push(`${file}: unresolved merge marker`);
    if (/\bdebugger\s*;/.test(source)) failures.push(`${file}: debugger statement`);
    try {
      await transformWithEsbuild(source, file, {
        loader: path.extname(file) === ".jsx" ? "jsx" : "js",
        target: "es2022",
      });
    } catch (error) {
      failures.push(`${file}: ${error.message}`);
    }
  }
}

if (failures.length) {
  failures.forEach((failure) => console.error(failure));
  process.exitCode = 1;
} else {
  console.log("Source lint passed.");
}
