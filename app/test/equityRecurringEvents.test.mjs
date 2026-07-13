import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, "..", "data", "equity-recurring-events.json");

async function eventConfig() {
  return JSON.parse(await readFile(configPath, "utf8"));
}

test("equity recurring events are bilingual liquidity annotations with reviewed sources", async () => {
  const config = await eventConfig();
  assert.equal(config.version, 1);
  assert.equal(config.events.length, 5);
  for (const event of config.events) {
    assert.equal(event.category, "liquidity");
    assert.ok(event.labelZh);
    assert.ok(event.labelEn);
    assert.ok(event.noteZh);
    assert.ok(event.noteEn);
    assert.match(event.sourceUrl, /^https:\/\//);
  }
});

test("crypto supply reviews and CEX anniversaries use the intended calendar anchors", async () => {
  const config = await eventConfig();
  const byId = Object.fromEntries(config.events.map((event) => [event.id, event]));
  assert.deepEqual(byId["crypto.hype.core-contributor-observation"].recurrence, { type: "monthly", day: 7 });
  assert.deepEqual(byId["crypto.eth.monthly-net-issuance-review"].recurrence, { type: "monthly", day: 1 });
  assert.deepEqual(byId["crypto.sol.monthly-issuance-review"].recurrence, { type: "monthly", day: 1 });
  assert.deepEqual(byId["cex.binance.anniversary"].recurrence, { type: "annual", month: 7, day: 14 });
  assert.deepEqual(byId["cex.okx.anniversary"].recurrence, { type: "annual", month: 5, day: 31 });
});
