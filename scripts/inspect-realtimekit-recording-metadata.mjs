import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Return structure only: no identifiers, filenames, signed URLs, tokens or provider text. */
export function recordingMetadataShape(record) {
  const value=record?.download_url;
  let decoded=value, encoded=false;
  if(typeof value==="string" && (value.trim().startsWith("[") || value.trim().startsWith("{"))) {
    try{decoded=JSON.parse(value);encoded=true;}catch{decoded=null;}
  }
  const layers=Array.isArray(decoded)?decoded:[];
  return {
    type:["TRACK","COMPOSITE"].includes(record?.type)?record.type:"other_or_absent",
    uploaded:record?.status==="UPLOADED",
    downloadValueType:Array.isArray(value)?"array":typeof value,
    jsonEncoded:encoded,
    layerCount:layers.length,
    layers:layers.slice(0,5).map(layer=>{
      const map=layer?.download_urls, values=map&&typeof map==="object"?Object.values(map):[];
      return {hasDownloadMap:Boolean(map),fileCount:values.length,
        valueTypes:[...new Set(values.map(item=>typeof item))],
        nestedUrlCount:values.filter(item=>typeof item?.download_url==="string").length,
        customHostFilenameCount:Object.keys(map??{}).filter(name=>name.includes("memoriesmystory-test-host")).length,
        customGuestFilenameCount:Object.keys(map??{}).filter(name=>name.includes("memoriesmystory-test-guest")).length,
      };
    }),
  };
}
export async function inspectExistingRecordingMetadata(env,fetcher=globalThis.fetch){
  if(!/^[a-f0-9]{32}$/iu.test(env.REALTIMEKIT_ACCOUNT_ID??"")||!env.REALTIMEKIT_API_TOKEN)return {ok:false,status:"missing_configuration"};
  try{
    const base=`https://api.cloudflare.com/client/v4/accounts/${env.REALTIMEKIT_ACCOUNT_ID}/realtime/kit`;
    async function get(path){
      const r=await fetcher(base+path,{headers:{Authorization:`Bearer ${env.REALTIMEKIT_API_TOKEN}`},redirect:"error",signal:globalThis.AbortSignal.timeout(20000)});
      const body=await r.json();if(!r.ok||body.success!==true)throw new Error("request_failed");return body.data;
    }
    const apps=await get("/apps?search=memoriesmystory-staging&per_page=100"),matches=apps.filter(app=>app.name==="memoriesmystory-staging");
    if(matches.length!==1||!/^[A-Za-z0-9_-]{8,128}$/u.test(matches[0].id))throw new Error("staging_app_uncertain");
    const rows=await get(`/${matches[0].id}/recordings?per_page=10&sort_order=DESC`);
    if(!Array.isArray(rows))throw new Error("listing_shape");
    return {ok:true,status:"recording_metadata_structure_inspected",records:rows.slice(0,10).map(recordingMetadataShape)};
  }catch{return {ok:false,status:"recording_metadata_inspection_failed"};}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await inspectExistingRecordingMetadata(process.env);console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
}
