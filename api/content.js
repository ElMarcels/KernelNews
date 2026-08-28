import { sql } from "@vercel/postgres";

// Se ejecuta en el runtime de Node en Vercel (compatible con @vercel/postgres)

function isAdmin(req) {
  try {
    const key = req.headers.get("x-admin-key") || "";
    return process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
  } catch {
    return false;
  }
}

function respond(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getAll() {
  const [n, t, e] = await Promise.all([
    sql`select id, title, category, minutes, date, excerpt, content, image, featured from noticias order by created_at desc`,
    sql`select name, icon, orden from temas order by orden asc, name asc`,
    sql`select id, title, date, time, location, type, description, image, posts from eventos order by created_at desc`,
  ]);

  const noticias = n.rows.map((r) => ({ ...r, featured: !!r.featured }));
  const temas = t.rows.map((r) => ({ name: r.name, icon: r.icon || "" }));
  const eventos = e.rows.map((r) => ({
    ...r,
    posts: Array.isArray(r.posts) ? r.posts : [],
  }));

  return { noticias, temas, eventos };
}

async function doSync(body) {
  const { noticias, temas, eventos } = body;
  await sql`begin`;
  try {
    await sql`delete from noticias`;
    await sql`delete from temas`;
    await sql`delete from eventos`;

    if (Array.isArray(noticias)) {
      for (const n of noticias) {
        await sql`
          insert into noticias (title, category, minutes, date, excerpt, content, image, featured)
          values (${n.title || ""}, ${n.category || ""}, ${n.minutes || 1}, ${n.date || ""}, ${n.excerpt || ""}, ${n.content || ""}, ${n.image || ""}, ${!!n.featured})
        `;
      }
    }
    if (Array.isArray(temas)) {
      let orden = 0;
      for (const t of temas) {
        await sql`
          insert into temas (name, icon, orden)
          values (${typeof t === "string" ? t : t.name}, ${typeof t === "string" ? "" : t.icon || ""}, ${orden++})
        `;
      }
    }
    if (Array.isArray(eventos)) {
      for (const e of eventos) {
        await sql`
          insert into eventos (title, date, time, location, type, description, image, posts)
          values (${e.title || ""}, ${e.date || ""}, ${e.time || ""}, ${e.location || ""}, ${e.type || ""}, ${e.description || ""}, ${e.image || ""}, ${JSON.stringify(e.posts || [])})
        `;
      }
    }
    await sql`commit`;
  } catch (err) {
    await sql`rollback`;
    throw err;
  }
  return getAll();
}

export async function GET() {
  try {
    return respond(200, await getAll());
  } catch (e) {
    return respond(500, { error: e.message });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const action = body.action;

    if (action === "sync") {
      if (!isAdmin(req)) return respond(401, { error: "No autorizado" });
      return respond(200, await doSync(body));
    }

    return respond(400, { error: "Acción no soportada" });
  } catch (e) {
    return respond(500, { error: e.message });
  }
}
