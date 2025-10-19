import express from "express";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
app.use(express.json());

const SECRET_KEY = "MySecretKey123";

// เชื่อม PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// สร้างตารางอัตโนมัติ
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
// 🟢 Test Endpoint
// ========================
app.get("/", (req, res) => {
  res.send("✅ Roblox Render Server (Bank + Customize) running!");
});

app.listen(3000, () => console.log("✅ Server running on port 3000"));
