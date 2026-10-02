/** `edge`: segundos en la caché de Cloudflare · el navegador guarda como mucho 5 minutos. */
export function json(body: unknown, status = 200, edge = 0): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": edge > 0 ? `public, max-age=${Math.min(edge, 300)}, s-maxage=${edge}` : "no-store",
    },
  });
}

export function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { status: 302, headers });
}

/** Cookie solo de servidor (HttpOnly), solo por HTTPS y ligada a este dominio exacto (prefijo __Host-). */
export function cookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}
