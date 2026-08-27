function text(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600"
    }
  });
}

export function handleDiscoveryRoute(request: Request): Response | null {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  const origin = url.origin;

  if (url.pathname === "/robots.txt") {
    return text(
      `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
      "text/plain; charset=utf-8"
    );
  }

  if (url.pathname === "/sitemap.xml") {
    const paths = [
      "/",
      "/llms.txt",
      "/llms-full.txt",
      "/agent/index.md",
      "/agent/capabilities.md",
      "/agent/privacy.md",
      "/agent/evidence.md",
      "/agent/examples.md"
    ];
    const urls = paths
      .map(path => `  <url><loc>${escapeXml(`${origin}${path}`)}</loc></url>`)
      .join("\n");
    return text(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      "application/xml; charset=utf-8"
    );
  }

  return null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
