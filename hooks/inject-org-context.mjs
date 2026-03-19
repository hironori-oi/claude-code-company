import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(__dirname, "..");

function main() {
  try {
    // Read org context
    const contextPath = join(pluginRoot, "org-context.md");
    const content = readFileSync(contextPath, "utf-8");

    // Prepend plugin root path so skills can reference organization files
    const pluginRootNormalized = pluginRoot.replace(/\\/g, "/");
    const output = `# Organization Plugin\nPlugin Root: ${pluginRootNormalized}\n\n${content}`;

    process.stdout.write(output);
  } catch (err) {
    process.stderr.write(`[company-plugin] Error: ${err.message}\n`);
  }
}

main();
