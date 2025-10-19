import express from "express";
import pkg from "pg";
import cookieParser from "cookie-parser";
const { Pool } = pkg;

const app = express();
app.use(express.json());
app.use(cookieParser());

const SECRET_KEY = "MySecretKey123"; // ใช้ฝั่ง Roblox
const ADMIN_PASSWORD = "FujiTownAdmin123"; // ✅ รหัสผ่านสำหรับเข้า Dashboard
const ADMIN_TOKEN = "FujiToken@2025"; // Token สำหรับ cookie

// ✅ PostgreSQL Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ Auto-create Table
async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS player_data (
      user_id BIGINT PRIMARY KEY,
      username TEXT,
      data JSONB,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("✅ player_data table ready!");
}
initTables();

//
// ==========================
// 💾 API สำหรับ Roblox
// ==========================
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
// ==========================
// 🔐 ระบบล็อกอินแอดมิน
// ==========================
app.get("/login", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="th">
  <head>
    <meta charset="UTF-8">
    <title>Admin Login</title>
    <style>
      body {
        background: #0f172a;
        color: white;
        font-family: 'Segoe UI', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
      }
      .box {
        background: #1e293b;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 0 15px #0ea5e9;
        text-align: center;
      }
      input {
        padding: 10px;
        width: 200px;
        border-radius: 8px;
        border: none;
        outline: none;
        margin-top: 10px;
      }
      button {
        background: #0ea5e9;
        border: none;
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        margin-top: 15px;
      }
      button:hover { background: #0284c7; }
      .error { color: #f87171; margin-top: 10px; }
    </style>
  </head>
  <body>
    <div class="box">
      <h2>🔐 Admin Login</h2>
      <input id="password" type="password" placeholder="Enter Admin Password"><br>
      <button onclick="login()">Login</button>
      <div class="error" id="error"></div>
    </div>
    <script>
      async function login() {
        const password = document.getElementById('password').value;
        const res = await fetch('/admin/login', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (data.ok) window.location.href = '/admin/playerdata';
        else document.getElementById('error').textContent = '❌ Password incorrect';
      }
    </script>
  </body>
  </html>
  `);
});

app.post("/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.cookie("admin_token", ADMIN_TOKEN, { httpOnly: true });
    return res.json({ ok: true });
  }
  return res.json({ ok: false });
});

function requireAdmin(req, res, next) {
  const token = req.cookies.admin_token;
  if (token === ADMIN_TOKEN) next();
  else res.redirect("/login");
}

//
// ==========================
// 🧭 Dashboard แสดงรูปและชื่อไทย
// ==========================
app.get("/admin/playerdata", requireAdmin, async (req, res) => {
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
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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
      .card:hover { transform: scale(1.03); }
      .avatar {
        border-radius: 50%;
        width: 100px;
        height: 100px;
        margin-bottom: 10px;
        border: 2px solid #38bdf8;
      }
      .username { font-size: 18px; color: #f1f5f9; margin-bottom: 5px; }
      .userid { font-size: 14px; color: #94a3b8; }
      .updated { font-size: 12px; color: #38bdf8; margin-top: 8px; }
      .inventory {
        background: #0f172a;
        margin-top: 10px;
        border-radius: 8px;
        padding: 8px;
        text-align: left;
        font-size: 13px;
        max-height: 160px;
        overflow-y: auto;
      }
      .item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 4px 0;
        color: #cbd5e1;
      }
      .item img {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        margin-right: 6px;
      }
      .item span { flex: 1; }
      .logout {
        position: fixed;
        top: 15px;
        right: 20px;
        background: #ef4444;
        border: none;
        color: white;
        padding: 8px 14px;
        border-radius: 6px;
        cursor: pointer;
      }
      .logout:hover { background: #dc2626; }
    </style>
  </head>
  <body>
    <button class="logout" onclick="logout()">Logout</button>
    <h1>👥 Roblox Player Dashboard</h1>
    <div id="grid"></div>

    <script type="module">
      import { Settings } from '/settings.js';
      window.Settings = Settings;
    </script>

    <script>
      async function loadPlayers() {
        const res = await fetch('/debug/playerdata');
        const players = await res.json();
        const grid = document.getElementById('grid');
        grid.innerHTML = '';

        for (const p of players) {
          const avatarUrl = \`https://www.roblox.com/headshot-thumbnail/image?userId=\${p.user_id}&width=180&height=180&format=png\`;
          const card = document.createElement('div');
          card.className = 'card';

          let invHtml = "";
          if (p.data && p.data.Inventory) {
            for (const [name, val] of Object.entries(p.data.Inventory)) {
              const item = window.Settings?.[name];
              const img = item?.Image
                ? item.Image.replace("rbxassetid://", "https://www.roblox.com/asset-thumbnail/image?assetId=")
                : "https://upload.wikimedia.org/wikipedia/commons/8/89/HD_transparent_picture.png";
              const displayName = item?.ThaiName || name;

              invHtml += \`
              <div class='item'>
                <img src="\${img}">
                <span>\${displayName}</span>
                <b>x\${val}</b>
              </div>\`;
            }
          } else invHtml = "<i style='color:#64748b'>No inventory data</i>";

          card.innerHTML = \`
            <img class="avatar" src="\${avatarUrl}">
            <div class="username">\${p.username || 'Unknown'}</div>
            <div class="userid">UserID: \${p.user_id}</div>
            <div class="updated">Updated: \${new Date(p.updated_at).toLocaleString()}</div>
            <div class="inventory">\${invHtml}</div>
          \`;

          grid.appendChild(card);
        }
      }

      function logout() {
        document.cookie = "admin_token=; Max-Age=0";
        window.location.href = "/login";
      }

      loadPlayers();
      setInterval(loadPlayers, 30000);
    </script>
  </body>
  </html>
  `);
});

//
// ==========================
// 🟢 Server Start
// ==========================
app.get("/", (req, res) => res.redirect("/login"));
app.listen(3000, () => console.log("✅ Server running with full Admin Dashboard on port 3000"));
