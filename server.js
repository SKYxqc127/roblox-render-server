import express from "express";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
app.use(express.json());

const SECRET_KEY = "MySecretKey123";

// ✅ เชื่อมต่อ PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ สร้างตาราง + อัปเดต column อัตโนมัติ
async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bank_data (
      user_id BIGINT PRIMARY KEY,
      bank INT DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customize_data (
      user_id BIGINT PRIMARY KEY,
      data JSONB DEFAULT '{}'::jsonb
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS position_data (
      user_id BIGINT PRIMARY KEY,
      x FLOAT,
      y FLOAT,
      z FLOAT,
      health FLOAT DEFAULT 100
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS player_data (
      user_id BIGINT PRIMARY KEY,
      data JSONB,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // ✅ เพิ่มคอลัมน์ username หากยังไม่มี
  await pool.query(`ALTER TABLE player_data ADD COLUMN IF NOT EXISTS username TEXT;`);

  console.log("✅ All tables initialized and schema updated successfully");
}
initTables();

//
// ========================
// 💰 Bank System
// ========================
app.post("/save", async (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${SECRET_KEY}`) return res.status(403).json({ error: "Forbidden" });

  const { userId, bank } = req.body;
  if (!userId || bank == null) return res.status(400).json({ error: "Missing data" });

  try {
    await pool.query(
      `INSERT INTO bank_data (user_id, bank)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET bank = EXCLUDED.bank;`,
      [userId, bank]
    );
    console.log(`[BANK SAVE] ${userId} = ${bank}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[DB ERROR]", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/load/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    const result = await pool.query("SELECT bank FROM bank_data WHERE user_id=$1", [userId]);
    if (result.rows.length > 0) res.json({ bank: result.rows[0].bank });
    else res.json({ bank: 0 });
  } catch (err) {
    console.error("[DB ERROR]", err);
    res.status(500).json({ error: "Database error" });
  }
});

//
// ========================
// 🧍 Customize System
// ========================
app.post("/save/customize", async (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${SECRET_KEY}`) return res.status(403).json({ error: "Forbidden" });

  const { userId, customize } = req.body;
  if (!userId || !customize) return res.status(400).json({ error: "Missing data" });

  try {
    await pool.query(
      `INSERT INTO customize_data (user_id, data)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data;`,
      [userId, customize]
    );
    console.log(`[CUSTOMIZE SAVE] ${userId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[CUSTOMIZE ERROR]", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/load/customize/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    const result = await pool.query("SELECT data FROM customize_data WHERE user_id=$1", [userId]);
    if (result.rows.length > 0) res.json(result.rows[0].data);
    else res.json({});
  } catch (err) {
    console.error("[CUSTOMIZE ERROR]", err);
    res.status(500).json({ error: "Database error" });
  }
});

//
// ========================
// 📍 Player Position + Health System
// ========================
app.post("/save/position", async (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${SECRET_KEY}`)
    return res.status(403).json({ error: "Forbidden" });

  const { userId, position, health } = req.body;
  if (!userId || !position || health == null)
    return res.status(400).json({ error: "Missing data" });

  try {
    await pool.query(
      `INSERT INTO position_data (user_id, x, y, z, health)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id)
       DO UPDATE SET x=EXCLUDED.x, y=EXCLUDED.y, z=EXCLUDED.z, health=EXCLUDED.health;`,
      [userId, position.x, position.y, position.z, health]
    );

    console.log(`[POSITION SAVE] ${userId} (${position.x},${position.y},${position.z}) HP:${health}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[POSITION ERROR]", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/load/position/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    const result = await pool.query("SELECT * FROM position_data WHERE user_id=$1", [userId]);
    if (result.rows.length > 0) res.json(result.rows[0]);
    else res.json({});
  } catch (err) {
    console.error("[POSITION ERROR]", err);
    res.status(500).json({ error: "Database error" });
  }
});

