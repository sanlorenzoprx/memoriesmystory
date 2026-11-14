import { randomUUID } from "node:crypto";
import { relative } from "node:path";
const wait = (ms) => new Promise((done) => globalThis.setTimeout(done, ms));
export class CloudArchiveError extends Error {
  constructor(code, httpStatus, providerCodes = []) {
    super(code);
    this.httpStatus = httpStatus;
    this.providerCodes = providerCodes;
  }
}

/** Isolated generated-source resources only. Never accepts existing resource IDs/names. */
export async function createCloudArchiveRuntime(
  options,
  credentials,
  fetcher = globalThis.fetch,
) {
  const account = credentials.REALTIMEKIT_ACCOUNT_ID,
    token = credentials.CLOUDFLARE_API_TOKEN;
  if (!/^[a-f0-9]{32}$/iu.test(account ?? "") || !token || /\s/u.test(token))
    throw new CloudArchiveError("archive_cloud_configuration_missing");
  const name = `memoriesmystory-archive-proof-${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const proofToken = randomUUID() + randomUUID(),
    root = `https://api.cloudflare.com/client/v4/accounts/${account}`;
  let databaseId,
    bucketCreated = false,
    workerMayExist = false,
    allocationUncertain = false,
    origin,
    uploaded = false,
    generation = "";
  async function api(path, method = "GET", payload, raw = false) {
    const form = payload instanceof globalThis.FormData;
    const response = await fetcher(root + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(payload && !form ? { "Content-Type": "application/json" } : {}),
      },
      ...(payload ? { body: form ? payload : JSON.stringify(payload) } : {}),
      redirect: "error",
      signal: globalThis.AbortSignal.timeout(60000),
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      const rejected = await response.json().catch(() => null);
      const codes = (Array.isArray(rejected?.errors) ? rejected.errors : [])
        .map((error) => error?.code)
        .filter((code) => Number.isSafeInteger(code) && code >= 0)
        .slice(0, 8);
      throw new CloudArchiveError(
        "archive_cloud_request_failed",
        response.status,
        codes,
      );
    }
    if (raw) return response;
    if (response.status === 204) return null;
    const body = await response.json();
    if (body?.success !== true)
      throw new CloudArchiveError(
        "archive_cloud_response_invalid",
        response.status,
      );
    return body.result;
  }
  const bound = Object.entries(options.bindings).map(([key, value]) => ({
    name: key,
    type: ["SESSION_SECRET", "REALTIMEKIT_API_TOKEN"].includes(key)
      ? "secret_text"
      : "plain_text",
    text: String(value),
  }));
  const wrapper = `import app from './native-archive-proof.js';
 export { LegacyRecorder } from './worker/legacy-recorder.js';
 export default {async fetch(request,env){
  if(new URL(request.url).pathname.startsWith('/__archive-proof/')){
   if(request.method!=='POST'||request.headers.get('Authorization')!=='Bearer '+env.ARCHIVE_PROOF_TOKEN)return new Response(null,{status:404});
   if(new URL(request.url).pathname==='/__archive-proof/generation')return Response.json({generation:env.ARCHIVE_PROOF_GENERATION},{headers:{'Cache-Control':'private, no-store'}});
   if(new URL(request.url).pathname!=='/__archive-proof/head')return new Response(null,{status:404});
   const {key}=await request.json();if(typeof key!=='string'||key.length>1024)return new Response(null,{status:400});
   const object=await env.MEDIA_BUCKET.head(key);return Response.json(object?{cacheControl:object.httpMetadata?.cacheControl,size:object.size}:null,{headers:{'Cache-Control':'private, no-store'}});
  }
  return app.fetch(request,env);
 }};`;
  const cleanupModule = `export default {async fetch(request,env){
  if(request.method!=='POST'||request.headers.get('Authorization')!=='Bearer '+env.ARCHIVE_PROOF_TOKEN)return new Response(null,{status:404});
  let count=0;for(let page=0;page<100;page++){const listed=await env.MEDIA_BUCKET.list({limit:1000});if(!listed.objects.length)return Response.json({empty:true,count});await env.MEDIA_BUCKET.delete(listed.objects.map(object=>object.key));count+=listed.objects.length;}
  return Response.json({empty:false,count},{status:503});
 }};`;
  async function upload(cleanup = false, restart = false) {
    generation = randomUUID();
    const metadata = {
      main_module: cleanup ? "cleanup.js" : "cloud-archive-proof.js",
      compatibility_date: "2026-07-15",
      bindings: [
        {
          name: "ARCHIVE_PROOF_GENERATION",
          type: "plain_text",
          text: generation,
        },
        { name: "MEDIA_BUCKET", type: "r2_bucket", bucket_name: name },
        { name: "ARCHIVE_PROOF_TOKEN", type: "secret_text", text: proofToken },
        ...(!cleanup
          ? [
              ...bound,
              { name: "DB", type: "d1", database_id: databaseId },
              {
                name: "LEGACY_RECORDERS",
                type: "durable_object_namespace",
                class_name: "LegacyRecorder",
              },
            ]
          : []),
      ],
      ...(!restart
        ? {
            migrations: cleanup
              ? {
                  old_tag: "archive-proof-v1",
                  new_tag: "archive-cleanup-v2",
                  deleted_classes: ["LegacyRecorder"],
                }
              : {
                  new_tag: "archive-proof-v1",
                  new_sqlite_classes: ["LegacyRecorder"],
                },
          }
        : {}),
    };
    const form = new globalThis.FormData();
    form.set("metadata", JSON.stringify(metadata));
    if (cleanup)
      form.set(
        "cleanup.js",
        new globalThis.Blob([cleanupModule], {
          type: "application/javascript+module",
        }),
        "cleanup.js",
      );
    else {
      for (const module of options.modules) {
        const path = relative(options.modulesRoot, module.path).replaceAll(
          "\\",
          "/",
        );
        if (path.startsWith("..") || path.startsWith("/"))
          throw new CloudArchiveError("archive_cloud_module_path_invalid");
        form.set(
          path,
          new globalThis.Blob([module.contents], {
            type: "application/javascript+module",
          }),
          path,
        );
      }
      form.set(
        "cloud-archive-proof.js",
        new globalThis.Blob([wrapper], {
          type: "application/javascript+module",
        }),
        "cloud-archive-proof.js",
      );
    }
    workerMayExist = true;
    await api(`/workers/scripts/${name}`, "PUT", form);
    uploaded = true;
  }
  async function workerProof(path, body) {
    const response = await fetcher(origin + path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${proofToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
      redirect: "error",
      signal: globalThis.AbortSignal.timeout(60000),
    });
    if (!response.ok)
      throw new CloudArchiveError(
        "archive_cloud_worker_unavailable",
        response.status,
      );
    return response.json();
  }
  async function dispose() {
    let confirmed = !allocationUncertain;
    // Removing the synthetic DO namespace first prevents late imports while emptying R2.
    if (uploaded && bucketCreated) {
      try {
        await upload(true);
        let empty = false;
        for (let i = 0; i < 20; i++) {
          try {
            empty = (await workerProof("/", {}))?.empty === true;
            if (empty) break;
          } catch {
            /* Deployment propagation is retried with a bounded wait. */
          }
          await wait(1000);
        }
        if (!empty) confirmed = false;
      } catch {
        confirmed = false;
      }
    }
    if (workerMayExist) {
      try {
        await api(`/workers/scripts/${name}?force=true`, "DELETE");
      } catch {
        confirmed = false;
      }
    }
    if (bucketCreated) {
      try {
        await api(`/r2/buckets/${name}`, "DELETE");
      } catch {
        confirmed = false;
      }
    }
    if (databaseId) {
      try {
        await api(`/d1/database/${databaseId}`, "DELETE");
      } catch {
        confirmed = false;
      }
    }
    if (!confirmed)
      throw new CloudArchiveError("archive_cloud_cleanup_unconfirmed");
  }
  try {
    const subdomain = await api("/workers/subdomain");
    if (!/^[a-z0-9-]{1,63}$/u.test(subdomain?.subdomain ?? ""))
      throw new CloudArchiveError("archive_cloud_subdomain_unavailable");
    origin = `https://${name}.${subdomain.subdomain}.workers.dev`;
    allocationUncertain = true;
    const database = await api("/d1/database", "POST", { name });
    if (!/^[a-f0-9-]{36}$/iu.test(database?.uuid ?? ""))
      throw new CloudArchiveError("archive_cloud_response_invalid");
    databaseId = database.uuid;
    allocationUncertain = false;
    allocationUncertain = true;
    const createdBucket = await api("/r2/buckets", "POST", { name });
    if (createdBucket?.name !== name)
      throw new CloudArchiveError("archive_cloud_response_invalid");
    bucketCreated = true;
    allocationUncertain = false;
    const managed = await api(`/r2/buckets/${name}/domains/managed`),
      custom = await api(`/r2/buckets/${name}/domains/custom`);
    if (
      managed?.enabled !== false ||
      !Array.isArray(custom?.domains) ||
      custom.domains.length
    )
      throw new CloudArchiveError("archive_cloud_bucket_privacy_unconfirmed");
    await upload();
    await api(`/workers/scripts/${name}/subdomain`, "POST", {
      enabled: true,
      previews_enabled: false,
    });
    async function query(sql, params = []) {
      const result = await api(`/d1/database/${databaseId}/query`, "POST", {
        sql,
        params,
      });
      if (
        !Array.isArray(result) ||
        result.length !== 1 ||
        !Array.isArray(result[0].results)
      )
        throw new CloudArchiveError("archive_cloud_query_unconfirmed");
      return result[0];
    }
    const db = {
      prepare(sql) {
        let params = [];
        const statement = {
          bind(...values) {
            params = values;
            return statement;
          },
          run: () => query(sql, params),
          all: () => query(sql, params),
          async first(column) {
            const row = (await query(sql, params)).results[0] ?? null;
            return column ? (row?.[column] ?? null) : row;
          },
        };
        return statement;
      },
    };
    const bucket = {
      async get(key) {
        const response = await api(
          `/r2/buckets/${name}/objects/${key.split("/").map(encodeURIComponent).join("/")}`,
          "GET",
          undefined,
          true,
        );
        if (!response) return null;
        const metadata = await workerProof("/__archive-proof/head", { key });
        if (!metadata)
          throw new CloudArchiveError("archive_cloud_object_unconfirmed");
        return {
          arrayBuffer: () => response.arrayBuffer(),
          httpMetadata: { cacheControl: metadata.cacheControl },
        };
      },
    };
    async function waitForGeneration() {
      const deadline = Date.now() + 60000;
      for (let i = 0; i < 30 && Date.now() < deadline; i++) {
        try {
          if (
            (await workerProof("/__archive-proof/generation", {}))
              ?.generation === generation
          )
            return;
        } catch {
          /* Retry propagation without accepting another deployment. */
        }
        await wait(2000);
      }
      throw new CloudArchiveError("archive_cloud_worker_unavailable");
    }
    const ready = waitForGeneration();
    return {
      ready,
      getD1Database: async () => db,
      getR2Bucket: async () => bucket,
      dispatchFetch(input, init) {
        const url = new URL(input);
        if (
          url.origin !== "https://example.test" ||
          !(
            url.pathname.startsWith("/resources/legacy-sessions/") ||
            /^\/resources\/family-archives(?:\/|$)/.test(url.pathname)
          )
        )
          throw new CloudArchiveError("archive_cloud_route_invalid");
        return fetcher(origin + url.pathname + url.search, {
          ...init,
          redirect: "error",
          signal: globalThis.AbortSignal.timeout(60000),
        });
      },
      async restart() {
        await upload(false, true);
        await waitForGeneration();
      },
      dispose,
    };
  } catch (error) {
    if (
      allocationUncertain &&
      error instanceof CloudArchiveError &&
      error.httpStatus >= 400 &&
      error.httpStatus < 500 &&
      ![408, 429].includes(error.httpStatus)
    )
      allocationUncertain = false;
    try {
      await dispose();
    } catch {
      throw new CloudArchiveError("archive_cloud_cleanup_unconfirmed");
    }
    throw error;
  }
}
