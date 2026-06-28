import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, "");
const dist = join(root, "dist");
const files = ["index.html", "styles.css", "app.js", "_headers", "manifest.webmanifest"];
const directories = ["icons"];

await rm(dist, { force: true, recursive: true });
await mkdir(dist, { recursive: true });

for (const file of files) {
  await cp(join(root, file), join(dist, file));
}

for (const directory of directories) {
  await cp(join(root, directory), join(dist, directory), { recursive: true });
}

console.log(`Built static site in ${dist}`);
