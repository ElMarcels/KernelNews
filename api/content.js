import { Pool } from "@neondatabase/serverless";

// Conexión a la base de datos Neon. En Vercel, la variable de entorno
// se llama DATABASE_URL (o la que hayas configurado).
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

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
    pool.query(`select id, title, category, minutes, date, excerpt, content, image, featured from noticias order by created_at desc`),
    pool.query(`select name, icon, orden from temas order by orden asc, name asc`),
    pool.query(`select id, title, date, time, location, type, description, image, posts from eventos order by created_at desc`),
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
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from noticias");
    await client.query("delete from temas");
    await client.query("delete from eventos");

    if (Array.isArray(noticias)) {
      for (const n of noticias) {
        await client.query(
          `insert into noticias (title, category, minutes, date, excerpt, content, image, featured)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [n.title || "", n.category || "", n.minutes || 1, n.date || "", n.excerpt || "", n.content || "", n.image || "", !!n.featured]
        );
      }
    }
    if (Array.isArray(temas)) {
      let orden = 0;
      for (const t of temas) {
        const name = typeof t === "string" ? t : t.name;
        const icon = typeof t === "string" ? "" : t.icon || "";
        await client.query(
          `insert into temas (name, icon, orden) values ($1, $2, $3)`,
          [name, icon, orden++]
        );
      }
    }
    if (Array.isArray(eventos)) {
      for (const e of eventos) {
        await client.query(
          `insert into eventos (title, date, time, location, type, description, image, posts)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [e.title || "", e.date || "", e.time || "", e.location || "", e.type || "", e.description || "", e.image || "", JSON.stringify(e.posts || [])]
        );
      }
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
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
