// Pure helpers for the public certificate verifier (no network, easy to test).

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Cheap pre-flight check so obviously wrong input never hits the RPC. */
export function isLikelySolanaAddress(value: string): boolean {
  return BASE58.test(value.trim());
}

export type VerifyFacts = {
  /** Collection the asset claims membership of (undefined when none). */
  collection?: string;
  /** Collection that this deployment treats as official. */
  expectedCollection?: string;
  /** Core PermanentFreezeDelegate state; undefined when the plugin is absent. */
  frozen?: boolean;
  hasMetadata: boolean;
  /** Local-only revocation flag (not an on-chain fact). */
  revokedLocally: boolean;
};

export type CheckState = "pass" | "warn" | "fail";
export type VerifyCheck = { id: string; label: string; detail: string; state: CheckState };

export function buildChecks(facts: VerifyFacts): VerifyCheck[] {
  const checks: VerifyCheck[] = [
    { id: "exists", label: "Asset exists on Solana Devnet", detail: "Read directly from the RPC node.", state: "pass" },
  ];

  if (!facts.collection) {
    checks.push({ id: "collection", label: "Part of an issuer collection", detail: "This asset is not in any collection.", state: "fail" });
  } else if (!facts.expectedCollection) {
    checks.push({ id: "collection", label: "Part of an issuer collection", detail: "Collection found, but no official collection is configured to compare against.", state: "warn" });
  } else if (facts.collection === facts.expectedCollection) {
    checks.push({ id: "collection", label: "Part of the official collection", detail: "Collection matches this deployment.", state: "pass" });
  } else {
    checks.push({ id: "collection", label: "Part of the official collection", detail: "Collection does not match this deployment's official collection.", state: "fail" });
  }

  if (facts.frozen === undefined) {
    checks.push({ id: "soulbound", label: "Non-transferable", detail: "No transfer restriction plugin found; the holder could move this NFT.", state: "warn" });
  } else if (facts.frozen) {
    checks.push({ id: "soulbound", label: "Non-transferable", detail: "Frozen by the issuer; it cannot be transferred.", state: "pass" });
  } else {
    checks.push({ id: "soulbound", label: "Non-transferable", detail: "Freeze delegate present but currently unfrozen.", state: "warn" });
  }

  checks.push(
    facts.hasMetadata
      ? { id: "metadata", label: "Metadata attached", detail: "A metadata URI is set.", state: "pass" }
      : { id: "metadata", label: "Metadata attached", detail: "No metadata URI (legacy asset); wallets may not show an image.", state: "warn" },
  );

  if (facts.revokedLocally) {
    checks.push({ id: "revocation", label: "Not revoked", detail: "Marked revoked in this browser only. On-chain revocation is not implemented yet.", state: "fail" });
  }

  return checks;
}

/** Overall verdict: any fail wins, then any warn. */
export function overallState(checks: VerifyCheck[]): CheckState {
  if (checks.some((c) => c.state === "fail")) return "fail";
  if (checks.some((c) => c.state === "warn")) return "warn";
  return "pass";
}

export function shareUrl(origin: string, pathname: string, asset: string): string {
  return `${origin}${pathname}?certificate=${encodeURIComponent(asset.trim())}`;
}
