import express from 'express';
import cors from 'cors';
import compression from 'compression';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';

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
    user: process.env.EMAIL_USER?.trim(), // 从 .env 读取并去除空格
    pass: process.env.EMAIL_PASS?.trim()  // 从 .env 读取并去除空格
  },
  connectionTimeout: 10000, // 10秒连接超时
  greetingTimeout: 10000,   // 10秒问候超时
  socketTimeout: 15000      // 15秒读取超时
});

async function startServer() {
  const app = express();
  app.use(compression());
  app.use(express.json({ limit: '50mb' }));
  app.use(cors());

  // --- 代理配置 (解决 HTTPS 页面请求 HTTP 接口的 Mixed Content 问题) ---
  // 如果您希望前端直接请求您的阿里云服务器，可以使用这个代理
  app.use('/proxy', createProxyMiddleware({ 
    target: 'http://47.79.19.177:3000', 
    changeOrigin: true,
    pathRewrite: { '^/proxy': '' },
    on: {
      proxyReq: (proxyReq, req, res) => {
        // 可以在这里添加自定义头
      },
      error: (err, req, res) => {
        console.error('Proxy Error:', err);
        if (res && 'status' in res && typeof res.status === 'function') {
          res.status(500).send('Proxy Error');
        }
      }
    }
  }));

  // 初始化数据库文件
  if (!fs.existsSync(DB_FILE)) {
    const initialDB = { users: {}, familyMappings: {} };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2));
  }

  let memoryDB: any = null;

  function readDB() {
    if (memoryDB) return memoryDB;
    try {
      const dataStr = fs.readFileSync(DB_FILE, "utf-8");
      memoryDB = JSON.parse(dataStr || '{"users":{}, "familyMappings":{}}');
      if (!memoryDB.users) memoryDB.users = {};
      if (!memoryDB.familyMappings) memoryDB.familyMappings = {};
      return memoryDB;
    } catch (e) {
      return { users: {}, familyMappings: {} };
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
    let { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "请输入邮箱" });
    email = email.toLowerCase().trim();
    
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: "请输入有效的邮箱地址" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodes[email] = {
      code,
      expires: Date.now() + 10 * 60 * 1000 // 10分钟有效
    };

    try {
      console.log(`[AUTH] Attempting to send code to ${email}...`);
      // 如果没有配置环境变量，这里仅打印验证码（方便开发调试）
      if (!process.env.EMAIL_USER) {
        console.log(`[DEV] Verification code for ${email}: ${code}`);
        return res.json({ success: true, message: "验证码已发送 (开发模式: 见控制台)" });
      }

      console.log(`[AUTH] Using SMTP user: ${process.env.EMAIL_USER}`);
      await transporter.sendMail({
        from: `"宝宝辅食助手" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "【宝宝辅食助手】登录验证码",
        text: `亲爱的宝爸宝妈您好：\n\n您的专属登录验证码是：【 ${code} 】。\n请在10分钟内输入。`
      });
      console.log(`[AUTH] Code sent successfully to ${email}`);
      res.json({ success: true, message: "验证码已发送" });
    } catch (error) {
      console.error("Send Email Error Details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      res.status(500).json({ success: false, message: "发送失败，请稍后再试" });
    }
  });

  // 2. 登录接口 (验证码登录)
  app.post('/api/login', (req, res) => {
    let { email, code } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "参数不全" });
    email = email.toLowerCase().trim();
    
    const record = verificationCodes[email];

    if (!record || record.code !== code || record.expires < Date.now()) {
      return res.status(401).json({ success: false, message: "验证码错误或已过期" });
    }

    delete verificationCodes[email];
    const db = readDB();
    
    // 关键逻辑：判断用户身份
    const familyOwnerEmail = db.familyMappings[email] || null;
    const isPrimaryAccount = !!db.users[email];
    const isSubAccount = !!familyOwnerEmail;
    
    // 只有既不是子账号，也不是已有主账号的用户，才被视为“新用户”并初始化空间
    const isNewUser = !isPrimaryAccount && !isSubAccount;

    if (isNewUser) {
      db.users[email] = {
        profile: { babyName: "宝宝", babyBirthday: "2025-08-07" },
        members: [{ username: email, email: email, role: "爸爸", isPrimary: true }],
        meals: [],
        vitamins: [],
        weightRecords: [],
        poopRecords: [],
        sleepRecords: [],
        safeIngredients: [],
        allergicIngredients: []
      };
      writeDB(db);
    } else if (isPrimaryAccount && (!db.users[email].members || db.users[email].members.length === 0)) {
      // 为老用户兼容新字段
      db.users[email].members = [{ 
        username: email, 
        email: email, 
        role: db.users[email].profile?.role || "爸爸", 
        isPrimary: true 
      }];
      writeDB(db);
    } else if (isPrimaryAccount && db.users[email].members) {
      // 确保现有主账号成员也有 email 字段
      const primaryMember = db.users[email].members.find((m: any) => m.isPrimary);
      if (primaryMember && !primaryMember.email) {
        primaryMember.email = email;
        writeDB(db);
      }
    }

    res.json({ 
      success: true, 
      message: "登录成功", 
      email,
      familyOwnerEmail,
      isNewUser
    });
  });

  // 3. 获取用户数据 (SaaS 隔离)
  app.get('/api/get-user-data', (req, res) => {
    let { email } = req.query;
    if (!email || typeof email !== 'string') return res.status(400).json({ success: false, message: "未识别身份" });
    email = email.toLowerCase().trim();

    const db = readDB();
    const userData = db.users[email];

    if (!userData) {
      return res.status(404).json({ success: false, message: "用户不存在" });
    }

    res.json({ success: true, data: userData });
  });

  // 4. 保存用户数据 (SaaS 隔离)
  app.post('/api/save-user-data', (req, res) => {
    let { email, type, data } = req.body;
    if (!email || !type) return res.status(400).json({ success: false, message: "参数不全" });
    email = email.toLowerCase().trim();

    const db = readDB();
    if (!db.users[email]) return res.status(404).json({ success: false, message: "用户不存在" });

    // 动态更新对应字段
    db.users[email][type] = data;
    writeDB(db);

    res.json({ success: true, message: "保存成功" });
  });

  // 5. 添加家庭成员
  app.post('/api/add-member', (req, res) => {
    let { email, memberEmail, username, role, force } = req.body;
    if (!email || !memberEmail || !username || !role) return res.status(400).json({ success: false, message: "参数不全" });
    
    email = email.toLowerCase().trim();
    memberEmail = memberEmail.toLowerCase().trim();

    if (email === memberEmail) {
      return res.status(400).json({ success: false, message: "不能添加自己为子账号" });
    }

    const db = readDB();
    if (!db.users[email]) return res.status(404).json({ success: false, message: "主账号不存在" });

    if (!db.users[email].members) db.users[email].members = [{ username: email, email: email, role: "爸爸", isPrimary: true }];
    
    // 1. 优先查找是否存在该角色的子账号（排除主账号）
    let memberIndex = db.users[email].members.findIndex((m: any) => m.role === role && !m.isPrimary);
    
    // 2. 如果没找到该角色的子账号，再看该邮箱是否已经在家庭中（可能是换角色）
    if (memberIndex === -1) {
      memberIndex = db.users[email].members.findIndex((m: any) => m.email === memberEmail && !m.isPrimary);
    }

    if (memberIndex !== -1) {
      const oldEmail = db.users[email].members[memberIndex].email;
      
      // 如果新邮箱被其他家庭占用，则报错
      const isOccupiedByOtherFamily = (db.familyMappings && db.familyMappings[memberEmail] && db.familyMappings[memberEmail] !== email);
      const isPrimaryOfOtherFamily = db.users[memberEmail] && !isOccupiedByOtherFamily; // 如果它在users里但没在mappings里，说明它是主账号

      if (oldEmail !== memberEmail && (isOccupiedByOtherFamily || (isPrimaryOfOtherFamily && !force))) {
        return res.status(400).json({ 
          success: false, 
          message: isPrimaryOfOtherFamily ? "该邮箱已是其他家庭的主账号，是否强制还原为子账号？" : "该邮箱已被其他家庭占用",
          code: isPrimaryOfOtherFamily ? "PRIMARY_OCCUPIED" : "OCCUPIED"
        });
      }

      // 如果是强制还原，删除原有的主账号数据
      if (force && isPrimaryOfOtherFamily) {
        delete db.users[memberEmail];
      }

      // 更新成员信息
      db.users[email].members[memberIndex].username = username;
      db.users[email].members[memberIndex].email = memberEmail;
      db.users[email].members[memberIndex].role = role; // 确保角色也更新

      // 更新家庭映射关系
      if (!db.familyMappings) db.familyMappings = {};
      if (oldEmail) delete db.familyMappings[oldEmail];
      db.familyMappings[memberEmail] = email;
    } else {
      // 检查新邮箱是否被其他家庭占用
      const isOccupiedByOtherFamily = (db.familyMappings && db.familyMappings[memberEmail] && db.familyMappings[memberEmail] !== email);
      const isPrimaryOfOtherFamily = db.users[memberEmail] && (!db.familyMappings || !db.familyMappings[memberEmail]);

      if (isOccupiedByOtherFamily || (isPrimaryOfOtherFamily && !force)) {
        return res.status(400).json({ 
          success: false, 
          message: isPrimaryOfOtherFamily ? "该邮箱已是其他家庭的主账号，是否强制还原为子账号？" : "该邮箱已被其他家庭占用",
          code: isPrimaryOfOtherFamily ? "PRIMARY_OCCUPIED" : "OCCUPIED"
        });
      }

      // 如果是强制还原，删除原有的主账号数据
      if (force && isPrimaryOfOtherFamily) {
        delete db.users[memberEmail];
      }

      // 添加到主账号的成员列表
      db.users[email].members.push({ username, email: memberEmail, role, isPrimary: false });
      
      // 建立家庭映射关系
      if (!db.familyMappings) db.familyMappings = {};
      db.familyMappings[memberEmail] = email;
    }
    
    writeDB(db);
    res.json({ success: true, message: "操作成功", members: db.users[email].members });
  });

  // 7. 修改家庭成员信息 (支持更新邮箱、用户名和角色)
  app.post('/api/update-member', (req, res) => {
    let { email, oldMemberEmail, newMemberEmail, newUsername, newRole, force } = req.body;
    if (!email || !oldMemberEmail) return res.status(400).json({ success: false, message: "参数不全" });

    email = email.toLowerCase().trim();
    oldMemberEmail = oldMemberEmail.toLowerCase().trim();
    if (newMemberEmail) newMemberEmail = newMemberEmail.toLowerCase().trim();

    const db = readDB();
    if (!db.users[email]) return res.status(404).json({ success: false, message: "主账号不存在" });

    if (!db.users[email].members) {
      db.users[email].members = [{ username: email, email: email, role: "爸爸", isPrimary: true }];
    }

    // 找到成员
    const memberIndex = db.users[email].members.findIndex((m: any) => (m.email || m.username) === oldMemberEmail);
    if (memberIndex === -1) return res.status(404).json({ success: false, message: "成员不存在" });

    const member = db.users[email].members[memberIndex];

    // 如果更新邮箱
    if (newMemberEmail && newMemberEmail !== oldMemberEmail) {
      // 检查新邮箱是否已被占用
      const isOccupiedByOtherFamily = (db.familyMappings && db.familyMappings[newMemberEmail] && db.familyMappings[newMemberEmail] !== email);
      const isPrimaryOfOtherFamily = db.users[newMemberEmail] && (!db.familyMappings || !db.familyMappings[newMemberEmail]);

      if (isOccupiedByOtherFamily || (isPrimaryOfOtherFamily && !force)) {
        return res.status(400).json({ 
          success: false, 
          message: isPrimaryOfOtherFamily ? "该邮箱已是其他家庭的主账号，是否强制还原为子账号？" : "新邮箱已被其他家庭占用",
          code: isPrimaryOfOtherFamily ? "PRIMARY_OCCUPIED" : "OCCUPIED"
        });
      }
      
      // 主账号的登录邮箱不可修改（因为它是主键）
      if (member.isPrimary) {
        return res.status(400).json({ success: false, message: "主账号登录邮箱不可修改" });
      }

      // 如果是强制还原，删除原有的主账号数据
      if (force && isPrimaryOfOtherFamily) {
        delete db.users[newMemberEmail];
      }

      member.email = newMemberEmail;
      // 更新家庭映射关系
      if (!db.familyMappings) db.familyMappings = {};
      delete db.familyMappings[oldMemberEmail];
      db.familyMappings[newMemberEmail] = email;
    }

    // 如果更新角色
    if (newRole && newRole !== member.role) {
      // 检查新角色是否已在家庭中存在
      const roleExists = db.users[email].members.find((m: any) => m.role === newRole);
      if (roleExists) return res.status(400).json({ success: false, message: "该角色在家庭中已存在" });
      member.role = newRole;
    }

    // 如果更新用户名
    if (newUsername) {
      member.username = newUsername;
    }

    writeDB(db);
    res.json({ success: true, message: "修改成功", members: db.users[email].members });
  });

  // 8. 数据导入 (用于同步老数据)
  app.post('/api/import-data', (req, res) => {
    const { email, oldData } = req.body;
    if (!email || !oldData) return res.status(400).json({ success: false, message: "参数不全" });

    const db = readDB();
    if (!db.users[email]) {
      // 如果用户不存在，先初始化
      db.users[email] = {
        profile: { babyName: "宝宝", babyBirthday: "2025-08-07" },
        members: [{ username: email, role: "爸爸", isPrimary: true }],
        meals: [],
        vitamins: [],
        weightRecords: [],
        poopRecords: [],
        sleepRecords: [],
        safeIngredients: [],
        allergicIngredients: []
      };
    }

    // 合并数据 (去重)
    const merge = (newList: any[], oldList: any[]) => {
      if (!oldList || !Array.isArray(oldList)) return newList;
      const existingIds = new Set(newList.map(item => item.id));
      const filteredOld = oldList.filter(item => !existingIds.has(item.id));
      return [...newList, ...filteredOld];
    };

    const user = db.users[email];
    user.meals = merge(user.meals || [], oldData.meals);
    user.vitamins = merge(user.vitamins || [], oldData.vitamins);
    user.weightRecords = merge(user.weightRecords || [], oldData.weightRecords);
    user.poopRecords = merge(user.poopRecords || [], oldData.poopRecords);
    user.sleepRecords = merge(user.sleepRecords || [], oldData.sleepRecords);
    user.safeIngredients = Array.from(new Set([...(user.safeIngredients || []), ...(oldData.safeIngredients || [])]));
    user.allergicIngredients = Array.from(new Set([...(user.allergicIngredients || []), ...(oldData.allergicIngredients || [])]));

    writeDB(db);
    res.json({ success: true, message: "数据同步成功", data: user });
  });

  // 7. 数据导出 (备份)
  app.get('/api/export-data', (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: "未识别身份" });

    const db = readDB();
    const userData = db.users[email as string];
    if (!userData) return res.status(404).json({ success: false, message: "用户不存在" });

    res.json({ success: true, data: userData });
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
