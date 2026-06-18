import fs from "node:fs";
import path from "node:path";

const needsQuotingPattern = /[\s#"']/;

export function updateDotenvContent(content: string, apiKeyEnv: string, apiKey: string) {
  const line = `${apiKeyEnv}=${formatDotenvValue(apiKey)}`;
  const normalized = content.length > 0 && !content.endsWith("\n") ? `${content}\n` : content;
  const lines = normalized.length > 0 ? normalized.split("\n") : [];
  let updated = false;

  const nextLines = lines.map((current) => {
    if (current.startsWith(`${apiKeyEnv}=`)) {
      updated = true;
      return line;
    }
    return current;
  });

  if (!updated) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] === "") {
      nextLines.splice(nextLines.length - 1, 0, line);
    } else {
      nextLines.push(line);
    }
  }

  const next = nextLines.join("\n");
  return next.endsWith("\n") ? next : `${next}\n`;
}

export function writeApiKeyToDotenv(envPath: string, apiKeyEnv: string, apiKey: string) {
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const next = updateDotenvContent(existing, apiKeyEnv, apiKey);
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(envPath, next, "utf8");
}

function formatDotenvValue(value: string) {
  if (!needsQuotingPattern.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
