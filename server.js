import express from "express";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
app.use(express.json());

// 🔒 ต้องตรงกับ SECRET_KEY ใน Roblox Script
const SECRET_KEY = "MySecretKey123";

// 🧠 สร้างการเชื่อมต่อ PostgreSQL
// Render จะใส่ DATABASE_URL ให้อัตโนมัติจาก Environment Variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ✅ สร้างตารางถ้ายังไม่มี (อัตโนมัติ)
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bank_data (
      user_id BIGINT PRIMARY KEY,
      bank INT DEFAULT 0
    );
  `);
}
ensureTable();

// 📤 Save ข้อมูลจาก Roblox
app.post("/save", async (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${SECRET_KEY}`) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { userId, bank } = req.body;
  if (!userId || bank == null) {
    return res.status(400).json({ error: "Missing data" });
  }

  try {
    await pool.query(
      `INSERT INTO bank_data (user_id, bank)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET bank = EXCLUDED.bank;`,
      [userId, bank]
    );
    console.log(`[SAVE] ${userId} = ${bank}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[DB ERROR]", err);
    res.status(500).json({ error: "Database error" });
  }
});

// 📥 โหลดข้อมูลของผู้เล่น
app.get("/load/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const result = await pool.query(
      "SELECT bank FROM bank_data WHERE user_id=$1",
      [userId]
    );

    if (result.rows.length > 0) {
      res.json({ bank: result.rows[0].bank });
    } else {
      res.json({ bank: 0 });
    }
  } catch (err) {
    console.error("[DB ERROR]", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ หน้าแสดงผลหลัก (ทดสอบ)
app.get("/", (req, res) => {
  res.send("✅ Roblox Render Server (with PostgreSQL) is running!");
});

// 🚀 เริ่มเซิร์ฟเวอร์
app.listen(3000, () => console.log("✅ Server running on port 3000"));
