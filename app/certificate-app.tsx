"use client";

import { useEffect, useMemo, useState } from "react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { create, createCollection, fetchAssetV1, fetchCollectionV1, mplCore } from "@metaplex-foundation/mpl-core";
import { createGenericFile, createGenericFileFromJson, generateSigner, publicKey, type GenericFile } from "@metaplex-foundation/umi";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys/web";
import type { IrysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { Connection, PublicKey, Transaction, VersionedTransaction, clusterApiUrl } from "@solana/web3.js";
import { createSolanaClient, type SolanaClient } from "@metamask/connect-solana";
import { Buffer } from "buffer";
import { sha256, sha384 } from "@noble/hashes/sha2.js";
import { BadgeCheck, CheckCircle2, Copy, ExternalLink, FileBadge2, LoaderCircle, Search, ShieldCheck, Wallet } from "lucide-react";

const RPC_URL = clusterApiUrl("devnet");
const METAMASK_DEVNET_SCOPE = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" as const;
const MIN_ADMIN_BALANCE = 0.05;
const COLLECTION_KEY = "nftstart.collection";
const CERTIFICATES_KEY = "nftstart.certificates";

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  connect: () => Promise<{ publicKey: PublicKey }>;
  signTransaction: (transaction: unknown) => Promise<unknown>;
  signAllTransactions: (transactions: unknown[]) => Promise<unknown[]>;
  signMessage?: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
};
type AdminWalletAdapter = {
  publicKey?: PublicKey;
  signTransaction: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  signAllTransactions: (transactions: (Transaction | VersionedTransaction)[]) => Promise<(Transaction | VersionedTransaction)[]>;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
};
type StandardAccount = { address: string };
type StandardSignTransactionFeature = { signTransaction: (...inputs: { account: StandardAccount; transaction: Uint8Array; chain: typeof METAMASK_DEVNET_SCOPE }[]) => Promise<readonly { signedTransaction: Uint8Array }[]> };
type StandardSignMessageFeature = { signMessage: (...inputs: { account: StandardAccount; message: Uint8Array }[]) => Promise<readonly { signature: Uint8Array }[]> };
type CertificateRecord = { asset:string; collection:string; recipient:string; recipientName:string; certificateNumber:string; program:string; issueDate:string; signature:string; metadataUri:string; createdAt:string; revoked:boolean };
declare global { interface Window { phantom?: { solana?: PhantomProvider } } }
type WebMcpContext = { registerTool:(tool:{name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:unknown)=>unknown},options?:{signal?:AbortSignal})=>void|Promise<void> };

const shorten = (value:string,left=5,right=5) => `${value.slice(0,left)}…${value.slice(-right)}`;
const formatDate = (value:string) => {
  const [year,month,day]=value.split("-");
  return year&&month&&day?`${day}.${month}.${year}`:value;
};

function errorMessage(reason:unknown,fallback:string) {
  const message=reason instanceof Error?reason.message:String(reason??"");
  if(/user rejected|request rejected|rejected by user|cancelled|canceled/i.test(message))return "Операция отменена в кошельке";
  if(/failed to fetch|networkerror|network request failed/i.test(message))return "Не удалось связаться с Solana или Irys. Проверьте интернет и попробуйте ещё раз";
  if(/insufficient|not enough|0x1/i.test(message))return "Недостаточно Devnet SOL для оплаты транзакции";
  return message||fallback;
}

function fitCanvasText(context:CanvasRenderingContext2D,text:string,maxWidth:number,startSize:number,fontFamily:string) {
  let size=startSize;
  do { context.font=`${size}px ${fontFamily}`; size-=2 } while(size>30&&context.measureText(text).width>maxWidth);
}

function drawCenteredWrappedText(context:CanvasRenderingContext2D,text:string,x:number,y:number,maxWidth:number,lineHeight:number) {
  const words=text.split(/\s+/); const lines:string[]=[]; let line="";
  for(const word of words){const next=line?`${line} ${word}`:word;if(context.measureText(next).width>maxWidth&&line){lines.push(line);line=word}else line=next}
  if(line)lines.push(line);
  lines.slice(0,2).forEach((value,index)=>context.fillText(value,x,y+index*lineHeight));
}

