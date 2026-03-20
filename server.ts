import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, "db.json");

const PRESET_USERS: Record<string, { password: string, role: string }> = {
  "mama": { password: "123456", role: "妈妈" },
  "baba": { password: "123456", role: "爸爸" },
  "nainai": { password: "123456", role: "奶奶" },
  "yeye": { password: "123456", role: "爷爷" },
  "waipo": { password: "123456", role: "外婆" },
  "waigong": { password: "123456", role: "外公" },
  "yuesao": { password: "123456", role: "月嫂" }
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(cors());

  // 初始化数据库文件
  if (!fs.existsSync(DB_FILE)) {
    const initialDB = { 
      users: { ...PRESET_USERS }, 
      profiles: {}, 
      sharedData: {
        babyName: "宝宝",
        babyBirthday: "2025-08-07",
        babyPhoto: null,
        meals: [
          { id: 'm1', date: '2026-03-19', time: "07:00", type: 'milk', milkType: 'breast', milkVolume: 180, foods: [], isCompleted: true, photos: [], comments: [], generatedBy: '妈妈', completedBy: '妈妈' },
          { id: 'm2', date: '2026-03-19', time: "12:00", type: 'food', foods: [{ foodId: '1', quantity: 2 }], isCompleted: false, photos: [], comments: [], generatedBy: '妈妈' },
          { id: 'm3', date: '2026-03-19', time: "18:00", type: 'food', foods: [{ foodId: '2', quantity: 1 }], isCompleted: false, photos: [], comments: [], generatedBy: '妈妈' }
        ],
        vitamins: [
          { id: 'v1', date: '2026-03-19', type: 'D', isCompleted: true, completedBy: '妈妈' },
          { id: 'v2', date: '2026-03-19', type: 'AD', isCompleted: false }
        ],
        weightRecords: [
          { id: 'w1', date: '2026-03-01', weight: 8.2 },
          { id: 'w2', date: '2026-03-04', weight: 8.35 },
          { id: 'w3', date: '2026-03-07', weight: 8.5 },
        ],
        safeIngredients: ['1', '13', '2', '16', '6', '33', '11', '17', '3', '31', '32', '18', '7', '5', '10'],
        allergicIngredients: []
      } 
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2));
  }

  // 内存缓存
  let memoryDB: any = null;

  function readDB() {
    if (memoryDB) return memoryDB;
    try { 
      const dataStr = fs.readFileSync(DB_FILE, "utf-8");
      memoryDB = JSON.parse(dataStr || "{}");
      
      // 确保预设用户始终存在
      let changed = false;
      if (!memoryDB.users) { memoryDB.users = {}; changed = true; }
      for (const [uname, udata] of Object.entries(PRESET_USERS)) {
        if (!memoryDB.users[uname]) {
          memoryDB.users[uname] = udata;
          changed = true;
        }
      }
      if (!memoryDB.sharedData) {
        memoryDB.sharedData = {
          babyName: "宝宝",
          babyBirthday: "2025-08-07",
          babyPhoto: null,
          meals: [],
          vitamins: [],
          weightRecords: [],
          safeIngredients: [],
          allergicIngredients: []
        };
        changed = true;
      }
      if (changed) {
        writeDB(memoryDB);
      }
      return memoryDB;
    } 
    catch (e) { 
      console.error("Read DB Error:", e);
      return { users: { ...PRESET_USERS }, profiles: {}, sharedData: {} }; 
    }
  }
  function writeDB(data: any) {
    memoryDB = data;
    // 异步写入文件，不阻塞主线程
    fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), (err) => {
      if (err) console.error("Write DB Error:", err);
    });
  }

  // --- 模拟后端 API 路由 ---

  // 1. 登录/注册接口 (用户名+密码)
  app.post('/api/login', (req, res) => {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ success: false, message: "用户名和密码不能为空" });
      }

      const db = readDB();
      
      // 如果用户不存在且不是预设用户，则自动注册
      if (!db.users[username]) {
        db.users[username] = { password };
        writeDB(db);
        return res.json({ success: true, message: "注册并登录成功", isNewUser: true, role: null });
      }

      // 验证密码
      if (db.users[username].password === password) {
        const role = db.users[username].role || null;
        res.json({ success: true, message: "登录成功", isNewUser: false, role });
      } else {
        res.status(401).json({ success: false, message: "密码错误" });
      }
  });

  // 2. 保存用户资料 (针对个人或共享)
  app.post("/api/save-profile", (req, res) => {
      const { username, babyName, babyBirthday, role, babyPhoto } = req.body;
      if (!username) return res.status(400).json({ success: false, message: "用户名不能为空" });

      const db = readDB();
      
      // 如果是预设用户，更新共享数据中的宝宝信息
      if (PRESET_USERS[username]) {
        db.sharedData.babyName = babyName;
        db.sharedData.babyBirthday = babyBirthday;
        if (babyPhoto !== undefined) db.sharedData.babyPhoto = babyPhoto;
        // 同时也更新用户自己的角色（虽然预设用户角色通常固定）
        db.users[username].role = role;
      } else {
        db.profiles[username] = { babyName, babyBirthday, role, babyPhoto, updatedAt: new Date().toISOString() };
      }
      
      writeDB(db);
      res.json({ success: true, message: "资料保存成功" });
  });

  // 3. 获取用户资料
  app.get("/api/get-profile", (req, res) => {
      const { username } = req.query;
      if (!username) return res.status(400).json({ success: false, message: "用户名不能为空" });

      const db = readDB();
      
      if (PRESET_USERS[username as string]) {
        res.json({ 
          success: true, 
          profile: {
            babyName: db.sharedData.babyName,
            babyBirthday: db.sharedData.babyBirthday,
            babyPhoto: db.sharedData.babyPhoto,
            role: db.users[username as string].role
          }
        });
      } else {
        const profile = db.profiles[username as string];
        if (profile) {
            res.json({ success: true, profile });
        } else {
            res.json({ success: false, message: "未找到用户资料" });
        }
      }
  });

  // 4. 获取共享数据 (餐次、维生素、体重等)
  app.get("/api/get-shared-data", (req, res) => {
    const db = readDB();
    res.json({ success: true, data: db.sharedData });
  });

  // 5. 保存共享数据
  app.post("/api/save-shared-data", (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ success: false, message: "数据不能为空" });

    const db = readDB();
    db.sharedData = { ...db.sharedData, ...data };
    writeDB(db);
    res.json({ success: true, message: "共享数据保存成功" });
  });

  // --- Vite 中间件配置 (开发环境) ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // 生产环境静态资源服务
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(3000, '0.0.0.0', () => {
      console.log('✅ 带数据库的终极 API 已启动，坚守 3000 端口...');
  });
}

startServer();
