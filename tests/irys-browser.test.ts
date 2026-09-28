import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "@noble/hashes/sha2.js";
import { HexInjectedSolanaSigner, createData } from "@irys/bundles/web";
import { installBrowserIrysHash, installBrowserIrysSigner, normalizeBytes } from "../lib/irys-browser.ts";

test("normalizeBytes accepts browser byte containers",()=>{
  assert.deepEqual([...normalizeBytes(new Uint8Array([1,2,3]),"test")],[1,2,3]);
  assert.deepEqual([...normalizeBytes(new Uint8Array([4,5]).buffer,"test")],[4,5]);
  assert.deepEqual([...normalizeBytes([6,7],"test")],[6,7]);
});

test("Irys signer unwraps wallet-standard signature objects",async()=>{
  const signer={async sign(){return{signature:new Uint8Array([9,8,7])}}};
  const irys={getSigner:()=>signer};
  installBrowserIrysSigner(irys);
  assert.deepEqual([...await signer.sign()],[9,8,7]);
  installBrowserIrysSigner(irys);
  assert.deepEqual([...await signer.sign()],[9,8,7]);
});

test("a real Irys DataItem signs when MetaMask returns an object",async()=>{
  const provider={
    publicKey:{toBuffer:()=>Buffer.alloc(32,1)},
    async signMessage(){return{signature:new Uint8Array(64).fill(2)}}
  };
  const signer=new HexInjectedSolanaSigner(provider as never);
  installBrowserIrysSigner({getSigner:()=>signer});
  const item=createData("certificate",signer);
  const id=await item.sign(signer);
  assert.equal(id.byteLength,32);
  assert.equal(item.rawSignature.byteLength,64);
  assert.equal(item.id.length>20,true);
});

test("Irys browser hash accepts typed arrays without SubtleCrypto",async()=>{
  const driver={async hash(){return new Uint8Array()}};
  const irys={bundles:{getCryptoDriver:()=>driver}};
  installBrowserIrysHash(irys);
  const input=new Uint8Array([1,2,3]);
  assert.deepEqual([...await driver.hash(input,"SHA-256")],[...sha256(input)]);
});
