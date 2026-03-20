/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, ErrorInfo, ReactNode } from 'react';
import { 
  Baby, 
  Utensils, 
  BookOpen, 
  MessageCircle, 
  Settings,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Camera,
  MessageSquare,
  X,
  Clock,
  Bell,
  User,
  Users,
  BarChart3,
  Scale,
  History as HistoryIcon,
  TrendingUp,
  Mail,
  ShieldCheck,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line
} from 'recharts';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: undefined,
      email: undefined,
      emailVerified: undefined,
      isAnonymous: undefined,
      tenantId: undefined,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorInfo: string | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorInfo: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-5 bg-red-50 text-red-900">
          <AlertCircle className="w-16 h-16 mb-4 text-red-500" />
          <h1 className="text-2xl font-black mb-2">出错了</h1>
          <p className="text-center mb-4 opacity-70">应用程序遇到了一些问题。请尝试刷新页面。</p>
          <div className="bg-white p-4 rounded-xl border border-red-200 text-xs font-mono overflow-auto max-w-full">
            {this.state.errorInfo}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 duo-btn-orange px-8 py-3 rounded-2xl"
          >
            刷新页面
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

// --- 辅助工具 ---
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- 类型定义 ---
type Page = 'home' | 'recipes' | 'wiki' | 'ai' | 'profile' | 'meal-detail' | 'plan' | 'history';
type FamilyRole = '妈妈' | '爸爸' | '爷爷' | '奶奶' | '外公' | '外婆' | '月嫂' | '其他';
type MealType = 'milk' | 'food';

interface Comment {
  id: string;
  role: FamilyRole;
  text: string;
  time: string;
}

interface MealFood {
  foodId: string;
  quantity: number; // 单位：勺 (五谷为克)
  actualQuantity?: number; // 实际摄入：勺 (五谷为克)
  isTesting?: boolean; // 是否为本次餐次的排敏测试项
}

interface Meal {
  id: string;
  date: string;
  time: string;
  type: MealType;
  foods: MealFood[]; // 关联食材及份量
  milkType?: 'breast' | 'formula'; // 奶类：母乳或奶粉
  milkVolume?: number; // 奶量：毫升
  actualMilkVolume?: number; // 实际奶量：毫升
  isCompleted: boolean;
  photos: string[]; // base64图片
  comments: Comment[];
  generatedBy: FamilyRole; // 谁生成的计划
  completedBy?: FamilyRole; // 谁执行的打卡
}

interface VitaminRecord {
  id: string;
  date: string;
  type: 'D' | 'AD';
  isCompleted: boolean;
  completedBy?: FamilyRole;
}

interface WeightRecord {
  id: string;
  date: string;
  weight: number; // 单位：kg
}

interface Ingredient {
  id: string;
  name: string;
  category: 'vegetable' | 'fruit' | 'grain' | 'protein' | 'other';
  minAge: number;
  allergyRisk: 'low' | 'medium' | 'high';
  tips: string;
  icon: string;
}

