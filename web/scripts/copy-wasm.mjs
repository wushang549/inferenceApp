import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "node_modules", "onnxruntime-web", "dist");
const publicDir = path.join(rootDir, "public");

async function main() {
  await fs.mkdir(publicDir, { recursive: true });

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const wasmFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".wasm"))
    .map((entry) => entry.name);

  if (!wasmFiles.length) {
    throw new Error("No .wasm files were found in onnxruntime-web/dist.");
  }

  for (const fileName of wasmFiles) {
    const sourcePath = path.join(sourceDir, fileName);
    const targetPath = path.join(publicDir, fileName);
    await fs.copyFile(sourcePath, targetPath);
  }

  console.log(`Copied ${wasmFiles.length} wasm files into public/.`);
}

main().catch((error) => {
  console.error("copy-wasm failed:", error.message);
  process.exitCode = 1;
});
