export function GET(req) {
  const key = req.headers.get("x-admin-key") || "";
  const ok = process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
  return new Response(JSON.stringify({ ok, msg: ok ? "Clave válida." : "Clave inválida." }), {
    status: ok ? 200 : 401,
    headers: { "Content-Type": "application/json" },
  });
}
