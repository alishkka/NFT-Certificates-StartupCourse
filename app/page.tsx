"use client";

import dynamic from "next/dynamic";

const CertificateApp = dynamic(() => import("./certificate-app"), {
  ssr: false,
  loading: () => (
    <main className="loading-screen">
      <span className="loading-mark" />
      <p>Loading NFT Certificates…</p>
    </main>
  ),
});

export default function Home() {
  return <CertificateApp />;
}
