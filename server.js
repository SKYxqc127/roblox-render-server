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

  // ✅ เพิ่มคอลัมน์ username ถ้ายังไม่มี
  await pool.query(`ALTER TABLE player_data ADD COLUMN IF NOT EXISTS username TEXT;`);

  console.log("✅ All tables initialized successfully");
}
initTables();

//
// ========================
// 💾 Player Data System
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

    console.log(`[PLAYER DATA SAVE] ${username || "Unknown"} (${userId})`);
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
// 🧩 Debug + Admin Dashboard
// ========================
app.get("/debug/playerdata", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT user_id, username, updated_at FROM player_data ORDER BY updated_at DESC LIMIT 100;"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[DEBUG ERROR]", err);
    res.status(500).json({ error: "Database error" });
  }
});

//
// ========================
// 🖥️ Admin Dashboard Page
// ========================
app.get("/admin/playerdata", async (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="th">
  <head>
    <meta charset="UTF-8">
    <title>Roblox Player Dashboard</title>
    <style>
      body {
        background: #0f172a;
        color: white;
        font-family: 'Segoe UI', sans-serif;
        padding: 20px;
      }
      h1 {
        text-align: center;
        color: #38bdf8;
        margin-bottom: 20px;
      }
      #grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 15px;
      }
      .card {
        background: #1e293b;
        border-radius: 12px;
        padding: 15px;
        text-align: center;
        box-shadow: 0 0 10px #0ea5e9;
        transition: transform 0.2s;
      }
      .card:hover {
        transform: scale(1.05);
      }
      .avatar {
        border-radius: 50%;
        width: 100px;
        height: 100px;
        margin-bottom: 10px;
      }
      .username {
        font-size: 18px;
        color: #f1f5f9;
        margin-bottom: 5px;
      }
      .userid {
        font-size: 14px;
        color: #94a3b8;
      }
      .updated {
        font-size: 12px;
        color: #38bdf8;
        margin-top: 8px;
      }
      .refresh {
        background: #0ea5e9;
        border: none;
        padding: 10px 20px;
        color: white;
        border-radius: 8px;
        cursor: pointer;
        display: block;
        margin: 0 auto 20px auto;
        font-size: 16px;
      }
      .refresh:hover {
        background: #0284c7;
      }
    </style>
  </head>
  <body>
    <h1>👥 Roblox Player Dashboard</h1>
    <button class="refresh" onclick="loadPlayers()">🔄 Refresh Data</button>
    <div id="grid"></div>

    <script>
      async function loadPlayers() {
        const res = await fetch('/debug/playerdata');
        const players = await res.json();
        const grid = document.getElementById('grid');
        grid.innerHTML = '';

        players.forEach(p => {
          const avatarUrl = \`https://www.roblox.com/headshot-thumbnail/image?userId=\${p.user_id}&width=180&height=180&format=png\`;
          const card = document.createElement('div');
          card.className = 'card';
          card.innerHTML = \`
            <img class="avatar" src="\${avatarUrl}" alt="Avatar">
            <div class="username">\${p.username || 'Unknown'}</div>
            <div class="userid">UserID: \${p.user_id}</div>
            <div class="updated">Updated: \${new Date(p.updated_at).toLocaleString()}</div>
          \`;
          grid.appendChild(card);
        });
      }

      loadPlayers();
      setInterval(loadPlayers, 30000); // รีเฟรชทุก 30 วิ
    </script>
  </body>
  </html>
  `);
});

//
// ========================
// 🟢 Server Start
// ========================
app.get("/", (req, res) => {
  res.send("✅ Roblox Render Server with Dashboard running!");
});

app.listen(3000, () => console.log("✅ Server running on port 3000"));
