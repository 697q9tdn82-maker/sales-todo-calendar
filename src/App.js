import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, increment } from "firebase/firestore";

import {
  PRIORITIES, STATUSES, ACTION_CATEGORIES, PIPELINE_ACTIONS,
  PRODUCT_CATEGORIES, CONTACT_CATEGORIES, DAYS_JP, MONTHS_JP,
  REPEATS, DEFAULT_TEMPLATES, STAGES, PRODUCTS, HALF_MONTHS,
} from "./constants";
import {
  makeDateStr, getBizDaysInMonth, getBizDaysPassed,
  toJSTDateStr, addDays, fmtDate, catColor, getCats, isDoneTodo, todoStatus, nextRepeatDate,
} from "./utils";
import { exportToExcel } from "./excel";
import TodoCard from "./components/TodoCard";
import PipelineTab from "./components/PipelineTab";
import BoardTab from "./components/BoardTab";
import HabitBar from "./components/HabitBar";

// ── Firebase設定 ──────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyB5eSZLCsrCCuUKXdmKwZyUxqlNbPBpZoI",
  authDomain: "eatin-map-ee417.firebaseapp.com",
  projectId: "eatin-map-ee417",
  storageBucket: "eatin-map-ee417.firebasestorage.app",
  messagingSenderId: "850029980093",
  appId: "1:850029980093:web:bd2ea9a6e942b342220ad4"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── 通知音(ポモドーロ) ────────────────────────────────
function beep() {
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    [0, 0.35].forEach(delay=>{
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime+delay);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+delay+0.3);
      o.start(ctx.currentTime+delay);
      o.stop(ctx.currentTime+delay+0.3);
    });
  } catch(e) {}
}

