import { Buffer } from "node:buffer";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { runStagingProof } from "./realtimekit-staging-proof.mjs";
import { recordingOutputs, downloadRecordingBytes } from "./realtimekit-recording-output.mjs";

const candidate = resolve("call-candidate"), origin = "http://127.0.0.1:4173";
const directory = await mkdtemp(join(tmpdir(), "memoriesmystory-recording-"));
const checks = [], outputMetadata = [];let stage = "prepare_synthetic_sources", browser, server;
const wait = ms => new Promise(r => globalThis.setTimeout(r, ms));
function tone() {
  const count=48000*10, b=Buffer.alloc(44+count*2);
  b.write("RIFF");b.writeUInt32LE(b.length-8,4);b.write("WAVEfmt ",8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(48000,24);b.writeUInt32LE(96000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write("data",36);b.writeUInt32LE(count*2,40);
  for(let i=0;i<count;i++)b.writeInt16LE(Math.round(Math.sin(2*Math.PI*440*i/48000)*6000),44+i*2);return b;
}
async function exercise({grants,recording}) {
  const {chromium} = await import(pathToFileURL(join(candidate,"node_modules/@playwright/test/index.mjs")).href);
  const cleanEnv={...process.env};delete cleanEnv.REALTIMEKIT_API_TOKEN;
  const file=join(directory,"synthetic.wav");await writeFile(file,tone(),{mode:0o600});
  server=spawn(process.execPath,[join(candidate,"node_modules/vite/bin/vite.js"),"preview","--host","127.0.0.1","--port","4173","--strictPort"],{cwd:candidate,stdio:"ignore",env:cleanEnv});
  for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error("fixture_failed");if(await globalThis.fetch(origin).then(r=>r.ok).catch(()=>false))break;await wait(100);if(i===99)throw new Error("fixture_failed");}
  browser=await chromium.launch({headless:true,env:cleanEnv,args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream",`--use-file-for-fake-audio-capture=${file}`]});
  const sdk=await readFile(join(candidate,"node_modules/@cloudflare/realtimekit/dist/browser.js"),"utf8");
  for(const grant of grants){
    stage=`join_synthetic_${grant.role}`;
    const context=await browser.newContext({permissions:["microphone","camera"]});
    const page=await context.newPage();page.setDefaultTimeout(45000);
    await page.route("**/recording-probe",route=>route.fulfill({contentType:"text/html",body:"<!doctype html><html lang='en'><title>Synthetic provider recording probe</title><body>Generated test sources only. Recording output verification.</body></html>"}));
    await page.goto(`${origin}/recording-probe`);await page.addScriptTag({content:sdk});
    await page.evaluate(async authToken=>{
      globalThis.__recordingClient=await globalThis.RealtimeKitClient.init({authToken,defaults:{audio:true,video:true}});
      await globalThis.__recordingClient.join();
    },grant.authToken);
  }
  stage="start_recording_pair";
  const pair=await recording.startSyntheticPair(true);
  async function until(id,status){
    for(let i=0;i<120;i++){
      const record=await recording.get(id);
      if(record?.status===status)return record;
      if(record?.status==="ERRORED")throw new Error("provider_recording_errored");
      await wait(2000);
    }
    throw new Error("provider_recording_timeout");
  }
  stage="wait_for_both_recorders";await Promise.all(Object.values(pair).map(id=>until(id,"RECORDING")));
  checks.push("simultaneous_track_and_composite_recorders_running");
  await wait(10000);
  stage="stop_recorders";await Promise.all(Object.values(pair).map(id=>recording.stop(id)));
  stage="wait_for_uploaded_outputs";
  const [composite,track]=await Promise.all([until(pair.composite,"UPLOADED"),until(pair.track,"UPLOADED")]);
  stage="map_participant_audio_outputs";
  const outputs=recordingOutputs(composite,track,grants);
  if(outputs.length>12)throw new Error("unexpected_output_count");
  for(let i=0;i<outputs.length;i++){
    const output=outputs[i];stage=`download_${output.kind}${output.role?`_${output.role}`:""}`;
    const {bytes,sha256}=await downloadRecordingBytes(output.url);
    const filename=join(directory,`source-${i}.media`);await writeFile(filename,bytes,{mode:0o600});
    stage=`decode_${output.kind}${output.role?`_${output.role}`:""}`;
    const {stdout}=await promisify(execFile)("ffprobe",["-v","error","-protocol_whitelist","file,pipe","-count_frames","-show_entries","stream=codec_type,nb_read_frames:format=duration","-of","json",filename],{timeout:30000,maxBuffer:65536,env:cleanEnv});
    const info=JSON.parse(stdout), types=info.streams?.filter(stream=>Number(stream.nb_read_frames)>0).map(stream=>stream.codec_type)??[];
    outputMetadata.push({kind:output.kind,...(output.role?{role:output.role}:{}),audioDecoded:types.includes("audio"),videoDecoded:types.includes("video"),durationKnown:Number(info.format?.duration)>0});
    if(!types.includes("audio")||sha256.length!==64)throw new Error("invalid_output");
    if(output.kind==="composite_video"&&!types.includes("video"))throw new Error("video_output_missing");
    if(output.kind==="participant_audio"&&types.includes("video"))throw new Error("unexpected_video_track");
  }
  checks.push("composite_audio_video_downloaded_hashed_and_decodable","both_participant_audio_sources_mapped_hashed_and_decodable");
  stage="complete";
}
let result;
try{
  result=await runStagingProof(process.env,globalThis.fetch,async context=>{
    try{await exercise(context);}finally{await browser?.close().catch(()=>{});server?.kill();}
  });
}finally{await browser?.close().catch(()=>{});server?.kill();await rm(directory,{recursive:true,force:true});}
const report={...result,recordingProbeStage:stage,recordingOutputChecks:checks,outputMetadata};
console.log(JSON.stringify(report));
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`## Synthetic RealtimeKit recording-output proof\n\n\`\`\`json\n${JSON.stringify(report,null,2)}\n\`\`\`\n\nGenerated audio/video only. Separate provider-output verification, not a consumer consent UI test or private archive durability proof. Temporary downloads are removed; credentials, participant JWTs, signed URLs, media and provider bodies are not exported. This bounded run uses calling/export minutes; no plan activation or production deployment.\n`);
if(!result.ok)process.exitCode=1;
