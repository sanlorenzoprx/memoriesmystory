import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const INTENTS_PATH = path.join(ROOT, "config", "functional-discovery-intents.json");

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function jsonScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function renderMarkdown(intent) {
  return `# ${intent.headline}\n\n${intent.description}\n\n## Generate a Story Starter\n\nOpen the interactive utility at /${intent.slug}. It uses the public, deterministic Legacy Story Starter capability. The public utility cannot read a private archive, photograph, voice recording, transcript, family graph, or share token.\n\n## Gentle starting questions\n\n${intent.sampleQuestions.map(question => `- ${question}`).join("\n")}\n\n## What happens next\n\nThe generated questions are guidance, never testimony. If the person chooses to continue, the utility returns a human start link into the ordinary Memories: My Story application. A Living Memory is only created through explicit human action.\n`;
}

function renderPage(intent) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: intent.title,
        description: intent.description,
        isPartOf: { "@type": "WebSite", name: "Memories: My Story" },
        mainEntity: { "@id": "#story-starter" }
      },
      {
        "@id": "#story-starter",
        "@type": "Service",
        name: "Legacy Story Starter",
        description: "A public prompt generator that helps a person begin a family-story conversation without inventing family facts or reading a private archive.",
        provider: { "@type": "Organization", name: "Memories: My Story" },
        areaServed: "Worldwide",
        availableLanguage: ["English", "Spanish"]
      }
    ]
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(intent.title)}</title>
  <meta name="description" content="${esc(intent.description)}">
  <meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1">
  <link rel="canonical" href="/${esc(intent.slug)}">
  <link rel="alternate" type="text/markdown" href="/${esc(intent.slug)}.md">
  <link rel="alternate" type="application/json" href="/openapi.json">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Memories: My Story">
  <meta property="og:title" content="${esc(intent.title)}">
  <meta property="og:description" content="${esc(intent.description)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(intent.title)}">
  <meta name="twitter:description" content="${esc(intent.description)}">
  <script type="application/ld+json">${jsonScript(structuredData)}</script>
  <style>
    :root { color-scheme:light; --ink:#2a2724; --muted:#68615b; --paper:#fbf7f0; --white:#fffdf9; --line:#ded4c7; --rose:#8b4b46; --sage:#52695c; --wash:#f1e8dc; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:ui-serif,Georgia,Cambria,"Times New Roman",serif; background:var(--paper); color:var(--ink); }
    .sans { font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .shell { width:min(1100px,calc(100% - 32px)); margin:0 auto; }
    header { border-bottom:1px solid var(--line); background:rgba(251,247,240,.96); }
    header .shell { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:18px 0; }
    .brand { text-decoration:none; color:var(--ink); font-size:1.25rem; font-weight:800; }
    .brand em { color:var(--rose); }
    header a:last-child { color:var(--sage); font-family:Inter,ui-sans-serif,system-ui,sans-serif; font-weight:700; }
    .hero { display:grid; grid-template-columns:minmax(0,1.05fr) minmax(340px,.95fr); gap:36px; align-items:start; padding:58px 0 34px; }
    .eyebrow { font-family:Inter,ui-sans-serif,system-ui,sans-serif; color:var(--rose); text-transform:uppercase; letter-spacing:.14em; font-size:.74rem; font-weight:900; }
    h1 { font-size:clamp(2.5rem,5vw,4.6rem); letter-spacing:-.04em; line-height:1; margin:.65rem 0 1.25rem; }
    .lede { color:var(--muted); font-size:1.2rem; line-height:1.75; max-width:760px; }
    .promise { margin-top:25px; border-left:4px solid var(--rose); padding:12px 0 12px 18px; font-size:1rem; line-height:1.6; }
    .card { background:var(--white); border:1px solid var(--line); border-radius:20px; padding:25px; box-shadow:0 16px 45px rgba(60,48,39,.08); }
    .card h2 { margin-top:0; font-size:1.55rem; }
    label { display:block; font-family:Inter,ui-sans-serif,system-ui,sans-serif; font-weight:800; margin:16px 0 7px; }
    select,input { width:100%; border:1px solid #bbb2a8; border-radius:11px; padding:12px 13px; background:white; color:var(--ink); font:inherit; }
    button,.button { border:0; border-radius:11px; background:var(--rose); color:white; padding:13px 18px; font-family:Inter,ui-sans-serif,system-ui,sans-serif; font-weight:900; cursor:pointer; text-decoration:none; display:inline-flex; justify-content:center; }
    button[disabled] { opacity:.55; cursor:not-allowed; }
    .status { min-height:24px; color:var(--muted); font-family:Inter,ui-sans-serif,system-ui,sans-serif; font-size:.88rem; margin-top:13px; }
    .result { display:none; border-top:1px solid var(--line); margin-top:20px; padding-top:20px; }
    .result.active { display:block; }
    .opening { font-size:1.4rem; line-height:1.5; font-weight:700; }
    .questions { padding-left:22px; font-size:1.05rem; line-height:1.7; }
    .questions li { margin:.55rem 0; }
    .capture-tip { background:#edf2ee; border-radius:12px; padding:14px 16px; color:#39483f; line-height:1.55; }
    .privacy { font-family:Inter,ui-sans-serif,system-ui,sans-serif; font-size:.83rem; line-height:1.5; color:var(--muted); margin-top:16px; }
    .content-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; padding:24px 0 66px; }
    .content-grid article { background:var(--wash); border-radius:16px; padding:23px; }
    .content-grid h2 { margin-top:0; font-size:1.45rem; }
    .content-grid p,.content-grid li { line-height:1.7; }
    footer { border-top:1px solid var(--line); padding:28px 0 40px; color:var(--muted); font-family:Inter,ui-sans-serif,system-ui,sans-serif; font-size:.85rem; }
    .machine { display:flex; flex-wrap:wrap; gap:14px; margin-top:12px; }
    .machine a { color:var(--sage); }
    @media (max-width:860px) { .hero,.content-grid { grid-template-columns:1fr; } .hero { padding-top:36px; } }
  </style>
</head>
<body data-intent="${esc(intent.slug)}">
<header><div class="shell"><a class="brand" href="/">Memories: <em>My Story</em></a><a href="/">Start a Living Memory</a></div></header>
<main class="shell">
  <section class="hero">
    <div>
      <p class="eyebrow">Free ${esc(intent.intent)} starter</p>
      <h1>${esc(intent.headline)}</h1>
      <p class="lede">${esc(intent.description)}</p>
      <p class="promise">The question generator helps someone remember. It does not know your family's facts, and it never turns generated guidance into human testimony.</p>
    </div>
    <section class="card" aria-labelledby="starter-title">
      <p class="eyebrow">Legacy Story Starter</p>
      <h2 id="starter-title">Generate questions now.</h2>
      <form id="starter-form">
        <label for="language">Language</label>
        <select id="language" name="language"><option value="en">English</option><option value="es">Español</option></select>
        <label for="time">How much time do you have?</label>
        <select id="time" name="time"><option value="10">About 10 minutes</option><option value="20" selected>About 20 minutes</option><option value="30">30 minutes or more</option></select>
        <button id="generate-button" type="submit">Generate my questions</button>
      </form>
      <p id="status" class="status" role="status" aria-live="polite"></p>
      <section id="result" class="result" aria-live="polite">
        <p class="eyebrow">Start here</p>
        <p id="opening" class="opening"></p>
        <h3>Questions</h3><ol id="questions" class="questions"></ol>
        <div id="photo-block"><h3>Photo prompts</h3><ul id="photo-prompts" class="questions"></ul></div>
        <p id="capture-tip" class="capture-tip"></p>
        <p><a id="start-link" class="button" href="/">Start a Living Memory</a></p>
        <p class="privacy">This public utility only generates prompts. It does not read or create a private Memory Story, inspect a photograph, record a voice, search an archive, bind identity, or share anything.</p>
      </section>
    </section>
  </section>
  <section class="content-grid">
    <article><h2>Questions you can start with</h2><ul>${intent.sampleQuestions.map(question => `<li>${esc(question)}</li>`).join("")}</ul></article>
    <article><h2>One question at a time</h2><p>Ask gently. Leave room for pauses. Accept “I don't remember.” A useful family conversation is not an interrogation, and different people can remember the same event differently.</p></article>
    <article><h2>Keep the real voice</h2><p>When the person is ready, Memories: My Story is designed to keep the photograph together with the authentic human voice and story that give it meaning.</p></article>
    <article><h2>No invented family history</h2><p>Muse and the public Story Starter may suggest questions, organize, or help someone remember. They do not invent names, places, dates, relationships, motives, or memories.</p></article>
  </section>
</main>
<footer><div class="shell"><strong>Memories: My Story</strong><div class="machine"><a href="/${esc(intent.slug)}.md">Markdown version</a><a href="/llms.txt">llms.txt</a><a href="/openapi.json">OpenAPI</a><a href="/agent/privacy.md">Agent privacy</a></div></div></footer>
<script>
(() => {
  const INTENT = ${JSON.stringify(intent.slug)};
  const RELATIONSHIP = ${JSON.stringify(intent.relationship)};
  const THEMES = ${JSON.stringify(intent.themes)};
  const form = document.getElementById('starter-form');
  const button = document.getElementById('generate-button');
  const status = document.getElementById('status');
  const result = document.getElementById('result');
  function source() {
    const params = new URLSearchParams(location.search);
    return (params.get('source') || params.get('utm_source') || 'organic').slice(0,28).replace(/[^a-z0-9_-]/gi,'-');
  }
  function setBusy(busy, message) { button.disabled = busy; status.textContent = message || ''; }
  function fillList(id, items) {
    const list = document.getElementById(id); list.replaceChildren();
    for (const item of items || []) { const li = document.createElement('li'); li.textContent = item; list.appendChild(li); }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    setBusy(true, 'Creating a gentle Story Starter…');
    result.classList.remove('active');
    try {
      const response = await fetch('/api/v1/legacy-story-starter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Agent-Client': ('web-intent:' + INTENT).slice(0,80) },
        body: JSON.stringify({
          relationship: RELATIONSHIP,
          themes: THEMES,
          language: String(data.get('language') || 'en'),
          time_available_minutes: Number(data.get('time') || 20),
          prompt_count: Number(data.get('time') || 20) <= 10 ? 5 : Number(data.get('time') || 20) <= 20 ? 8 : 10,
          agent: { client: ('web-intent:' + INTENT + ':' + source()).slice(0,80), protocol: 'search' }
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'The Story Starter is unavailable right now.');
      document.getElementById('opening').textContent = body.opening_question || '';
      fillList('questions', body.questions);
      fillList('photo-prompts', body.photo_prompts);
      document.getElementById('capture-tip').textContent = body.capture_tip || '';
      const link = document.getElementById('start-link');
      try {
        const start = new URL(body.start_living_memory_url, location.origin);
        if (start.origin !== location.origin) throw new Error('Unexpected start URL');
        link.href = start.pathname + start.search + start.hash;
      } catch { link.href = '/'; }
      result.classList.add('active');
      setBusy(false, 'Your Story Starter is ready.');
      result.scrollIntoView({ behavior:'smooth', block:'start' });
    } catch (error) {
      setBusy(false, error instanceof Error ? error.message : 'The Story Starter is unavailable right now.');
    }
  });
  if ((navigator.language || '').toLowerCase().startsWith('es')) document.getElementById('language').value = 'es';
})();
</script>
</body>
</html>`;
}

async function writeFile(relativePath, content) {
  const target = path.join(DIST, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}

const intents = JSON.parse(await fs.readFile(INTENTS_PATH, "utf8"));
if (!Array.isArray(intents) || intents.length !== 10) throw new Error("Memories functional discovery catalog must contain exactly 10 intents.");
if (new Set(intents.map(intent => intent.slug)).size !== intents.length) throw new Error("Memories functional discovery slugs must be unique.");

for (const intent of intents) {
  await writeFile(path.join(intent.slug, "index.html"), renderPage(intent));
  await writeFile(`${intent.slug}.md`, renderMarkdown(intent));
}
await writeFile("discovery-manifest.json", JSON.stringify({
  schemaVersion: "memories-functional-discovery-v1",
  generatedAt: new Date().toISOString(),
  product: "Memories: My Story",
  defaultAction: "Generate a public Legacy Story Starter, then hand the human into the ordinary Living Memory flow",
  privacyBoundary: "No private archive, photo, voice, transcript, family graph, identity or share-token access",
  intents: intents.map(intent => ({
    slug: intent.slug,
    intent: intent.intent,
    path: `/${intent.slug}`,
    markdownPath: `/${intent.slug}.md`,
    storyStudioPathTemplate: `/${intent.slug}?source=story-studio&campaign=functional-discovery-01&platform={platform}&creative_id={creative_id}`
  }))
}, null, 2));

console.log(`Generated ${intents.length} Memories functional discovery utilities.`);
