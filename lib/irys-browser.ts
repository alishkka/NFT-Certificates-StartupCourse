import { sha256, sha384 } from "@noble/hashes/sha2.js";

export function normalizeBytes(value:unknown,label:string):Uint8Array {
  if(value instanceof Uint8Array)return Uint8Array.from(value);
  if(ArrayBuffer.isView(value))return Uint8Array.from(new Uint8Array(value.buffer,value.byteOffset,value.byteLength));
  if(value instanceof ArrayBuffer)return new Uint8Array(value.slice(0));
  if(Array.isArray(value))return Uint8Array.from(value);
  throw new Error(`${label}: кошелёк вернул подпись в неподдерживаемом формате`);
}

export function installBrowserIrysHash(irys:unknown) {
  type CryptoDriver={hash:(data:unknown,algorithm?:string)=>Promise<Uint8Array>;__nftStartHashPatched?:boolean};
  type IrysWithBundles={bundles:{getCryptoDriver:()=>CryptoDriver}};
  const driver=(irys as IrysWithBundles).bundles.getCryptoDriver();
  if(driver.__nftStartHashPatched)return;
  driver.hash=async(data,algorithm="SHA-256")=>{
    const bytes=normalizeBytes(data,"Irys hash");
    const normalized=algorithm.toUpperCase().replace(/-/g,"");
    if(normalized==="SHA256")return sha256(bytes);
    if(normalized==="SHA384")return sha384(bytes);
    throw new Error(`Irys запросил неподдерживаемый алгоритм хеширования: ${algorithm}`);
  };
  driver.__nftStartHashPatched=true;
}

export function installBrowserIrysSigner(irys:unknown) {
  type IrysSigner={sign:(message:Uint8Array)=>Promise<unknown>;__nftStartSignerPatched?:boolean};
  type IrysWithSigner={getSigner:()=>IrysSigner};
  const signer=(irys as IrysWithSigner).getSigner();
  if(signer.__nftStartSignerPatched)return;
  const originalSign=signer.sign.bind(signer);
  signer.sign=async(message)=>{
    const result=await originalSign(message);
    const signature=result&&typeof result==="object"&&"signature" in result
      ? (result as {signature:unknown}).signature
      : result;
    return normalizeBytes(signature,"Irys signature");
  };
  signer.__nftStartSignerPatched=true;
}
