import assert from "node:assert/strict";
import test from "node:test";
import { buildChecks, isLikelySolanaAddress, overallState, shareUrl } from "../lib/verify.ts";

const COL = "2utt1vHx3KHL2b45Rswt563ZriTM9aYD4QQihHPQR6Yy";

test("isLikelySolanaAddress accepts real addresses and rejects junk", () => {
  assert.equal(isLikelySolanaAddress("FxRV2Y2fbJzfeMcQgGHjd8SwLoXX2xfHAvudrqofxufQ"), true);
  assert.equal(isLikelySolanaAddress("  " + COL + " "), true);
  assert.equal(isLikelySolanaAddress(""), false);
  assert.equal(isLikelySolanaAddress("hello"), false);
  assert.equal(isLikelySolanaAddress("0OIl" + "a".repeat(40)), false); // excluded base58 chars
});

test("a frozen asset in the official collection passes everything", () => {
  const checks = buildChecks({ collection: COL, expectedCollection: COL, frozen: true, hasMetadata: true, revokedLocally: false });
  assert.equal(overallState(checks), "pass");
  assert.equal(checks.find((c) => c.id === "revocation"), undefined);
});

test("collection mismatch or missing collection fails", () => {
  const other = buildChecks({ collection: "x".repeat(44), expectedCollection: COL, frozen: true, hasMetadata: true, revokedLocally: false });
  assert.equal(overallState(other), "fail");
  const none = buildChecks({ expectedCollection: COL, frozen: true, hasMetadata: true, revokedLocally: false });
  assert.equal(none.find((c) => c.id === "collection")?.state, "fail");
});

test("legacy asset (no plugin, no metadata) warns but does not fail", () => {
  const checks = buildChecks({ collection: COL, expectedCollection: COL, hasMetadata: false, revokedLocally: false });
  assert.equal(overallState(checks), "warn");
});

test("local revocation fails the verdict", () => {
  const checks = buildChecks({ collection: COL, expectedCollection: COL, frozen: true, hasMetadata: true, revokedLocally: true });
  assert.equal(overallState(checks), "fail");
});

test("shareUrl builds a deep link", () => {
  assert.equal(shareUrl("https://a.app", "/", " abc "), "https://a.app/?certificate=abc");
});