async function makeCertificatePng(data:{recipientName:string;certificateNumber:string;issueDate:string;program:string}) {
  const template=await new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("Не удалось загрузить PNG-шаблон сертификата"));image.src="/certificate-template.png"});
  const canvas=document.createElement("canvas");canvas.width=2000;canvas.height=1414;
  const context=canvas.getContext("2d");if(!context)throw new Error("Браузер не смог сформировать изображение сертификата");
  context.drawImage(template,0,0,canvas.width,canvas.height);
  context.fillStyle="#fff";
  context.fillRect(205,305,310,135);
  context.fillRect(350,385,1250,150);
  context.fillRect(225,530,1550,125);
  context.fillStyle="#111";context.textAlign="left";context.font="36px Georgia, serif";
  context.fillText(`№${data.certificateNumber.trim()}`,235,360);context.fillText(`от ${formatDate(data.issueDate)}`,235,415);
  context.textAlign="center";context.fillStyle="#050505";fitCanvasText(context,data.recipientName.trim(),1160,92,"Georgia, serif");context.fillText(data.recipientName.trim(),975,490);
  context.fillStyle="#ff5c57";context.font="34px Arial, sans-serif";
  drawCenteredWrappedText(context,`успешно прошёл(ла) программу инкубации «${data.program.trim()}», включающую следующие темы:`,1000,570,1500,46);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Не удалось сохранить карточку сертификата")),"image/png",0.95));
  return new Uint8Array(await blob.arrayBuffer());
}

const validUploadUri = (value:unknown): value is string =>
  typeof value === "string" &&
  /^https:\/\/[^/]+\/.+/.test(value) &&
  !/\/(?:undefined|null)$/.test(value);

function normalizeBytes(value:unknown,label:string):Uint8Array {
  if(value instanceof Uint8Array)return Uint8Array.from(value);
  if(ArrayBuffer.isView(value))return Uint8Array.from(new Uint8Array(value.buffer,value.byteOffset,value.byteLength));
  if(value instanceof ArrayBuffer)return new Uint8Array(value.slice(0));
  if(Array.isArray(value))return Uint8Array.from(value);
  throw new Error(`${label}: кошелёк вернул подпись в неподдерживаемом формате`);
}

