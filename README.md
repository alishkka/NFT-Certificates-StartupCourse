# NFT Certificates

An educational certificate prototype on **Solana Devnet** for course organizers, accelerators and graduates.

[Try the demo](https://alishkka.github.io/NFT-Certificates-StartupCourse/) · [Existing NFT](https://explorer.solana.com/address/FxRV2Y2fbJzfeMcQgGHjd8SwLoXX2xfHAvudrqofxufQ?cluster=devnet) · [Source](https://github.com/alishkka/NFT-Certificates-StartupCourse)

![NFT Certificates interface](docs/assets/demo.png)

## What it does

A PDF alone does not establish who issued it. NFT Certificates links a certificate to a Solana asset with an owner and collection that a verifier can inspect independently.

The public deployment is an **interactive, read-only demo**. Visitors can edit sample form fields, see a preview and verify an existing NFT through a live Devnet lookup. Wallet connection, minting, airdrops and revocation are disabled. Form edits are not saved.

**This is a Devnet MVP, not a production credential authority.** An NFT proves a chain record and ownership, not identity, academic achievement or institutional accreditation.

## Try it in one minute

1. Open the demo. No wallet or real SOL is required.
2. Edit the name, date or program and watch the preview.
3. Scroll to **Existing certificates**.
4. Click **Verify** on certificate #1.
5. Inspect its owner and collection, then open Solana Explorer.

Only the confirmed example is listed. Failed mint attempts are not shown as issued certificates.

## Submission materials

- [Three-minute demo, 16:9 MP4](docs/NFT-Certificates-Demo-3min.mp4)
- [Architecture and limitations](docs/ARCHITECTURE.md)
- [Judge testing guide](docs/JUDGE-GUIDE.md)

The video includes actual UI recordings and a live lookup of an existing NFT. Wallet signing and new issuance are labelled process diagrams, not a claimed successful new mint. Its narration-free music is originally synthesized.

## Stack

React 19, TypeScript, Vinext/Vite, Tailwind CSS, Solana Web3.js, Metaplex Core/Umi, Irys, MetaMask Solana Connect, Phantom and GitHub Pages for the public demo. The original server build uses Cloudflare Workers via Sites. Development assistance: OpenAI Codex and ChatGPT.

No custom Solana program is deployed by this prototype.

## Local development

Requirements: Node.js **22.13+**, npm and network access for live verification.

```bash
npm ci
npm run dev
```

Open `http://localhost:5173/`. Clean clones default to read-only demo mode. No API key or private key is needed.

```bash
npm test
npm run lint
npm run build
```

The build targets Cloudflare Workers through Vinext. `npm start` runs the built Worker locally; use its printed URL. The public demo is a separate static build on GitHub Pages: `npx vite build --config vite.pages.config.ts`. Its read-only mode is fixed in the build configuration.

### Separate local administrator session

```bash
NFTSTART_DEMO_MODE=admin npm run dev
```

Restart the dev server when changing modes. This is a build-time setting, not a query parameter or localStorage switch. **Do not deploy an administrator build as the public judging demo.**

Administrator mode contains the issuance implementation: connect a wallet, acquire Devnet SOL, enter a recipient's Solana address, generate PNG, upload image/JSON through Irys, and sign the Core transaction. The collection update authority must match the connected issuer. Confirm requests yourself; never enter a seed phrase into the app.

The latest upload/signing path still needs a fresh end-to-end wallet test. Four regression tests cover browser bytes, hashing and signer adaptation; they do not establish successful live uploading or minting.

## Existing on-chain example

| Field | Value |
| --- | --- |
| Network | Solana Devnet |
| Asset | `FxRV2Y2fbJzfeMcQgGHjd8SwLoXX2xfHAvudrqofxufQ` |
| Collection | `2utt1vHx3KHL2b45Rswt563ZriTM9aYD4QQihHPQR6Yy` |
| Owner | `Gjr5p3HUvj2T3kHoTPNdgafvkEdjwBRL8CLFHkLTCXBV` |
| Explorer name | KBTU Certificate #1 |
| Issued | 26 September 2026 |

Read from Devnet and inspected in Explorer on 2 October 2026. Devnet may reset. This original NFT has no usable metadata URI, so a wallet may not show an image.

## Limitations and trust

- Administrator mode is a development workflow, not an authenticated multi-tenant service.
- The demo pins a known collection. A verified issuer registry and institutional authorization process are not implemented.
- Administrator history and **Отозвать** (Revoke) use localStorage, not on-chain revocation. Public demo mode ignores local history and hides revocation.
- Minting uses the Core `PermanentFreezeDelegate` plugin to restrict transfer. This does not establish identity or permanent irrevocability.
- PNG/JSON availability depends on the storage provider. No archival retention guarantee is claimed for this Devnet setup.
- Third-party wallet NFT rendering, especially in Devnet, is not guaranteed. Use the verifier and Explorer.
- Public names and metadata require informed consent. Avoid real student records in casual tests.
- The supplied KBTU/Startup-Course artwork is prototype material. No institutional partnership or permission for reuse elsewhere is claimed.

## Structure

```text
app/certificate-app.tsx   Form, wallets, issuance and verification
app/globals.css           Brand and responsive preview
lib/demo-data.ts          Confirmed public Devnet example
lib/irys-browser.ts       Browser hash/signature compatibility
lib/browser-crypto.ts     Browser crypto compatibility
public/                  Certificate artwork
tests/                   Regression tests
docs/                    Presentation, demo and judge guide
```

## Next steps

Validate a fresh wallet-to-storage-to-mint run, implement issuer onboarding and on-chain revocation, replace local history with indexed records, and test wallet compatibility before mainnet. Proposed business model: organizer subscriptions with usage-based issuance. Demand and pricing have not yet been validated.
