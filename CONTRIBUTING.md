# Contributing

Open an issue describing the problem, expected behavior and reproduction steps. Include the browser and Solana network where relevant. Do not include private keys, seed phrases or private student data.

## Development

Use Node.js 22.13+ and npm 11.12.1, then run `npm ci` and `npm run dev`. The default local mode is the read-only demo. See the README for the separate administrator workflow.

For a change, run the relevant checks:

```sh
npm test
npm run lint
npx vite build --config vite.vercel.config.ts
```

Keep public demo minting disabled. Use Solana Devnet for development. Explain the change and verification in the pull request, with screenshots for visible UI changes. Clearly distinguish a simulated workflow from a real on-chain result.

Third-party code and artwork retain their original licenses. This repository currently has no project-wide open-source license grant.
