import { Buffer } from "node:buffer";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { runStagingProof } from "./realtimekit-staging-proof.mjs";

// The workflow pins this candidate checkout. No arbitrary code/ref input is accepted.
const candidate = resolve("call-candidate");
const origin = "http://127.0.0.1:4173";
const browserChecks = [];
let browserStage = "start_browser_fixture";
const directory = await mkdtemp(join(tmpdir(), "memoriesmystory-call-"));
let server, browser;
function sineWave() {
  const samples = 48000 * 10, data = Buffer.alloc(44 + samples * 2);
  data.write("RIFF",0); data.writeUInt32LE(data.length-8,4); data.write("WAVEfmt ",8);
  data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);
  data.writeUInt32LE(48000,24);data.writeUInt32LE(96000,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);
  data.write("data",36);data.writeUInt32LE(samples*2,40);
  for(let n=0;n<samples;n++)data.writeInt16LE(Math.round(Math.sin(2*Math.PI*440*n/48000)*6000),44+n*2);
  return data;
}
async function exercise({grants,revokeGuest}) {
  const {chromium} = await import(pathToFileURL(join(candidate,"node_modules/@playwright/test/index.mjs")).href);
  const tone = join(directory,"synthetic-tone.wav");await writeFile(tone,sineWave(),{mode:0o600});
  const childEnvironment = { ...process.env };
  delete childEnvironment.REALTIMEKIT_API_TOKEN;
  server = spawn(process.execPath,[join(candidate,"node_modules/vite/bin/vite.js"),"preview","--host","127.0.0.1","--port","4173","--strictPort"],{cwd:candidate,stdio:"ignore",env:childEnvironment});
  for(let n=0;n<100;n++){
    if(server.exitCode!==null)throw new Error("fixture_not_ready");
    if(await globalThis.fetch(origin).then(r=>r.ok).catch(()=>false))break;
    await new Promise(r=>globalThis.setTimeout(r,100));
    if(n===99)throw new Error("fixture_not_ready");
  }
  browser=await chromium.launch({headless:true,env:childEnvironment,args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream",`--use-file-for-fake-audio-capture=${tone}`]});
  const photo=await readFile(join(candidate,"tests/fixtures/synthetic-family-photo.png"));
  const pages=[];
  for(const grant of grants){
    const context=await browser.newContext({viewport:{width:412,height:915},permissions:["camera","microphone"]});
    const page=await context.newPage();page.setDefaultTimeout(45000);
    await page.addInitScript(()=>{
      globalThis.localStorage.setItem("memoriesmystory:ui-locale","en-US");
      const proof={pcs:[],audio:[],streams:[],requests:0};globalThis.__callProof=proof;
      const Peer=globalThis.RTCPeerConnection;
      globalThis.RTCPeerConnection=new Proxy(Peer,{construct(target,args){const peer=Reflect.construct(target,args,target);proof.pcs.push(peer);return peer;}});
      const AudioElement=globalThis.Audio;
      globalThis.Audio=new Proxy(AudioElement,{construct(target,args){const audio=Reflect.construct(target,args,target);proof.audio.push(audio);return audio;}});
      const getMedia=globalThis.navigator.mediaDevices.getUserMedia.bind(globalThis.navigator.mediaDevices);
      globalThis.navigator.mediaDevices.getUserMedia=async constraints=>{
        if(constraints.audio||constraints.video)proof.requests++;
        const stream=await getMedia(constraints);proof.streams.push(stream);return stream;
      };
    });
    await page.route("**/resources/legacy-sessions/**",async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path.endsWith("/call"))return route.fulfill({json:{authToken:grant.authToken}});
      if(path.endsWith("/photo"))return route.fulfill({body:photo,contentType:"image/png"});
      if(path.endsWith("/recordings"))return route.fulfill({json:{recordings:[]}});
      if(path.endsWith("/invitation"))return route.fulfill({json:{joinPath:null}});
      return route.fulfill({json:{
        id:"legacy_live_synthetic",mode:"remote",status:"draft",version:1,consentEpoch:0,consentVersion:"legacy-recording-v1",
        actorId:`participant_${grant.role}`,actorRole:grant.role,photoUrl:"/resources/legacy-sessions/legacy_live_synthetic/photo",canRecord:false,
        participants:["host","guest"].map(role=>({id:`participant_${role}`,role,displayName:`Synthetic ${role}`,consent:"declined",joined:true,revoked:false})),
      }});
    });
    await page.goto(`${origin}/legacy/legacy_live_synthetic${grant.role==="guest"?"?as=guest":""}`);
    browserStage=`join_${grant.role}`;
    await page.getByRole("button",{name:"Join the call",exact:true}).click();
    await page.getByRole("button",{name:"Leave call",exact:true}).waitFor();
    if(await page.evaluate(()=>globalThis.__callProof.requests!==0))throw new Error("early_device_request");
    pages.push(page);
  }
  browserChecks.push("both_joined_without_recording_consent_or_early_device_requests");
  async function activate(page,role){
    browserStage=`enable_${role}_media`;
    await page.getByRole("button",{name:"Turn on microphone",exact:true}).click();
    await page.getByRole("button",{name:"Mute microphone",exact:true}).waitFor();
    await page.getByRole("button",{name:"Turn on camera",exact:true}).click();
    await page.getByRole("button",{name:"Turn off camera",exact:true}).waitFor();
    await page.getByRole("button",{name:"Hear my conversation partner",exact:true}).click();
  }
  await activate(pages[0],"host");await activate(pages[1],"guest");
  async function mediaReceived(page){
    await page.waitForFunction(async()=>{
      let audio=false,video=false;
      for(const pc of globalThis.__callProof.pcs){
        if(pc.connectionState==="closed")continue;
        const reports=await pc.getStats();
        for(const report of reports.values()){
          if(report.type!=="inbound-rtp")continue;
          if(report.kind==="audio"&&report.bytesReceived>0&&report.totalAudioEnergy>0)audio=true;
          if(report.kind==="video"&&report.framesDecoded>0)video=true;
        }
      }
      const playing=globalThis.__callProof.audio.some(element=>!element.paused&&!element.muted&&element.readyState>=2&&element.srcObject?.getAudioTracks().some(track=>track.readyState==="live"));
      const visible=[...globalThis.document.querySelectorAll('video[aria-label="Your conversation partner"]')].some(element=>element.videoWidth>0&&element.readyState>=2);
      return audio&&video&&playing&&visible;
    },null,{timeout:45000});
  }
  browserStage="bidirectional_media_delivery";await Promise.all(pages.map(mediaReceived));
  browserChecks.push("both_received_decoded_video_and_nonzero_audio_energy_with_playback_running");
  browserStage="audio_continues_with_camera_off";
  await pages[0].getByRole("button",{name:"Turn off camera",exact:true}).click();
  const receivedAudio=page=>page.evaluate(async()=>{
    let bytes=0;for(const pc of globalThis.__callProof.pcs){if(pc.connectionState==="closed")continue;for(const stat of (await pc.getStats()).values())if(stat.type==="inbound-rtp"&&stat.kind==="audio")bytes+=stat.bytesReceived??0;}return bytes;
  });
  const before=await receivedAudio(pages[1]);
  await pages[1].waitForFunction(async previous=>{
    let bytes=0;for(const pc of globalThis.__callProof.pcs){if(pc.connectionState==="closed")continue;for(const stat of (await pc.getStats()).values())if(stat.type==="inbound-rtp"&&stat.kind==="audio")bytes+=stat.bytesReceived??0;}return bytes>previous;
  },before,{timeout:15000});
  browserChecks.push("audio_packets_continue_after_camera_disabled");
  await pages[0].getByRole("button",{name:"Turn on camera",exact:true}).click();
  browserStage="leave_and_release_devices";
  await pages[1].getByRole("button",{name:"Leave call",exact:true}).click();
  await pages[1].waitForFunction(()=>globalThis.__callProof.streams.every(stream=>stream.getTracks().every(track=>track.readyState==="ended")),null,{timeout:15000});
  browserChecks.push("leave_releases_captured_tracks");
  browserStage="rejoin_guest";
  await pages[1].getByRole("button",{name:"Join the call",exact:true}).click();
  await pages[1].getByRole("button",{name:"Leave call",exact:true}).waitFor();
  await activate(pages[1],"rejoined_guest");
  browserStage="media_after_rejoin";await Promise.all(pages.map(mediaReceived));
  browserChecks.push("bidirectional_media_returns_after_guest_rejoin");
  browserStage="remove_active_guest";await revokeGuest();
  await pages[1].getByRole("button",{name:"Join the call",exact:true}).waitFor();
  await pages[1].waitForFunction(()=>globalThis.__callProof.streams.every(stream=>stream.getTracks().every(track=>track.readyState==="ended")),null,{timeout:15000});
  browserChecks.push("provider_participant_deletion_removes_active_guest_and_releases_devices");
  browserStage="complete";
}
let result;
try{
  result=await runStagingProof(process.env,globalThis.fetch,async context=>{
    try{await exercise(context);}finally{await browser?.close().catch(()=>{});server?.kill();}
  });
}finally{
  await browser?.close().catch(()=>{});server?.kill();await rm(directory,{recursive:true,force:true});
}
const report={...result,browserStage,browserChecks};
console.log(JSON.stringify(report));
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`## RealtimeKit live synthetic browser proof\n\n\`\`\`json\n${JSON.stringify(report,null,2)}\n\`\`\`\n\nReal Cloudflare media with two isolated Chromium contexts on one runner; application session/photo APIs are synthetic test fixtures. No physical-device, cross-region, recording or archive-durability claim. No tokens, media files, screenshots, traces or provider bodies are exported.\n`);
if(!result.ok)process.exitCode=1;
