import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Shared operator parser has no TypeScript declarations.
import * as outputs from "../../scripts/realtimekit-recording-output.mjs";
const people=[{participantId:"person_host_001",role:"host"},{participantId:"person_guest_001",role:"guest"}];
const composite={status:"UPLOADED",download_url:"https://recordings.example.r2.cloudflarestorage.com/composite?private=CANARY"};
const track={status:"UPLOADED",download_url:[{layer_name:"default",download_urls:Object.fromEntries(people.map(p=>[`memoriesmystory_${p.participantId}_peerid_peer_audio_1700000000000.webm`,{download_url:`https://recordings.example.r2.cloudflarestorage.com/${p.role}?private=CANARY`}]))}]};
describe("recording outputs and bounded private download",()=>{
  it("maps each participant's original audio separately from the composite",()=>{
    expect(outputs.recordingOutputs(composite,track,people).map((x:{kind:string;role?:string})=>[x.kind,x.role])).toEqual([["composite_video",undefined],["participant_audio","host"],["participant_audio","guest"]]);
  });
  it("refuses incomplete, missing or unconfirmed attribution rather than guessing speakers",()=>{
    expect(()=>outputs.recordingOutputs({...composite,status:"UPLOADING"},track,people)).toThrow();
    expect(()=>outputs.recordingOutputs(composite,track,[...people,{participantId:"person_unknown_001",role:"guest"}])).toThrow();
    expect(()=>outputs.recordingOutputs(composite,{...track,download_url:[{download_urls:{"unattributed.webm":{download_url:composite.download_url}}}]},people)).toThrow();
  });
  it("rejects untrusted download origins, credentials and non-HTTPS before any request",async()=>{
    const fetch=vi.fn();
    for(const url of ["http://recordings.cloudflare.com/file","https://127.0.0.1/file","https://recordings.evilcloudflare.com/file","https://user:password@cloudflare.com/file","https://cloudflare.com:444/file"]){
      await expect(outputs.downloadRecordingBytes(url,fetch)).rejects.toThrow();
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("hashes actual bounded bytes and does not forward API credentials",async()=>{
    const body=new Uint8Array([0x1a,0x45,0xdf,0xa3,1,2,3]);
    const fetch=vi.fn(async()=>new Response(body));
    const result=await outputs.downloadRecordingBytes(composite.download_url,fetch,20);
    expect(result.bytes).toEqual(body);expect(result.sha256).toBe(createHash("sha256").update(body).digest("hex"));
    expect(fetch.mock.calls[0]).toHaveLength(2);
    const options=fetch.mock.calls[0] as unknown as [string,RequestInit];
    expect(options[1].headers).toBeUndefined();expect(options[1].redirect).toBe("error");
    await expect(outputs.downloadRecordingBytes(composite.download_url,async()=>new Response(body),2)).rejects.toThrow();
  });
});
