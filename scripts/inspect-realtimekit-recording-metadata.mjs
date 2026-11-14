import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const schemaKeys=new Set(["default","layer_name","download_url","download_urls","url","urls","layers","files","file","audio","video","data","recording","recordings","user_id","peer_id","filename","file_name","output_file_name","media_kind","stream_kind","type","items"]);
function safeTree(value,depth=0){
  if(value===null)return {kind:"null"};
  if(depth>=5)return {kind:Array.isArray(value)?"array":typeof value};
  if(Array.isArray(value))return {kind:"array",length:value.length,first:value.length?safeTree(value[0],depth+1):null};
  if(typeof value==="object")return {kind:"object",fields:Object.entries(value).slice(0,10).map(([key,v])=>({key:schemaKeys.has(key)?key:"opaque_key",shape:safeTree(v,depth+1)}))};
  return {kind:typeof value,...(typeof value==="string"?{https:value.startsWith("https://")}:{} )};
}
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
    downloadStructure:safeTree(value),
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
    const records=[];
    for(const row of rows.slice(0,10)){
      if(!/^[A-Za-z0-9_-]{8,128}$/u.test(row.id))throw new Error("record_identity");
      const detail=await get(`/${matches[0].id}/recordings/${row.id}`);
      records.push(recordingMetadataShape(detail?.recording??detail));
    }
    return {ok:true,status:"recording_metadata_structure_inspected",records};
  }catch{return {ok:false,status:"recording_metadata_inspection_failed"};}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await inspectExistingRecordingMetadata(process.env);console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
}
