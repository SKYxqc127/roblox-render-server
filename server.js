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

// ✅ สร้างตาราง + เพิ่ม column อัตโนมัติ
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
// ========================
// 💾 Save / Load Player Data
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
// 🧩 Debug API
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
// 🖥️ Admin Dashboard
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
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 15px;
      }
      .card {
        background: #1e293b;
        border-radius: 12px;
        padding: 15px;
        text-align: center;
        box-shadow: 0 0 10px #0ea5e9;
        transition: transform 0.2s;
        cursor: pointer;
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
      .inventory {
        background: #0f172a;
        margin-top: 10px;
        border-radius: 6px;
        padding: 5px;
        text-align: left;
        font-size: 13px;
        max-height: 120px;
        overflow-y: auto;
      }
      .item {
        display: flex;
        justify-content: space-between;
        color: #cbd5e1;
      }
      .popup {
        display: none;
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0,0,0,0.6);
        justify-content: center;
        align-items: center;
      }
      .popup-content {
        background: #1e293b;
        padding: 20px;
        border-radius: 12px;
        max-width: 600px;
        max-height: 80%;
        overflow-y: auto;
        box-shadow: 0 0 15px #0ea5e9;
      }
      .close-btn {
        float: right;
        cursor: pointer;
        font-weight: bold;
        color: #f87171;
      }
    </style>
  </head>
  <body>
    <h1>👥 Roblox Player Dashboard</h1>
    <div id="grid"></div>

    <div id="popup" class="popup" onclick="closePopup(event)">
      <div class="popup-content" id="popupContent"></div>
    </div>

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
              invHtml += \`<div class='item'><span>\${name}</span><span>\${val}</span></div>\`;
            }
          } else invHtml = "<i>No inventory data</i>";

          card.innerHTML = \`
            <img class="avatar" src="\${avatarUrl}" alt="Avatar">
            <div class="username">\${p.username || 'Unknown'}</div>
            <div class="userid">UserID: \${p.user_id}</div>
            <div class="updated">Updated: \${new Date(p.updated_at).toLocaleString()}</div>
            <div class="inventory">\${invHtml}</div>
          \`;

          card.onclick = () => showDetails(p);
          grid.appendChild(card);
        }
      }

      function showDetails(p) {
        const popup = document.getElementById('popup');
        const content = document.getElementById('popupContent');
        content.innerHTML = '<span class="close-btn" onclick="closePopup()">&times;</span>';
        content.innerHTML += \`<h2>\${p.username || 'Unknown'} (UserID: \${p.user_id})</h2>\`;

        if (!p.data) { content.innerHTML += '<p>No data available</p>'; popup.style.display='flex'; return; }

        for (const [section, values] of Object.entries(p.data)) {
          content.innerHTML += \`<h3>\${section}</h3><div style="margin-bottom:10px;">\`;
          if (typeof values === 'object') {
            for (const [k, v] of Object.entries(values)) {
              content.innerHTML += \`<div style="color:#94a3b8;">• \${k}: <span style="color:#f8fafc;">\${v}</span></div>\`;
            }
          } else {
            content.innerHTML += \`<div style="color:#f8fafc;">\${values}</div>\`;
          }
          content.innerHTML += '</div>';
        }
        popup.style.display = 'flex';
      }

      function closePopup(e) {
        if (!e || e.target.id === 'popup') {
          document.getElementById('popup').style.display = 'none';
        }
      }

      loadPlayers();
      setInterval(loadPlayers, 30000);
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
  res.send("✅ Roblox Render Server with Player Dashboard running!");
});

app.listen(3000, () => console.log("✅ Server running on port 3000"));
