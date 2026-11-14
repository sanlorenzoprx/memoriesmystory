import { describe,expect,it } from "vitest";
// @ts-expect-error Standalone runner diagnostic has no declarations.
import {recordingMetadataShape} from "../../scripts/inspect-realtimekit-recording-metadata.mjs";
describe("recording metadata structure diagnostic",()=>{
  it("reports structural differences without returning source identifiers or capabilities",()=>{
    const result=recordingMetadataShape({id:"PRIVATE_ID_CANARY",type:"TRACK",status:"UPLOADED",download_url:JSON.stringify([{layer_name:"default",download_urls:{"PRIVATE_FILENAME_CANARY.webm":{download_url:"https://example.com/?secret=PRIVATE_URL_CANARY"}}}])});
    expect(result).toMatchObject({type:"TRACK",uploaded:true,downloadValueType:"string",jsonEncoded:true,layerCount:1,layers:[{fileCount:1,nestedUrlCount:1}]});
    expect(JSON.stringify(result)).not.toMatch(/CANARY|example.com/);
  });
});
