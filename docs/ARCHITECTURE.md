# Architecture

## Public demo

The default Vite build defines `process.env.NEXT_PUBLIC_DEMO_MODE` as `"true"`. It displays the fixed, previously issued asset in `lib/demo-data.ts` and ignores administrator browser history. Form changes affect only React state. Verification reads Metaplex Core through Solana Devnet RPC.

Wallet connection, airdrop, collection creation, mint submission and local revocation handlers return immediately or throw in demo mode. Their controls are absent or disabled. No issuer key is bundled, stored or held on a server. These guards prevent the demo's normal write flows; control of an on-chain asset still comes from Solana keys and program rules, not hiding a button.

## Administrator development flow

`NFTSTART_DEMO_MODE=admin` selects a separate build. The wallet signs requests. The app draws a PNG from the supplied template, uploads image and JSON with Irys, ensures a Core collection, checks update authority, and creates a Core asset for the recipient with a freeze plugin. Successful records go into the current browser's localStorage.

There is no application backend for issuer authorization or history, and no custom on-chain program. The starter database helpers are not a certificate database.

## Trust boundaries

- Ownership and membership come from chain reads. Trust in the issuer requires an independently established collection identity.
- Names and course details may be public. Obtain consent before upload.
- The current local revocation toggle has no effect on the blockchain.
- The known demo NFT exists in Devnet but its original metadata URI is empty.

## Validation scope

Regression tests exercise byte-container normalization, hashing and signature-object adaptation. The signing fixture is not live wallet signature validation. Browser QA checks read-only controls and live lookup. A successful build does not establish end-to-end issuance reliability.