//
// ========================
// 💾 Player Data System (Render + Roblox Hybrid)
// ========================
app.post("/save/playerdata", async (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${SECRET_KEY}`)
    return res.status(403).json({ error: "Forbidden" });

  const { userId, username, data } = req.body;
  if (!userId || !data)
    return res.status(400).json({ error: "Missing data" });

  try {
    await pool.query(
      `INSERT INTO player_data (user_id, username, data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET username = EXCLUDED.username, data = EXCLUDED.data, updated_at = NOW();`,
      [userId, username || "Unknown", data]
    );

    console.log(`[PLAYER DATA SAVE] ${username || "Unknown"} (${userId}) (${Object.keys(data).length} sections)`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[PLAYER DATA ERROR]", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/load/playerdata/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    const result = await pool.query("SELECT username, data FROM player_data WHERE user_id=$1", [userId]);
    if (result.rows.length > 0) res.json(result.rows[0]);
    else res.json({});
  } catch (err) {
    console.error("[PLAYER DATA LOAD ERROR]", err);
    res.status(500).json({ error: "Database error" });
  }
});

//
// ========================
// 🧩 Debug Endpoint – ดูข้อมูลผู้เล่น
// ========================
app.get("/debug/playerdata", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT user_id, username, updated_at, data FROM player_data ORDER BY updated_at DESC LIMIT 100;"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[DEBUG ERROR]", err);
    res.status(500).json({ error: "Database error" });
  }
});

//
// ========================
// 🖥️ Admin Dashboard (Web Interface)
// ========================
app.get("/admin/playerdata", async (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Player Dashboard</title>
    <style>
      body { background:#0f172a;color:white;font-family:sans-serif;padding:20px; }
      h1 { color:#38bdf8;text-align:center; }
      #grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:15px; }
      .card { background:#1e293b;border-radius:12px;padding:15px;text-align:center;cursor:pointer;transition:transform .2s; }
      .card:hover{transform:scale(1.05);}
      .avatar{border-radius:50%;width:100px;height:100px;margin-bottom:10px;}
      .username{font-size:18px;}
      .userid{color:#94a3b8;font-size:13px;}
      .updated{color:#38bdf8;font-size:12px;}
    </style>
  </head>
  <body>
    <h1>👥 Player Dashboard</h1>
    <div id="grid"></div>
    <script>
      async function load(){
        const res = await fetch('/debug/playerdata');
        const players = await res.json();
        const grid=document.getElementById('grid');
        grid.innerHTML='';
        for(const p of players){
          const card=document.createElement('div');
          card.className='card';
          const avatar=\`https://www.roblox.com/headshot-thumbnail/image?userId=\${p.user_id}&width=180&height=180&format=png\`;
          card.innerHTML=\`
            <img class="avatar" src="\${avatar}">
            <div class="username">\${p.username||'Unknown'}</div>
            <div class="userid">ID: \${p.user_id}</div>
            <div class="updated">\${new Date(p.updated_at).toLocaleString()}</div>
          \`;
          card.onclick=()=>location.href='/admin/player/'+p.user_id;
          grid.appendChild(card);
        }
      }
      load();
      setInterval(load,30000);
    </script>
  </body>
  </html>
  `);
});

//
// ========================
// 📄 Player Detail Page
// ========================
app.get("/admin/player/:userId", async (req, res) => {
  res.send(`
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>Player Detail</title>
    <style>
      body{background:#0a0f1f;color:#e2e8f0;font-family:sans-serif;padding:20px;}
      h1{color:#38bdf8;}
      .panel{background:#1e293b;border-radius:12px;padding:15px;margin-bottom:15px;}
      .row{display:flex;justify-content:space-between;color:#cbd5e1;font-size:14px;margin:4px 0;}
      .small{color:#9fb2cc;font-size:12px;}
      .avatar{border-radius:50%;width:120px;height:120px;}
    </style>
  </head>
  <body>
    <a href="/admin/playerdata" style="color:#38bdf8;">← Back</a>
    <h1 id="pname">Player Detail</h1>
    <img id="avatar" class="avatar">
    <div id="updated" class="small"></div>
    <div id="info"></div>
    <script>
      const id=location.pathname.split('/').pop();
      async function load(){
        const res=await fetch('/load/playerdata/'+id);
        if(!res.ok)return alert('Player not found');
        const p=await res.json();
        document.getElementById('avatar').src=\`https://www.roblox.com/headshot-thumbnail/image?userId=\${id}&width=180&height=180&format=png\`;
        document.getElementById('pname').textContent=(p.username||'Unknown')+' (UserID: '+id+')';
        document.getElementById('updated').textContent='Updated: '+new Date().toLocaleString();
        const d=p.data||{};
        const info=document.getElementById('info');
        info.innerHTML='';
        for(const [section,values] of Object.entries(d)){
          info.innerHTML+='<div class="panel"><b>'+section+'</b><br>'+
            Object.entries(values).map(([k,v])=>'<div class="row"><span>'+k+'</span><span>'+v+'</span></div>').join('')+'</div>';
        }
      }
      load();
    </script>
  </body>
  </html>
  `);
});

//
// ========================
// 🟢 Server Start
// ========================
app.get("/", (req, res) => res.redirect("/admin/playerdata"));

app.listen(3000, () => console.log("✅ Server running on port 3000 with dashboard!"));
