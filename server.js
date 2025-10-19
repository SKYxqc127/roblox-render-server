import express from "express";
const app = express();
app.use(express.json());

const SECRET_KEY = "MySecretKey123"; // 🔒 เปลี่ยนเป็นคีย์ลับของคุณ

let bankData = {}; // เก็บข้อมูลในหน่วยความจำ (เริ่มต้นแบบง่าย ๆ)

app.post("/save", (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${SECRET_KEY}`) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { userId, bank } = req.body;
  if (!userId || bank == null)
    return res.status(400).json({ error: "Missing data" });

  bankData[userId] = bank;
  console.log(`[SAVE] ${userId} = ${bank}`);
  res.json({ ok: true, message: "Saved successfully" });
});

app.get("/load/:userId", (req, res) => {
  const userId = req.params.userId;
  res.json({ bank: bankData[userId] || 0 });
});

app.listen(3000, () => console.log("✅ Server running on port 3000"));