function installBrowserIrysHash(irys:unknown) {
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

function installBrowserIrysSigner(irys:unknown) {
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

async function uploadPermanentFile(uploader:IrysUploader,file:GenericFile) {
  const amount=await uploader.getUploadPrice([file]);
  await uploader.fund(amount,false);
  const irys=await uploader.irys();
  installBrowserIrysHash(irys);
  installBrowserIrysSigner(irys);
  const tags=file.contentType?[{name:"Content-Type",value:file.contentType},...file.tags]:file.tags;
  const transaction=irys.createTransaction(Buffer.from(file.buffer),{tags});
  await transaction.sign();
  const transactionId=transaction.id;
  const response=await irys.uploader.uploadTransaction(transaction);
  const responseData=response.data as {id?:string;tx_id?:string;data?:{id?:string}}|undefined;
  const id=responseData?.id||responseData?.tx_id||responseData?.data?.id||transactionId;
  if(response.status>=300)throw new Error(`Постоянное хранилище отклонило загрузку (${response.status})`);
  if(!id||id==="undefined"||id==="null")throw new Error(`Irys принял файл, но не вернул его ID (HTTP ${response.status})`);
  return `https://gateway.irys.xyz/${id}`;
}

const getPhantom = () => typeof window === "undefined" ? undefined : window.phantom?.solana;
function createAdminUmi(provider:AdminWalletAdapter) {
  const adapter = { publicKey:provider.publicKey, signTransaction:provider.signTransaction.bind(provider), signAllTransactions:provider.signAllTransactions.bind(provider), signMessage:provider.signMessage?.bind(provider) };
  return createUmi(RPC_URL).use(mplCore()).use(walletAdapterIdentity(adapter as never)).use(irysUploader({address:"https://devnet.irys.xyz",providerUrl:RPC_URL,timeout:60_000}));
}

export default function Home() {
  const [walletAddress,setWalletAddress]=useState(""); const [walletName,setWalletName]=useState<"Phantom"|"MetaMask"|"">(""); const [walletPicker,setWalletPicker]=useState(false); const [walletAdapter,setWalletAdapter]=useState<AdminWalletAdapter|null>(null); const [balance,setBalance]=useState<number|null>(null); const [collection,setCollection]=useState("");
  const [records,setRecords]=useState<CertificateRecord[]>([]); const [mode,setMode]=useState<"issue"|"verify">("issue"); const [busy,setBusy]=useState(""); const [status,setStatus]=useState(""); const [error,setError]=useState(""); const [verifyAddress,setVerifyAddress]=useState("");
  const [verifiedAsset,setVerifiedAsset]=useState<null|{name:string;owner:string;uri:string;asset:string;collection?:string}>(null);
  const [form,setForm]=useState({recipientName:"",certificateNumber:"",issueDate:new Date().toISOString().slice(0,10),program:"Технологическое предпринимательство и стартапы",recipient:""});
  const connection=useMemo(()=>new Connection(RPC_URL,"confirmed"),[]);

  useEffect(()=>{const timer=window.setTimeout(()=>{setCollection(localStorage.getItem(COLLECTION_KEY)??"");try{const stored:unknown=JSON.parse(localStorage.getItem(CERTIFICATES_KEY)??"[]");setRecords(Array.isArray(stored)?stored:[])}catch{setRecords([])}const certificate=new URLSearchParams(window.location.search).get("certificate");if(certificate){setVerifyAddress(certificate);setMode("verify");void verifyCertificate(certificate)}},0);return()=>window.clearTimeout(timer)},[]);
  useEffect(()=>{const context=(document as Document&{modelContext?:WebMcpContext}).modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();void Promise.resolve(context.registerTool({name:"prepare_certificate_issue",title:"Подготовить выпуск сертификата",description:"Заполняет видимую форму выпуска NFT-сертификата. Транзакция не отправляется: администратор должен проверить данные и подтвердить выпуск в подключённом кошельке.",inputSchema:{type:"object",properties:{recipientName:{type:"string"},certificateNumber:{type:"string"},issueDate:{type:"string"},program:{type:"string"},recipient:{type:"string"}},required:["recipientName","certificateNumber","issueDate","program","recipient"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){const value=input as Record<string,string>;if(!value.recipientName||!value.certificateNumber||!value.issueDate||!value.program||!value.recipient)throw new Error("Все поля обязательны");setForm({recipientName:value.recipientName,certificateNumber:value.certificateNumber,issueDate:value.issueDate,program:value.program,recipient:value.recipient});setMode("issue");return{status:"prepared",requiresAdminConfirmation:true}}},{signal:lifecycle.signal}));return()=>lifecycle.abort()},[]);
  async function refreshBalance(address:string){const lamports=await connection.getBalance(new PublicKey(address));setBalance(lamports/1_000_000_000)}
  async function connectPhantom(){setError("");setWalletPicker(false);const provider=getPhantom();if(!provider?.isPhantom){setError("Phantom не найден. Установите расширение или откройте приложение во встроенном браузере Phantom.");return}try{const result=await provider.connect();if(!provider.signMessage)throw new Error("Phantom не предоставил функцию подписи сообщений Solana");const address=result.publicKey.toBase58();const adapter:AdminWalletAdapter={publicKey:result.publicKey,async signTransaction(transaction){return await provider.signTransaction(transaction) as Transaction|VersionedTransaction},async signAllTransactions(transactions){return await provider.signAllTransactions(transactions) as (Transaction|VersionedTransaction)[]},async signMessage(message){const output=await provider.signMessage!(message);return normalizeBytes(output.signature,"Phantom signature")}};setWalletAdapter(adapter);setWalletName("Phantom");setWalletAddress(address);await refreshBalance(address);setStatus("Phantom подключён к Solana Devnet")}catch(reason){setError(errorMessage(reason,"Не удалось подключить Phantom"))}}
  async function connectMetaMask(){setError("");setWalletPicker(false);setBusy("connect");try{const client:SolanaClient=await createSolanaClient({dapp:{name:"Startup Course NFT Certificates",url:window.location.href},api:{supportedNetworks:{devnet:RPC_URL}},analytics:{enabled:false}});const wallet=client.getWallet() as ReturnType<SolanaClient["getWallet"]>&{accounts:readonly StandardAccount[];updateSession:(session:unknown,selectedAddress:undefined)=>void};const existingSession=await client.core.provider.getSession();if(existingSession&&Object.keys(existingSession.sessionScopes??{}).some(scope=>scope.startsWith("solana:")))await client.disconnect();const devnetSession=await client.core.provider.createSession({optionalScopes:{[METAMASK_DEVNET_SCOPE]:{methods:[],notifications:[]}},sessionProperties:{solana_accountChanged_notifications:true}});wallet.updateSession(devnetSession,undefined);const signFeature=wallet.features["solana:signTransaction"] as StandardSignTransactionFeature|undefined;const messageFeature=wallet.features["solana:signMessage"] as StandardSignMessageFeature|undefined;if(!signFeature)throw new Error("MetaMask не предоставил функцию подписи Solana");if(!messageFeature)throw new Error("MetaMask не предоставил функцию подписи сообщений Solana");const account=wallet.accounts[0];if(!account)throw new Error("В MetaMask не выбран Solana-аккаунт для Devnet");const deserialize=(original:Transaction|VersionedTransaction,bytes:Uint8Array)=>original instanceof VersionedTransaction?VersionedTransaction.deserialize(bytes):Transaction.from(bytes);const adapter:AdminWalletAdapter={publicKey:new PublicKey(account.address),async signTransaction(transaction){const [output]=await signFeature.signTransaction({account,transaction:transaction.serialize({requireAllSignatures:false,verifySignatures:false}),chain:METAMASK_DEVNET_SCOPE});return deserialize(transaction,output.signedTransaction)},async signAllTransactions(transactions){const outputs=await signFeature.signTransaction(...transactions.map(transaction=>({account,transaction:transaction.serialize({requireAllSignatures:false,verifySignatures:false}),chain:METAMASK_DEVNET_SCOPE})));return outputs.map((output,index)=>deserialize(transactions[index],output.signedTransaction))},async signMessage(message){const [output]=await messageFeature.signMessage({account,message});return normalizeBytes(output.signature,"MetaMask signature")}};setWalletAdapter(adapter);setWalletName("MetaMask");setWalletAddress(account.address);await refreshBalance(account.address);setStatus("MetaMask подключён к Solana Devnet")}catch(reason){setError(errorMessage(reason,"Не удалось подключить MetaMask"))}finally{setBusy("")}}
  async function requestAirdrop(){if(!walletAddress)return;setBusy("airdrop");setError("");try{const signature=await connection.requestAirdrop(new PublicKey(walletAddress),1_000_000_000);const blockhash=await connection.getLatestBlockhash();await connection.confirmTransaction({signature,...blockhash},"confirmed");await refreshBalance(walletAddress);setStatus("Получен 1 Devnet SOL")}catch{setError("Devnet faucet отклонил запрос. Пополните кошелёк через faucet.solana.com.")}finally{setBusy("")}}
  async function ensureCollection(){if(collection)return collection;if(!walletAdapter?.publicKey)throw new Error("Сначала подключите кошелёк администратора");setStatus("Создаём официальную коллекцию…");const umi=createAdminUmi(walletAdapter);const signer=generateSigner(umi);const uploader=umi.uploader as IrysUploader;const uri=await uploadPermanentFile(uploader,createGenericFileFromJson({name:"KBTU Startup Incubator Certificates",description:"Official certificate collection on Solana Devnet",image:""}));await createCollection(umi,{collection:signer,name:"KBTU Startup Incubator Certificates",uri}).sendAndConfirm(umi);const address=signer.publicKey.toString();localStorage.setItem(COLLECTION_KEY,address);setCollection(address);return address}

  async function issueCertificate(event:React.FormEvent){event.preventDefault();setError("");setStatus("");try{if(!walletAddress||!walletAdapter?.publicKey)throw new Error("Сначала подключите кошелёк администратора");if(!walletAdapter.signMessage)throw new Error("Подключённый кошелёк не поддерживает подпись сообщений, необходимую для загрузки сертификата");if(balance===null||balance<MIN_ADMIN_BALANCE)throw new Error("Недостаточно Devnet SOL. Сначала нажмите «Получить Devnet SOL» или пополните адрес через faucet.solana.com.");new PublicKey(form.recipient);if(!form.recipientName.trim()||!form.certificateNumber.trim())throw new Error("Заполните ФИО и номер сертификата");if(records.some(item=>item.certificateNumber===form.certificateNumber.trim()))throw new Error("Сертификат с таким номером уже выпускался на этом устройстве");setBusy("issue");const umi=createAdminUmi(walletAdapter);const uploader=umi.uploader as IrysUploader;const collectionAddress=await ensureCollection();const collectionAccount=await fetchCollectionV1(umi,publicKey(collectionAddress));if(collectionAccount.updateAuthority.toString()!==walletAddress)throw new Error(`Эта коллекция принадлежит другому кошельку (${shorten(collectionAccount.updateAuthority.toString())}). Подключите кошелёк администратора, который создал коллекцию`);setStatus("Формируем PNG и загружаем метаданные…");const png=await makeCertificatePng(form);const image=await uploadPermanentFile(uploader,createGenericFile(png,`certificate-${form.certificateNumber}.png`,{contentType:"image/png"}));if(!validUploadUri(image))throw new Error("Картинка не загрузилась в постоянное хранилище. NFT не выпущен — попробуйте ещё раз.");const assetSigner=generateSigner(umi);const name=`KBTU Certificate #${form.certificateNumber.trim()}`;const metadata={name,description:`Сертификат программы «${form.program}», выданный KBTU Startup Incubator`,image,external_url:`${window.location.origin}/?certificate=${assetSigner.publicKey}`,attributes:[{trait_type:"Recipient",value:form.recipientName.trim()},{trait_type:"Certificate Number",value:form.certificateNumber.trim()},{trait_type:"Program",value:form.program.trim()},{trait_type:"Issue Date",value:form.issueDate},{trait_type:"Issuer",value:"KBTU Startup Incubator"},{trait_type:"Network",value:"Solana Devnet"}],properties:{files:[{uri:image,type:"image/png"}],category:"image"}};const metadataUri=await uploadPermanentFile(uploader,createGenericFileFromJson(metadata));if(!validUploadUri(metadataUri))throw new Error("Метаданные не загрузились в постоянное хранилище. NFT не выпущен — попробуйте ещё раз.");setStatus(`Подтвердите финальный выпуск NFT в ${walletName}…`);const result=await create(umi,{asset:assetSigner,collection:collectionAccount,owner:publicKey(form.recipient),name,uri:metadataUri,plugins:[{type:"PermanentFreezeDelegate",frozen:true,authority:{type:"Address",address:publicKey(walletAddress)}},{type:"Attributes",attributeList:[{key:"certificate_number",value:form.certificateNumber.trim()},{key:"recipient",value:form.recipientName.trim()},{key:"program",value:form.program.trim()},{key:"issue_date",value:form.issueDate},{key:"status",value:"valid"}]}]}).sendAndConfirm(umi);const record:CertificateRecord={asset:assetSigner.publicKey.toString(),collection:collectionAddress,recipient:form.recipient,recipientName:form.recipientName.trim(),certificateNumber:form.certificateNumber.trim(),program:form.program.trim(),issueDate:form.issueDate,signature:Array.from(result.signature).join("."),metadataUri,createdAt:new Date().toISOString(),revoked:false};const next=[record,...records];setRecords(next);localStorage.setItem(CERTIFICATES_KEY,JSON.stringify(next));setStatus(`Сертификат #${record.certificateNumber} выпущен`);setVerifyAddress(record.asset);setForm(current=>({...current,recipientName:"",certificateNumber:"",recipient:""}));await refreshBalance(walletAddress)}catch(reason){setError(errorMessage(reason,"Выпуск не выполнен"))}finally{setBusy("")}}
  async function verifyCertificate(address=verifyAddress){setBusy("verify");setError("");setVerifiedAsset(null);try{const umi=createUmi(RPC_URL).use(mplCore());const asset=await fetchAssetV1(umi,publicKey(address.trim()));const collectionAddress=asset.updateAuthority.type==="Collection"&&asset.updateAuthority.address?asset.updateAuthority.address.toString():undefined;setVerifiedAsset({name:asset.name,owner:asset.owner.toString(),uri:asset.uri,asset:address.trim(),collection:collectionAddress})}catch{setError("NFT не найден в Solana Devnet или адрес введён неверно")}finally{setBusy("")}}
  function toggleRevoked(asset:string){const next=records.map(item=>item.asset===asset?{...item,revoked:!item.revoked}:item);setRecords(next);localStorage.setItem(CERTIFICATES_KEY,JSON.stringify(next))}
  async function copy(value:string){await navigator.clipboard.writeText(value);setStatus("Скопировано")}
  const localRecord=records.find(item=>item.asset===verifiedAsset?.asset);const collectionMatches=Boolean(verifiedAsset?.collection&&collection&&verifiedAsset.collection===collection);

  return <main className="app-shell"><header className="topbar"><div className="brand"><img className="brand-logo" src="https://startup-course.com/images/tild3261-3537-4565-a263-323130366532__3.svg" alt="Startup Course"/><div><strong>STARTUP-COURSE.COM</strong><small>NFT CERTIFICATES</small></div></div><span className="network-pill"><i/> SOLANA DEVNET</span><div className="wallet-zone">{walletAddress?<><span className="balance">{balance?.toFixed(3)??"—"} SOL</span><button className="wallet-button connected" title={walletName}><Wallet size={16}/>{walletName} · {shorten(walletAddress)}</button></>:<div className="wallet-picker-wrap"><button className="wallet-button" onClick={()=>setWalletPicker(value=>!value)} disabled={busy==="connect"}><Wallet size={16}/>{busy==="connect"?"ПОДКЛЮЧЕНИЕ…":"ПОДКЛЮЧИТЬ КОШЕЛЁК"}</button>{walletPicker&&<div className="wallet-picker"><button onClick={connectPhantom}><strong>Phantom</strong><span>Solana · расширение</span></button><button onClick={connectMetaMask}><strong>MetaMask</strong><span>Solana · Devnet</span></button></div>}</div>}</div></header>
  <div className="workspace"><aside className="sidebar"><nav><button className={mode==="issue"?"active":""} onClick={()=>setMode("issue")}><FileBadge2 size={18}/>Выпуск</button><button className={mode==="verify"?"active":""} onClick={()=>setMode("verify")}><Search size={18}/>Проверка</button></nav><div className="collection-card"><span>Официальная коллекция</span><strong>{collection?shorten(collection,7,7):"Ещё не создана"}</strong>{collection&&<a href={`https://explorer.solana.com/address/${collection}?cluster=devnet`} target="_blank" rel="noreferrer">Открыть в Explorer <ExternalLink size={13}/></a>}</div></aside>
  <section className="content">{status&&<div className="notice success"><CheckCircle2 size={18}/>{status}</div>}{error&&<div className="notice error">{error}</div>}
  {mode==="issue"?<><div className="page-heading"><div><p>STARTUP-COURSE · ADMIN</p><h1>Выпустить сертификат</h1><span>От идеи до готового продукта — теперь с подтверждением в Solana.</span></div>{walletAddress&&(balance??0)<MIN_ADMIN_BALANCE&&<button className="secondary-button" onClick={requestAirdrop} disabled={Boolean(busy)}>{busy==="airdrop"&&<LoaderCircle className="spin" size={16}/>}Получить Devnet SOL</button>}</div><div className="grid-layout"><form className="panel form-panel" onSubmit={issueCertificate}><label>ФИО получателя<input required value={form.recipientName} onChange={e=>setForm({...form,recipientName:e.target.value})} placeholder="Токсеитова Аружан"/></label><div className="row"><label>Номер<input required value={form.certificateNumber} onChange={e=>setForm({...form,certificateNumber:e.target.value})} placeholder="320"/></label><label>Дата<input required type="date" value={form.issueDate} onChange={e=>setForm({...form,issueDate:e.target.value})}/></label></div><label>Программа<input required value={form.program} onChange={e=>setForm({...form,program:e.target.value})}/></label><label>Solana-адрес получателя<input required className="mono" value={form.recipient} onChange={e=>setForm({...form,recipient:e.target.value.trim()})} placeholder="Введите публичный адрес"/></label>{walletAddress&&balance!==null&&balance<MIN_ADMIN_BALANCE&&<div className="warning balance-warning"><ShieldCheck size={19}/><span>На кошельке {balance.toFixed(3)} SOL. Сначала получите тестовые SOL — без них выпуск невозможен. <a href="https://faucet.solana.com/" target="_blank" rel="noreferrer">Открыть faucet</a></span></div>}<div className="warning"><ShieldCheck size={19}/><span>NFT будет сразу отправлен получателю и заблокирован от передачи.</span></div><button className="primary-button" disabled={Boolean(busy)||(Boolean(walletAddress)&&balance!==null&&balance<MIN_ADMIN_BALANCE)}>{busy==="issue"?<LoaderCircle className="spin" size={18}/>:<BadgeCheck size={18}/>}ВЫПУСТИТЬ NFT</button></form><div className="panel preview-panel"><span className="eyebrow">ПРЕДПРОСМОТР</span><div className="certificate-preview"><img src="/certificate-template.png" alt="Предпросмотр сертификата"/><div className="preview-number"><span>№{form.certificateNumber||"—"}</span><span>от {formatDate(form.issueDate)}</span></div><h3>{form.recipientName||"Имя получателя"}</h3><p>успешно прошёл(ла) программу инкубации «{form.program}», включающую следующие темы:</p></div></div></div>
  <section className="records-section"><div className="section-heading"><h2>Последние выпуски</h2><span>{records.length}</span></div>{records.length===0?<div className="empty-state">После первого выпуска сертификат появится здесь.</div>:<div className="records">{records.map(item=><article key={item.asset}><div className="record-icon"><FileBadge2 size={18}/></div><div className="record-main"><strong>{item.recipientName}</strong><small>#{item.certificateNumber} · {item.issueDate}</small></div><span className={item.revoked?"state revoked":"state"}>{item.revoked?"Отозван":"Действителен"}</span><button title="Скопировать адрес" onClick={()=>copy(item.asset)}><Copy size={16}/></button><button onClick={()=>toggleRevoked(item.asset)}>{item.revoked?"Вернуть":"Отозвать"}</button><a href={`https://explorer.solana.com/address/${item.asset}?cluster=devnet`} target="_blank" rel="noreferrer"><ExternalLink size={16}/></a></article>)}</div>}</section></>:<div className="verify-wrap"><div className="page-heading"><div><p>ПУБЛИЧНАЯ ПРОВЕРКА</p><h1>Проверить сертификат</h1></div></div><div className="panel verify-panel"><label>Адрес NFT<div className="search-row"><input className="mono" value={verifyAddress} onChange={e=>setVerifyAddress(e.target.value.trim())} placeholder="Введите адрес Core Asset"/><button className="primary-button" onClick={()=>verifyCertificate()} disabled={busy==="verify"}>{busy==="verify"?<LoaderCircle className="spin" size={18}/>:<Search size={18}/>}Проверить</button></div></label></div>{verifiedAsset&&<div className="panel result-card"><div className={localRecord?.revoked?"result-symbol revoked":"result-symbol"}>{localRecord?.revoked?"!":<BadgeCheck size={34}/>}</div><div><span className="eyebrow">РЕЗУЛЬТАТ ПРОВЕРКИ</span><h2>{verifiedAsset.name}</h2><p className={localRecord?.revoked?"result-status revoked":"result-status"}>{localRecord?.revoked?"Сертификат отозван":collectionMatches?"Подлинный сертификат коллекции":"NFT найден, коллекция не подтверждена на этом устройстве"}</p><dl><div><dt>Владелец</dt><dd>{verifiedAsset.owner}</dd></div><div><dt>Коллекция</dt><dd>{verifiedAsset.collection??"Без коллекции"}</dd></div><div><dt>Метаданные</dt><dd><a href={verifiedAsset.uri} target="_blank" rel="noreferrer">Открыть JSON <ExternalLink size={13}/></a></dd></div></dl><a className="explorer-link" href={`https://explorer.solana.com/address/${verifiedAsset.asset}?cluster=devnet`} target="_blank" rel="noreferrer">Открыть в Solana Explorer <ExternalLink size={15}/></a></div></div>}</div>}</section></div></main>;
}
