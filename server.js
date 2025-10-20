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

// ✅ สร้างตาราง + เพิ่ม column timestamp ถ้ายังไม่มี
async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bank_data (
      user_id BIGINT PRIMARY KEY,
      bank INT DEFAULT 0,
      session_id TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
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
      username TEXT,
      data JSONB,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("✅ Tables initialized and schema updated successfully");
}
initTables();

//
// ========================
// 💰 Bank System (with anti-rollback)
// ========================
app.post("/save", async (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${SECRET_KEY}`)
    return res.status(403).json({ error: "Forbidden" });

  const { userId, bank, sessionId, timestamp } = req.body;
  if (!userId || bank == null)
    return res.status(400).json({ error: "Missing data" });

  const saveTime = timestamp ? new Date(timestamp * 1000) : new Date();

  try {
    const existing = await pool.query(
      "SELECT updated_at FROM bank_data WHERE user_id=$1",
      [userId]
    );

    if (existing.rows.length > 0) {
      const lastUpdated = new Date(existing.rows[0].updated_at);
      if (lastUpdated.getTime() > saveTime.getTime()) {
        console.warn(`[⏱️ OLD DATA IGNORED] ${userId} tried to save older bank data.`);
        return res.status(409).json({ error: "Older data ignored" });
      }
    }

    await pool.query(
      `INSERT INTO bank_data (user_id, bank, session_id, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id)
       DO UPDATE SET bank=EXCLUDED.bank, session_id=EXCLUDED.session_id, updated_at=EXCLUDED.updated_at;`,
      [userId, bank, sessionId || "none", saveTime]
    );

    console.log(`[BANK SAVE] ${userId} = ${bank} (${sessionId || "no-session"})`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[DB ERROR]", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/load/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    const result = await pool.query(
      "SELECT bank, updated_at FROM bank_data WHERE user_id=$1",
      [userId]
    );
    if (result.rows.length > 0) res.json(result.rows[0]);
    else res.json({ bank: 0, updated_at: null });
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
  if (auth !== `Bearer ${SECRET_KEY}`)
    return res.status(403).json({ error: "Forbidden" });

  const { userId, customize } = req.body;
  if (!userId || !customize)
    return res.status(400).json({ error: "Missing data" });

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
// 📍 Position + Health
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
// 🧩 Debug + Dashboard (เหมือนเดิม)
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

app.get("/", (req, res) => res.send("✅ Render Server with Anti-Rollback System Active!"));

app.listen(3000, () => console.log("✅ Server running on port 3000 (Anti-Rollback active)"));
