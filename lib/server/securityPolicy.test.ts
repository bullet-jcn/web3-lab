import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");

function readProjectFile(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

describe("repository security policy", () => {
  it("pins every GitHub Action to an immutable commit", () => {
    const workflowDirectory = resolve(projectRoot, ".github/workflows");
    const workflowFiles = readdirSync(workflowDirectory).filter((file) =>
      /\.ya?ml$/.test(file),
    );

    for (const workflowFile of workflowFiles) {
      const workflow = readFileSync(resolve(workflowDirectory, workflowFile), "utf8");
      const actionReferences = [...workflow.matchAll(/^\s*- uses:\s+([^\s#]+)/gm)].map(
        ([, reference]) => reference,
      );

      expect(actionReferences, `${workflowFile} must use at least one action`).not.toHaveLength(0);
      for (const reference of actionReferences) {
        expect(reference, `${workflowFile}: ${reference}`).toMatch(
          /^[^/\s]+\/[^@\s]+@[0-9a-f]{40}$/,
        );
      }
    }
  });

  it("never grants fork code the pull_request_target secret boundary", () => {
    const securityWorkflow = readProjectFile(".github/workflows/security.yml");

    expect(securityWorkflow).toContain("pull_request:");
    expect(securityWorkflow).not.toContain("pull_request_target");
  });

  it("keeps install scripts and audit thresholds explicit", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts: Record<string, string>;
      allowScripts: Record<string, boolean>;
    };

    expect(packageJson.scripts["security:audit:prod"]).toBe(
      "npm audit --omit=dev --audit-level=moderate",
    );
    expect(packageJson.scripts["security:audit:all"]).toBe(
      "npm audit --audit-level=high",
    );
    expect(Object.keys(packageJson.allowScripts).sort()).toEqual([
      "@google/genai@2.12.0",
      "@reown/appkit@1.8.19",
      "fsevents@2.3.3",
      "protobufjs@7.6.5",
      "unrs-resolver@1.12.2",
    ]);
    expect(Object.values(packageJson.allowScripts).every(Boolean)).toBe(true);
    expect(readProjectFile(".npmrc")).toBe("strict-allow-scripts=true\n");
  });
});
