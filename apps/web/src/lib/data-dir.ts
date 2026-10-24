import fs from "node:fs";
import path from "node:path";

/**
 * Local dev/preview ke liye file-based store — web, admin aur api teeno
 * ek hi `.data/` folder use karte hain, isliye order turant admin me dikhta hai.
 * Production me yeh Prisma/Postgres se replace hota hai (database/README.md).
 */
export function repoRoot(): string {
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    if (fs.existsSync(path.join(dir, "turbo.json")) || fs.existsSync(path.join(dir, ".git"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export function dataDir(): string {
  const dir = process.env.DATA_DIR ?? path.join(repoRoot(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function dataFile(name: string): string {
  return path.join(dataDir(), name);
}