// ── メインコンポーネント ──────────────────────────────
export default function App() {
  const [tab, setTab] = useState("list");

  // ── 「今日」を常に最新に保つ(日付跨ぎ対応) ─────────
  const [todayStr, setTodayStr] = useState(()=>toJSTDateStr(new Date()));
  useEffect(()=>{
    const iv = setInterval(()=>{
      const s = toJSTDateStr(new Date());
      setTodayStr(prev => prev===s ? prev : s);
    }, 60*1000);
    return ()=>clearInterval(iv);
  },[]);

  // ── 報告書欄(Firestore同期: スマホ⇔PCで共有) ──────
  const [reportItems, setReportItems] = useState([]);
  const [reportInput, setReportInput] = useState("");
  const [reportDate,  setReportDate]  = useState(()=>toJSTDateStr(new Date()));
  useEffect(()=>{
    const unsub = onSnapshot(collection(db,"sales_reports"),(snap)=>{
      setReportItems(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return ()=>unsub();
  },[]);
  // 旧localStorageデータの一回きり移行
  useEffect(()=>{
    try {
      if (localStorage.getItem("sales-report-migrated")) return;
      const s = localStorage.getItem("sales-report");
      const old = s ? JSON.parse(s) : [];
      localStorage.setItem("sales-report-migrated","1");
      old.forEach(r=>{
        if (r && r.name && r.date) addDoc(collection(db,"sales_reports"),{ date:r.date, name:r.name, createdAt:new Date().toISOString() });
      });
    } catch(e) {}
  },[]);
  async function addReport() {
    if (!reportInput.trim()) return;
    await addDoc(collection(db,"sales_reports"),{ date:reportDate, name:reportInput.trim(), createdAt:new Date().toISOString() });
    setReportInput("");
  }
  async function deleteReport(id) {
    await deleteDoc(doc(db,"sales_reports",id));
  }

  // ── ポモドーロ(通知音+当日セット数を保存) ──────────
  const POMO_WORK = 25*60, POMO_BREAK = 5*60;
  const [pomoTime,    setPomoTime]    = useState(POMO_WORK);
  const [pomoRunning, setPomoRunning] = useState(false);
  const [pomoMode,    setPomoMode]    = useState("work"); // "work"|"break"
  const [pomoCount,   setPomoCount]   = useState(()=>{
    try {
      const s = JSON.parse(localStorage.getItem("pomo-count")||"{}");
      return s.date===toJSTDateStr(new Date()) ? (s.count||0) : 0;
    } catch { return 0; }
  });
  useEffect(()=>{
    try { localStorage.setItem("pomo-count", JSON.stringify({date:todayStr, count:pomoCount})); } catch {}
  },[pomoCount, todayStr]);
  useEffect(()=>{
    if(!pomoRunning) return;
    const t = setInterval(()=>{
      setPomoTime(prev=>{
        if(prev<=1){
          clearInterval(t);
          setPomoRunning(false);
          beep();
          if(pomoMode==="work"){
            setPomoCount(c=>c+1);
            setPomoMode("break");
            setPomoTime(POMO_BREAK);
          } else {
            setPomoMode("work");
            setPomoTime(POMO_WORK);
          }
          return prev;
        }
        return prev-1;
      });
    },1000);
    return ()=>clearInterval(t);
  },[pomoRunning,pomoMode]); // eslint-disable-line react-hooks/exhaustive-deps
  function pomoReset(){ setPomoRunning(false); setPomoMode("work"); setPomoTime(POMO_WORK); }
  function pomoFmt(s){ return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }

  // ── カレンダー ────────────────────────────────────
  const [calView, setCalView]   = useState("month");
  const [currentDate, setCurrentDate] = useState(()=>{ const n=new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selectedDate, setSelectedDate] = useState(()=>toJSTDateStr(new Date()));

  // ── Firestore: タスク ─────────────────────────────
  const [todos, setTodos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "sales_todos"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTodos(data);
      setLoading(false);
      setLoadError(null);
    }, (err) => {
      console.error("Firestore読み込みエラー:", err);
      setLoadError(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Firestore: 日別完了数(ストリーク・週間グラフ用) ──
  const [dailyDone, setDailyDone] = useState({});
  useEffect(()=>{
    const unsub = onSnapshot(doc(db,"sales_stats","dailyDone"),(snap)=>{
      setDailyDone(snap.exists() ? snap.data() : {});
    });
    return ()=>unsub();
  },[]);
  function bumpDaily(date, delta) {
    setDoc(doc(db,"sales_stats","dailyDone"), { [date]: increment(delta) }, { merge:true }).catch(()=>{});
  }

  // ── Firestore: 案件パイプライン ────────────────────
  const [deals, setDeals]         = useState([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [showDealModal, setShowDealModal] = useState(false);
  const [editDeal, setEditDeal]   = useState(null);
  const [dealForm, setDealForm]   = useState({ company:"", products:[], amount:"", person:"", note:"", stage:"contact", nextAction:"" });

  useEffect(()=>{
    const unsub = onSnapshot(collection(db,"sales_deals"),(snap)=>{
      setDeals(snap.docs.map(d=>({id:d.id,...d.data()})));
      setDealsLoading(false);
    });
    return ()=>unsub();
  },[]);

  function openAddDeal(stage) {
    setEditDeal(null);
    setDealForm({ company:"", products:[], amount:"", person:"", note:"", stage:stage||"contact", nextAction:"" });
    setShowDealModal(true);
  }
  function openEditDeal(deal) {
    setEditDeal(deal);
    setDealForm({ company:deal.company||"", products:deal.products||[], amount:deal.amount||"", person:deal.person||"", note:deal.note||"", stage:deal.stage||"contact", nextAction:deal.nextAction||"" });
    setShowDealModal(true);
  }
  async function saveDeal() {
    if (!dealForm.company.trim()) return;
    const prevNextAction = editDeal ? (editDeal.nextAction||"") : "";
    if (editDeal) {
      await updateDoc(doc(db,"sales_deals",editDeal.id), dealForm);
    } else {
      await addDoc(collection(db,"sales_deals"), { ...dealForm, createdAt: new Date().toISOString() });
    }
    // 次回アクション日が設定/変更されたら、フォロータスクを自動作成
    if (dealForm.nextAction && dealForm.nextAction!==prevNextAction) {
      const title = `${dealForm.company.trim()} フォロー`;
      const dup = todos.some(t=>t.title===title && t.date===dealForm.nextAction);
      if (!dup) {
        await addDoc(collection(db,"sales_todos"),{
          title, date:dealForm.nextAction, priority:"medium",
          categories:["followup"], status:"undone", done:false,
          note:"案件パイプラインから自動作成",
        });
      }
    }
    setShowDealModal(false);
  }
  async function deleteDeal(id) {
    if (!window.confirm("削除しますか？")) return;
    await deleteDoc(doc(db,"sales_deals",id));
  }
  async function moveDeal(deal, stageKey) {
    await updateDoc(doc(db,"sales_deals",deal.id), { stage: stageKey });
  }

  // ── Firestore: ボードデータ ────────────────────────
  const [boardData, setBoardData]   = useState(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardEdit, setBoardEdit]   = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "sales_board", "main"), (snap) => {
      if (snap.exists()) {
        setBoardData(snap.data());
      } else {
        const init = {
          halfLabel: "上期（4〜9月）",
          months: HALF_MONTHS,
          products: PRODUCTS.map(p => ({
            key: p.key, label: p.label,
            halfTarget: 0,
            monthlyTargets:  Object.fromEntries(HALF_MONTHS.map(m=>[m,0])),
            monthlyResults:  Object.fromEntries(HALF_MONTHS.map(m=>[m,0])),
          }))
        };
        setBoardData(init);
      }
      setBoardLoading(false);
    });
    return () => unsub();
  }, []);

  async function saveBoardData(data) {
    await setDoc(doc(db, "sales_board", "main"), data);
  }

  // ── モーダル(タスク) ──────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editTodo,  setEditTodo]  = useState(null);
  const [form, setForm] = useState({ title:"", date:toJSTDateStr(new Date()), priority:"medium", categories:[], status:"undone", note:"", repeat:"" });
  const [saving, setSaving] = useState(false);

  // ── タスクテンプレート ─────────────────────────────
  const [templates, setTemplates] = useState(()=>{
    try {
      const s = JSON.parse(localStorage.getItem("task-templates"));
      return Array.isArray(s)&&s.length>0 ? s : DEFAULT_TEMPLATES;
    } catch { return DEFAULT_TEMPLATES; }
  });
  function persistTemplates(next) {
    setTemplates(next);
    try { localStorage.setItem("task-templates", JSON.stringify(next)); } catch {}
  }
  function applyTemplate(tp) {
    setForm({...form, title:tp.title, categories:tp.categories||[], priority:tp.priority||"medium"});
  }
  function saveAsTemplate() {
    if (!form.title.trim()) { alert("タスク名を入力してからテンプレ登録してください"); return; }
    const name = window.prompt("テンプレート名", form.title.trim().slice(0,8));
    if (!name) return;
    persistTemplates([...templates, { name, title:form.title.trim(), categories:form.categories||[], priority:form.priority }]);
  }
  function deleteTemplate(i) {
    if (!window.confirm(`テンプレート「${templates[i].name}」を削除しますか？`)) return;
    persistTemplates(templates.filter((_,x)=>x!==i));
  }

  // ── フィルター(一覧) ───────────────────────────────
  const [listFilter,    setListFilter]    = useState("all");
  const [listCatFilter, setListCatFilter] = useState("all");
  const [listSort,      setListSort]      = useState("date");
  const [listCatTab,    setListCatTab]    = useState("action");
  const [listSearch,    setListSearch]    = useState("");
  const [quickTitle,    setQuickTitle]    = useState("");

  // フィルター(カレンダー日次)
  const [calCatFilter, setCalCatFilter] = useState("all");
  const [calCatTab,    setCalCatTab]    = useState("action");

  // ── ステータス変更時の共通処理(実績カウント+繰り返し生成) ──
  async function afterStatusChange(todo, prevStatus, nextStatus) {
    if (prevStatus!=="done" && nextStatus==="done") {
      bumpDaily(todayStr, 1);
      // 繰り返しタスク: 次回分を自動生成
      if (todo.repeat && REPEATS[todo.repeat]) {
        const base = todo.date && todo.date>=todayStr ? todo.date : todayStr;
        const nd   = nextRepeatDate(base, todo.repeat);
        const dup  = todos.some(t=>t.title===todo.title && t.date===nd && t.repeat===todo.repeat && !isDoneTodo(t));
        if (!dup) {
          await addDoc(collection(db,"sales_todos"),{
            title:todo.title, date:nd, priority:todo.priority||"medium",
            categories:getCats(todo), status:"undone", done:false,
            note:todo.note||"", repeat:todo.repeat,
          });
        }
      }
    }
    if (prevStatus==="done" && nextStatus!=="done") bumpDaily(todayStr, -1);
  }

  // ── CRUD (Firestore) ──────────────────────────────
  function openAdd(ds) {
    setEditTodo(null);
    setForm({ title:"", date: typeof ds==="string" ? ds : todayStr, priority:"medium", categories:[], status:"undone", note:"", repeat:"" });
    setShowModal(true);
  }
  function openEdit(todo) {
    setEditTodo(todo);
    setForm({ title:todo.title, date:todo.date, priority:todo.priority, categories:getCats(todo), status:todoStatus(todo), note:todo.note, repeat:todo.repeat||"" });
    setShowModal(true);
  }
  async function saveTodo() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editTodo) {
        const prev = todoStatus(editTodo);
        await updateDoc(doc(db, "sales_todos", editTodo.id), { ...form, done: form.status==="done" });
        await afterStatusChange({...editTodo, ...form}, prev, form.status);
      } else {
        await addDoc(collection(db, "sales_todos"), { ...form, done: form.status==="done" });
        if (form.status==="done") await afterStatusChange({...form}, "undone", "done");
        // パイプライン自動登録（初回接触・提案・クロージングを選んだ場合）
        const cats = form.categories || [];
        const pipeAction = cats.find(k => PIPELINE_ACTIONS.includes(k));
        if (pipeAction) {
          const stageKey = ACTION_CATEGORIES[pipeAction].pipelineStage;
          const company  = form.title.replace(/\s*(初回|提案|クロージング|アポ|訪問|面談).*$/,"").trim();
          const products = cats.filter(k => PRODUCT_CATEGORIES[k]);
          const exists = deals.some(d => d.company===company && d.stage===stageKey);
          if (!exists) {
            await addDoc(collection(db,"sales_deals"),{
              company, products, amount:"", person:"", note:"",
              stage: stageKey,
              createdAt: new Date().toISOString(),
              fromTask: true,
            });
          }
        }
      }
      setShowModal(false);
    } catch(e) { alert("保存に失敗しました: " + e.message); }
    setSaving(false);
  }
  // クイック追加(TOPの1行入力)
  async function quickAdd() {
    const title = quickTitle.trim();
    if (!title) return;
    setQuickTitle("");
    try {
      await addDoc(collection(db,"sales_todos"),{
        title, date:todayStr, priority:"medium", categories:[], status:"undone", done:false, note:"",
      });
    } catch(e) { alert("追加に失敗しました: " + e.message); }
  }
  async function cycleStatus(todo) {
    const order = ["undone","progress","done"];
    const cur   = todoStatus(todo);
    const next  = order[(order.indexOf(cur)+1) % order.length];
    await updateDoc(doc(db, "sales_todos", todo.id), { status: next, done: next==="done" });
    await afterStatusChange(todo, cur, next);
  }
  async function deleteTodo(id) {
    if (!window.confirm("削除しますか？")) return;
    await deleteDoc(doc(db, "sales_todos", id));
  }
  async function deleteDoneTodos() {
    const doneTodos = todos.filter(isDoneTodo);
    if (doneTodos.length===0) { alert("済のタスクはありません"); return; }
    if (!window.confirm(`済のタスク ${doneTodos.length}件を一括削除しますか？`)) return;
    await Promise.all(doneTodos.map(t=>deleteDoc(doc(db,"sales_todos",t.id))));
  }

  // ── 期限切れタスクを当日に繰越(⏰繰越タグ付き・二重書き込み防止) ──
  const carryRef = useRef(new Set());
  useEffect(() => {
    todos
      .filter(t => t.date && t.date < todayStr && !isDoneTodo(t))
      .forEach(t => {
        if (carryRef.current.has(t.id)) return;
        carryRef.current.add(t.id);
        updateDoc(doc(db, "sales_todos", t.id), {
          date: todayStr,
          carriedFrom: t.carriedFrom || t.date,
        }).catch(()=>carryRef.current.delete(t.id));
      });
  }, [todos, todayStr]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── カレンダー計算 ────────────────────────────────
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay    = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();
  const calendarDays = [];
  for (let i=0;i<firstDay;i++) calendarDays.push(null);
  for (let d=1;d<=daysInMonth;d++) calendarDays.push(d);
  const threeDays = [selectedDate, addDays(selectedDate,1), addDays(selectedDate,2)];
  const todosFor  = (ds) => todos.filter(t=>t.date===ds);

  // ── 統計 ─────────────────────────────────────────
  const stats = {
    high:   todos.filter(t=>t.priority==="high"&&!isDoneTodo(t)).length,
    medium: todos.filter(t=>t.priority==="medium"&&!isDoneTodo(t)).length,
    low:    todos.filter(t=>t.priority==="low"&&!isDoneTodo(t)).length,
  };

  // ── 一覧フィルタ(複数カテゴリ対応版) ────────────────
  let listTodos = [...todos];
  if (listFilter==="done")     listTodos = listTodos.filter(isDoneTodo);
  if (listFilter==="progress") listTodos = listTodos.filter(t=>t.status==="progress");
  if (listFilter==="undone")   listTodos = listTodos.filter(t=>todoStatus(t)==="undone");
  if (listCatFilter!=="all")   listTodos = listTodos.filter(t=>getCats(t).includes(listCatFilter));
  if (listSearch.trim()) {
    const q = listSearch.trim().toLowerCase();
    listTodos = listTodos.filter(t=>(t.title||"").toLowerCase().includes(q) || (t.note||"").toLowerCase().includes(q));
  }
  const priorityRank={high:0,medium:1,low:2};
  if (listSort==="date")     listTodos.sort((a,b)=>a.date.localeCompare(b.date));
  if (listSort==="priority") listTodos.sort((a,b)=>(priorityRank[a.priority]??1)-(priorityRank[b.priority]??1));
  // 済みは常に末尾
  listTodos.sort((a,b) => isDoneTodo(a)===isDoneTodo(b) ? 0 : isDoneTodo(a) ? 1 : -1);

  // ── カレンダー日次フィルタ(複数カテゴリ対応版) ──────
  const dayTodos = (calCatFilter==="all" ? todos : todos.filter(t=>getCats(t).includes(calCatFilter)))
    .filter(t=>t.date===selectedDate)
    .sort((a,b)=>(priorityRank[a.priority]??1)-(priorityRank[b.priority]??1))
    .sort((a,b)=>isDoneTodo(a)===isDoneTodo(b)?0:isDoneTodo(a)?1:-1);

  // ── 共通スタイル ──────────────────────────────────
  const inputStyle = {
    width:"100%", background:"#12151E", border:"1px solid #2A2D3A",
    borderRadius:10, padding:"10px 14px", color:"#E8EAF0", fontSize:14,
    outline:"none", boxSizing:"border-box", fontFamily:"inherit",
  };

  // ── カテゴリフィルターバー ────────────────────────
  function CatFilterBar({ catTab, setCatTab, catFilter, setCatFilter }) {
    return (
      <div style={{marginBottom:12}}>
        <div style={{display:"flex", gap:6, marginBottom:7, alignItems:"center"}}>
          {[["action","営業アクション"],["product","商品"],["contact","連絡手段"]].map(([t,l])=>(
            <button key={t} onClick={()=>setCatTab(t)} style={{
              padding:"4px 11px", borderRadius:6, border:"none", cursor:"pointer", fontSize:11, fontWeight:700,
              background:catTab===t?"#2A2D3A":"transparent", color:catTab===t?"#E8EAF0":"#5A5D6A",
            }}>{l}</button>
          ))}
          <button onClick={()=>setCatFilter("all")} style={{
            marginLeft:"auto", padding:"4px 11px", borderRadius:6, border:"none", cursor:"pointer", fontSize:11, fontWeight:700,
            background:catFilter==="all"?"#FFD700":"#1E2230", color:catFilter==="all"?"#0D0F14":"#7A7D8A",
          }}>すべて</button>
        </div>
        <div style={{display:"flex", gap:5, flexWrap:"wrap"}}>
          {Object.entries(catTab==="action"?ACTION_CATEGORIES:catTab==="product"?PRODUCT_CATEGORIES:CONTACT_CATEGORIES).map(([key,cat])=>{
            const active=catFilter===key;
            const cc=catColor(key);
            return (
              <button key={key} onClick={()=>setCatFilter(key)} style={{
                padding:"4px 10px", borderRadius:16,
                border:active?`1px solid ${cc}`:"1px solid transparent",
                cursor:"pointer", fontSize:11, fontWeight:600,
                background:active?cc+"18":"#1A1D26", color:active?cc:"#7A7D8A",
              }}>{cat.icon} {cat.label}</button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── モーダル内カテゴリ選択（複数選択対応） ──────────
  function CategoryPicker() {
    function toggleCat(k) {
      const cats = form.categories || [];
      const next = cats.includes(k) ? cats.filter(c=>c!==k) : [...cats, k];
      setForm({...form, categories: next});
    }
    return (
      <div>
        <label style={{fontSize:11, color:"#7A7D8A", display:"block", marginBottom:4}}>カテゴリ <span style={{color:"#5A5D6A", fontWeight:400}}>(複数選択・選択なしもOK)</span></label>
        <div style={{fontSize:10, color:"#5A5D6A", marginBottom:5}}>営業アクション</div>
        <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:10}}>
          {Object.entries(ACTION_CATEGORIES).map(([k,v])=>{
            const active=(form.categories||[]).includes(k);
            return (
              <button key={k} onClick={()=>toggleCat(k)} style={{
                padding:"5px 10px", borderRadius:16, border:"none", cursor:"pointer", fontSize:11, fontWeight:600,
                background:active?"#2A2D3A":"#12151E",
                color:active?"#E8EAF0":"#5A5D6A",
                outline:active?"1px solid #4FC3F7":"none",
              }}>{v.icon} {v.label}</button>
            );
          })}
        </div>
        <div style={{fontSize:10, color:"#5A5D6A", marginBottom:5}}>商品</div>
        <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:10}}>
          {Object.entries(PRODUCT_CATEGORIES).map(([k,v])=>{
            const active=(form.categories||[]).includes(k);
            return (
              <button key={k} onClick={()=>toggleCat(k)} style={{
                padding:"5px 10px", borderRadius:16, border:"none", cursor:"pointer", fontSize:11, fontWeight:600,
                background:active?v.color+"18":"#12151E", color:active?v.color:"#5A5D6A",
                outline:active?`1px solid ${v.color}`:"none",
              }}>{v.icon} {v.label}</button>
            );
          })}
        </div>
        <div style={{fontSize:10, color:"#5A5D6A", marginBottom:5}}>連絡手段</div>
        <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
          {Object.entries(CONTACT_CATEGORIES).map(([k,v])=>{
            const active=(form.categories||[]).includes(k);
            return (
              <button key={k} onClick={()=>toggleCat(k)} style={{
                padding:"5px 10px", borderRadius:16, border:"none", cursor:"pointer", fontSize:11, fontWeight:600,
                background:active?v.color+"18":"#12151E", color:active?v.color:"#5A5D6A",
                outline:active?`1px solid ${v.color}`:"none",
              }}>{v.icon} {v.label}</button>
            );
          })}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════
  if (loadError) return (
    <div style={{minHeight:"100vh", background:"#0D0F14", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:14, padding:20, textAlign:"center"}}>
      <div style={{fontSize:34}}>⚠️</div>
      <div style={{color:"#FF5252", fontSize:16, fontWeight:800}}>データベースに接続できません</div>
      <div style={{color:"#E8EAF0", fontSize:13, background:"#1A1D26", border:"1px solid #2A2D3A", borderRadius:10, padding:"10px 16px", maxWidth:480, wordBreak:"break-all"}}>
        {loadError.code || ""} {loadError.message || String(loadError)}
      </div>
      {String(loadError.code).includes("permission-denied") && (
        <div style={{color:"#FBBF24", fontSize:12, maxWidth:440, lineHeight:1.7}}>
          Firestoreのセキュリティルールで拒否されています。<br/>
          Firebaseコンソール → Firestore Database → ルール を確認してください(テストモードの期限切れの可能性)
        </div>
      )}
      <button onClick={()=>window.location.reload()} style={{marginTop:6, padding:"9px 22px", borderRadius:10, border:"none", cursor:"pointer", fontSize:13, fontWeight:700, background:"linear-gradient(135deg,#FFD700,#FF8C00)", color:"#0D0F14"}}>再読み込み</button>
    </div>
  );

  if (loading) return (
    <div style={{minHeight:"100vh", background:"#0D0F14", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16}}>
      <div style={{
        width:40, height:40, borderRadius:"50%",
        border:"3px solid #2A2D3A", borderTop:"3px solid #FFD700",
        animation:"spin 0.8s linear infinite",
      }}/>
      <div style={{color:"#7A7D8A", fontSize:13}}>データを読み込み中...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const TABS = [["list","TOP","⚡"],["calendar","カレンダー","📅"],["board","ボード","📊"],["pipeline","案件","🔀"]];

  return (
    <div style={{minHeight:"100vh", background:"#0D0F14", fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif", color:"#E8EAF0"}}>

      {/* レスポンシブ用CSS */}
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .bottomNav{display:none}
        @media (max-width:640px){
          .topTabs{display:none !important}
          .bottomNav{
            display:flex !important;
            position:fixed; bottom:0; left:0; right:0; z-index:250;
            background:#12151E; border-top:1px solid #2A2D3A;
            padding:6px 8px calc(6px + env(safe-area-inset-bottom));
          }
          .fab{bottom:86px !important}
          .mainPad{padding-bottom:150px !important}
        }
      `}</style>

      {/* ── ヘッダー ── */}
      <div style={{
        background:"linear-gradient(135deg,#1A1D26 0%,#12151E 100%)",
        borderBottom:"1px solid #2A2D3A", padding:"14px 18px",
        position:"sticky", top:0, zIndex:100,
      }}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", maxWidth:980, margin:"0 auto"}}>
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <div style={{
              width:34, height:34, borderRadius:10,
              background:"linear-gradient(135deg,#FFD700,#FF8C00)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:17,
            }}>⚡</div>
            <div>
              <div style={{fontWeight:700, fontSize:15, color:"#fff", letterSpacing:"0.05em"}}>SALES TASK</div>
              <div style={{fontSize:10, color:"#7A7D8A", letterSpacing:"0.1em"}}>TOP PERFORMER BOARD</div>
            </div>
          </div>
          <div className="topTabs" style={{display:"flex", gap:5, flexWrap:"wrap", justifyContent:"flex-end"}}>
            {TABS.map(([t,l])=>(
              <button key={t} onClick={()=>setTab(t)} style={{
                padding:"6px 12px", borderRadius:9, border:"none", cursor:"pointer", fontSize:12, fontWeight:700,
                background:tab===t?"linear-gradient(135deg,#FFD700,#FF8C00)":"#1E2230",
                color:tab===t?"#0D0F14":"#7A7D8A", transition:"all 0.2s", whiteSpace:"nowrap",
              }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="mainPad" style={{maxWidth:980, margin:"0 auto", padding:"12px 10px 100px"}}>

        {/* ── 統計バー ── */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:9, marginBottom:12}}>
          {[
            {label:"🔴 緊急", value:stats.high,   accent:"#FF5252"},
            {label:"🟠 重要", value:stats.medium, accent:"#FF9500"},
            {label:"🟢 通常", value:stats.low,    accent:"#34C759"},
          ].map(s=>(
            <div key={s.label} style={{
              background:"#1A1D26", borderRadius:12, padding:"11px 13px",
              border:"1px solid #2A2D3A", position:"relative", overflow:"hidden",
            }}>
              <div style={{fontSize:10, color:"#7A7D8A", marginBottom:4}}>{s.label}</div>
              <div style={{fontSize:22, fontWeight:800, color:s.accent, lineHeight:1}}>{s.value}<span style={{fontSize:12, marginLeft:3}}>件</span></div>
              <div style={{position:"absolute", right:-8, bottom:-8, width:46, height:46, borderRadius:"50%", background:s.accent, opacity:0.07}}/>
            </div>
          ))}
        </div>

        {/* ════════ 一覧タブ ════════ */}
        {tab==="list" && (
          <div>
            {/* 習慣化バー: 達成率リング+ストリーク+週間グラフ */}
            <HabitBar todos={todos} todayStr={todayStr} dailyDone={dailyDone}/>

            {/* クイック追加 */}
            <div style={{display:"flex", gap:7, marginBottom:14}}>
              <input value={quickTitle} onChange={e=>setQuickTitle(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter") quickAdd();}}
                placeholder="⚡ 今日のタスクをサッと追加 (Enter)"
                style={{flex:1, background:"#1A1D26", border:"1px solid #2A2D3A", borderRadius:10, padding:"10px 14px", color:"#E8EAF0", fontSize:13, outline:"none"}}/>
              <button onClick={quickAdd} style={{
                background:"linear-gradient(135deg,#FFD700,#FF8C00)", border:"none", borderRadius:10,
                padding:"0 18px", cursor:"pointer", fontSize:13, fontWeight:800, color:"#0D0F14",
              }}>追加</button>
            </div>

            {/* 報告書欄 + ポモドーロ */}
            <div style={{display:"flex", flexDirection:"column", gap:10, marginBottom:14}}>

              {/* 報告書欄(Firestore同期) */}
              <div style={{background:"#1A1D26", borderRadius:14, border:"1px solid #2A2D3A", padding:"12px 14px"}}>
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8}}>
                  <div style={{fontSize:11, color:"#7A7D8A", fontWeight:700}}>📝 本日提出報告書 <span style={{color:"#34D399"}}>☁同期</span></div>
                  <input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)}
                    style={{background:"#12151E", border:"1px solid #2A2D3A", borderRadius:6, padding:"3px 8px", color:"#7A7D8A", fontSize:11, outline:"none"}}/>
                </div>
                {/* 入力 */}
                <div style={{display:"flex", gap:6, marginBottom:8}}>
                  <input value={reportInput} onChange={e=>setReportInput(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter") addReport();}}
                    placeholder="会社名を入力してEnter"
                    style={{flex:1, background:"#12151E", border:"1px solid #2A2D3A", borderRadius:8, padding:"7px 10px", color:"#E8EAF0", fontSize:12, outline:"none"}}/>
                  <button onClick={addReport} style={{
                    background:"linear-gradient(135deg,#FFD700,#FF8C00)", border:"none", borderRadius:8, padding:"7px 12px", cursor:"pointer", fontSize:12, fontWeight:700, color:"#0D0F14",
                  }}>追加</button>
                </div>
                {/* リスト */}
                {reportItems.filter(r=>r.date===reportDate).length===0
                  ? <div style={{fontSize:11, color:"#3A3D4A", textAlign:"center", padding:"8px 0"}}>本日の報告書なし</div>
                  : <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                      {reportItems.filter(r=>r.date===reportDate).map(r=>(
                        <div key={r.id} style={{display:"flex", alignItems:"center", gap:4, background:"#12151E", border:"1px solid #2A2D3A", borderRadius:20, padding:"4px 10px"}}>
                          <span style={{fontSize:12, color:"#E8EAF0"}}>📄 {r.name}</span>
                          <button onClick={()=>deleteReport(r.id)} style={{background:"none", border:"none", cursor:"pointer", color:"#FF5252", fontSize:11, padding:0}}>×</button>
                        </div>
                      ))}
                    </div>
                }
              </div>

              {/* ポモドーロタイマー */}
              <div style={{background:"#1A1D26", borderRadius:14, border:`1px solid ${pomoMode==="work"?"#FF444430":"#34C75930"}`, padding:"12px 16px"}}>
                <div style={{display:"flex", alignItems:"center", gap:12}}>
                  <div style={{fontSize:11, color:pomoMode==="work"?"#FF5252":"#34C759", fontWeight:700, whiteSpace:"nowrap"}}>
                    {pomoMode==="work"?"🍅 集中中":"☕ 休憩中"}
                  </div>
                  <div style={{fontSize:28, fontWeight:800, color:pomoMode==="work"?"#FF5252":"#34C759", lineHeight:1, fontVariantNumeric:"tabular-nums", flex:1}}>
                    {pomoFmt(pomoTime)}
                  </div>
                  <div style={{display:"flex", gap:6, alignItems:"center"}}>
                    <button onClick={()=>setPomoRunning(!pomoRunning)} style={{
                      background:pomoRunning?"#FF444418":"#34C75918", border:`1px solid ${pomoRunning?"#FF4444":"#34C759"}`,
                      borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:13, fontWeight:700,
                      color:pomoRunning?"#FF5252":"#34C759",
                    }}>{pomoRunning?"⏸":"▶"}</button>
                    <button onClick={pomoReset} style={{background:"#1E2230", border:"1px solid #2A2D3A", borderRadius:8, padding:"6px 10px", cursor:"pointer", fontSize:13, color:"#7A7D8A"}}>↺</button>
                    <div style={{fontSize:10, color:"#7A7D8A", whiteSpace:"nowrap"}}>🍅 {pomoCount}セット</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 営業日カウンター */}
            {(()=>{
              const t3 = new Date();
              const passed2   = getBizDaysPassed(t3.getFullYear(), t3.getMonth()+1);
              const totalBiz2 = getBizDaysInMonth(t3.getFullYear(), t3.getMonth()+1);
              const remain2   = totalBiz2 - passed2;
              return (
                <div style={{display:"flex", gap:8, marginBottom:10}}>
                  {[
                    {label:"営業日目", value:passed2,   color:"#FFD700"},
                    {label:"残り営業日", value:remain2,  color:"#FF9500"},
                    {label:"月間営業日", value:totalBiz2, color:"#94A3B8"},
                  ].map(s=>(
                    <div key={s.label} style={{flex:1, background:"#1A1D26", borderRadius:10, border:"1px solid #2A2D3A", padding:"10px 12px", textAlign:"center"}}>
                      <div style={{fontSize:22, fontWeight:800, color:s.color, lineHeight:1}}>{s.value}</div>
                      <div style={{fontSize:10, color:"#7A7D8A", marginTop:3}}>{s.label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* 進捗サマリー */}
            {boardData && (()=>{
              const today3   = new Date();
              const mLabel   = (today3.getMonth()+1)+"月";
              const months2  = boardData.months||HALF_MONTHS;
              const prods    = boardData.products||[];
              const MILESTONES = { membership:[{day:5,pct:45},{day:10,pct:65},{day:15,pct:100}], news:[{day:5,pct:85},{day:15,pct:100}] };
              function fmt2(n){const v=Number(n)||0;return v>=10000?(v/10000).toFixed(1)+"万":v.toLocaleString();}
              function pct2(a,b){return b>0?Math.round((a/b)*100):0;}
              return (
                <div style={{background:"#1A1D26", borderRadius:14, border:"1px solid #2A2D3A", padding:"12px 14px", marginBottom:14}}>
                  <div style={{display:"flex", alignItems:"center", marginBottom:10}}>
                    <div style={{fontSize:11, color:"#7A7D8A", fontWeight:700}}>📊 今月進捗 ({mLabel})</div>
                  </div>
                  <div style={{display:"flex", flexDirection:"column", gap:8}}>
                    {prods.map(prod=>{
                      const color2={membership:"#A78BFA",cosmos:"#34D399",news:"#60A5FA"}[prod.key]||"#94A3B8";
                      const tgt  = Number(prod.monthlyTargets?.[mLabel])||0;
                      const res  = Number(prod.monthlyResults?.[mLabel])||0;
                      const p3   = pct2(res,tgt);
                      const cumTgt = months2.reduce((s,m)=>s+(Number(prod.monthlyTargets?.[m])||0),0);
                      const cumRes = months2.reduce((s,m)=>s+(Number(prod.monthlyResults?.[m])||0),0);
                      const cumP   = pct2(cumRes,cumTgt);
                      const ms2 = MILESTONES[prod.key]||[];
                      const nextMs = ms2.find(m=>Math.round(tgt*m.pct/100)>res);
                      const msText = nextMs
                        ? `次MS(${nextMs.day}営業日/${nextMs.pct}%): あと${fmt2(Math.round(tgt*nextMs.pct/100)-res)}円`
                        : ms2.length>0?"✅ 全MS達成":"";
                      return (
                        <div key={prod.key} style={{display:"flex", alignItems:"center", gap:10}}>
                          <div style={{width:52, fontSize:11, fontWeight:700, color:color2, flexShrink:0}}>{prod.label}</div>
                          <div style={{flex:1}}>
                            <div style={{height:6, background:"#12151E", borderRadius:3, overflow:"hidden"}}>
                              <div style={{height:"100%", width:`${Math.min(p3,100)}%`, background:color2, borderRadius:3}}/>
                            </div>
                          </div>
                          <div style={{fontSize:11, color:p3>=100?"#FFD700":p3>=70?"#66BB6A":"#E8EAF0", fontWeight:700, minWidth:36, textAlign:"right"}}>{p3}%</div>
                          <div style={{fontSize:10, color:"#7A7D8A", minWidth:60, textAlign:"right"}}>累計{cumP}%</div>
                          {msText&&<div style={{fontSize:10, color:"#FBBF24", minWidth:120, textAlign:"right"}}>{msText}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* フィルタ・並び替え */}
            <div style={{display:"flex", gap:8, marginBottom:12, alignItems:"center", flexWrap:"wrap"}}>
              <div style={{display:"flex", gap:5}}>
                {[["all","すべて"],["undone","未"],["progress","着手中"],["done","済"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setListFilter(v)} style={{
                    padding:"5px 12px", borderRadius:16, border:"none", cursor:"pointer", fontSize:12, fontWeight:600,
                    background:listFilter===v?"#FFD700":"#1A1D26",
                    color:listFilter===v?"#0D0F14":"#7A7D8A",
                  }}>{l}</button>
                ))}
              </div>
              <div style={{marginLeft:"auto", display:"flex", gap:5, alignItems:"center"}}>
                <span style={{fontSize:11, color:"#5A5D6A"}}>並び替え</span>
                {[["date","日付"],["priority","優先度"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setListSort(v)} style={{
                    padding:"5px 11px", borderRadius:16, border:"none", cursor:"pointer", fontSize:11, fontWeight:600,
                    background:listSort===v?"#2A2D3A":"#1A1D26",
                    color:listSort===v?"#E8EAF0":"#5A5D6A",
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {/* 検索 */}
            <input value={listSearch} onChange={e=>setListSearch(e.target.value)}
              placeholder="🔍 タスク・メモを検索"
              style={{width:"100%", boxSizing:"border-box", background:"#1A1D26", border:"1px solid #2A2D3A", borderRadius:10, padding:"9px 13px", color:"#E8EAF0", fontSize:13, outline:"none", marginBottom:10}}/>

            <CatFilterBar catTab={listCatTab} setCatTab={setListCatTab} catFilter={listCatFilter} setCatFilter={setListCatFilter}/>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10}}>
              <div style={{fontSize:12, color:"#5A5D6A"}}>{listTodos.length}件</div>
              <div style={{display:"flex", gap:6}}>
                <button onClick={deleteDoneTodos} style={{
                  padding:"6px 12px", borderRadius:9, border:"1px solid #FF525260", cursor:"pointer", fontSize:11, fontWeight:700,
                  background:"#FF525218", color:"#FF5252",
                }}>🗑 済を一括削除</button>
                <button onClick={()=>exportToExcel(todos, reportItems)} style={{
                  padding:"6px 12px", borderRadius:9, border:"1px solid #34D39960", cursor:"pointer", fontSize:11, fontWeight:700,
                  background:"#34D39918", color:"#34D399",
                }}>📥 今西さん提出用</button>
              </div>
            </div>
            <div style={{display:"flex", flexDirection:"column", gap:9}}>
              {listTodos.length===0&&(
                <div style={{background:"#1A1D26", borderRadius:14, padding:"36px 20px", textAlign:"center", color:"#7A7D8A", border:"1px dashed #2A2D3A"}}>
                  <div style={{fontSize:28, marginBottom:8}}>📭</div>
                  <div>タスクなし</div>
                </div>
              )}
              {listTodos.map(t=><TodoCard key={t.id} todo={t} showDate={true} onEdit={openEdit} onDelete={deleteTodo} onCycle={cycleStatus}/>)}
            </div>
          </div>
        )}

        {/* ════════ 案件タブ ════════ */}
        {tab==="pipeline" && (
          <PipelineTab deals={deals} dealsLoading={dealsLoading} todayStr={todayStr}
            openAddDeal={openAddDeal} openEditDeal={openEditDeal} deleteDeal={deleteDeal} moveDeal={moveDeal}/>
        )}

        {/* ════════ ボードタブ ════════ */}
        {tab==="board" && (
          <BoardTab boardData={boardData} setBoardData={setBoardData} saveBoardData={saveBoardData}
            boardLoading={boardLoading} boardEdit={boardEdit} setBoardEdit={setBoardEdit}/>
        )}

        {/* ════════ カレンダータブ ════════ */}
        {tab==="calendar" && (
          <div>
            <div style={{display:"flex", gap:5, marginBottom:14}}>
              {[["month","月次"],["3day","3日"],["day","日次"]].map(([v,l])=>(
                <button key={v} onClick={()=>setCalView(v)} style={{
                  padding:"6px 16px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, fontWeight:700,
                  background:calView===v?"linear-gradient(135deg,#FFD700,#FF8C00)":"#1E2230",
                  color:calView===v?"#0D0F14":"#7A7D8A", transition:"all 0.2s",
                }}>{l}</button>
              ))}
            </div>

            {/* 月次 */}
            {calView==="month"&&(
              <div style={{background:"#1A1D26", borderRadius:18, border:"1px solid #2A2D3A", overflow:"hidden"}}>
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 17px", borderBottom:"1px solid #2A2D3A"}}>
                  <button onClick={()=>setCurrentDate(new Date(year,month-1,1))} style={{background:"#12151E", border:"1px solid #2A2D3A", borderRadius:8, width:30, height:30, cursor:"pointer", color:"#E8EAF0", fontSize:16}}>‹</button>
                  <div style={{fontWeight:700, fontSize:17}}>{year}年 {MONTHS_JP[month]}</div>
                  <button onClick={()=>setCurrentDate(new Date(year,month+1,1))} style={{background:"#12151E", border:"1px solid #2A2D3A", borderRadius:8, width:30, height:30, cursor:"pointer", color:"#E8EAF0", fontSize:16}}>›</button>
                </div>
                <div style={{display:"grid", gridTemplateColumns:"repeat(7,1fr)", textAlign:"center"}}>
                  {DAYS_JP.map((d,i)=>(
                    <div key={d} style={{padding:"7px 0", fontSize:11, fontWeight:700, color:i===0?"#FF5252":i===6?"#4FC3F7":"#7A7D8A", borderBottom:"1px solid #2A2D3A"}}>{d}</div>
                  ))}
                </div>
                <div style={{display:"grid", gridTemplateColumns:"repeat(7,1fr)"}}>
                  {calendarDays.map((d,i)=>{
                    if(!d) return <div key={`e${i}`} style={{minHeight:70, borderRight:"1px solid #1E2230", borderBottom:"1px solid #1E2230"}}/>;
                    const ds=makeDateStr(year,month,d);
                    const dt=todosFor(ds);
                    const isToday=ds===todayStr, isSel=ds===selectedDate;
                    const dow=(firstDay+d-1)%7;
                    const hasHigh=dt.some(t=>t.priority==="high"&&!isDoneTodo(t));
                    return (
                      <div key={d} onClick={()=>{setSelectedDate(ds);setCalView("day");}} style={{
                        minHeight:70, padding:"5px", cursor:"pointer",
                        borderRight:"1px solid #1E2230", borderBottom:"1px solid #1E2230",
                        background:isSel?"#1E2538":isToday?"#1A2028":"transparent",
                      }}>
                        <div style={{
                          width:24, height:24, borderRadius:"50%",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          background:isToday?"linear-gradient(135deg,#FFD700,#FF8C00)":"transparent",
                          color:isToday?"#0D0F14":dow===0?"#FF5252":dow===6?"#4FC3F7":"#E8EAF0",
                          fontSize:12, fontWeight:isToday?800:500, marginBottom:3, position:"relative",
                        }}>
                          {d}
                          {hasHigh&&<span style={{position:"absolute",top:-1,right:-1,width:6,height:6,borderRadius:"50%",background:"#FF4444"}}/>}
                        </div>
                        {dt.slice(0,2).map(t=>{
                          const cats=getCats(t);
                          const firstCat=cats[0]; const cc=catColor(firstCat);
                          const icon=(firstCat&&(ACTION_CATEGORIES[firstCat]||PRODUCT_CATEGORIES[firstCat]||CONTACT_CATEGORIES[firstCat])?.icon)||"";
                          return <div key={t.id} style={{fontSize:9, padding:"1px 4px", borderRadius:3, marginBottom:2, background:cc+"20", color:cc, opacity:isDoneTodo(t)?0.4:1, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis"}}>{icon} {t.title}</div>;
                        })}
                        {dt.length>2&&<div style={{fontSize:9,color:"#7A7D8A"}}>+{dt.length-2}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3日 */}
            {calView==="3day"&&(
              <div>
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12}}>
                  <button onClick={()=>setSelectedDate(addDays(selectedDate,-3))} style={{background:"#1A1D26", border:"1px solid #2A2D3A", borderRadius:8, padding:"6px 13px", cursor:"pointer", color:"#E8EAF0", fontSize:13}}>‹ 前3日</button>
                  <div style={{fontWeight:700, fontSize:13, color:"#7A7D8A"}}>{fmtDate(threeDays[0])} 〜 {fmtDate(threeDays[2])}</div>
                  <button onClick={()=>setSelectedDate(addDays(selectedDate,3))} style={{background:"#1A1D26", border:"1px solid #2A2D3A", borderRadius:8, padding:"6px 13px", cursor:"pointer", color:"#E8EAF0", fontSize:13}}>次3日 ›</button>
                </div>
                <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10}}>
                  {threeDays.map(ds=>{
                    const dt=todosFor(ds), d=new Date(ds), dow=d.getUTCDay(), isToday=ds===todayStr;
                    return (
                      <div key={ds} style={{background:"#1A1D26", borderRadius:14, border:isToday?"1px solid #FFD70060":"1px solid #2A2D3A", overflow:"hidden"}}>
                        <div style={{padding:"10px 12px", borderBottom:"1px solid #2A2D3A", background:isToday?"#FFD70010":"transparent", display:"flex", alignItems:"center", gap:6}}>
                          <div style={{fontWeight:800, fontSize:20, color:dow===0?"#FF5252":dow===6?"#4FC3F7":"#E8EAF0"}}>{d.getUTCDate()}</div>
                          <div>
                            <div style={{fontSize:10, color:"#7A7D8A"}}>{d.getUTCMonth()+1}月 {DAYS_JP[dow]}曜</div>
                            {isToday&&<span style={{fontSize:9, background:"#FFD700", color:"#0D0F14", borderRadius:3, padding:"1px 5px", fontWeight:700}}>TODAY</span>}
                          </div>
                          <div style={{marginLeft:"auto", background:"#12151E", borderRadius:10, padding:"2px 8px", fontSize:11, color:"#7A7D8A"}}>{dt.length}件</div>
                        </div>
                        <div style={{padding:"8px", display:"flex", flexDirection:"column", gap:6}}>
                          {dt.length===0&&<div style={{textAlign:"center", color:"#3A3D4A", fontSize:11, padding:"10px 0"}}>タスクなし</div>}
                          {dt.map(t=>{
                            const done=isDoneTodo(t);
                            const pri=PRIORITIES[t.priority]||PRIORITIES.medium;
                            return (
                              <div key={t.id} onClick={()=>{setSelectedDate(ds);setCalView("day");}} style={{background:"#12151E", borderRadius:8, padding:"8px 10px", border:`1px solid ${done?"#2A2D3A":pri.color+"40"}`, opacity:done?0.5:1, cursor:"pointer"}}>
                                <div style={{fontSize:12, fontWeight:600, marginBottom:3, textDecoration:done?"line-through":"none", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis"}}>{t.title}</div>
                                <div style={{display:"flex", gap:4}}>
                                  <span style={{fontSize:9, padding:"1px 5px", borderRadius:10, background:pri.bg, color:pri.color, fontWeight:700}}>{pri.label}</span>
                                  {getCats(t).slice(0,2).map(ck=>{
                                    const c3=ACTION_CATEGORIES[ck]||PRODUCT_CATEGORIES[ck]||CONTACT_CATEGORIES[ck];
                                    const cc3=catColor(ck);
                                    return c3?<span key={ck} style={{fontSize:9, padding:"1px 5px", borderRadius:10, background:cc3+"18", color:cc3}}>{c3.icon} {c3.label}</span>:null;
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          <button onClick={()=>{setSelectedDate(ds);openAdd(ds);}} style={{width:"100%", background:"transparent", border:"1px dashed #2A2D3A", borderRadius:8, padding:"6px", cursor:"pointer", color:"#5A5D6A", fontSize:11}}>+ 追加</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 日次 */}
            {calView==="day"&&(
              <div>
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:13}}>
                  <button onClick={()=>setSelectedDate(addDays(selectedDate,-1))} style={{background:"#1A1D26", border:"1px solid #2A2D3A", borderRadius:8, padding:"6px 13px", cursor:"pointer", color:"#E8EAF0", fontSize:13}}>‹ 前日</button>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontWeight:800, fontSize:20}}>{fmtDate(selectedDate)}</div>
                    <div style={{fontSize:12, color:"#7A7D8A"}}>
                      {DAYS_JP[new Date(selectedDate).getUTCDay()]}曜日
                      {selectedDate===todayStr&&<span style={{marginLeft:6, background:"#FFD700", color:"#0D0F14", borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700}}>TODAY</span>}
                    </div>
                  </div>
                  <button onClick={()=>setSelectedDate(addDays(selectedDate,1))} style={{background:"#1A1D26", border:"1px solid #2A2D3A", borderRadius:8, padding:"6px 13px", cursor:"pointer", color:"#E8EAF0", fontSize:13}}>翌日 ›</button>
                </div>
                <CatFilterBar catTab={calCatTab} setCatTab={setCalCatTab} catFilter={calCatFilter} setCatFilter={setCalCatFilter}/>
                <div style={{display:"flex", flexDirection:"column", gap:9}}>
                  {dayTodos.length===0&&(
                    <div style={{background:"#1A1D26", borderRadius:14, padding:"36px 20px", textAlign:"center", color:"#7A7D8A", border:"1px dashed #2A2D3A"}}>
                      <div style={{fontSize:28, marginBottom:8}}>📭</div>
                      <div>タスクなし</div>
                    </div>
                  )}
                  {dayTodos.map(t=><TodoCard key={t.id} todo={t} onEdit={openEdit} onDelete={deleteTodo} onCycle={cycleStatus}/>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── モバイル用下部ナビ ── */}
      <div className="bottomNav">
        {TABS.map(([t,l,icon])=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            flex:1, background:"none", border:"none", cursor:"pointer",
            display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"4px 0",
            color:tab===t?"#FFD700":"#5A5D6A",
          }}>
            <span style={{fontSize:18}}>{icon}</span>
            <span style={{fontSize:9, fontWeight:700}}>{l}</span>
          </button>
        ))}
      </div>

      {/* 案件モーダル */}
      {showDealModal&&(
        <div style={{position:"fixed",inset:0,background:"#000000BB",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16}}
          onClick={e=>e.target===e.currentTarget&&setShowDealModal(false)}>
          <div style={{background:"#1A1D26",borderRadius:20,padding:22,width:"100%",maxWidth:440,border:"1px solid #2A2D3A",maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{fontWeight:800,fontSize:17,marginBottom:18}}>{editDeal?"案件編集":"案件追加"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:13}}>
              {/* 会社名 */}
              <div>
                <label style={{fontSize:11,color:"#7A7D8A",display:"block",marginBottom:5}}>会社名</label>
                <input value={dealForm.company} onChange={e=>setDealForm({...dealForm,company:e.target.value})}
                  placeholder="例：山田商事" style={inputStyle}/>
              </div>
              {/* ステージ */}
              <div>
                <label style={{fontSize:11,color:"#7A7D8A",display:"block",marginBottom:5}}>ステージ</label>
                <div style={{display:"flex",gap:6}}>
                  {STAGES.map(s=>(
                    <button key={s.key} onClick={()=>setDealForm({...dealForm,stage:s.key})} style={{
                      flex:1,padding:"7px 4px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
                      background:dealForm.stage===s.key?s.color+"30":"#12151E",
                      color:dealForm.stage===s.key?s.color:"#5A5D6A",
                      outline:dealForm.stage===s.key?`1px solid ${s.color}`:"none",
                    }}>{s.label}</button>
                  ))}
                </div>
              </div>
              {/* 商品 */}
              <div>
                <label style={{fontSize:11,color:"#7A7D8A",display:"block",marginBottom:5}}>商品（複数選択可）</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {PRODUCTS.map(p=>{
                    const active=(dealForm.products||[]).includes(p.key);
                    return (
                      <button key={p.key} onClick={()=>{
                        const next=active?(dealForm.products||[]).filter(k=>k!==p.key):[...(dealForm.products||[]),p.key];
                        setDealForm({...dealForm,products:next});
                      }} style={{
                        padding:"6px 12px",borderRadius:16,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,
                        background:active?p.color+"18":"#12151E",color:active?p.color:"#5A5D6A",
                        outline:active?`1px solid ${p.color}`:"none",
                      }}>{p.label}</button>
                    );
                  })}
                </div>
              </div>
              {/* 金額 */}
              <div>
                <label style={{fontSize:11,color:"#7A7D8A",display:"block",marginBottom:5}}>金額（円）</label>
                <input type="number" value={dealForm.amount} onChange={e=>setDealForm({...dealForm,amount:e.target.value})}
                  placeholder="例：500000" style={inputStyle}/>
              </div>
              {/* 担当者 */}
              <div>
                <label style={{fontSize:11,color:"#7A7D8A",display:"block",marginBottom:5}}>担当者名</label>
                <input value={dealForm.person} onChange={e=>setDealForm({...dealForm,person:e.target.value})}
                  placeholder="例：田中部長" style={inputStyle}/>
              </div>
              {/* 次回アクション日 */}
              <div>
                <label style={{fontSize:11,color:"#7A7D8A",display:"block",marginBottom:5}}>次回アクション日 <span style={{color:"#5A5D6A",fontWeight:400}}>(設定するとフォロータスクを自動作成)</span></label>
                <input type="date" value={dealForm.nextAction} onChange={e=>setDealForm({...dealForm,nextAction:e.target.value})} style={inputStyle}/>
              </div>
              {/* 備考 */}
              <div>
                <label style={{fontSize:11,color:"#7A7D8A",display:"block",marginBottom:5}}>備考</label>
                <textarea value={dealForm.note} onChange={e=>setDealForm({...dealForm,note:e.target.value})}
                  rows={2} placeholder="メモ..." style={{...inputStyle,resize:"none"}}/>
              </div>
              <div style={{display:"flex",gap:10,marginTop:2}}>
                <button onClick={()=>setShowDealModal(false)} style={{flex:1,padding:"11px",borderRadius:12,border:"1px solid #2A2D3A",background:"transparent",color:"#7A7D8A",cursor:"pointer",fontSize:13,fontWeight:600}}>キャンセル</button>
                <button onClick={saveDeal} style={{flex:2,padding:"11px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#FFD700,#FF8C00)",color:"#0D0F14",cursor:"pointer",fontSize:13,fontWeight:800}}>保存する</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button className="fab" onClick={()=>openAdd()} style={{
        position:"fixed", bottom:26, right:22,
        width:54, height:54, borderRadius:"50%",
        background:"linear-gradient(135deg,#FFD700,#FF8C00)",
        border:"none", cursor:"pointer", fontSize:26, color:"#0D0F14",
        boxShadow:"0 4px 20px #FF8C0050",
        display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, zIndex:200,
      }}>+</button>

      {/* タスクモーダル */}
      {showModal&&(
        <div style={{position:"fixed", inset:0, background:"#000000BB", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:16}}
          onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={{background:"#1A1D26", borderRadius:20, padding:22, width:"100%", maxWidth:440, border:"1px solid #2A2D3A", maxHeight:"92vh", overflowY:"auto"}}>
            <div style={{fontWeight:800, fontSize:17, marginBottom:18}}>{editTodo?"タスク編集":"タスク追加"}</div>
            <div style={{display:"flex", flexDirection:"column", gap:13}}>

              {/* テンプレート */}
              <div>
                <label style={{fontSize:11, color:"#7A7D8A", display:"block", marginBottom:5}}>テンプレート <span style={{color:"#5A5D6A",fontWeight:400}}>(タップで反映)</span></label>
                <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                  {templates.map((tp,i)=>(
                    <span key={i} style={{display:"inline-flex", alignItems:"center", gap:4, background:"#12151E", border:"1px solid #2A2D3A", borderRadius:16, padding:"4px 4px 4px 10px"}}>
                      <button onClick={()=>applyTemplate(tp)} style={{background:"none", border:"none", cursor:"pointer", color:"#4FC3F7", fontSize:11, fontWeight:700, padding:0}}>📌 {tp.name}</button>
                      <button onClick={()=>deleteTemplate(i)} style={{background:"none", border:"none", cursor:"pointer", color:"#5A5D6A", fontSize:10, padding:"0 4px"}}>×</button>
                    </span>
                  ))}
                  <button onClick={saveAsTemplate} style={{background:"#1E2230", border:"1px dashed #2A2D3A", borderRadius:16, padding:"4px 10px", cursor:"pointer", color:"#7A7D8A", fontSize:11}}>+ 現在の内容を登録</button>
                </div>
              </div>

              <div>
                <label style={{fontSize:11, color:"#7A7D8A", display:"block", marginBottom:5}}>タスク名</label>
                <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="例：山田商事 提案書作成" style={inputStyle}/>
              </div>
              <div>
                <label style={{fontSize:11, color:"#7A7D8A", display:"block", marginBottom:5}}>日付</label>
                <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={inputStyle}/>
              </div>
              <div>
                <label style={{fontSize:11, color:"#7A7D8A", display:"block", marginBottom:5}}>繰り返し <span style={{color:"#5A5D6A",fontWeight:400}}>(済にすると次回分を自動作成)</span></label>
                <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                  {Object.entries(REPEATS).map(([k,v])=>(
                    <button key={k} onClick={()=>setForm({...form,repeat:k})} style={{
                      flex:1, minWidth:60, padding:"8px 4px", borderRadius:8, border:"none", cursor:"pointer", fontSize:11, fontWeight:700,
                      background:(form.repeat||"")===k?"#4FC3F730":"#12151E",
                      color:(form.repeat||"")===k?"#4FC3F7":"#5A5D6A",
                      outline:(form.repeat||"")===k?"1px solid #4FC3F7":"none",
                    }}>{k===""?"なし":"🔁 "+v.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{fontSize:11, color:"#7A7D8A", display:"block", marginBottom:5}}>優先度</label>
                <div style={{display:"flex", gap:8}}>
                  {Object.entries(PRIORITIES).map(([k,v])=>(
                    <button key={k} onClick={()=>setForm({...form,priority:k})} style={{
                      flex:1, padding:"8px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, fontWeight:700,
                      background:form.priority===k?v.bg:"#12151E", color:form.priority===k?v.color:"#5A5D6A",
                      outline:form.priority===k?`1px solid ${v.color}`:"none",
                    }}>{v.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{fontSize:11, color:"#7A7D8A", display:"block", marginBottom:5}}>ステータス</label>
                <div style={{display:"flex", gap:8}}>
                  {Object.entries(STATUSES).map(([k,v])=>(
                    <button key={k} onClick={()=>setForm({...form,status:k})} style={{
                      flex:1, padding:"8px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, fontWeight:700,
                      background:form.status===k?v.bg:"#12151E", color:form.status===k?v.color:"#5A5D6A",
                      outline:form.status===k?`1px solid ${v.color}`:"none",
                    }}>{v.icon} {v.label}</button>
                  ))}
                </div>
              </div>
              <CategoryPicker/>
              <div>
                <label style={{fontSize:11, color:"#7A7D8A", display:"block", marginBottom:5}}>メモ</label>
                <textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})} rows={2} placeholder="補足メモ..." style={{...inputStyle,resize:"none"}}/>
              </div>
              <div style={{display:"flex", gap:10, marginTop:2}}>
                <button onClick={()=>setShowModal(false)} style={{flex:1, padding:"11px", borderRadius:12, border:"1px solid #2A2D3A", background:"transparent", color:"#7A7D8A", cursor:"pointer", fontSize:13, fontWeight:600}}>キャンセル</button>
                <button onClick={saveTodo} disabled={saving} style={{flex:2, padding:"11px", borderRadius:12, border:"none", background:saving?"#2A2D3A":"linear-gradient(135deg,#FFD700,#FF8C00)", color:saving?"#7A7D8A":"#0D0F14", cursor:saving?"not-allowed":"pointer", fontSize:13, fontWeight:800}}>
                  {saving?"保存中...":"保存する"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
