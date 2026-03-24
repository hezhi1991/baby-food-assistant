import express from 'express';
import cors from 'cors';
import compression from 'compression';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// 强制加载 .env 配置文件
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, "db.json");

// 邮箱正则校验
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// 临时存储验证码 (生产环境建议用 Redis)
const verificationCodes: Record<string, { code: string, expires: number }> = {};

// Nodemailer 配置 (使用网易 Yeah 邮箱专业配置)
const transporter = nodemailer.createTransport({
  host: 'smtp.yeah.net',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER, // 从 .env 读取
    pass: process.env.EMAIL_PASS  // 从 .env 读取
  }
});

async function startServer() {
  const app = express();
  app.use(compression());
  app.use(express.json({ limit: '50mb' }));
  app.use(cors());

  // 初始化数据库文件
  if (!fs.existsSync(DB_FILE)) {
    const initialDB = { users: {} };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2));
  }

  let memoryDB: any = null;

  function readDB() {
    if (memoryDB) return memoryDB;
    try {
      const dataStr = fs.readFileSync(DB_FILE, "utf-8");
      memoryDB = JSON.parse(dataStr || '{"users":{}}');
      if (!memoryDB.users) memoryDB.users = {};
      return memoryDB;
    } catch (e) {
      return { users: {} };
    }
  }

  function writeDB(data: any) {
    memoryDB = data;
    fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), (err) => {
      if (err) console.error("Write DB Error:", err);
    });
  }

  // --- API 路由 ---

  // 1. 发送验证码
  app.post('/api/send-code', async (req, res) => {
    const { email } = req.body;
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: "请输入有效的邮箱地址" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodes[email] = {
      code,
      expires: Date.now() + 10 * 60 * 1000 // 10分钟有效
    };

    try {
      // 如果没有配置环境变量，这里仅打印验证码（方便开发调试）
      if (!process.env.EMAIL_USER) {
        console.log(`[DEV] Verification code for ${email}: ${code}`);
        return res.json({ success: true, message: "验证码已发送 (开发模式: 见控制台)" });
      }

      await transporter.sendMail({
        from: `"宝宝辅食助手" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "【宝宝辅食助手】登录验证码",
        text: `亲爱的宝爸宝妈您好：\n\n您的专属登录验证码是：【 ${code} 】。\n请在10分钟内输入。`
      });
      res.json({ success: true, message: "验证码已发送" });
    } catch (error) {
      console.error("Send Email Error:", error);
      res.status(500).json({ success: false, message: "发送失败，请稍后再试" });
    }
  });

  // 2. 登录接口 (验证码登录)
  app.post('/api/login', (req, res) => {
    const { email, code } = req.body;
    const record = verificationCodes[email];

    if (!record || record.code !== code || record.expires < Date.now()) {
      return res.status(401).json({ success: false, message: "验证码错误或已过期" });
    }

    delete verificationCodes[email];
    const db = readDB();
    
    // 如果是新用户，初始化空间
    if (!db.users[email]) {
      db.users[email] = {
        profile: { babyName: "宝宝", babyBirthday: "2025-08-07" },
        meals: [],
        vitamins: [],
        weightRecords: [],
        poopRecords: [],
        sleepRecords: [],
        safeIngredients: [],
        allergicIngredients: []
      };
      writeDB(db);
    }

    res.json({ success: true, message: "登录成功", email });
  });

  // 3. 获取用户数据 (SaaS 隔离)
  app.get('/api/get-user-data', (req, res) => {
    const { email } = req.query;
    if (!email || typeof email !== 'string') return res.status(400).json({ success: false, message: "未识别身份" });

    const db = readDB();
    const userData = db.users[email];

    if (!userData) {
      return res.status(404).json({ success: false, message: "用户不存在" });
    }

    res.json({ success: true, data: userData });
  });

  // 4. 保存用户数据 (SaaS 隔离)
  app.post('/api/save-user-data', (req, res) => {
    const { email, type, data } = req.body;
    if (!email || !type) return res.status(400).json({ success: false, message: "参数不全" });

    const db = readDB();
    if (!db.users[email]) return res.status(404).json({ success: false, message: "用户不存在" });

    // 动态更新对应字段
    db.users[email][type] = data;
    writeDB(db);

    res.json({ success: true, message: "保存成功" });
  });

  // --- Vite 中间件配置 ---
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
    }
  }

  const PORT = process.env.PORT || 3000;
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`✅ SaaS 服务器已启动，监听端口 ${PORT}...`);
  });
}

startServer();