const INITIAL_INGREDIENTS: Ingredient[] = [
  { id: '1', name: '大米', category: 'grain', minAge: 6, allergyRisk: 'low', tips: '最理想的辅食起点，易消化。', icon: '🌾' },
  { id: '2', name: '南瓜', category: 'vegetable', minAge: 6, allergyRisk: 'low', tips: '自带甜味，宝宝接受度高。', icon: '🎃' },
  { id: '3', name: '苹果', category: 'fruit', minAge: 6, allergyRisk: 'low', tips: '刮泥或蒸熟磨泥。', icon: '🍎' },
  { id: '4', name: '胡萝卜', category: 'vegetable', minAge: 6, allergyRisk: 'low', tips: '含胡萝卜素，需蒸熟。', icon: '🥕' },
  { id: '5', name: '鸡蛋黄', category: 'protein', minAge: 7, allergyRisk: 'high', tips: '从1/4个开始，观察是否过敏。', icon: '🥚' },
  { id: '6', name: '西兰花', category: 'vegetable', minAge: 7, allergyRisk: 'low', tips: '富含维生素C，去硬茎。', icon: '🥦' },
  { id: '7', name: '猪肉', category: 'protein', minAge: 7, allergyRisk: 'medium', tips: '选择里脊肉，打成肉泥。', icon: '🥩' },
  { id: '8', name: '香蕉', category: 'fruit', minAge: 6, allergyRisk: 'low', tips: '成熟香蕉直接压泥。', icon: '🍌' },
  { id: '9', name: '鳕鱼', category: 'protein', minAge: 8, allergyRisk: 'high', tips: '优质蛋白，需仔细去刺。', icon: '🐟' },
  { id: '10', name: '铁强化米粉', category: 'grain', minAge: 6, allergyRisk: 'low', tips: '含铁量高，辅食首选。', icon: '🥣' },
  { id: '11', name: '豌豆', category: 'vegetable', minAge: 7, allergyRisk: 'low', tips: '去皮磨泥，口感细腻。', icon: '🫛' },
  { id: '12', name: '猪肝', category: 'protein', minAge: 7, allergyRisk: 'medium', tips: '补铁佳品，需彻底蒸熟。', icon: '🟤' },
  { id: '13', name: '土豆', category: 'vegetable', minAge: 6, allergyRisk: 'low', tips: '淀粉丰富，口感软糯。', icon: '🥔' },
  { id: '14', name: '鸡肉', category: 'protein', minAge: 7, allergyRisk: 'low', tips: '肉质细嫩，易于消化。', icon: '🍗' },
  { id: '15', name: '山药', category: 'vegetable', minAge: 7, allergyRisk: 'low', tips: '健脾益胃，蒸熟压泥。', icon: '🍠' },
  { id: '16', name: '菠菜', category: 'vegetable', minAge: 7, allergyRisk: 'low', tips: '焯水去草酸后再磨泥。', icon: '🥬' },
  { id: '17', name: '番茄', category: 'vegetable', minAge: 7, allergyRisk: 'low', tips: '去皮去籽，酸甜开胃。', icon: '🍅' },
  { id: '18', name: '牛肉', category: 'protein', minAge: 7, allergyRisk: 'medium', tips: '补铁效果好，需打成细泥。', icon: '🥩' },
  { id: '19', name: '香菇', category: 'vegetable', minAge: 7, allergyRisk: 'medium', tips: '提鲜好帮手，切碎末。', icon: '🍄' },
  { id: '20', name: '冬瓜', category: 'vegetable', minAge: 7, allergyRisk: 'low', tips: '清热利水，蒸熟压泥。', icon: '🍈' },
  { id: '21', name: '虾仁', category: 'protein', minAge: 8, allergyRisk: 'high', tips: '优质蛋白，需去虾线。', icon: '🍤' },
  { id: '22', name: '内酯豆腐', category: 'protein', minAge: 8, allergyRisk: 'medium', tips: '口感极佳，补钙。', icon: '🧊' },
  { id: '23', name: '小米', category: 'grain', minAge: 8, allergyRisk: 'low', tips: '养胃佳品，熬粥。', icon: '🥣' },
  { id: '24', name: '三文鱼', category: 'protein', minAge: 9, allergyRisk: 'high', tips: '富含DHA，去刺。', icon: '🍣' },
  { id: '25', name: '秋葵', category: 'vegetable', minAge: 11, allergyRisk: 'low', tips: '焯水切碎，口感滑嫩。', icon: '🥒' },
  { id: '26', name: '茼蒿', category: 'vegetable', minAge: 12, allergyRisk: 'low', tips: '独特香味，焯水切碎。', icon: '🌿' },
  { id: '27', name: '鲈鱼', category: 'protein', minAge: 18, allergyRisk: 'high', tips: '清蒸最佳，去刺。', icon: '🐟' },
  { id: '28', name: '芦笋', category: 'vegetable', minAge: 18, allergyRisk: 'low', tips: '去老根，焯水。', icon: '🎋' },
  { id: '29', name: '荷兰豆', category: 'vegetable', minAge: 18, allergyRisk: 'low', tips: '去筋，焯水。', icon: '🫛' },
  { id: '30', name: '玉米', category: 'grain', minAge: 18, allergyRisk: 'low', tips: '打成浆或切碎末。', icon: '🌽' },
  { id: '31', name: '梨', category: 'fruit', minAge: 6, allergyRisk: 'low', tips: '清甜多汁，刮泥或蒸熟。', icon: '🍐' },
  { id: '32', name: '牛油果', category: 'fruit', minAge: 6, allergyRisk: 'low', tips: '富含优质脂肪，直接压泥。', icon: '🥑' },
  { id: '33', name: '芹菜', category: 'vegetable', minAge: 7, allergyRisk: 'low', tips: '去筋切碎，富含纤维。', icon: '🥬' },
];

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  // --- 状态管理 ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [loginStep, setLoginStep] = useState<'login' | 'baby-setup' | 'role'>('login');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [lastLocalChangeTime, setLastLocalChangeTime] = useState(0);
  const lastLocalChangeTimeRef = useRef(0);
  const [isEditingBabyProfile, setIsEditingBabyProfile] = useState(false);
  const isEditingBabyProfileRef = useRef(false);

  const [babyPhoto, setBabyPhoto] = useState<string | null>(null);
  const [babyName, setBabyName] = useState<string>('宝宝');
  const [babyBirthday, setBabyBirthday] = useState<string>('2025-08-07');
  const [userRole, setUserRole] = useState<FamilyRole | null>(null);

  const updateLastLocalChange = () => {
    const now = Date.now();
    lastLocalChangeTimeRef.current = now;
    setLastLocalChangeTime(now);
    // console.log("本地修改已记录:", now);
  };

  const updateIsSaving = (val: boolean) => {
    setIsSaving(val);
    isSavingRef.current = val;
  };

  const updateIsEditingBabyProfile = (val: boolean) => {
    setIsEditingBabyProfile(val);
    isEditingBabyProfileRef.current = val;
    if (val) {
      updateLastLocalChange();
    }
  };

  // --- 后端 API 调用 ---
  const fetchSharedData = async () => {
    const now = Date.now();
    const timeSinceLastChange = now - lastLocalChangeTimeRef.current;
    
    // 如果正在保存，或者正在编辑宝宝资料，或者最近 10 秒内有本地修改，跳过本次自动刷新
    if (isSavingRef.current || isEditingBabyProfileRef.current || (timeSinceLastChange < 10000)) {
      // console.log("跳过轮询刷新:", { isSaving: isSavingRef.current, isEditing: isEditingBabyProfileRef.current, timeSinceLastChange });
      return;
    }

    try {
      const response = await fetch('/api/get-shared-data', {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      const result = await response.json();
      
      // 再次检查，防止在请求期间发生了本地修改或进入编辑模式
      const nowAfter = Date.now();
      const timeSinceLastChangeAfter = nowAfter - lastLocalChangeTimeRef.current;
      if (isSavingRef.current || isEditingBabyProfileRef.current || (timeSinceLastChangeAfter < 10000)) {
        // console.log("请求后跳过更新:", { isSaving: isSavingRef.current, isEditing: isEditingBabyProfileRef.current, timeSinceLastChangeAfter });
        return;
      }

      if (result.success) {
        const data = result.data;
        setBabyName(data.babyName || '宝宝');
        setBabyBirthday(data.babyBirthday || '2025-08-07');
        setBabyPhoto(data.babyPhoto || null);
        setMeals(data.meals || []);
        setVitamins(data.vitamins || []);
        setWeightRecords(data.weightRecords || []);
        setSafeIngredients(data.safeIngredients || []);
        setAllergicIngredients(data.allergicIngredients || []);
      }
    } catch (error) {
      console.error("Failed to fetch shared data:", error);
    }
  };

  const fetchUserProfile = async (username: string) => {
    try {
      const response = await fetch(`/api/get-profile?username=${username}`);
      const result = await response.json();
      if (result.success) {
        const profile = result.profile;
        setUserRole(profile.role || null);
        if (profile.babyName) setBabyName(profile.babyName);
        if (profile.babyBirthday) setBabyBirthday(profile.babyBirthday);
        if (profile.babyPhoto) setBabyPhoto(profile.babyPhoto);
        return true;
      } else {
        // 如果没有资料，进入设置流程
        setLoginStep('baby-setup');
        return false;
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
      return false;
    }
  };

  const checkProfile = async (username: string) => {
    return await fetchUserProfile(username);
  };

  const saveSharedData = async (overrideData?: any) => {
    updateIsSaving(true); // 开启锁定
    try {
      const dataToSave = overrideData || {
        babyName,
        babyBirthday,
        babyPhoto,
        meals,
        vitamins,
        weightRecords,
        safeIngredients,
        allergicIngredients
      };
      const response = await fetch('/api/save-shared-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataToSave }),
      });
      const result = await response.json();
      if (!result.success) {
        console.error("Failed to save shared data:", result.message);
      }
    } catch (error) {
      console.error("Error saving shared data:", error);
    } finally {
      // 延迟一小会儿解锁，确保服务器数据已落盘
      setTimeout(() => updateIsSaving(false), 1000);
    }
  };

  // 初始加载检查登录状态
  useEffect(() => {
    const savedUsername = localStorage.getItem('baby_food_username');
    if (savedUsername) {
      setUid(savedUsername);
      setIsLoggedIn(true);
      fetchUserProfile(savedUsername);
      fetchSharedData();
    }
    setIsAuthReady(true);
  }, []);

  const [activePage, setActivePage] = useState<Page>('home');
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAllergyStatus, setSelectedAllergyStatus] = useState<string>('all');
  
  // 核心业务数据
  const [ingredients, setIngredients] = useState<Ingredient[]>(INITIAL_INGREDIENTS);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [vitamins, setVitamins] = useState<VitaminRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [historySelectedDate, setHistorySelectedDate] = useState<string | null>(null);
  const [historySearchDate, setHistorySearchDate] = useState<string>(getLocalDateString(new Date()));
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [planCalendarMonth, setPlanCalendarMonth] = useState<Date>(new Date());
  const [isAddingWeight, setIsAddingWeight] = useState(false);
  const [newWeight, setNewWeight] = useState<string>('');
  
  const [safeIngredients, setSafeIngredients] = useState<string[]>([]); // 已排敏食材ID
  const [allergicIngredients, setAllergicIngredients] = useState<string[]>([]); // 已过敏食材ID
  const [selectedDateForPlan, setSelectedDateForPlan] = useState<string>(getLocalDateString(new Date()));
  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [addMealStep, setAddMealStep] = useState<number>(1);
  const [newMealData, setNewMealData] = useState<{ 
    time: string, 
    type: MealType, 
    foods: MealFood[],
    milkType?: 'breast' | 'formula',
    milkVolume?: number
  }>({
    time: '12:00',
    type: 'food',
    foods: []
  });

  // --- 后端数据同步 (替代 Firestore) ---
  useEffect(() => {
    if (!isAuthReady || !uid) return;

    // 初始加载
    fetchUserProfile(uid);
    fetchSharedData();

    // 轮询同步 (简单实现实时效果)
    const interval = setInterval(() => {
      fetchSharedData();
    }, 5000);

    return () => clearInterval(interval);
  }, [isAuthReady, uid]); // 移除 isSaving 和 lastLocalChangeTime 依赖，靠 Ref 检查最新值

  // 监听数据变化并自动保存
  useEffect(() => {
    if (!isAuthReady || !isLoggedIn) return;
    
    // 如果最近 3 秒内没有本地修改，说明这是来自 fetchSharedData 的更新，不触发保存
    const now = Date.now();
    if (now - lastLocalChangeTime > 3000) return;

    const timer = setTimeout(() => {
      saveSharedData({
        babyName,
        babyBirthday,
        babyPhoto,
        meals,
        vitamins,
        weightRecords,
        safeIngredients,
        allergicIngredients
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [babyName, babyBirthday, babyPhoto, meals, vitamins, weightRecords, safeIngredients, allergicIngredients, isAuthReady, isLoggedIn]);

  const saveBabyProfile = async (data: { babyName: string, babyBirthday: string, role: FamilyRole, babyPhoto?: string | null }) => {
    if (!uid) return;
    updateLastLocalChange();
    // 更新本地状态以触发自动保存
    setBabyName(data.babyName);
    setBabyBirthday(data.babyBirthday);
    if (data.babyPhoto !== undefined) setBabyPhoto(data.babyPhoto);
    setUserRole(data.role);
    
    try {
      const response = await fetch('/api/save-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uid, ...data }),
      });
      const result = await response.json();
      if (result.success) {
        setLoginStep('login');
        updateIsEditingBabyProfile(false);
        fetchUserProfile(uid);
        fetchSharedData();
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
    }
  };

  const handleLogin = async () => {
    // 移除 Firebase 登录，改用后端登录
    setLoginStep('login');
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('baby_food_username');
      setUid(null);
      setIsLoggedIn(false);
      setActivePage('home');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);
  const [newIngredientData, setNewIngredientData] = useState<Partial<Ingredient>>({
    category: 'vegetable',
    minAge: 6,
    allergyRisk: 'low',
    icon: '🥦'
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const babyPhotoInputRef = useRef<HTMLInputElement>(null);

  // --- 动态计算宝宝信息 ---
  const calculateBabyInfo = () => {
    const birthday = new Date(babyBirthday);
    const now = new Date();
    
    let months = (now.getFullYear() - birthday.getFullYear()) * 12 + (now.getMonth() - birthday.getMonth());
    if (now.getDate() < birthday.getDate()) {
      months--;
    }
    
    const diffTime = Math.abs(now.getTime() - birthday.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let stage = "准备期";
    if (months >= 6 && months < 7) stage = "吞咽期 (6个月)";
    else if (months >= 7 && months < 9) stage = "蠕嚼期 (7-8个月)";
    else if (months >= 9 && months < 12) stage = "细嚼期 (9-11个月)";
    else if (months >= 12) stage = "咀嚼期 (12个月+)";

    return {
      name: babyName,
      age: `${months}个月${now.getDate() >= birthday.getDate() ? now.getDate() - birthday.getDate() : 30 - (birthday.getDate() - now.getDate())}天`,
      stage,
      months
    };
  };

  const babyInfo = calculateBabyInfo();

  // --- 初始化数据 ---
  useEffect(() => {
    // 移除客户端模拟数据生成，改由后端同步
  }, []);

  // --- 业务逻辑 ---
  const toggleAllergy = (foodId: string) => {
    const newAllergic = allergicIngredients.includes(foodId) 
      ? allergicIngredients.filter(id => id !== foodId) 
      : [...allergicIngredients, foodId];
    const newSafe = safeIngredients.filter(id => id !== foodId);
    
    setAllergicIngredients(newAllergic);
    setSafeIngredients(newSafe);
    updateLastLocalChange();
  };

  const toggleSafe = (foodId: string) => {
    const newSafe = safeIngredients.includes(foodId) 
      ? safeIngredients.filter(id => id !== foodId) 
      : [...safeIngredients, foodId];
    const newAllergic = allergicIngredients.filter(id => id !== foodId);

    setSafeIngredients(newSafe);
    setAllergicIngredients(newAllergic);
    updateLastLocalChange();
  };

  const toggleVitamin = (date: string, type: 'D' | 'AD') => {
    setVitamins(prev => {
      let newVitamins;
      const existing = prev.find(v => v.date === date && v.type === type);
      if (existing) {
        newVitamins = prev.map(v => v.id === existing.id ? { ...v, isCompleted: !v.isCompleted, completedBy: !v.isCompleted ? (userRole || undefined) : undefined } : v);
      } else {
        newVitamins = [...prev, {
          id: Date.now().toString(),
          date,
          type,
          isCompleted: true,
          completedBy: userRole || undefined
        }];
      }
      updateLastLocalChange();
      return newVitamins;
    });
  };

  const updateMeal = (mealId: string, updates: Partial<Meal>) => {
    setMeals(prev => {
      const newMeals = prev.map(m => {
        if (m.id === mealId) {
          const newMeal = { ...m, ...updates };
          if (updates.isCompleted === true) {
            newMeal.completedBy = userRole || undefined;
          } else if (updates.isCompleted === false) {
            newMeal.completedBy = undefined;
          }
          return newMeal;
        }
        return m;
      });
      updateLastLocalChange();
      return newMeals;
    });
  };

  const addComment = (mealId: string, text: string) => {
    if (!text.trim() || !userRole) return;
    const currentMeal = meals.find(m => m.id === mealId);
    if (!currentMeal) return;
    
    const newComment: Comment = {
      id: Date.now().toString(),
      role: userRole,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    updateMeal(mealId, { comments: [...currentMeal.comments, newComment] });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedMealId) return;
    
    const currentMeal = meals.find(m => m.id === selectedMealId);
    if (currentMeal && currentMeal.photos.length >= 3) {
      alert("每餐最多上传3张照片哦");
      return;
    }

    const file = files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      updateMeal(selectedMealId, { photos: [...(currentMeal?.photos || []), reader.result as string] });
    };
    reader.readAsDataURL(file);
  };

  const handleBabyPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setBabyPhoto(base64String);
      updateLastLocalChange();
      // 如果已经登录，立即保存到后端
      if (uid) {
        fetch('/api/save-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            username: uid, 
            babyName, 
            babyBirthday, 
            role: userRole, 
            babyPhoto: base64String 
          }),
        }).catch(err => console.error("Failed to save baby photo:", err));
      }
    };
    reader.readAsDataURL(file);
  };

  const addMeal = () => {
    let newMeals;
    if (editingMealId) {
      newMeals = meals.map(m => {
        if (m.id === editingMealId) {
          const newMeal = { 
            ...m,
            time: newMealData.time,
            type: newMealData.type,
            foods: newMealData.type === 'milk' ? [] : newMealData.foods.map(f => ({
              ...f,
              isTesting: f.isTesting ?? (!safeIngredients.includes(f.foodId) && !allergicIngredients.includes(f.foodId))
            })),
            milkType: newMealData.type === 'milk' ? newMealData.milkType : undefined,
            milkVolume: newMealData.type === 'milk' ? newMealData.milkVolume : undefined,
          };
          return newMeal;
        }
        return m;
      });
      setEditingMealId(null);
    } else {
      const newMeal: Meal = {
        id: Date.now().toString(),
        date: selectedDateForPlan,
        time: newMealData.time,
        type: newMealData.type,
        foods: newMealData.type === 'milk' ? [] : newMealData.foods.map(f => ({
          ...f,
          isTesting: f.isTesting ?? (!safeIngredients.includes(f.foodId) && !allergicIngredients.includes(f.foodId))
        })),
        milkType: newMealData.type === 'milk' ? newMealData.milkType : undefined,
        milkVolume: newMealData.type === 'milk' ? newMealData.milkVolume : undefined,
        isCompleted: false,
        photos: [],
        comments: [],
        generatedBy: userRole || '妈妈'
      };
      newMeals = [...meals, newMeal].sort((a, b) => a.time.localeCompare(b.time));
    }
    setMeals(newMeals);
    updateLastLocalChange();
    setIsAddingMeal(false);
    setAddMealStep(1);
    setNewMealData({ time: '12:00', type: 'food', foods: [] });
  };

  const addIngredient = () => {
    if (!newIngredientData.name || !newIngredientData.category) return;
    const newIng: Ingredient = {
      id: Date.now().toString(),
      name: newIngredientData.name,
      category: newIngredientData.category as any,
      minAge: newIngredientData.minAge || 6,
      allergyRisk: newIngredientData.allergyRisk as any || 'low',
      tips: newIngredientData.tips || '',
      icon: newIngredientData.icon || '🥦'
    };
    const newIngredients = [...ingredients, newIng];
    setIngredients(newIngredients);
    // 食材列表通常不共享，但如果需要共享也可以加入 saveSharedData
    setIsAddingIngredient(false);
    setNewIngredientData({
      category: 'vegetable',
      minAge: 6,
      allergyRisk: 'low',
      icon: '🥦'
    });
  };

  const deleteIngredient = (id: string) => {
    const newIngredients = ingredients.filter(i => i.id !== id);
    const newSafe = safeIngredients.filter(sid => sid !== id);
    const newAllergic = allergicIngredients.filter(aid => aid !== id);
    setIngredients(newIngredients);
    setSafeIngredients(newSafe);
    setAllergicIngredients(newAllergic);
    updateLastLocalChange();
  };

  const openEditMeal = (meal: Meal) => {
    setEditingMealId(meal.id);
    setNewMealData({
      time: meal.time,
      type: meal.type,
      foods: meal.foods,
      milkType: meal.milkType,
      milkVolume: meal.milkVolume
    });
    setAddMealStep(1);
    setIsAddingMeal(true);
  };

  const deleteMeal = (id: string) => {
    const newMeals = meals.filter(m => m.id !== id);
    setMeals(newMeals);
    setLastLocalChangeTime(Date.now());
  };

  const addWeight = () => {
    const weightNum = parseFloat(newWeight);
    if (isNaN(weightNum) || weightNum <= 0) return;
    const today = getLocalDateString(new Date());
    setWeightRecords(prev => {
      let newRecords;
      const existing = prev.find(w => w.date === today);
      if (existing) {
        newRecords = prev.map(w => w.date === today ? { ...w, weight: weightNum } : w);
      } else {
        newRecords = [...prev, { id: Date.now().toString(), date: today, weight: weightNum }].sort((a, b) => a.date.localeCompare(b.date));
      }
      setLastLocalChangeTime(Date.now());
      return newRecords;
    });
    setIsAddingWeight(false);
    setNewWeight('');
  };

  // 提醒逻辑：查找最近一小时内的餐次
  const upcomingMeal = meals.find(m => {
    if (m.isCompleted) return false;
    const mealTime = new Date(`${m.date}T${m.time}`);
    const now = new Date();
    const diff = (mealTime.getTime() - now.getTime()) / (1000 * 60);
    return diff > 0 && diff <= 60;
  });

  // --- 历史页面渲染 ---
  const renderHistoryPage = () => {
    const today = getLocalDateString(new Date());
    
    // 准备图表数据
    const chartData = weightRecords
      .filter(w => w.date <= today)
      .map(w => ({
        date: w.date.split('-').slice(1).join('/'),
        weight: w.weight
      }));

    // 按日期分组的历史记录，且不超过今日
    let historyDates: string[] = (Array.from(new Set(meals.map(m => m.date))) as string[])
      .filter(d => d <= today)
      .sort((a, b) => (b as string).localeCompare(a as string));

    // 如果有搜索日期，且该日期不在列表中（比如当天没记录），则手动加入
    if (historySearchDate && historySearchDate <= today && !historyDates.includes(historySearchDate)) {
      historyDates = [historySearchDate, ...historyDates].sort((a, b) => (b as string).localeCompare(a as string));
    }

    // 过滤搜索结果
    const activeDate = historySearchDate || today;
    const dayMeals = meals.filter(m => m.date === activeDate);
    const dayMilk = dayMeals
      .filter(m => m.type === 'milk' && m.isCompleted)
      .reduce((sum, m) => sum + (m.actualMilkVolume || m.milkVolume || 0), 0);
    const dayFood = dayMeals
      .filter(m => m.type === 'food' && m.isCompleted)
      .reduce((sum, m) => sum + m.foods.reduce((s, f) => s + (f.actualQuantity ?? f.quantity), 0), 0);
    const dayWeight = weightRecords.find(w => w.date === activeDate)?.weight;

    // 日历逻辑
    const getDaysInMonth = (year: number, month: number) => {
      const date = new Date(year, month, 1);
      const days = [];
      while (date.getMonth() === month) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
      }
      return days;
    };

    const calendarDays = getDaysInMonth(calendarMonth.getFullYear(), calendarMonth.getMonth());
    const firstDayOfWeek = calendarDays[0].getDay();
    const paddingDays = Array(firstDayOfWeek).fill(null);

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black text-gray-800">成长记录</h2>
        </div>

        {/* 月度日历 */}
        <div className="duo-card p-5 bg-white space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-orange-500" />
              <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">
                {calendarMonth.getFullYear()}年 {calendarMonth.getMonth() + 1}月
              </h3>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4 rotate-180 text-gray-400" />
              </button>
              <button 
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {['日', '一', '二', '三', '四', '五', '六'].map(d => (
              <div key={d} className="text-center text-[10px] font-black text-gray-300 py-2">{d}</div>
            ))}
            {paddingDays.map((_, i) => <div key={`pad-${i}`} />)}
              {calendarDays.map(day => {
                const dateStr = getLocalDateString(day);
                const isToday = dateStr === today;
                const dayWeight = weightRecords.find(w => w.date === dateStr)?.weight;
                const dayMeals = meals.filter(m => m.date === dateStr && m.isCompleted);
                const dayVitamins = vitamins.filter(v => v.date === dateStr && v.isCompleted);
                const dayMilkTotal = dayMeals
                  .filter(m => m.type === 'milk')
                  .reduce((sum, m) => sum + (m.actualMilkVolume || m.milkVolume || 0), 0);
                const dayFoodTotal = dayMeals
                  .filter(m => m.type === 'food')
                  .reduce((sum, m) => sum + m.foods.reduce((s, f) => s + (f.actualQuantity ?? f.quantity), 0), 0);
                const isFuture = dateStr > today;

                return (
                  <div 
                    key={dateStr}
                    onClick={() => {
                      if (!isFuture) {
                        setHistorySearchDate(dateStr);
                        setHistorySelectedDate(dateStr);
                      }
                    }}
                    className={`relative h-20 border rounded-xl flex flex-col items-center justify-start p-1 transition-all cursor-pointer ${
                      isToday ? 'border-orange-500 bg-orange-50/30' : 'border-gray-50 hover:border-orange-200'
                    } ${isFuture ? 'opacity-30 cursor-not-allowed' : ''} ${historySearchDate === dateStr ? 'ring-2 ring-orange-500 ring-offset-1' : ''}`}
                  >
                    <span className={`text-[10px] font-black ${isToday ? 'text-orange-600' : 'text-gray-400'}`}>
                      {day.getDate()}
                    </span>
                    
                    {dayWeight && (
                      <span className="text-[8px] font-black text-orange-500 mt-0.5 leading-none">
                        {dayWeight}k
                      </span>
                    )}

                    <div className="mt-auto w-full flex flex-col items-center gap-0.5 pb-0.5">
                      {dayVitamins.length > 0 && (
                        <div className="flex gap-0.5 mb-0.5">
                          {dayVitamins.map(v => (
                            <span key={v.id} className="text-[6px] font-black text-purple-500 bg-purple-50 px-0.5 rounded leading-tight border border-purple-100">
                              {v.type}
                            </span>
                          ))}
                        </div>
                      )}
                      {dayMilkTotal > 0 && (
                        <span className="text-[7px] font-black text-blue-500 bg-blue-50 px-0.5 rounded leading-tight">
                          {dayMilkTotal}ml
                        </span>
                      )}
                      {dayFoodTotal > 0 && (
                        <span className="text-[7px] font-black text-green-500 bg-green-50 px-0.5 rounded leading-tight">
                          {(() => {
                            const g = dayMeals.filter(m => m.type === 'food').reduce((sum, m) => sum + m.foods.filter(f => ingredients.find(i => i.id === f.foodId)?.category === 'grain').reduce((s, f) => s + (f.actualQuantity ?? f.quantity), 0), 0);
                            const o = dayMeals.filter(m => m.type === 'food').reduce((sum, m) => sum + m.foods.filter(f => ingredients.find(i => i.id === f.foodId)?.category !== 'grain').reduce((s, f) => s + (f.actualQuantity ?? f.quantity), 0), 0);
                            return (g > 0 ? `${g}克` : '') + (g > 0 && o > 0 ? '+' : '') + (o > 0 ? `${o}勺` : '');
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
          
          <div className="flex justify-center gap-4 pt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-[10px] font-bold text-gray-400">已喂奶</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-[10px] font-bold text-gray-400">已辅食</span>
            </div>
          </div>
        </div>

        {/* 记录详情 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
              {activeDate} 记录详情
            </h3>
            {activeDate !== today && (
              <button 
                onClick={() => {
                  setHistorySearchDate(today);
                  setHistorySelectedDate(today);
                  setCalendarMonth(new Date());
                }}
                className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100"
              >
                回到今天
              </button>
            )}
          </div>

          <div className="duo-card bg-white overflow-hidden border-2 border-orange-100/50">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-black text-gray-800">{activeDate === today ? '今天' : activeDate}</span>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span className="text-[11px] font-black text-blue-600">奶量 {dayMilk}ml</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-green-50 px-2.5 py-1 rounded-xl border border-green-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span className="text-[11px] font-black text-green-600">辅食 {(() => {
                        const g = dayMeals.filter(m => m.type === 'food').reduce((sum, m) => sum + m.foods.filter(f => ingredients.find(i => i.id === f.foodId)?.category === 'grain').reduce((s, f) => s + (f.actualQuantity ?? f.quantity), 0), 0);
                        const o = dayMeals.filter(m => m.type === 'food').reduce((sum, m) => sum + m.foods.filter(f => ingredients.find(i => i.id === f.foodId)?.category !== 'grain').reduce((s, f) => s + (f.actualQuantity ?? f.quantity), 0), 0);
                        return (g > 0 ? `${g}克` : '') + (g > 0 && o > 0 ? '+' : '') + (o > 0 ? `${o}勺` : '') || '0';
                      })()}</span>
                    </div>
                    {dayWeight && (
                      <div className="flex items-center gap-1.5 bg-orange-50 px-2.5 py-1 rounded-xl border border-orange-100">
                        <Scale className="w-3 h-3 text-orange-400" />
                        <span className="text-[11px] font-black text-orange-600">体重 {dayWeight}kg</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t-2 border-gray-50">
                {dayMeals.length > 0 ? dayMeals.sort((a, b) => a.time.localeCompare(b.time)).map(meal => (
                  <div 
                    key={meal.id}
                    onClick={() => { setSelectedMealId(meal.id); setActivePage('meal-detail'); }}
                    className="flex items-center gap-4 p-4 bg-gray-50/50 rounded-2xl border-2 border-gray-100 hover:border-orange-200 transition-all group"
                  >
                    <div className="flex flex-col items-center w-12">
                      <span className="text-xs font-black text-gray-400">{meal.time}</span>
                      <span className="text-[9px] font-black text-gray-300">第{getMealOrder(meal.id, activeDate, meals)}餐</span>
                    </div>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm ${meal.type === 'milk' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                      {meal.type === 'milk' ? '🍼' : '🥣'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black text-gray-700 group-hover:text-orange-600 transition-colors">
                        {meal.type === 'milk' 
                          ? `${meal.milkType === 'breast' ? '母乳' : '配方奶'} (${meal.actualMilkVolume ?? meal.milkVolume}ml)`
                          : meal.foods.map(f => ingredients.find(i => i.id === f.foodId)?.name).join(' + ')}
                      </p>
                    </div>
                    {meal.isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-gray-200" />
                    )}
                  </div>
                )) : (
                  <div className="py-12 flex flex-col items-center justify-center text-gray-300">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                      <Utensils className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="text-sm font-black italic">当日没有记录哦</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </motion.div>
    );
  };

  // --- 辅助函数 ---
  const getMealOrder = (mealId: string, date: string, allMeals: Meal[]) => {
    const dayMeals = allMeals
      .filter(m => m.date === date)
      .sort((a, b) => a.time.localeCompare(b.time));
    return dayMeals.findIndex(m => m.id === mealId) + 1;
  };

  const renderTrendsPage = () => {
    // 准备体重趋势数据，包含 WHO 标准参考
    const whoStandard = [
      { month: 0, weight: 3.3 }, { month: 1, weight: 4.5 }, { month: 2, weight: 5.6 },
      { month: 3, weight: 6.4 }, { month: 4, weight: 7.0 }, { month: 5, weight: 7.5 },
      { month: 6, weight: 7.9 }, { month: 7, weight: 8.3 }, { month: 8, weight: 8.6 },
      { month: 9, weight: 8.9 }, { month: 10, weight: 9.2 }, { month: 11, weight: 9.4 },
      { month: 12, weight: 9.6 }
    ];

    const growthData = weightRecords.map(r => {
      const recordDate = new Date(r.date);
      const birthDate = new Date(); // 假设当前月龄是基于当前日期回推的
      birthDate.setMonth(birthDate.getMonth() - babyInfo.months);
      const diffTime = Math.abs(recordDate.getTime() - birthDate.getTime());
      const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
      const standard = whoStandard.find(s => s.month === diffMonths)?.weight;
      return {
        date: r.date.split('-').slice(1).join('/'),
        weight: r.weight,
        standard: standard
      };
    });

    // 排敏进度统计
    const categories = [
      { id: 'grain', label: '五谷', icon: '🌾' },
      { id: 'protein', label: '肉蛋', icon: '🍗' },
      { id: 'vegetable', label: '蔬菜', icon: '🥦' },
      { id: 'fruit', label: '水果', icon: '🍎' }
    ];

    const progressStats = categories.map(cat => {
      const total = ingredients.filter(i => i.category === cat.id).length;
      const safe = ingredients.filter(i => i.category === cat.id && safeIngredients.includes(i.id)).length;
      return { ...cat, total, safe, percent: total > 0 ? (safe / total) * 100 : 0 };
    });

    // 最近7天喂养平衡
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = getLocalDateString(d);
      const dayMeals = meals.filter(m => m.date === dateStr && m.isCompleted);
      const milk = dayMeals.filter(m => m.type === 'milk').reduce((s, m) => s + (m.actualMilkVolume || m.milkVolume || 0), 0);
      const food = dayMeals.filter(m => m.type === 'food').reduce((s, m) => s + m.foods.reduce((fs, f) => fs + (f.actualQuantity ?? f.quantity), 0), 0);
      return { date: dateStr.split('-')[2], milk, food };
    }).reverse();

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-6 pb-24">
        <header className="flex items-center justify-between">
          <h2 className="text-3xl font-black text-gray-800 tracking-tight">成长趋势</h2>
          <button 
            onClick={() => setIsAddingWeight(true)}
            className="duo-btn-orange px-4 py-2 text-xs flex items-center gap-2"
          >
            <Scale className="w-4 h-4" /> 记录体重
          </button>
        </header>

        {/* 生长曲线 */}
        <section className="duo-card p-6 bg-white space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
              <Scale className="w-4 h-4 text-orange-500" />
              体重发育曲线 (kg)
            </h3>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-[10px] font-bold text-gray-400">宝宝</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-gray-200" />
                <span className="text-[10px] font-bold text-gray-400">WHO标准</span>
              </div>
            </div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }} />
                <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 900 }} />
                <Line type="monotone" dataKey="standard" stroke="#e5e7eb" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="weight" stroke="#f97316" strokeWidth={4} dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-gray-400 font-bold text-center italic">数据参考 WHO 0-12个月男婴中位值</p>
        </section>

        {/* 排敏进度 */}
        <section className="space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">食材排敏通关进度</h3>
          <div className="grid grid-cols-2 gap-4">
            {progressStats.map(stat => (
              <div key={stat.id} className="duo-card p-4 bg-white space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-2xl">{stat.icon}</span>
                  <span className="text-[10px] font-black text-gray-400">{stat.safe}/{stat.total}</span>
                </div>
                <div>
                  <p className="text-sm font-black text-gray-700">{stat.label}</p>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full mt-2 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.percent}%` }}
                      className="h-full bg-green-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 喂养平衡 */}
        <section className="duo-card p-6 bg-white space-y-4">
          <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
            <Utensils className="w-4 h-4 text-blue-500" />
            近7日喂养平衡
          </h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }} />
                <YAxis yAxisId="left" hide />
                <YAxis yAxisId="right" orientation="right" hide />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 900 }} />
                <Bar yAxisId="left" dataKey="milk" fill="#60a5fa" radius={[4, 4, 0, 0]} name="奶量(ml)" />
                <Bar yAxisId="right" dataKey="food" fill="#4ade80" radius={[4, 4, 0, 0]} name="辅食(份)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-400" />
              <span className="text-[10px] font-black text-gray-500">奶量 (ml)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-400" />
              <span className="text-[10px] font-black text-gray-500">辅食 (份)</span>
            </div>
          </div>
        </section>
      </motion.div>
    );
  };

  const renderPage = () => {
    switch (activePage) {
      case 'home': {
        const todayStr = getLocalDateString(new Date());
        const todayMeals = meals.filter(m => m.date === todayStr);
        const totalMilk = todayMeals
          .filter(m => m.type === 'milk' && m.isCompleted)
          .reduce((sum, m) => sum + (m.actualMilkVolume || m.milkVolume || 0), 0);
        const totalMilkPlanned = todayMeals
          .filter(m => m.type === 'milk')
          .reduce((sum, m) => sum + (m.milkVolume || 0), 0);

        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-6">
            {/* 婴语提醒 */}
            {upcomingMeal && (
              <motion.div 
                initial={{ y: -20, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }}
                className="bg-[#ff9600] text-white p-5 rounded-2xl shadow-[0_4px_0_0_#e68700] flex items-center gap-4 border-2 border-[#e68700]"
              >
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Bell className="w-7 h-7 text-white animate-bounce" />
                </div>
                <div className="flex-1">
                  <p className="font-black text-lg leading-tight">“妈妈我快饿了哦！”</p>
                  <p className="text-xs font-bold opacity-90">距离下一餐 {upcomingMeal.time} 还有不到一小时</p>
                </div>
              </motion.div>
            )}

            {/* 宝宝状态 */}
            <div className="duo-card p-6 bg-white flex items-center gap-5 relative overflow-hidden">
              <div 
                onClick={() => babyPhotoInputRef.current?.click()}
                className="w-20 h-20 bg-orange-50 rounded-2xl flex items-center justify-center border-2 border-orange-200 overflow-hidden cursor-pointer relative group shadow-[0_4px_0_0_#fed7aa]"
              >
                {babyPhoto ? (
                  <img src={babyPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Baby className="text-orange-500 w-10 h-10" />
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
              <input type="file" accept="image/*" className="hidden" ref={babyPhotoInputRef} onChange={handleBabyPhotoUpload} />
              <div className="flex-1">
                <h2 className="text-2xl font-black text-gray-800 tracking-tight">{babyInfo.name}宝贝</h2>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-orange-500 font-bold text-sm">{babyInfo.age} · {babyInfo.stage}</p>
                  <div className="flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100 cursor-pointer hover:bg-orange-100 transition-colors" onClick={() => setIsAddingWeight(true)}>
                    <Scale className="w-3 h-3 text-orange-500" />
                    <span className="text-[10px] font-black text-orange-600">
                      {weightRecords.length > 0 ? `${weightRecords[weightRecords.length - 1].weight}kg` : '记录体重'}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 bg-blue-50 rounded-full overflow-hidden border border-blue-100">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (totalMilk / (totalMilkPlanned || 1)) * 100)}%` }}
                      className="h-full bg-blue-400"
                    />
                  </div>
                  <span className="text-[10px] font-black text-blue-600 whitespace-nowrap">今日奶量: {totalMilk}ml</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-green-50 rounded-full overflow-hidden border border-green-100">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (todayMeals.filter(m => m.type === 'food' && m.isCompleted).length / (todayMeals.filter(m => m.type === 'food').length || 1)) * 100)}%` }}
                      className="h-full bg-green-400"
                    />
                  </div>
                  <span className="text-[10px] font-black text-green-600 whitespace-nowrap">今日辅食: {(() => {
                    const g = todayMeals.filter(m => m.type === 'food' && m.isCompleted).reduce((sum, m) => sum + m.foods.filter(f => ingredients.find(i => i.id === f.foodId)?.category === 'grain').reduce((s, f) => s + (f.actualQuantity ?? f.quantity), 0), 0);
                    const o = todayMeals.filter(m => m.type === 'food' && m.isCompleted).reduce((sum, m) => sum + m.foods.filter(f => ingredients.find(i => i.id === f.foodId)?.category !== 'grain').reduce((s, f) => s + (f.actualQuantity ?? f.quantity), 0), 0);
                    return (g > 0 ? `${g}克` : '') + (g > 0 && o > 0 ? '+' : '') + (o > 0 ? `${o}勺` : '') || '0';
                  })()}</span>
                </div>
              </div>
            </div>

            {/* 维生素打卡 */}
            <section className="space-y-3">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">每日营养补充</h3>
              <div className="grid grid-cols-2 gap-4">
                {['D', 'AD'].map(vType => {
                  const record = vitamins.find(v => v.date === todayStr && v.type === vType);
                  const isDone = record?.isCompleted;
                  return (
                    <button 
                      key={vType}
                      onClick={() => toggleVitamin(todayStr, vType as 'D' | 'AD')}
                      className={`duo-card p-4 flex items-center gap-3 transition-all ${isDone ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}
                      style={isDone ? { borderBottomColor: '#eab308', borderBottomWidth: '4px' } : {}}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${isDone ? 'bg-yellow-400 text-white' : 'bg-yellow-100 text-yellow-600'}`}>
                        {vType === 'D' ? '☀️' : '💊'}
                      </div>
                      <div className="text-left">
                        <p className={`text-sm font-black ${isDone ? 'text-yellow-700' : 'text-gray-700'}`}>维生素 {vType}</p>
                        <p className="text-[10px] font-bold text-gray-400">{isDone ? `已由${record.completedBy}打卡` : '未打卡'}</p>
                      </div>
                      {isDone && <CheckCircle2 className="w-5 h-5 text-yellow-500 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 今日计划 */}
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black flex items-center gap-2 text-gray-800">
                  <CalendarIcon className="w-6 h-6 text-orange-500" />
                  今日计划
                </h3>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => { 
                      setSelectedDateForPlan(todayStr); 
                      setEditingMealId(null); 
                      setAddMealStep(1); 
                      setIsAddingMeal(true); 
                    }}
                    className="duo-btn-orange w-8 h-8 flex items-center justify-center p-0 rounded-lg"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className={`w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-orange-500' : 'bg-gray-200'}`} />
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                {meals.filter(m => m.date === todayStr).map(meal => (
                  <div 
                    key={meal.id} 
                    className={`duo-card p-5 flex flex-col gap-3 transition-all relative overflow-hidden ${meal.isCompleted ? 'bg-green-50/30 border-green-200 border-bottom-width-4' : 'bg-white'}`}
                    style={meal.isCompleted ? { borderBottomColor: '#46a302', borderBottomWidth: '4px' } : {}}
                  >
                    {meal.isCompleted && (
                      <div className="absolute -right-2 -top-2 w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center rotate-12">
                        <CheckCircle2 className="w-8 h-8 text-green-500/30" />
                      </div>
                    )}
                    <div className="flex items-center gap-5 relative z-10">
                      <div className="flex-1 flex items-center gap-5 cursor-pointer" onClick={() => { setSelectedMealId(meal.id); setActivePage('meal-detail'); }}>
                        <div className="flex flex-col items-center w-14">
                          <div className={`text-lg font-black ${meal.isCompleted ? 'text-green-600' : 'text-gray-800'}`}>{meal.time}</div>
                          <div className="text-[10px] font-black text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md mt-1 uppercase tracking-tighter">
                            第{getMealOrder(meal.id, todayStr, meals)}餐
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${meal.type === 'milk' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                              {meal.type === 'milk' ? '奶类' : '辅食'}
                            </span>
                            {meal.isCompleted && (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-green-500 text-white">
                                已完成
                              </span>
                            )}
                          </div>
                          <div className={`text-lg font-black flex flex-col leading-tight ${meal.isCompleted ? 'text-green-900' : 'text-gray-800'}`}>
                            <span>
                              {meal.type === 'milk' 
                                ? `${meal.milkType === 'breast' ? '母乳' : '配方奶'}`
                                : (meal.foods.length > 0 
                                    ? meal.foods.map((f, idx) => {
                                        const ing = ingredients.find(i => i.id === f.foodId);
                                        const isTesting = f.isTesting;
                                        return (
                                          <React.Fragment key={f.foodId}>
                                            {idx > 0 && ' + '}
                                            <span className={isTesting ? 'text-orange-500 bg-orange-50 px-1 rounded-md border border-orange-200' : ''}>
                                              {ing?.name || '未知食材'}
                                              {isTesting && (
                                                <span className="text-[8px] ml-0.5 align-top flex flex-col items-center inline-flex">
                                                  <span className="leading-none">测</span>
                                                  <span className="text-[6px] leading-none mt-0.5">D{f.quantity}</span>
                                                </span>
                                              )}
                                            </span>
                                          </React.Fragment>
                                        );
                                      })
                                    : '待添加食材')}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-bold opacity-40 uppercase tracking-wider">
                                {meal.type === 'milk'
                                  ? `计划 ${meal.milkVolume}ml`
                                  : meal.foods.length > 0 ? `计划 ${(() => {
                                      const g = meal.foods.filter(f => ingredients.find(i => i.id === f.foodId)?.category === 'grain').reduce((s, f) => s + f.quantity, 0);
                                      const o = meal.foods.filter(f => ingredients.find(i => i.id === f.foodId)?.category !== 'grain').reduce((s, f) => s + f.quantity, 0);
                                      return (g > 0 ? `${g}克` : '') + (g > 0 && o > 0 ? '+' : '') + (o > 0 ? `${o}勺` : '');
                                    })()}` : ''}
                              </span>
                              {meal.isCompleted && (
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                  meal.type === 'milk' 
                                    ? (meal.actualMilkVolume !== undefined && meal.actualMilkVolume < (meal.milkVolume || 0) ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600')
                                    : (meal.foods.some(f => f.actualQuantity !== undefined && f.actualQuantity < f.quantity) ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600')
                                }`}>
                                  {meal.type === 'milk'
                                    ? `实摄 ${meal.actualMilkVolume ?? meal.milkVolume}ml`
                                    : `实摄 ${(() => {
                                        const g = meal.foods.filter(f => ingredients.find(i => i.id === f.foodId)?.category === 'grain').reduce((s, f) => s + (f.actualQuantity ?? f.quantity), 0);
                                        const o = meal.foods.filter(f => ingredients.find(i => i.id === f.foodId)?.category !== 'grain').reduce((s, f) => s + (f.actualQuantity ?? f.quantity), 0);
                                        return (g > 0 ? `${g}克` : '') + (g > 0 && o > 0 ? '+' : '') + (o > 0 ? `${o}勺` : '');
                                      })()}`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className={`text-xs font-bold ${meal.isCompleted ? 'text-green-600/70' : 'text-gray-500'} flex items-center gap-3 mt-2`}>
                            <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full"><Plus className="w-3 h-3" />{meal.generatedBy}</span>
                            {meal.isCompleted && <span className="flex items-center gap-1 bg-green-100 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" />{meal.completedBy}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); openEditMeal(meal); }} 
                          className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-orange-500 transition-colors bg-gray-50 rounded-lg border-2 border-gray-100"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteMeal(meal.id); }} 
                          className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors bg-gray-50 rounded-lg border-2 border-gray-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* 首页照片展示 */}
                    {meal.photos.length > 0 && (
                      <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
                        {meal.photos.map((p, idx) => (
                          <div key={idx} className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 border-gray-100 shadow-sm">
                            <img src={p} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* 快捷工具 */}
            <div className="grid grid-cols-2 gap-5">
              <button onClick={() => setActivePage('plan')} className="duo-card p-5 flex flex-col items-center gap-3 bg-white group">
                <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-500 group-active:scale-95 transition-transform">
                  <CalendarIcon className="w-7 h-7" />
                </div>
                <span className="text-sm font-black text-gray-700">规划月食谱</span>
              </button>
              <button onClick={() => setActivePage('wiki')} className="duo-card p-5 flex flex-col items-center gap-3 bg-white group">
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-500 group-active:scale-95 transition-transform">
                  <BookOpen className="w-7 h-7" />
                </div>
                <span className="text-sm font-black text-gray-700">食材百科</span>
              </button>
            </div>
          </motion.div>
        );
      }

      case 'plan': {
        const getDaysInMonth = (year: number, month: number) => {
          const date = new Date(year, month, 1);
          const days = [];
          while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
          }
          return days;
        };

        const planCalendarDays = getDaysInMonth(planCalendarMonth.getFullYear(), planCalendarMonth.getMonth());
        const planFirstDayOfWeek = planCalendarDays[0].getDay();
        const planPaddingDays = Array(planFirstDayOfWeek).fill(null);
        const todayStr = getLocalDateString(new Date());

        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-6 pb-24">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-3xl font-black text-gray-800 tracking-tight">喂养计划</h2>
              <button 
                onClick={() => { setEditingMealId(null); setAddMealStep(1); setIsAddingMeal(true); }}
                className="duo-btn-orange w-12 h-12 flex items-center justify-center p-0"
              >
                <Plus className="w-7 h-7" />
              </button>
            </div>

            {/* 月度日历视图 */}
            <div className="duo-card p-5 bg-white space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-orange-500" />
                  <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">
                    {planCalendarMonth.getFullYear()}年 {planCalendarMonth.getMonth() + 1}月
                  </h3>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setPlanCalendarMonth(new Date(planCalendarMonth.getFullYear(), planCalendarMonth.getMonth() - 1, 1))}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180 text-gray-400" />
                  </button>
                  <button 
                    onClick={() => setPlanCalendarMonth(new Date(planCalendarMonth.getFullYear(), planCalendarMonth.getMonth() + 1, 1))}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                  <div key={d} className="text-center text-[10px] font-black text-gray-300 py-2">{d}</div>
                ))}
                {planPaddingDays.map((_, i) => <div key={`pad-${i}`} />)}
                {planCalendarDays.map(day => {
                  const dateStr = getLocalDateString(day);
                  const isActive = selectedDateForPlan === dateStr;
                  const isToday = dateStr === todayStr;
                  const dayMeals = meals.filter(m => m.date === dateStr);
                  const dayVitamins = vitamins.filter(v => v.date === dateStr);
                  const milkCount = dayMeals.filter(m => m.type === 'milk').length;
                  const foodCount = dayMeals.filter(m => m.type === 'food').length;
                  
                  const testingFoods = dayMeals
                    .flatMap(m => m.foods)
                    .filter(f => f.isTesting)
                    .map(f => ingredients.find(i => i.id === f.foodId))
                    .filter(Boolean);
                  
                  const uniqueTestingFoods = Array.from(new Set(testingFoods.map(f => f?.id)))
                    .map(id => testingFoods.find(f => f?.id === id));

                  return (
                    <div 
                      key={dateStr}
                      onClick={() => setSelectedDateForPlan(dateStr)}
                      className={`relative h-20 border rounded-xl flex flex-col items-center justify-start p-1 transition-all cursor-pointer ${
                        isActive 
                          ? 'border-orange-500 bg-orange-50/30 ring-2 ring-orange-500 ring-offset-1' 
                          : isToday ? 'border-orange-200 bg-orange-50/10' : 'border-gray-50 hover:border-orange-100'
                      }`}
                    >
                      <span className={`text-[10px] font-black ${isActive || isToday ? 'text-orange-600' : 'text-gray-400'}`}>
                        {day.getDate()}
                      </span>
                      
                      <div className="mt-auto w-full flex flex-col items-center gap-0.5 pb-0.5">
                        {uniqueTestingFoods.length > 0 && (
                          <div className="flex flex-wrap justify-center gap-0.5 mb-0.5">
                            {uniqueTestingFoods.map(f => {
                              const mealWithThisFood = dayMeals.find(m => m.foods.some(food => food.foodId === f?.id && food.isTesting));
                              const foodData = mealWithThisFood?.foods.find(food => food.foodId === f?.id && food.isTesting);
                              if (!foodData) return null;
                              return (
                                <span key={f?.id} className="text-[7px] font-black text-orange-600 bg-orange-100 px-0.5 rounded leading-tight border border-orange-200 flex flex-col items-center">
                                  <span>{f?.name}</span>
                                  <span className="text-[5px] opacity-70">Day {foodData?.quantity}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {dayVitamins.length > 0 && (
                          <div className="flex gap-0.5 mb-0.5">
                            {dayVitamins.map(v => (
                              <span key={v.id} className={`text-[6px] font-black px-1 rounded-full border ${v.isCompleted ? 'bg-purple-100 text-purple-600 border-purple-200' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                                {v.type}
                              </span>
                            ))}
                          </div>
                        )}
                        {milkCount > 0 && (
                          <span className="text-[7px] font-black text-blue-500 bg-blue-50 px-0.5 rounded leading-tight">
                            {milkCount}次奶
                          </span>
                        )}
                        {foodCount > 0 && (
                          <span className="text-[7px] font-black text-green-500 bg-green-50 px-0.5 rounded leading-tight">
                            {foodCount}餐辅
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-500" />
                  当日安排
                </h3>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-1 rounded-lg">
                  {meals.filter(m => m.date === selectedDateForPlan).length} 场餐次
                </span>
              </div>
              
              <div className="space-y-4">
                {meals.filter(m => m.date === selectedDateForPlan).map(meal => (
                  <motion.div 
                    layout
                    key={meal.id} 
                    className="duo-card p-5 flex items-center gap-5 bg-white group relative overflow-hidden"
                  >
                    {/* 时间轴装饰 */}
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gray-50 group-hover:bg-orange-100 transition-colors" />
                    
                    <div className="flex flex-col items-center justify-center w-16 h-16 bg-gray-50 rounded-2xl border-2 border-gray-100 group-hover:border-orange-200 transition-colors">
                      <span className="text-lg font-black text-gray-800">{meal.time}</span>
                      <span className="text-[10px] font-black text-gray-400 mt-0.5">第{getMealOrder(meal.id, selectedDateForPlan, meals)}餐</span>
                    </div>

                    <div className="flex-1 cursor-pointer" onClick={() => openEditMeal(meal)}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${
                          meal.type === 'milk' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                        }`}>
                          {meal.type === 'milk' ? <><div className="w-1 h-1 rounded-full bg-blue-400" /> 奶类</> : <><div className="w-1 h-1 rounded-full bg-green-400" /> 辅食</>}
                        </span>
                        <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">
                          由 {meal.generatedBy || '妈妈'}
                        </span>
                      </div>
                      <div className="font-black text-gray-800 leading-tight text-lg">
                        {meal.type === 'milk' 
                          ? `${meal.milkType === 'breast' ? '母乳' : '配方奶'} (${meal.milkVolume || 0}ml)`
                          : (meal.foods.length > 0 
                              ? meal.foods.map((f, idx) => {
                                  const ing = ingredients.find(i => i.id === f.foodId);
                                  const isTesting = f.isTesting;
                                  return (
                                    <React.Fragment key={f.foodId}>
                                      {idx > 0 && ' + '}
                                      <span className={isTesting ? 'text-orange-500 bg-orange-50 px-1 rounded-md border border-orange-200' : ''}>
                                        {ing?.name || '未知'}
                                      </span>
                                    </React.Fragment>
                                  );
                                })
                              : <span className="text-gray-300 italic">待添加食材</span>)
                        }
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {meal.isCompleted ? (
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                          <Clock className="w-5 h-5" />
                        </div>
                      )}
                      <ChevronRight className="w-5 h-5 text-gray-200" />
                    </div>
                  </motion.div>
                ))}
                
                {meals.filter(m => m.date === selectedDateForPlan).length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-10 bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-200"
                  >
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-gray-300 mb-4 shadow-sm">
                      <Plus className="w-8 h-8" />
                    </div>
                    <p className="text-gray-400 font-black text-sm mb-4">今天还没有安排餐次哦</p>
                    <button 
                      onClick={() => {
                        setNewMealData(prev => ({ ...prev, date: selectedDateForPlan }));
                        setIsAddingMeal(true);
                      }}
                      className="px-6 py-3 duo-btn-orange text-sm"
                    >
                      立即添加
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        );
      }

      case 'meal-detail':
        const meal = meals.find(m => m.id === selectedMealId);
        if (!meal) return null;
        return (
          <motion.div initial={{ x: 100 }} animate={{ x: 0 }} className="p-5 space-y-6">
            <button onClick={() => setActivePage('home')} className="flex items-center gap-2 text-gray-400 font-black text-sm uppercase tracking-wider hover:text-orange-500 transition-colors">
              <ChevronRight className="w-5 h-5 rotate-180" /> 返回计划
            </button>
            
            <div className={`duo-card p-6 space-y-6 transition-all relative overflow-hidden ${meal.isCompleted ? 'bg-green-50/30' : 'bg-white'}`}
                 style={meal.isCompleted ? { borderBottomColor: '#46a302', borderBottomWidth: '4px' } : {}}>
              {meal.isCompleted && (
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-green-500/5 rounded-full flex items-center justify-center rotate-12">
                  <CheckCircle2 className="w-16 h-16 text-green-500/10" />
                </div>
              )}
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${meal.type === 'milk' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                      {meal.type === 'milk' ? '奶类' : '辅食'}
                    </span>
                  </div>
                  <h2 className="text-3xl font-black text-gray-800 leading-tight">
                    {meal.time} {meal.type === 'milk' ? '喂奶' : '辅食餐'}
                    <span className="text-sm font-black text-orange-500 ml-2 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100">第{getMealOrder(meal.id, meal.date, meals)}餐</span>
                  </h2>
                  <div className="flex flex-col gap-1 mt-2">
                    <p className="text-gray-400 font-bold text-sm">{meal.date}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black bg-gray-100 text-gray-500 px-2 py-1 rounded-lg flex items-center gap-1">
                        <Plus className="w-3 h-3" /> {meal.generatedBy}安排
                      </span>
                      {meal.isCompleted && (
                        <span className="text-[10px] font-black bg-green-100 text-green-600 px-2 py-1 rounded-lg flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {meal.completedBy}执行
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => updateMeal(meal.id, { isCompleted: !meal.isCompleted })}
                  className={`px-6 py-3 text-sm transition-all ${meal.isCompleted ? 'duo-btn-green' : 'duo-btn-orange'}`}
                >
                  {meal.isCompleted ? '已完成' : '打卡'}
                </button>
              </div>

              <div className="space-y-3 relative z-10">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  {meal.type === 'milk' ? '奶类及奶量' : '包含食材及份量'}
                </p>
                <div className="flex flex-wrap gap-3">
                  {meal.type === 'milk' ? (
                    <div className="flex flex-col gap-3 w-full">
                      <div className="duo-card px-4 py-3 bg-blue-50/50 flex items-center gap-3 border-blue-100">
                        <span className="text-xl">🍼</span>
                        <div className="flex flex-col">
                          <span className="font-black text-blue-700">{meal.milkType === 'breast' ? '母乳' : '配方奶'}</span>
                          <span className="text-[10px] font-bold text-blue-400">计划奶量: {meal.milkVolume || 0}ml</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between bg-gray-50/50 p-4 rounded-[24px] border-2 border-gray-100">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                            <Clock className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-black text-gray-600">实际摄入量</span>
                        </div>
                        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border-2 border-blue-100 shadow-sm">
                          <button 
                            onClick={() => updateMeal(meal.id, { actualMilkVolume: Math.max(0, (meal.actualMilkVolume ?? meal.milkVolume ?? 0) - 10) })}
                            className="w-8 h-8 flex items-center justify-center text-blue-500 font-black text-xl hover:bg-blue-50 rounded-lg transition-colors"
                          >-</button>
                          <span className="text-lg font-black w-16 text-center text-blue-700">{(meal.actualMilkVolume ?? meal.milkVolume ?? 0)}ml</span>
                          <button 
                            onClick={() => updateMeal(meal.id, { actualMilkVolume: (meal.actualMilkVolume ?? meal.milkVolume ?? 0) + 10 })}
                            className="w-8 h-8 flex items-center justify-center text-blue-500 font-black text-xl hover:bg-blue-50 rounded-lg transition-colors"
                          >+</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    meal.foods.length > 0 ? meal.foods.map(f => {
                      const ing = ingredients.find(i => i.id === f.foodId);
                      const isAllergic = allergicIngredients.includes(f.foodId);
                      const isSafe = safeIngredients.includes(f.foodId);
                      return (
                        <div key={f.foodId} className={`duo-card p-4 flex flex-col gap-4 w-full ${isAllergic ? 'bg-red-50 border-red-200' : 'bg-gray-50/50 border-gray-200'}`}>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{ing?.icon || '❓'}</span>
                            <div className="flex flex-col flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-gray-700">{ing?.name || '未知食材'}</span>
                                {f.isTesting && (
                                  <span className="text-[8px] font-black bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-md border border-orange-200 uppercase tracking-widest">
                                    排敏测试中
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-gray-400">计划份量: {f.quantity} {ing?.category === 'grain' ? '克' : '勺'}</span>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={(e) => { e.stopPropagation(); toggleAllergy(f.foodId); }} className="hover:scale-110 transition-transform">
                                <AlertCircle className={`w-5 h-5 ${isAllergic ? 'fill-red-500 text-white' : 'text-gray-300'}`} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); toggleSafe(f.foodId); }} className="hover:scale-110 transition-transform">
                                <CheckCircle2 className={`w-5 h-5 ${isSafe ? 'text-green-500' : 'text-gray-300'}`} />
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between bg-white/80 p-3 rounded-2xl border border-gray-100">
                            <span className="text-xs font-black text-gray-500">实际吃了</span>
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => updateMeal(meal.id, { 
                                  foods: meal.foods.map(food => {
                                    if (food.foodId === f.foodId) {
                                      const isGrain = ing?.category === 'grain';
                                      const step = isGrain ? 2.5 : 0.5;
                                      return { ...food, actualQuantity: Math.max(0, (food.actualQuantity ?? food.quantity) - step) };
                                    }
                                    return food;
                                  }) 
                                })}
                                className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg text-gray-600 font-black"
                              >-</button>
                              <span className="text-sm font-black w-12 text-center text-gray-800">{f.actualQuantity ?? f.quantity}{ing?.category === 'grain' ? '克' : '勺'}</span>
                              <button 
                                onClick={() => updateMeal(meal.id, { 
                                  foods: meal.foods.map(food => {
                                    if (food.foodId === f.foodId) {
                                      const isGrain = ing?.category === 'grain';
                                      const step = isGrain ? 2.5 : 0.5;
                                      return { ...food, actualQuantity: (food.actualQuantity ?? food.quantity) + step };
                                    }
                                    return food;
                                  }) 
                                })}
                                className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg text-gray-600 font-black"
                              >+</button>
                            </div>
                          </div>
                        </div>
                      );
                    }) : <span className="text-gray-400 font-bold italic">待添加食材</span>
                  )}
                </div>
                {meal.foods.some(f => allergicIngredients.includes(f.foodId)) && (
                  <div className="bg-red-50 p-4 rounded-2xl flex items-start gap-3 text-red-600 text-xs border-2 border-red-100">
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <p className="font-bold leading-relaxed">警告：本餐包含{babyName}过敏的食材！请立即停止喂食并观察反应。</p>
                  </div>
                )}
              </div>

              {/* 照片墙 */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">进餐状态 ({meal.photos.length}/3)</p>
                  {meal.photos.length < 3 && (
                    <button onClick={() => fileInputRef.current?.click()} className="duo-btn-gray px-3 py-1.5 text-[10px] flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" /> 上传照片
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {meal.photos.map((p, i) => (
                    <div key={i} className="aspect-square rounded-2xl overflow-hidden bg-gray-100 relative group border-2 border-gray-100 shadow-sm">
                      <img src={p} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button 
                        onClick={() => updateMeal(meal.id, { photos: meal.photos.filter((_, idx) => idx !== i) })}
                        className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {meal.photos.length === 0 && <div className="col-span-3 py-10 border-2 border-dashed border-gray-100 rounded-[32px] flex flex-col items-center justify-center text-gray-300 text-xs gap-3 font-bold"><Camera className="w-8 h-8 opacity-20" /> 记录{babyName}吃饭的可爱瞬间</div>}
                </div>
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handlePhotoUpload} />
              </div>

              {/* 评论区 */}
              <div className="space-y-4 pt-6 border-t-2 border-gray-100">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">家庭讨论</p>
                <div className="space-y-4">
                  {meal.comments.map(c => (
                    <div key={c.id} className="flex gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-xs font-black text-orange-600 flex-shrink-0 border-2 border-orange-200">
                        {c.role[0]}
                      </div>
                      <div className="flex-1 bg-gray-50 p-3 rounded-2xl rounded-tl-none border-2 border-gray-100">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[10px] font-black text-gray-500 uppercase">{c.role}</span>
                          <span className="text-[8px] font-bold text-gray-400">{c.time}</span>
                        </div>
                        <p className="text-sm font-bold text-gray-700 leading-relaxed">{c.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-6">
                  <input 
                    type="text" 
                    placeholder={`以${userRole}身份评论...`}
                    className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3 text-sm font-bold focus:outline-none focus:border-orange-500 transition-colors"
                    onKeyDown={(e) => { if (e.key === 'Enter') { addComment(meal.id, e.currentTarget.value); e.currentTarget.value = ''; } }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 'wiki':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-gray-800 tracking-tight">食材百科</h2>
              <button 
                onClick={() => setIsAddingIngredient(true)}
                className="duo-btn-orange w-12 h-12 flex items-center justify-center p-0"
              >
                <Plus className="w-7 h-7" />
              </button>
            </div>
            
            {/* 搜索栏 */}
            <div className="relative">
              <input 
                type="text" 
                placeholder="搜索食材，如：南瓜"
                className="w-full bg-white border-2 border-gray-200 rounded-2xl px-5 py-4 pl-12 font-black focus:outline-none focus:border-orange-500 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="absolute left-4 top-4.5 text-gray-400">
                <ChevronRight className="w-6 h-6 rotate-90" />
              </div>
            </div>

            {/* 分类筛选 */}
            <div className="space-y-4">
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {[
                  { id: 'all', label: '全部种类' },
                  { id: 'vegetable', label: '蔬菜' },
                  { id: 'fruit', label: '水果' },
                  { id: 'grain', label: '五谷' },
                  { id: 'protein', label: '肉蛋' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-5 py-2 rounded-xl text-sm font-black whitespace-nowrap transition-all ${selectedCategory === cat.id ? 'duo-btn-orange' : 'duo-btn-gray text-gray-500'}`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {[
                  { id: 'all', label: '全部状态' },
                  { id: 'safe', label: '已排敏' },
                  { id: 'allergic', label: '已过敏' },
                  { id: 'untested', label: '未尝试' },
                ].map(status => (
                  <button
                    key={status.id}
                    onClick={() => setSelectedAllergyStatus(status.id)}
                    className={`px-5 py-2 rounded-xl text-sm font-black whitespace-nowrap transition-all ${selectedAllergyStatus === status.id ? 'duo-btn-green' : 'duo-btn-gray text-gray-500'}`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 食材列表 */}
            <div className="grid grid-cols-1 gap-4">
              {ingredients.filter(item => {
                const matchesSearch = item.name.includes(searchQuery);
                const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
                
                let matchesStatus = true;
                if (selectedAllergyStatus === 'safe') matchesStatus = safeIngredients.includes(item.id);
                else if (selectedAllergyStatus === 'allergic') matchesStatus = allergicIngredients.includes(item.id);
                else if (selectedAllergyStatus === 'untested') matchesStatus = !safeIngredients.includes(item.id) && !allergicIngredients.includes(item.id);
                
                return matchesSearch && matchesCategory && matchesStatus;
              }).map(item => {
                const isAllergic = allergicIngredients.includes(item.id);
                const isSafe = safeIngredients.includes(item.id);
                return (
                  <div key={item.id} className={`duo-card p-5 flex items-center gap-5 transition-all ${isAllergic ? 'bg-red-50 border-red-200' : (isSafe ? 'bg-green-50/30 border-green-200' : 'bg-white')}`}
                       style={isAllergic ? { borderBottomColor: '#ef4444' } : (isSafe ? { borderBottomColor: '#46a302' } : {})}>
                    <div className="text-4xl w-16 h-16 flex items-center justify-center bg-gray-50 rounded-2xl border-2 border-gray-100 shadow-sm">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-lg text-gray-800">{item.name}</span>
                        <span className="text-[10px] font-black bg-orange-100 text-orange-600 px-2 py-0.5 rounded-lg">{item.minAge}M+</span>
                        {isAllergic ? (
                          <span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> 过敏
                          </span>
                        ) : (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${isSafe ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                            {isSafe ? '已排敏' : '未尝试'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-gray-500 mt-1.5 line-clamp-1">{item.tips}</p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={(e) => { e.stopPropagation(); toggleSafe(item.id); }} className="hover:scale-110 transition-transform">
                        <CheckCircle2 className={`w-7 h-7 ${isSafe ? 'text-green-500 fill-green-500' : 'text-gray-200'}`} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); toggleAllergy(item.id); }} className="hover:scale-110 transition-transform">
                        <AlertCircle className={`w-7 h-7 ${isAllergic ? 'text-red-500 fill-red-500' : 'text-gray-200'}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      case 'history':
        return renderHistoryPage();
      case 'recipes':
        return renderTrendsPage();
      case 'ai':
        return (
          <div className="h-full flex flex-col items-center justify-center p-10 text-center space-y-4">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center">
              <MessageCircle className="w-10 h-10 text-orange-500" />
            </div>
            <h2 className="text-xl font-bold">AI 辅食顾问</h2>
            <p className="text-gray-500 text-sm">正在接入 Gemini 智慧大脑，为您解答所有喂养难题...</p>
          </div>
        );
      default:
        return (
          <div className="h-full flex items-center justify-center text-gray-400">
            页面开发中...
          </div>
        );
    }
  };

  const renderLoginPage = () => {
    const roles: { role: FamilyRole, label: string, icon: string }[] = [
      { role: '妈妈', label: '妈妈', icon: '👩‍🍼' },
      { role: '爸爸', label: '爸爸', icon: '👨‍🍼' },
      { role: '奶奶', label: '奶奶', icon: '👵' },
      { role: '爷爷', label: '爷爷', icon: '👴' },
      { role: '外婆', label: '外婆', icon: '👵' },
      { role: '外公', label: '外公', icon: '👴' },
      { role: '月嫂', label: '月嫂', icon: '👩‍⚕️' }
    ];

    if (loginStep === 'login') {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="h-full flex flex-col px-8 pt-20"
        >
          <div className="mb-12">
            <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mb-6 border-4 border-orange-50">
              <Baby className="w-10 h-10 text-orange-500" />
            </div>
            <h1 className="text-4xl font-black text-gray-800 mb-3">欢迎来到{babyName === '宝宝' ? '宝宝' : babyName}的家</h1>
            <p className="text-gray-400 font-bold">请输入用户名和密码以开始记录宝宝的成长</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">用户名</label>
              <div className="relative">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                <input 
                  type="text" 
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-14 pr-5 py-5 bg-gray-50 rounded-[24px] border-2 border-gray-100 font-black text-lg focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">密码</label>
              <div className="relative">
                <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                <input 
                  type="password" 
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-14 pr-5 py-5 bg-gray-50 rounded-[24px] border-2 border-gray-100 font-black text-lg focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            <button 
              onClick={async () => {
                if (username && password) {
                  try {
                    const response = await fetch('/api/login', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ username, password })
                    });
                    const data = await response.json();
                    if (data.success) {
                      localStorage.setItem('baby_food_username', username);
                      setUid(username); // 确保设置 UID
                      // 如果返回了角色，说明是预设用户且已初始化，直接进入
                      if (data.role) {
                        setUserRole(data.role);
                        await checkProfile(username);
                        setIsLoggedIn(true);
                      } else {
                        const hasProfile = await checkProfile(username);
                        if (!hasProfile) {
                          setLoginStep('baby-setup');
                        } else {
                          setIsLoggedIn(true); // 已有资料，直接登录
                        }
                      }
                    } else {
                      alert(data.message || '登录失败');
                    }
                  } catch (error) {
                    console.error("登录失败:", error);
                    alert(`服务器连接失败: ${error instanceof Error ? error.message : '未知错误'}`);
                  }
                } else {
                  alert('请输入用户名和密码');
                }
              }}
              className="w-full py-5 duo-btn-orange text-lg mt-4"
            >
              登录 / 注册
            </button>
          </div>

          <p className="mt-auto mb-10 text-center text-[10px] font-bold text-gray-300 px-10">
            登录即代表您同意 <span className="text-gray-400 underline">用户协议</span> 和 <span className="text-gray-400 underline">隐私政策</span>
          </p>
        </motion.div>
      );
    }

    if (loginStep === 'baby-setup') {
      return (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="h-full flex flex-col px-8 pt-16"
        >
          <div className="mb-10">
            <h1 className="text-4xl font-black text-gray-800 mb-3">完善宝宝资料</h1>
            <p className="text-gray-400 font-bold">让我们为宝宝定制专属的辅食计划</p>
          </div>

          <div className="space-y-8">
            {/* 头像上传 */}
            <div className="flex flex-col items-center gap-4">
              <div 
                onClick={() => babyPhotoInputRef.current?.click()}
                className="w-28 h-28 bg-orange-100 rounded-[32px] flex items-center justify-center border-4 border-orange-50 relative overflow-hidden group cursor-pointer shadow-lg"
              >
                {babyPhoto ? (
                  <img src={babyPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Baby className="w-14 h-14 text-orange-500" />
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </div>
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">点击上传宝宝头像</span>
            </div>

            {/* 名字输入 */}
            <div className="space-y-3">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">宝宝昵称</label>
              <input 
                type="text" 
                value={babyName === '宝宝' ? '' : babyName}
                onChange={(e) => {
                  setBabyName(e.target.value);
                  updateLastLocalChange();
                }}
                placeholder="请输入宝宝昵称，如：塔塔"
                className="w-full px-6 py-5 bg-gray-50 rounded-[24px] border-2 border-gray-100 font-black text-lg focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            {/* 生日选择 */}
            <div className="space-y-3">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">出生日期</label>
              <input 
                type="date" 
                value={babyBirthday}
                onChange={(e) => {
                  setBabyBirthday(e.target.value);
                  updateLastLocalChange();
                }}
                className="w-full px-6 py-5 bg-gray-50 rounded-[24px] border-2 border-gray-100 font-black text-lg focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                onClick={() => setLoginStep('login')}
                className="flex-1 py-5 bg-gray-100 rounded-[24px] font-black text-gray-400 text-lg"
              >
                上一步
              </button>
              <button 
                onClick={() => {
                  if (babyName.trim()) {
                    setLoginStep('role');
                  } else {
                    alert('请输入宝宝昵称');
                  }
                }}
                className="flex-[2] py-5 duo-btn-orange text-lg"
              >
                保存并继续
              </button>
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="h-full flex flex-col px-8 pt-20"
      >
        <div className="mb-12">
          <h1 className="text-4xl font-black text-gray-800 mb-3">选择您的角色</h1>
          <p className="text-gray-400 font-bold">不同的角色将拥有个性化的喂养视图</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {roles.map((r) => (
            <button
              key={r.role}
              onClick={async () => {
                try {
                  await saveBabyProfile({
                    babyName,
                    babyBirthday,
                    role: r.role,
                    babyPhoto: null
                  });
                  setIsLoggedIn(true);
                } catch (error) {
                  console.error("保存资料失败:", error);
                  alert("服务器连接失败，请检查网络");
                }
              }}
              className="flex flex-col items-center gap-2 p-6 bg-gray-50 rounded-[28px] border-2 border-gray-100 hover:border-orange-500 hover:bg-orange-50 group transition-all"
            >
              <span className="text-4xl">{r.icon}</span>
              <span className="text-lg font-black text-gray-700 group-hover:text-orange-600">{r.label}</span>
            </button>
          ))}
        </div>

        <button 
          onClick={() => setLoginStep('baby-setup')}
          className="mt-8 text-center text-sm font-black text-gray-400 hover:text-orange-500 transition-colors"
        >
          返回修改宝宝资料
        </button>
      </motion.div>
    );
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col relative bg-white">
      {!isLoggedIn ? (
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {renderLoginPage()}
          </AnimatePresence>
        </main>
      ) : (
        <>
          {/* 顶部状态栏模拟 */}
      <div className="h-16 flex items-center justify-between px-6 font-black text-sm sticky top-0 bg-white/90 backdrop-blur-md z-30 border-b-2 border-gray-100">
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => updateIsEditingBabyProfile(true)}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center border-2 border-orange-200 group-hover:bg-orange-200 transition-all shadow-sm">
              {babyPhoto ? (
                <img src={babyPhoto} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
              ) : (
                <Baby className="w-6 h-6 text-orange-500" />
              )}
            </div>
            <div className="flex flex-col items-start">
              <span className="text-gray-800 tracking-tight leading-none mb-1">{babyName}宝贝</span>
              <span className="text-[10px] text-orange-500 font-black uppercase tracking-widest opacity-70">点击修改资料</span>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-1.5 bg-orange-100 text-orange-600 px-3 py-1.5 rounded-xl text-[10px] font-black border-2 border-orange-200">
          <User className="w-3.5 h-3.5" />
          {userRole}
        </div>
      </div>

      {/* 主内容区 */}
      <main className="flex-1 pb-24 overflow-y-auto">
        <AnimatePresence mode="wait">
          {renderPage()}
        </AnimatePresence>
      </main>

      {/* 底部导航栏 */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 backdrop-blur-lg border-t-2 border-gray-100 px-6 py-4 flex justify-between items-center safe-area-bottom z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
        <NavButton 
          active={activePage === 'wiki'} 
          onClick={() => setActivePage('wiki')} 
          icon={<BookOpen className="w-7 h-7" />} 
          label="百科" 
        />
        <NavButton 
          active={activePage === 'history'} 
          onClick={() => setActivePage('history')} 
          icon={<HistoryIcon className="w-7 h-7" />} 
          label="历史" 
        />
        <div className="relative -top-8">
          <button 
            onClick={() => setActivePage('home')}
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${activePage === 'home' || activePage === 'meal-detail' ? 'duo-btn-orange scale-110' : 'bg-white text-orange-500 border-2 border-orange-100 shadow-sm'}`}
          >
            <Utensils className="w-8 h-8" />
          </button>
        </div>
        <NavButton 
          active={activePage === 'recipes'} 
          onClick={() => setActivePage('recipes')} 
          icon={<TrendingUp className="w-7 h-7" />} 
          label="趋势" 
        />
        <NavButton 
          active={activePage === 'profile'} 
          onClick={() => {
            setIsLoggedIn(false);
            setLoginStep('login');
            setUserRole(null);
          }} 
          icon={<User className="w-7 h-7" />} 
          label="退出" 
        />
      </nav>
    </>
    )}
      {/* 宝宝资料编辑弹窗 */}
      <AnimatePresence>
        {isEditingBabyProfile && (
          <motion.div 
            key="baby-profile-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          >
            <motion.div 
              key="baby-profile-modal-content"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-md bg-white rounded-t-[40px] p-8 pb-12 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-gray-800">编辑宝宝资料</h3>
                <button 
                  onClick={() => updateIsEditingBabyProfile(false)}
                  className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-8">
                {/* 头像编辑 */}
                <div className="flex flex-col items-center gap-4">
                  <div 
                    onClick={() => babyPhotoInputRef.current?.click()}
                    className="w-24 h-24 bg-orange-100 rounded-3xl flex items-center justify-center border-4 border-orange-50 relative overflow-hidden group cursor-pointer"
                  >
                    {babyPhoto ? (
                      <img src={babyPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Baby className="w-12 h-12 text-orange-500" />
                    )}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">点击更换头像</span>
                </div>

                {/* 名字编辑 */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">宝宝昵称</label>
                  <input 
                    type="text" 
                    value={babyName}
                    onChange={(e) => {
                      setBabyName(e.target.value);
                      updateLastLocalChange();
                    }}
                    placeholder="请输入宝宝名字"
                    className="w-full px-6 py-5 bg-gray-50 rounded-[24px] border-2 border-gray-100 font-black text-lg focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>

                {/* 出生日期编辑 */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">出生日期</label>
                  <input 
                    type="date" 
                    value={babyBirthday}
                    onChange={(e) => {
                      setBabyBirthday(e.target.value);
                      updateLastLocalChange();
                    }}
                    className="w-full px-6 py-5 bg-gray-50 rounded-[24px] border-2 border-gray-100 font-black text-lg focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>

                <button 
                  disabled={isSaving}
                  onClick={async () => {
                    updateIsSaving(true);
                    try {
                      const response = await fetch('/api/save-profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          username: uid, 
                          babyName, 
                          babyBirthday, 
                          role: userRole,
                          babyPhoto
                        })
                      });
                      const data = await response.json();
                      if (data.success) {
                        updateIsEditingBabyProfile(false);
                        updateIsSaving(false); // 先解锁
                        // 保存成功后立即刷新一次数据，确保同步
                        await fetchSharedData();
                      } else {
                        alert(data.message || "保存失败");
                      }
                    } catch (error) {
                      console.error("保存资料失败:", error);
                      alert("服务器连接失败");
                    } finally {
                      updateIsSaving(false);
                    }
                  }}
                  className={`w-full py-5 duo-btn-orange text-lg mt-4 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSaving ? '正在保存...' : '保存修改'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 全局弹窗组件 */}
      <AnimatePresence>
        {/* 体重录入弹窗 */}
        {isAddingWeight && (
          <motion.div 
            key="weight-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsAddingWeight(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end justify-center"
          >
            <motion.div 
              key="weight-modal-content"
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-t-[40px] p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black text-gray-800">记录体重</h3>
                  <button onClick={() => setIsAddingWeight(false)} className="text-gray-300 hover:text-red-500"><X className="w-6 h-6" /></button>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 bg-gray-50 p-6 rounded-[24px] border-2 border-gray-100">
                    <Scale className="w-8 h-8 text-orange-500" />
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="宝宝今天的体重 (kg)"
                      className="flex-1 bg-transparent font-black text-2xl focus:outline-none"
                      value={newWeight}
                      onChange={(e) => setNewWeight(e.target.value)}
                      autoFocus
                    />
                    <span className="text-xl font-black text-gray-400">kg</span>
                  </div>
                  <button 
                    onClick={addWeight}
                    className="w-full py-5 rounded-[24px] font-black text-white duo-btn-orange text-lg tracking-widest"
                  >
                    确认记录
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* 添加餐次弹窗 */}
        {isAddingMeal && (
          <motion.div 
            key="meal-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] flex items-end justify-center"
            onClick={() => setIsAddingMeal(false)}
          >
            <motion.div 
              key="meal-modal-content"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="w-full max-w-md bg-white rounded-t-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto border-t-4 border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black text-gray-800">{editingMealId ? '编辑餐次' : '添加新餐次'}</h3>
                  <div className="flex gap-4">
                    {addMealStep > 1 && (
                      <button onClick={() => setAddMealStep(prev => prev - 1)} className="text-gray-400 font-black text-sm uppercase tracking-widest hover:text-orange-500">上一步</button>
                    )}
                    <button onClick={() => setIsAddingMeal(false)} className="text-gray-300 hover:text-red-500"><X className="w-6 h-6" /></button>
                  </div>
                </div>
                
                <div className="space-y-6">
                  {/* Step 1: Type & Time */}
                  {addMealStep === 1 && (
                    <div className="space-y-8">
                      <div className="flex gap-5">
                        <button 
                          onClick={() => setNewMealData(prev => ({ ...prev, type: 'milk' }))}
                          className={`flex-1 p-6 rounded-[32px] border-4 transition-all flex flex-col items-center gap-3 ${newMealData.type === 'milk' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 text-gray-400'}`}
                          style={newMealData.type === 'milk' ? { borderBottomWidth: '8px' } : {}}
                        >
                          <div className="text-4xl">🍼</div>
                          <div className="text-sm font-black uppercase tracking-widest">喂奶</div>
                        </button>
                        <button 
                          onClick={() => setNewMealData(prev => ({ ...prev, type: 'food' }))}
                          className={`flex-1 p-6 rounded-[32px] border-4 transition-all flex flex-col items-center gap-3 ${newMealData.type === 'food' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 text-gray-400'}`}
                          style={newMealData.type === 'food' ? { borderBottomWidth: '8px' } : {}}
                        >
                          <div className="text-4xl">🥣</div>
                          <div className="text-sm font-black uppercase tracking-widest">辅食</div>
                        </button>
                      </div>
                      <div className="space-y-3">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">设定时间</label>
                        <input 
                          type="time" 
                          value={newMealData.time}
                          onChange={(e) => setNewMealData(prev => ({ ...prev, time: e.target.value }))}
                          className="w-full p-5 bg-gray-50 rounded-[24px] border-2 border-gray-100 font-black text-xl focus:outline-none focus:border-orange-500 transition-colors"
                        />
                      </div>
                      <button 
                        onClick={() => setAddMealStep(2)}
                        className="w-full py-5 rounded-[24px] font-black text-white duo-btn-orange text-lg tracking-widest"
                      >
                        下一步
                      </button>
                    </div>
                  )}

                  {/* Milk Flow */}
                  {newMealData.type === 'milk' && addMealStep === 2 && (
                    <div className="space-y-8">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">选择奶类</label>
                      <div className="flex gap-5">
                        <button 
                          onClick={() => setNewMealData(prev => ({ ...prev, milkType: 'breast' }))}
                          className={`flex-1 p-6 rounded-[32px] border-4 transition-all font-black uppercase tracking-widest ${newMealData.milkType === 'breast' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-100 text-gray-400'}`}
                          style={newMealData.milkType === 'breast' ? { borderBottomWidth: '8px' } : {}}
                        >
                          母乳
                        </button>
                        <button 
                          onClick={() => setNewMealData(prev => ({ ...prev, milkType: 'formula' }))}
                          className={`flex-1 p-6 rounded-[32px] border-4 transition-all font-black uppercase tracking-widest ${newMealData.milkType === 'formula' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-100 text-gray-400'}`}
                          style={newMealData.milkType === 'formula' ? { borderBottomWidth: '8px' } : {}}
                        >
                          奶粉
                        </button>
                      </div>
                      {newMealData.milkType && (
                        <button 
                          onClick={() => setAddMealStep(3)}
                          className="w-full py-5 rounded-[24px] font-black text-white duo-btn-orange text-lg tracking-widest"
                        >
                          下一步
                        </button>
                      )}
                    </div>
                  )}

                  {newMealData.type === 'milk' && addMealStep === 3 && (
                    <div className="space-y-8">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">设定奶量 (ML)</label>
                      <div className="flex items-center justify-between bg-gray-50 p-6 rounded-[32px] border-2 border-gray-100">
                        <button 
                          onClick={() => setNewMealData(prev => ({ ...prev, milkVolume: Math.max(0, (prev.milkVolume || 0) - 30) }))}
                          className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-orange-500 font-black text-3xl border-2 border-gray-100"
                        >-</button>
                        <div className="text-4xl font-black text-orange-600 flex items-baseline gap-2">
                          {newMealData.milkVolume || 0} 
                          <span className="text-sm text-gray-400 uppercase tracking-widest">ml</span>
                        </div>
                        <button 
                          onClick={() => setNewMealData(prev => ({ ...prev, milkVolume: (prev.milkVolume || 0) + 30 }))}
                          className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-orange-500 font-black text-3xl border-2 border-gray-100"
                        >+</button>
                      </div>
                      <button 
                        onClick={addMeal}
                        className="w-full py-5 rounded-[24px] font-black text-white duo-btn-orange text-lg tracking-widest"
                      >
                        完成规划
                      </button>
                    </div>
                  )}

                  {/* Food Flow */}
                  {newMealData.type === 'food' && addMealStep >= 2 && (
                    <div className="space-y-6">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                          {addMealStep === 2 ? '第一步：选择五谷 (必选)' : 
                           addMealStep === 3 ? '第二步：选择肉蛋 (可选)' :
                           addMealStep === 4 ? '第三步：选择蔬菜 (可选)' :
                           '第四步：选择水果 (可选)'}
                        </label>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mt-2 border border-gray-50">
                          <div 
                            className="h-full bg-green-500 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(34,197,94,0.3)]" 
                            style={{ width: `${(addMealStep - 1) * 25}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 max-h-[40vh] overflow-y-auto p-1 no-scrollbar">
                        {ingredients.filter(ing => {
                          if (addMealStep === 2) return ing.category === 'grain';
                          if (addMealStep === 3) return ing.category === 'protein';
                          if (addMealStep === 4) return ing.category === 'vegetable';
                          if (addMealStep === 5) return ing.category === 'fruit';
                          return false;
                        }).map(ing => {
                          const mealFood = newMealData.foods.find(f => f.foodId === ing.id);
                          const isSelected = !!mealFood;
                          const isAllergic = allergicIngredients.includes(ing.id);
                          const isSafe = safeIngredients.includes(ing.id);
                          return (
                            <div 
                              key={ing.id}
                              className={`duo-card p-4 flex flex-col gap-3 transition-all relative ${isAllergic ? 'opacity-40 grayscale cursor-not-allowed' : (isSelected ? 'border-orange-500 bg-orange-50' : 'bg-white')}`}
                              style={isSelected ? { borderBottomColor: '#f27d26' } : {}}
                            >
                              {isAllergic && (
                                <div className="absolute top-2 right-2">
                                  <AlertCircle className="w-4 h-4 text-red-500 fill-red-50" />
                                </div>
                              )}
                              
                              <button
                                disabled={isAllergic}
                                onClick={() => {
                                  setNewMealData(prev => {
                                    if (isSelected) {
                                      return { ...prev, foods: prev.foods.filter(f => f.foodId !== ing.id) };
                                    } else {
                                      if (addMealStep === 2) {
                                        const otherGrains = ingredients.filter(i => i.category === 'grain').map(i => i.id);
                                        return { 
                                          ...prev, 
                                          foods: [...prev.foods.filter(f => !otherGrains.includes(f.foodId)), { foodId: ing.id, quantity: 2.5 }] 
                                        };
                                      }
                                      const isGrain = ing.category === 'grain';
                                      return { ...prev, foods: [...prev.foods, { foodId: ing.id, quantity: isGrain ? 2.5 : 1 }] };
                                    }
                                  });
                                }}
                                className="flex items-center gap-3 text-left"
                              >
                                <span className="text-3xl">{ing.icon}</span>
                                <div className="flex flex-col">
                                  <span className="text-sm font-black text-gray-800 truncate">{ing.name}</span>
                                  <span className={`text-[10px] font-black ${isSafe ? 'text-green-500' : 'text-gray-400'}`}>
                                    {isSafe ? '已排敏' : '未尝试'}
                                  </span>
                                </div>
                              </button>
                              {isSelected && (
                                <div className="flex items-center justify-between bg-white/50 p-2 rounded-xl border-2 border-orange-100">
                                  <button 
                                    onClick={() => setNewMealData(prev => ({
                                      ...prev,
                                      foods: prev.foods.map(f => {
                                        if (f.foodId === ing.id) {
                                          const isGrain = ing.category === 'grain';
                                          const step = isGrain ? 2.5 : 0.5;
                                          return { ...f, quantity: Math.max(step, f.quantity - step) };
                                        }
                                        return f;
                                      })
                                    }))}
                                    className="w-7 h-7 bg-white rounded-lg shadow-sm flex items-center justify-center text-orange-500 font-black"
                                  >-</button>
                                  <span className="text-xs font-black w-10 text-center">{mealFood.quantity}{ing.category === 'grain' ? '克' : '勺'}</span>
                                  <button 
                                    onClick={() => setNewMealData(prev => ({
                                      ...prev,
                                      foods: prev.foods.map(f => {
                                        if (f.foodId === ing.id) {
                                          const isGrain = ing.category === 'grain';
                                          const step = isGrain ? 2.5 : 0.5;
                                          return { ...f, quantity: f.quantity + step };
                                        }
                                        return f;
                                      })
                                    }))}
                                    className="w-7 h-7 bg-white rounded-lg shadow-sm flex items-center justify-center text-orange-500 font-black"
                                  >+</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="flex gap-4 pt-4">
                        {addMealStep < 5 ? (
                          <button 
                            onClick={() => {
                              if (addMealStep === 2) {
                                const hasGrain = newMealData.foods.some(f => ingredients.find(i => i.id === f.foodId)?.category === 'grain');
                                if (!hasGrain) {
                                  alert("请先选择一种五谷哦");
                                  return;
                                }
                              }
                              setAddMealStep(prev => prev + 1);
                            }}
                            className="flex-1 py-5 rounded-[24px] font-black text-white duo-btn-orange text-lg tracking-widest"
                          >
                            下一步
                          </button>
                        ) : (
                          <button 
                            onClick={addMeal}
                            className="flex-1 py-5 rounded-[24px] font-black text-white duo-btn-orange text-lg tracking-widest"
                          >
                            完成规划
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* 新增食材弹窗 */}
        {isAddingIngredient && (
          <motion.div 
            key="ingredient-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] flex items-end justify-center"
            onClick={() => setIsAddingIngredient(false)}
          >
            <motion.div 
              key="ingredient-modal-content"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="w-full max-w-md bg-white rounded-t-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto border-t-4 border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black text-gray-800">录入新食材</h3>
                  <button onClick={() => setIsAddingIngredient(false)} className="text-gray-300 hover:text-red-500"><X className="w-6 h-6" /></button>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">食材名称</label>
                    <input 
                      type="text" 
                      placeholder="如：南瓜"
                      className="w-full p-5 bg-gray-50 rounded-[24px] border-2 border-gray-100 font-black text-lg focus:outline-none focus:border-orange-500 transition-colors"
                      value={newIngredientData.name || ''}
                      onChange={(e) => setNewIngredientData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">食材分类</label>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { id: 'vegetable', label: '蔬菜', icon: '🥦' },
                        { id: 'fruit', label: '水果', icon: '🍎' },
                        { id: 'grain', label: '五谷', icon: '🌾' },
                        { id: 'protein', label: '肉蛋', icon: '🥩' }
                      ].map(cat => (
                        <button 
                          key={cat.id}
                          onClick={() => setNewIngredientData(prev => ({ ...prev, category: cat.id as any }))}
                          className={`p-4 rounded-2xl border-2 flex items-center gap-3 font-black transition-all ${newIngredientData.category === cat.id ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-100 text-gray-400'}`}
                        >
                          <span className="text-xl">{cat.icon}</span>
                          <span className="text-sm">{cat.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">过敏风险</label>
                    <div className="flex gap-3">
                      {['low', 'medium', 'high'].map(risk => (
                        <button 
                          key={risk}
                          onClick={() => setNewIngredientData(prev => ({ ...prev, allergyRisk: risk as any }))}
                          className={`flex-1 py-3 rounded-xl border-2 font-black text-xs uppercase tracking-widest transition-all ${newIngredientData.allergyRisk === risk ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-100 text-gray-400'}`}
                        >
                          {risk === 'low' ? '低' : risk === 'medium' ? '中' : '高'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">喂养贴士</label>
                    <textarea 
                      placeholder="如：蒸熟磨泥，口感细腻..."
                      className="w-full p-5 bg-gray-50 rounded-[24px] border-2 border-gray-100 font-black text-sm focus:outline-none focus:border-orange-500 transition-colors h-32 resize-none"
                      value={newIngredientData.tips || ''}
                      onChange={(e) => setNewIngredientData(prev => ({ ...prev, tips: e.target.value }))}
                    />
                  </div>

                  <button 
                    onClick={addIngredient}
                    className="w-full py-5 rounded-[24px] font-black text-white duo-btn-orange text-lg tracking-widest"
                  >
                    确认录入
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={babyPhotoInputRef} 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
              setBabyPhoto(reader.result as string);
              updateLastLocalChange();
            };
            reader.readAsDataURL(file);
          }
        }} 
      />
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 transition-all ${active ? 'text-orange-500 scale-110' : 'text-gray-400 hover:text-gray-600'}`}
    >
      <div className={`${active ? 'bg-orange-50 p-1 rounded-lg' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}
