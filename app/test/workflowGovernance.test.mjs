import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workflowPath = resolve(__dirname, "..", "..", ".github", "workflows", "update-market-data.yml");
const deployWorkflowPath = resolve(__dirname, "..", "..", ".github", "workflows", "deploy-pages.yml");

test("versioned market snapshots are isolated from the development branch", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /refs\/remotes\/origin\/data-cache/);
  assert.match(workflow, /git commit-tree/);
  assert.match(workflow, /refs\/heads\/data-cache/);
  assert.doesNotMatch(workflow, /^\s+git commit -m /m);
  assert.doesNotMatch(workflow, /^\s+git push\s*$/m);
});

test("scheduled deployments fall back to the durable data branch", async () => {
  const workflow = await readFile(deployWorkflowPath, "utf8");

  assert.match(workflow, /id:\s*restore-data-baseline/);
  assert.match(workflow, /steps\.restore-data-baseline\.outputs\.cache-hit == ''/);
  assert.match(workflow, /data-cache:refs\/remotes\/origin\/data-cache/);
  assert.match(workflow, /git restore --source=refs\/remotes\/origin\/data-cache -- app\/public\/data/);
  assert.match(workflow, /A fast refresh requires either an Actions cache or origin\/data-cache/);
  assert.doesNotMatch(workflow, /fail-on-cache-miss:/);
});
