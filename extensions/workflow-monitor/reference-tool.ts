import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { accessSync } from "node:fs";

const TOPIC_MAP: Record<string, string> = {
  "tdd-rationalizations": "skills/test-driven-development/reference/rationalizations.md",
  "tdd-examples": "skills/test-driven-development/reference/examples.md",
  "tdd-when-stuck": "skills/test-driven-development/reference/when-stuck.md",
  "tdd-anti-patterns": "skills/test-driven-development/testing-anti-patterns.md",
};

export const REFERENCE_TOPICS = Object.keys(TOPIC_MAP);

function getPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== "/") {
    try {
      accessSync(resolve(dir, "package.json"));
      return dir;
    } catch {
      dir = dirname(dir);
    }
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

export async function loadReference(topic: string): Promise<string> {
  const relativePath = TOPIC_MAP[topic];
  if (!relativePath) {
    return `Unknown topic: "${topic}". Available topics: ${REFERENCE_TOPICS.join(", ")}`;
  }

  const root = getPackageRoot();
  const fullPath = resolve(root, relativePath);

  try {
    return await readFile(fullPath, "utf-8");
  } catch {
    return `Error loading reference "${topic}": file not found at ${fullPath}`;
  }
}
