import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import * as XLSX from "xlsx";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from "firebase/firestore";

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

// ── 定数 ──────────────────────────────────────────────
const PRIORITIES = {
  high:   { label: "緊急", color: "#FF4444", bg: "#FF444418" },
  medium: { label: "重要", color: "#FF9500", bg: "#FF950018" },
  low:    { label: "通常", color: "#34C759", bg: "#34C75918" },
};

const STATUSES = {
  undone:   { label: "未",    color: "#94A3B8", bg: "#94A3B818", icon: "○" },
  progress: { label: "着手中", color: "#FBBF24", bg: "#FBBF2418", icon: "◑" },
  done:     { label: "済",    color: "#34C759", bg: "#34C75918", icon: "✓" },
};

const ACTION_CATEGORIES = {
  prospect: { label: "新規開拓", icon: "🎯" },
  followup: { label: "フォロー", icon: "📞" },
  proposal: { label: "提案",    icon: "📋" },
  contract: { label: "契約",    icon: "✍️" },
  admin:    { label: "管理",    icon: "🗂️" },
};

const PRODUCT_CATEGORIES = {
  membership: { label: "加盟料",   icon: "🏅", color: "#A78BFA" },
  news:       { label: "ニュース", icon: "📰", color: "#60A5FA" },
  cos:        { label: "COS",     icon: "💼", color: "#34D399" },
  att:        { label: "ATT",     icon: "📡", color: "#FBBF24" },
  net:        { label: "NET",     icon: "🌐", color: "#F87171" },
  ticket:     { label: "チケット", icon: "🎟️", color: "#FB923C" },
};

const CONTACT_CATEGORIES = {
  tel_office: { label: "事務所電話", icon: "☎️", color: "#818CF8" },
  tel_mobile: { label: "携帯電話",   icon: "📱", color: "#34D399" },
  email:      { label: "メール",     icon: "✉️", color: "#60A5FA" },
  line:       { label: "LINE",       icon: "💬", color: "#4ADE80" },
  other:      { label: "その他",     icon: "💡", color: "#94A3B8" },
};

const ALL_CATEGORIES = { ...ACTION_CATEGORIES, ...PRODUCT_CATEGORIES, ...CONTACT_CATEGORIES };
const DAYS_JP   = ["日","月","火","水","木","金","土"];
const MONTHS_JP = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

// ── ユーティリティ ────────────────────────────────────

// ── Excel出力（今西さん提出用） ────────────────────────
function exportToExcel(todos) {
  // ── データ生成 ──────────────────────────────────────
  const headers = ["日付", "曜日", "タスク内容", "営業アクション", "商品区分", "連絡手段", "緊急度", "完了"];
  const rows = [...todos]
    .filter(t => { const s = t.status||(t.done?"done":"undone"); return s==="undone"||s==="progress"; })
    .sort((a,b) => a.date.localeCompare(b.date))
    .map(t => {
      const d    = new Date(t.date);
      const cats = Array.isArray(t.categories)&&t.categories.length>0
        ? t.categories
        : (t.category ? [t.category] : []);
      const actions  = cats.filter(k=>ACTION_CATEGORIES[k]).map(k=>ACTION_CATEGORIES[k].label).join("・");
      const products = cats.filter(k=>PRODUCT_CATEGORIES[k]).map(k=>PRODUCT_CATEGORIES[k].label).join("・");
      const contacts = cats.filter(k=>CONTACT_CATEGORIES[k]).map(k=>CONTACT_CATEGORIES[k].label).join("・");
      return [
        t.date,
        DAYS_JP[d.getDay()] + "曜日",
        t.title,
        actions,
        products,
        contacts,
        (PRIORITIES[t.priority]||PRIORITIES.medium).label,
        (STATUSES[t.status||(t.done?"done":"undone")]||STATUSES.undone).label,
      ];
    });

  // ── ワークシート作成 ────────────────────────────────
  const wsData = [headers, ...rows];
  const ws     = XLSX.utils.aoa_to_sheet(wsData);

  // ── 列幅設定 ───────────────────────────────────────
  ws["!cols"] = [
    { wch: 12 }, // 日付
    { wch: 8  }, // 曜日
    { wch: 36 }, // タスク内容
    { wch: 16 }, // 営業アクション
    { wch: 14 }, // 商品区分
    { wch: 14 }, // 連絡手段
    { wch: 8  }, // 緊急度
    { wch: 8  }, // 完了
  ];

  // ── 行高さ設定 ─────────────────────────────────────
  ws["!rows"] = wsData.map(() => ({ hpt: 18 }));

  // ── タイトル行スタイル（薄い青塗りつぶし） ──────────
  const titleFill = { patternType: "solid", fgColor: { rgb: "BDD7EE" } };
  const titleFont = { bold: true, color: { rgb: "1F3864" } };
  const titleBorder = {
    top:    { style: "thin", color: { rgb: "9DC3E6" } },
    bottom: { style: "thin", color: { rgb: "9DC3E6" } },
    left:   { style: "thin", color: { rgb: "9DC3E6" } },
    right:  { style: "thin", color: { rgb: "9DC3E6" } },
  };
  headers.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cell]) return;
    ws[cell].s = { fill: titleFill, font: titleFont, border: titleBorder, alignment: { horizontal: "center", vertical: "center" } };
  });

  // ── データ行のボーダー ─────────────────────────────
  const dataBorder = {
    top:    { style: "thin", color: { rgb: "D9D9D9" } },
    bottom: { style: "thin", color: { rgb: "D9D9D9" } },
    left:   { style: "thin", color: { rgb: "D9D9D9" } },
    right:  { style: "thin", color: { rgb: "D9D9D9" } },
  };
  rows.forEach((_, ri) => {
    headers.forEach((_, ci) => {
      const cell = XLSX.utils.encode_cell({ r: ri+1, c: ci });
      if (!ws[cell]) ws[cell] = { t: "s", v: "" };
      ws[cell].s = { border: dataBorder, alignment: { vertical: "center", wrapText: false } };
    });
  });

  // ── ワークブック出力 ────────────────────────────────
  const wb  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "タスク一覧");
  const now = toJSTDateStr(new Date());
  XLSX.writeFile(wb, "タスク一覧_" + now.replace(/-/g,"") + ".xlsx");
}

function makeDateStr(y,m,d) { return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }
// ── 日本祝日データ ────────────────────────────────────
const JP_HOLIDAYS = new Set([
  // 2025年
  "2025-01-01","2025-01-13","2025-02-11","2025-02-23","2025-02-24",
  "2025-03-20","2025-04-29","2025-05-03","2025-05-04","2025-05-05",
  "2025-05-06","2025-07-21","2025-08-11","2025-09-15","2025-09-22",
  "2025-09-23","2025-10-13","2025-11-03","2025-11-23","2025-11-24",
  "2025-12-23",
  // 2026年
  "2026-01-01","2026-01-12","2026-02-11","2026-02-23","2026-03-20",
  "2026-04-29","2026-05-03","2026-05-04","2026-05-05","2026-05-06",
  "2026-07-20","2026-08-11","2026-09-21","2026-09-22","2026-09-23",
  "2026-10-12","2026-11-03","2026-11-23",
]);
function isHoliday(y,m,d) {
  const s = `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  return JP_HOLIDAYS.has(s);
}
function isBizDay(y,m,d) {
  const dow = new Date(y,m-1,d).getDay();
  return dow!==0 && dow!==6 && !isHoliday(y,m,d);
}
function getBizDaysInMonth(y,m) {
  const total = new Date(y,m,0).getDate();
  let c=0;
  for(let d=1;d<=total;d++) if(isBizDay(y,m,d)) c++;
  return c;
}
function getBizDaysPassed(y,m) {
  const today0 = new Date();
  const last = (today0.getFullYear()===y&&today0.getMonth()+1===m) ? today0.getDate() : new Date(y,m,0).getDate();
  let c=0;
  for(let d=1;d<=last;d++) if(isBizDay(y,m,d)) c++;
  return c;
}

function toJSTDateStr(d) {
  const jst = new Date(d.getTime() + 9*60*60*1000);
  return jst.toISOString().slice(0,10);
}
function addDays(str,n) { const d=new Date(str); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function fmtDate(str) { const d=new Date(str); return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`; }
function catColor(key) { return PRODUCT_CATEGORIES[key]?.color ?? CONTACT_CATEGORIES[key]?.color ?? "#94A3B8"; }

const today    = new Date();
const todayStr = toJSTDateStr(today);

// ── メインコンポーネント ──────────────────────────────
export default function App() {
  const [tab, setTab]           = useState("list");
  // ④ 報告書欄
  const [reportItems, setReportItems] = useState(() => {
    try { const s=localStorage.getItem("sales-report"); return s?JSON.parse(s):[]; } catch { return []; }
  });
  const [reportInput, setReportInput] = useState("");
  const [reportDate,  setReportDate]  = useState(todayStr);
  useEffect(()=>{ try{localStorage.setItem("sales-report",JSON.stringify(reportItems));}catch{} },[reportItems]);

  // ⑤ ポモドーロ
  const POMO_WORK = 25*60, POMO_BREAK = 5*60;
  const [pomoTime,    setPomoTime]    = useState(POMO_WORK);
  const [pomoRunning, setPomoRunning] = useState(false);
  const [pomoMode,    setPomoMode]    = useState("work"); // "work"|"break"
  const [pomoCount,   setPomoCount]   = useState(0);
  useEffect(()=>{
    if(!pomoRunning) return;
    const t = setInterval(()=>{
      setPomoTime(prev=>{
        if(prev<=1){
          clearInterval(t);
          setPomoRunning(false);
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
  const [calView, setCalView]   = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1)); // JSTベース
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Firestore リアルタイム同期
  const [todos, setTodos]   = useState([]);
  const [loading, setLoading] = useState(true);

  // ── 案件パイプライン ──────────────────────────────
  const STAGES = [
    { key:"contact",  label:"初回接触", color:"#60A5FA" },
    { key:"proposal", label:"提案",    color:"#FBBF24" },
    { key:"closing",  label:"クロージング", color:"#F87171" },
    { key:"won",      label:"成約",    color:"#34D399" },
  ];
  const [deals, setDeals]         = useState([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [showDealModal, setShowDealModal] = useState(false);
  const [editDeal, setEditDeal]   = useState(null);
  const [dealForm, setDealForm]   = useState({ company:"", products:[], amount:"", person:"", note:"", stage:"contact" });

  useEffect(()=>{
    const unsub = onSnapshot(collection(db,"sales_deals"),(snap)=>{
      setDeals(snap.docs.map(d=>({id:d.id,...d.data()})));
      setDealsLoading(false);
    });
    return ()=>unsub();
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  function openAddDeal(stage) {
    setEditDeal(null);
    setDealForm({ company:"", products:[], amount:"", person:"", note:"", stage:stage||"contact" });
    setShowDealModal(true);
  }
  function openEditDeal(deal) {
    setEditDeal(deal);
    setDealForm({ company:deal.company||"", products:deal.products||[], amount:deal.amount||"", person:deal.person||"", note:deal.note||"", stage:deal.stage||"contact" });
    setShowDealModal(true);
  }
  async function saveDeal() {
    if (!dealForm.company.trim()) return;
    if (editDeal) {
      await updateDoc(doc(db,"sales_deals",editDeal.id), dealForm);
    } else {
      await addDoc(collection(db,"sales_deals"), { ...dealForm, createdAt: new Date().toISOString() });
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

  // ── ボードデータ ──────────────────────────────────
  const PRODUCTS = [
    { key:"membership", label:"加盟料",  color:"#A78BFA" },
    { key:"cosmos",     label:"COSMOS", color:"#34D399" },
    { key:"news",       label:"ニュース", color:"#60A5FA" },
  ];
  const HALF_MONTHS = ["4月","5月","6月","7月","8月","9月"]; // 上期デフォルト
  const MILESTONES = {
    membership: [{day:5,pct:45},{day:10,pct:65},{day:15,pct:100}],
    news:       [{day:5,pct:85},{day:15,pct:100}],
  };

  const [boardData, setBoardData]   = useState(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardEdit, setBoardEdit]   = useState(false); // 編集モード

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "sales_board", "main"), (snap) => {
      if (snap.exists()) {
        setBoardData(snap.data());
      } else {
        // 初期データ
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveBoardData(data) {
    await setDoc(doc(db, "sales_board", "main"), data);
  }

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "sales_todos"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTodos(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // モーダル
  const [showModal, setShowModal] = useState(false);
  const [editTodo,  setEditTodo]  = useState(null);
  const [form, setForm] = useState({ title:"", date:toJSTDateStr(new Date()), priority:"medium", categories:[], status:"undone", note:"" });
  const [saving, setSaving] = useState(false);

  // フィルター（一覧）
  const [listFilter,    setListFilter]    = useState("all");
  const [listCatFilter, setListCatFilter] = useState("all");
  const [listSort,      setListSort]      = useState("date");
  const [listCatTab,    setListCatTab]    = useState("action");

  // フィルター（カレンダー日次）
  const [calCatFilter, setCalCatFilter] = useState("all");
  const [calCatTab,    setCalCatTab]    = useState("action");

  // ── CRUD (Firestore) ──────────────────────────────
  function openAdd(ds) {
    setEditTodo(null);
    setForm({ title:"", date:toJSTDateStr(new Date()), priority:"medium", categories:[], status:"undone", note:"" });
    setShowModal(true);
  }
  function openEdit(todo) {
    setEditTodo(todo);
    setForm({ title:todo.title, date:todo.date, priority:todo.priority, categories:Array.isArray(todo.categories)?todo.categories:(todo.category?[todo.category]:[]), status:todo.status||(todo.done?"done":"undone"), note:todo.note });
    setShowModal(true);
  }
  async function saveTodo() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editTodo) {
        await updateDoc(doc(db, "sales_todos", editTodo.id), { ...form, done: form.status==="done" });
      } else {
        await addDoc(collection(db, "sales_todos"), { ...form, done: form.status==="done" });
      }
      setShowModal(false);
    } catch(e) { alert("保存に失敗しました: " + e.message); }
    setSaving(false);
  }
  async function cycleStatus(todo) {
    const order = ["undone","progress","done"];
    const cur   = todo.status || (todo.done ? "done" : "undone");
    const next  = order[(order.indexOf(cur)+1) % order.length];
    await updateDoc(doc(db, "sales_todos", todo.id), { status: next, done: next==="done" });
  }
  async function deleteTodo(id) {
    if (!window.confirm("削除しますか？")) return;
    await deleteDoc(doc(db, "sales_todos", id));
  }
  async function deleteDoneTodos() {
    const doneTodos = todos.filter(t=>t.status==="done"||t.done);
    if (doneTodos.length===0) { alert("済のタスクはありません"); return; }
    if (!window.confirm(`済のタスク ${doneTodos.length}件を一括削除しますか？`)) return;
    await Promise.all(doneTodos.map(t=>deleteDoc(doc(db,"sales_todos",t.id))));
  }

  // ── カレンダー計算 ────────────────────────────────
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay    = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();
  const calendarDays = [];
  for (let i=0;i<firstDay;i++) calendarDays.push(null);
  for (let d=1;d<=daysInMonth;d++) calendarDays.push(d);
  const threeDays = [selectedDate, addDays(selectedDate,1), addDays(selectedDate,2)];
  // 期限切れタスクは今日に引き上げて表示（ステータス問わず・データは変えない）
  const displayDate = (t) => {
    if (t.date < todayStr) return todayStr;
    return t.date;
  };
  const todosFor  = (ds) => todos.filter(t=>displayDate(t)===ds);

  // ── 統計 ─────────────────────────────────────────
  const monthPrefix = `${year}-${String(month+1).padStart(2,"0")}`;
  const monthTodos  = todos.filter(t=>t.date.startsWith(monthPrefix));
  const stats = {
    total:      todos.length,
    done:       todos.filter(t=>t.status==="done"||t.done).length,
    high:       todos.filter(t=>t.priority==="high"&&t.status!=="done"&&!t.done).length,
    medium:     todos.filter(t=>t.priority==="medium"&&t.status!=="done"&&!t.done).length,
    low:        todos.filter(t=>t.priority==="low"&&t.status!=="done"&&!t.done).length,
    monthTotal: monthTodos.length,
  };

  // ── 一覧フィルタ ──────────────────────────────────
  let listTodos = [...todos];
  if (listFilter==="done")     listTodos = listTodos.filter(t=>t.status==="done"||t.done);
  if (listFilter==="progress") listTodos = listTodos.filter(t=>t.status==="progress");
  if (listFilter==="undone")   listTodos = listTodos.filter(t=>!t.status||t.status==="undone");
  if (listCatFilter!=="all") listTodos = listTodos.filter(t=>t.category===listCatFilter);
  if (listSort==="date")     listTodos.sort((a,b)=>a.date.localeCompare(b.date));
  if (listSort==="priority") {
    const rank={high:0,medium:1,low:2};
    listTodos.sort((a,b)=>rank[a.priority]-rank[b.priority]);
  }
  // 済みは常に末尾
  const isDone = t => t.status==="done" || t.done;
  listTodos.sort((a,b) => isDone(a)===isDone(b) ? 0 : isDone(a) ? 1 : -1);

  // ── カレンダー日次フィルタ ────────────────────────
  const priorityRank={high:0,medium:1,low:2};
  const dayTodos = (calCatFilter==="all" ? todos : todos.filter(t=>t.category===calCatFilter))
    .filter(t=>displayDate(t)===selectedDate)
    .sort((a,b)=>priorityRank[a.priority]-priorityRank[b.priority])
    .sort((a,b)=>{ const d=s=>s.status==="done"||s.done; return d(a)===d(b)?0:d(a)?1:-1; });

  // ── 共通スタイル ──────────────────────────────────
  const inputStyle = {
    width:"100%", background:"#12151E", border:"1px solid #2A2D3A",
    borderRadius:10, padding:"10px 14px", color:"#E8EAF0", fontSize:14,
    outline:"none", boxSizing:"border-box", fontFamily:"inherit",
  };

  // ── TodoCard ─────────────────────────────────────
  function TodoCard({ todo, showDate=false }) {
    return (
      <div onDoubleClick={()=>openEdit(todo)} style={{
        background:"#1A1D26", borderRadius:14, padding:"13px 15px",
        border:`1px solid ${(todo.status==="done"||todo.done)?"#2A2D3A":PRIORITIES[todo.priority].color+"50"}`,
        opacity:(todo.status==="done"||todo.done)?0.55:1,
        display:"flex", alignItems:"flex-start", gap:11,
        cursor:"pointer",
      }}>
        {(()=>{
          const st=STATUSES[todo.status||(todo.done?"done":"undone")]||STATUSES.undone;
          return (
            <button onClick={()=>cycleStatus(todo)} title="クリックでステータス切替" style={{
              width:22, height:22, borderRadius:"50%", flexShrink:0, marginTop:2,
              border:`2px solid ${st.color}`, background:st.bg,
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
              color:st.color, fontSize:11, fontWeight:700,
            }}>{st.icon}</button>
          );
        })()}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap"}}>
            <span style={{fontSize:14, fontWeight:600, textDecoration:(todo.status==="done"||todo.done)?"line-through":"none"}}>{todo.title}</span>
            <span style={{fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:700, background:PRIORITIES[todo.priority].bg, color:PRIORITIES[todo.priority].color}}>
              {PRIORITIES[todo.priority].label}
            </span>
            {(()=>{const st=STATUSES[todo.status||(todo.done?"done":"undone")]||STATUSES.undone; return <span style={{fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:700, background:st.bg, color:st.color}}>{st.icon} {st.label}</span>; })()}
            {(()=>{
              const cats = Array.isArray(todo.categories)&&todo.categories.length>0 ? todo.categories : (todo.category?[todo.category]:[]);
              return cats.length===0
                ? null
                : cats.map(ck=>{
                    const c=ALL_CATEGORIES[ck]; if(!c) return null;
                    const cc2=catColor(ck);
                    return <span key={ck} style={{fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:700, background:cc2+"18", color:cc2}}>{c.icon} {c.label}</span>;
                  });
            })()}
            {showDate&&<span style={{fontSize:11, color:"#7A7D8A"}}>{fmtDate(todo.date)} {DAYS_JP[new Date(todo.date).getDay()]}曜</span>}
          </div>
          {todo.note&&<div style={{fontSize:12, color:"#7A7D8A", marginTop:3}}>{todo.note}</div>}
        </div>
        <div style={{display:"flex", gap:5, flexShrink:0}}>
          <button onClick={()=>openEdit(todo)} style={{background:"#1E2230", border:"none", borderRadius:6, width:28, height:28, cursor:"pointer", color:"#7A7D8A", fontSize:13}}>✏️</button>
          <button onClick={()=>deleteTodo(todo.id)} style={{background:"#1E2230", border:"none", borderRadius:6, width:28, height:28, cursor:"pointer", color:"#FF5252", fontSize:13}}>🗑</button>
        </div>
      </div>
    );
  }

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

  // ── PipelineTab ──────────────────────────────────
  function PipelineTab() {
    const PROD_LIST = [
      { key:"membership", label:"加盟料",  color:"#A78BFA" },
      { key:"cosmos",     label:"COSMOS", color:"#34D399" },
      { key:"news",       label:"ニュース", color:"#60A5FA" },
    ];

    function fmt(n){ const v=Number(n)||0; return v>=10000?(v/10000).toFixed(1)+"万":v>0?v.toLocaleString():"―"; }

    if (dealsLoading) return <div style={{textAlign:"center",color:"#7A7D8A",padding:"40px"}}>読み込み中...</div>;

    // ステージ別集計
    const stageTotal = (stageKey) => deals
      .filter(d=>d.stage===stageKey)
      .reduce((s,d)=>s+(Number(d.amount)||0),0);

    return (
      <div>
        {/* ヘッダー */}
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14}}>
          <div style={{fontWeight:800, fontSize:17}}>🔀 案件パイプライン</div>
          <button onClick={()=>openAddDeal("contact")} style={{
            padding:"7px 16px", borderRadius:9, border:"none", cursor:"pointer", fontSize:13, fontWeight:700,
            background:"linear-gradient(135deg,#FFD700,#FF8C00)", color:"#0D0F14",
          }}>+ 案件追加</button>
        </div>

        {/* サマリー */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:9, marginBottom:16}}>
          {STAGES.map(s=>{
            const stagDeals = deals.filter(d=>d.stage===s.key);
            return (
              <div key={s.key} style={{background:"#1A1D26", borderRadius:12, padding:"10px 13px", border:`1px solid ${s.color}30`}}>
                <div style={{fontSize:10, color:s.color, fontWeight:700, marginBottom:4}}>{s.label}</div>
                <div style={{fontSize:20, fontWeight:800, color:"#E8EAF0", lineHeight:1}}>{stagDeals.length}<span style={{fontSize:11, marginLeft:2}}>件</span></div>
                <div style={{fontSize:11, color:"#7A7D8A", marginTop:2}}>{fmt(stageTotal(s.key))}円</div>
              </div>
            );
          })}
        </div>

        {/* かんばんボード */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10}}>
          {STAGES.map(stage=>{
            const stageDeals = deals.filter(d=>d.stage===stage.key);
            return (
              <div key={stage.key} style={{background:"#1A1D26", borderRadius:14, border:`1px solid ${stage.color}30`, overflow:"hidden"}}>
                {/* ステージヘッダー */}
                <div style={{padding:"10px 12px", borderBottom:`1px solid ${stage.color}30`, background:stage.color+"10", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                  <div style={{fontWeight:700, fontSize:13, color:stage.color}}>{stage.label}</div>
                  <div style={{background:stage.color+"20", color:stage.color, borderRadius:10, padding:"2px 8px", fontSize:11, fontWeight:700}}>{stageDeals.length}</div>
                </div>
                {/* 案件カード */}
                <div style={{padding:"8px", display:"flex", flexDirection:"column", gap:7, minHeight:120}}>
                  {stageDeals.length===0 && (
                    <div style={{textAlign:"center", color:"#3A3D4A", fontSize:11, padding:"16px 0"}}>案件なし</div>
                  )}
                  {stageDeals.map(deal=>{
                    const prods = (deal.products||[]).map(k=>PROD_LIST.find(p=>p.key===k)).filter(Boolean);
                    return (
                      <div key={deal.id} onDoubleClick={()=>openEditDeal(deal)} style={{
                        background:"#12151E", borderRadius:10, padding:"10px 11px",
                        border:"1px solid #2A2D3A", cursor:"pointer",
                      }}>
                        <div style={{fontWeight:700, fontSize:13, marginBottom:5, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis"}}>{deal.company}</div>
                        {/* 商品バッジ */}
                        {prods.length>0 && (
                          <div style={{display:"flex", gap:4, flexWrap:"wrap", marginBottom:5}}>
                            {prods.map(p=>(
                              <span key={p.key} style={{fontSize:9, padding:"1px 6px", borderRadius:10, background:p.color+"18", color:p.color, fontWeight:700}}>{p.label}</span>
                            ))}
                          </div>
                        )}
                        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                          <div style={{fontSize:12, color:"#66BB6A", fontWeight:700}}>{fmt(deal.amount)}円</div>
                          {deal.person && <div style={{fontSize:10, color:"#7A7D8A"}}>👤 {deal.person}</div>}
                        </div>
                        {deal.note && <div style={{fontSize:10, color:"#7A7D8A", marginTop:4, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis"}}>{deal.note}</div>}
                        {/* ステージ移動ボタン */}
                        <div style={{display:"flex", gap:4, marginTop:7}}>
                          {STAGES.filter(s=>s.key!==stage.key).map(s=>(
                            <button key={s.key} onClick={e=>{e.stopPropagation();moveDeal(deal,s.key);}} style={{
                              flex:1, padding:"3px 0", borderRadius:6, border:`1px solid ${s.color}50`,
                              background:s.color+"10", color:s.color, cursor:"pointer", fontSize:9, fontWeight:700,
                            }}>{s.label}</button>
                          ))}
                          <button onClick={e=>{e.stopPropagation();deleteDeal(deal.id);}} style={{
                            padding:"3px 6px", borderRadius:6, border:"1px solid #FF525250",
                            background:"#FF525210", color:"#FF5252", cursor:"pointer", fontSize:9,
                          }}>🗑</button>
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={()=>openAddDeal(stage.key)} style={{
                    width:"100%", background:"transparent", border:"1px dashed #2A2D3A",
                    borderRadius:8, padding:"6px", cursor:"pointer", color:"#5A5D6A", fontSize:11,
                  }}>+ 追加</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── BoardTab ─────────────────────────────────────
  function BoardTab() {
    const today2  = new Date();
    const curMonth = today2.getMonth()+1;
    const monthLabel = curMonth + "月";

    if (boardLoading || !boardData) return (
      <div style={{textAlign:"center", color:"#7A7D8A", padding:"40px"}}>読み込み中...</div>
    );

    const months   = boardData.months || HALF_MONTHS;
    const products = boardData.products || [];

    // 今月インデックス
    const curIdx = months.findIndex(m => m === monthLabel);

    // 累計集計
    function cumulative(prod, upToMonth) {
      const idx = months.indexOf(upToMonth);
      let target=0, result=0;
      for(let i=0;i<=idx;i++){
        target += Number(prod.monthlyTargets[months[i]])||0;
        result += Number(prod.monthlyResults[months[i]])||0;
      }
      return {target, result};
    }

    // 今月の営業日数（簡易：月の平日数）
    const totalBizDays  = getBizDaysInMonth(today2.getFullYear(), today2.getMonth()+1);
    const passedBizDays = getBizDaysPassed(today2.getFullYear(), today2.getMonth()+1);

    const inputStyle2 = {
      background:"#12151E", border:"1px solid #2A2D3A", borderRadius:8,
      padding:"6px 10px", color:"#E8EAF0", fontSize:13,
      outline:"none", width:"100%", boxSizing:"border-box", textAlign:"right",
    };

    function fmt(n) {
      const num = Number(n)||0;
      if(num>=10000) return (num/10000).toFixed(1)+"万";
      return num.toLocaleString();
    }
    function pct(a,b) { return b>0 ? Math.round((a/b)*100) : 0; }

    async function updateField(pKey, field, val) {
      const newData = JSON.parse(JSON.stringify(boardData));
      const p = newData.products.find(p=>p.key===pKey);
      if(!p) return;
      if(field==="halfTarget") p.halfTarget = Number(val)||0;
      else if(field.startsWith("target_")) p.monthlyTargets[field.replace("target_","")] = Number(val)||0;
      else if(field.startsWith("result_")) p.monthlyResults[field.replace("result_","")] = Number(val)||0;
      setBoardData(newData);
      await saveBoardData(newData);
    }

    const PROD_COLORS = {membership:"#A78BFA", cosmos:"#34D399", news:"#60A5FA"};

    return (
      <div style={{display:"flex", flexDirection:"column", gap:16}}>

        {/* ヘッダー */}
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
          <div style={{fontWeight:800, fontSize:17}}>{boardData.halfLabel || "上期（4〜9月）"} 営業ボード</div>
          <button onClick={()=>setBoardEdit(!boardEdit)} style={{
            padding:"6px 14px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, fontWeight:700,
            background:boardEdit?"linear-gradient(135deg,#FFD700,#FF8C00)":"#1E2230",
            color:boardEdit?"#0D0F14":"#7A7D8A",
          }}>{boardEdit?"✅ 完了":"✏️ 編集"}</button>
        </div>

        {/* 商品別カード */}
        {products.map(prod => {
          const color = PROD_COLORS[prod.key]||"#94A3B8";
          const halfResult = months.reduce((s,m)=>s+(Number(prod.monthlyResults[m])||0),0);
          const halfPct    = pct(halfResult, prod.halfTarget);
          const halfRemain = (Number(prod.halfTarget)||0) - halfResult;
          const curTarget  = curIdx>=0 ? (Number(prod.monthlyTargets[monthLabel])||0) : 0;
          const curResult  = curIdx>=0 ? (Number(prod.monthlyResults[monthLabel])||0) : 0;
          const curPct     = pct(curResult, curTarget);
          const curRemain  = curTarget - curResult;
          const ms         = MILESTONES[prod.key]||[];

          return (
            <div key={prod.key} style={{background:"#1A1D26", borderRadius:16, border:`1px solid ${color}30`, overflow:"hidden"}}>
              {/* 商品ヘッダー */}
              <div style={{background:color+"15", borderBottom:`1px solid ${color}30`, padding:"10px 16px", display:"flex", alignItems:"center", gap:8}}>
                <div style={{width:10, height:10, borderRadius:"50%", background:color}}/>
                <div style={{fontWeight:800, fontSize:15, color:color}}>{prod.label}</div>
              </div>

              <div style={{padding:"14px 16px", display:"flex", flexDirection:"column", gap:14}}>

                {/* 半期サマリー */}
                <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10}}>
                  {[
                    {label:"半期目標", value: boardEdit
                      ? <input type="number" defaultValue={prod.halfTarget||0} onBlur={e=>updateField(prod.key,"halfTarget",e.target.value)} style={inputStyle2}/>
                      : fmt(prod.halfTarget)+"円", accent:color},
                    {label:"半期累計", value:fmt(halfResult)+"円", accent:"#66BB6A"},
                    {label:"達成率／残", value:`${halfPct}% / ${fmt(halfRemain<0?0:halfRemain)}円`, accent:halfPct>=100?"#FFD700":halfPct>=70?"#66BB6A":"#FF5252"},
                  ].map(s=>(
                    <div key={s.label} style={{background:"#12151E", borderRadius:10, padding:"10px 12px"}}>
                      <div style={{fontSize:10, color:"#7A7D8A", marginBottom:4}}>{s.label}</div>
                      <div style={{fontSize:13, fontWeight:700, color:s.accent}}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* 半期プログレスバー */}
                <div>
                  <div style={{height:8, background:"#12151E", borderRadius:4, overflow:"hidden"}}>
                    <div style={{height:"100%", width:`${Math.min(halfPct,100)}%`, background:`linear-gradient(90deg,${color},${color}99)`, borderRadius:4, transition:"width 0.5s"}}/>
                  </div>
                </div>

                {/* 今月 */}
                <div style={{borderTop:"1px solid #2A2D3A", paddingTop:12}}>
                  <div style={{fontSize:11, color:"#7A7D8A", marginBottom:8, fontWeight:700}}>📅 今月（{monthLabel}） 営業日: {passedBizDays}/{totalBizDays}日</div>
                  <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:10}}>
                    {[
                      {label:"月次目標", value: boardEdit
                        ? <input type="number" defaultValue={curTarget} onBlur={e=>updateField(prod.key,`target_${monthLabel}`,e.target.value)} style={inputStyle2}/>
                        : fmt(curTarget)+"円", accent:color},
                      {label:"成約金額", value: boardEdit
                        ? <input type="number" defaultValue={curResult} onBlur={e=>updateField(prod.key,`result_${monthLabel}`,e.target.value)} style={inputStyle2}/>
                        : fmt(curResult)+"円", accent:"#66BB6A"},
                      {label:"達成率／残", value:`${curPct}% / ${fmt(curRemain<0?0:curRemain)}円`, accent:curPct>=100?"#FFD700":curPct>=70?"#66BB6A":"#FF5252"},
                    ].map(s=>(
                      <div key={s.label} style={{background:"#12151E", borderRadius:10, padding:"10px 12px"}}>
                        <div style={{fontSize:10, color:"#7A7D8A", marginBottom:4}}>{s.label}</div>
                        <div style={{fontSize:13, fontWeight:700, color:s.accent}}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* 今月プログレスバー */}
                  <div style={{height:6, background:"#12151E", borderRadius:4, overflow:"hidden", marginBottom: ms.length?10:0}}>
                    <div style={{height:"100%", width:`${Math.min(curPct,100)}%`, background:`linear-gradient(90deg,${color},${color}99)`, borderRadius:4, transition:"width 0.5s"}}/>
                  </div>

                  {/* マイルストーン */}
                  {ms.length>0 && (
                    <div style={{display:"flex", flexDirection:"column", gap:6}}>
                      <div style={{fontSize:10, color:"#7A7D8A", fontWeight:700}}>🏁 マイルストーン</div>
                      <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                        {ms.map(m=>{
                          const msTarget   = Math.round((Number(curTarget)||0) * m.pct/100);
                          const reached    = curResult >= msTarget;
                          const isCurrent  = passedBizDays <= m.day && (ms.find(x=>x.day<m.day)===undefined || passedBizDays > (ms.find(x=>x.day<m.day)?.day||0));
                          return (
                            <div key={m.day} style={{
                              background: reached?"#34C75918":isCurrent?"#FBBF2418":"#12151E",
                              border:`1px solid ${reached?"#34C759":isCurrent?"#FBBF24":"#2A2D3A"}`,
                              borderRadius:10, padding:"8px 12px", minWidth:100,
                            }}>
                              <div style={{fontSize:10, color:reached?"#34C759":isCurrent?"#FBBF24":"#7A7D8A", fontWeight:700}}>{m.day}営業日目 {m.pct}%</div>
                              <div style={{fontSize:12, fontWeight:700, color:reached?"#34C759":isCurrent?"#FBBF24":"#E8EAF0", marginTop:2}}>{fmt(msTarget)}円</div>
                              <div style={{fontSize:10, color:"#7A7D8A", marginTop:1}}>{reached?"✅ 達成":isCurrent?"← 現在":"未"}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 月次一覧テーブル */}
                <div style={{borderTop:"1px solid #2A2D3A", paddingTop:12}}>
                  <div style={{fontSize:11, color:"#7A7D8A", marginBottom:8, fontWeight:700}}>📆 月次推移</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%", borderCollapse:"collapse", fontSize:12}}>
                      <thead>
                        <tr>
                          {["月","目標","成約","達成率","累計目標","累計成約","累計達成率"].map(h=>(
                            <th key={h} style={{padding:"6px 8px", background:"#12151E", color:"#7A7D8A", fontWeight:700, textAlign:"right", borderBottom:"1px solid #2A2D3A", whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {months.map((m,i)=>{
                          const tgt = Number(prod.monthlyTargets[m])||0;
                          const res = Number(prod.monthlyResults[m])||0;
                          const p2  = pct(res,tgt);
                          const cum = cumulative(prod,m);
                          const isThis = m===monthLabel;
                          return (
                            <tr key={m} style={{background:isThis?color+"10":"transparent"}}>
                              <td style={{padding:"6px 8px", color:isThis?color:"#E8EAF0", fontWeight:isThis?700:400, borderBottom:"1px solid #1E2230"}}>{m}</td>
                              <td style={{padding:"6px 8px", textAlign:"right", color:"#94A3B8", borderBottom:"1px solid #1E2230"}}>
                                {boardEdit
                                  ? <input type="number" defaultValue={tgt} onBlur={e=>updateField(prod.key,`target_${m}`,e.target.value)} style={{...inputStyle2,width:80}}/>
                                  : fmt(tgt)}
                              </td>
                              <td style={{padding:"6px 8px", textAlign:"right", color:"#66BB6A", borderBottom:"1px solid #1E2230"}}>
                                {boardEdit
                                  ? <input type="number" defaultValue={res} onBlur={e=>updateField(prod.key,`result_${m}`,e.target.value)} style={{...inputStyle2,width:80}}/>
                                  : fmt(res)}
                              </td>
                              <td style={{padding:"6px 8px", textAlign:"right", color:p2>=100?"#FFD700":p2>=70?"#66BB6A":"#FF5252", fontWeight:700, borderBottom:"1px solid #1E2230"}}>{p2}%</td>
                              <td style={{padding:"6px 8px", textAlign:"right", color:"#94A3B8", borderBottom:"1px solid #1E2230"}}>{fmt(cum.target)}</td>
                              <td style={{padding:"6px 8px", textAlign:"right", color:"#66BB6A", borderBottom:"1px solid #1E2230"}}>{fmt(cum.result)}</td>
                              <td style={{padding:"6px 8px", textAlign:"right", color:pct(cum.result,cum.target)>=100?"#FFD700":pct(cum.result,cum.target)>=70?"#66BB6A":"#FF5252", fontWeight:700, borderBottom:"1px solid #1E2230"}}>{pct(cum.result,cum.target)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ════════════════════════════════════════════════════
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

  return (
    <div style={{minHeight:"100vh", background:"#0D0F14", fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif", color:"#E8EAF0"}}>

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
          <div style={{display:"flex", gap:5, alignItems:"center"}}>
            {[["list","📋 TOP"],["calendar","📅 カレンダー"],["board","📊 ボード"],["pipeline","🔀 案件"]].map(([t,l])=>(
              <button key={t} onClick={()=>setTab(t)} style={{
                padding:"7px 16px", borderRadius:9, border:"none", cursor:"pointer", fontSize:13, fontWeight:700,
                background:tab===t?"linear-gradient(135deg,#FFD700,#FF8C00)":"#1E2230",
                color:tab===t?"#0D0F14":"#7A7D8A", transition:"all 0.2s",
              }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:980, margin:"0 auto", padding:"16px 13px 100px"}}>

        {/* ── 統計バー ── */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:9, marginBottom:16}}>
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
            {/* ④⑤ 報告書欄 + ポモドーロ（2カラム） */}
            <div style={{display:"grid", gridTemplateColumns:"1fr auto", gap:12, marginBottom:14, alignItems:"start"}}>

              {/* 報告書欄 */}
              <div style={{background:"#1A1D26", borderRadius:14, border:"1px solid #2A2D3A", padding:"12px 14px"}}>
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8}}>
                  <div style={{fontSize:11, color:"#7A7D8A", fontWeight:700}}>📝 本日提出報告書</div>
                  <input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)}
                    style={{background:"#12151E", border:"1px solid #2A2D3A", borderRadius:6, padding:"3px 8px", color:"#7A7D8A", fontSize:11, outline:"none"}}/>
                </div>
                {/* 入力 */}
                <div style={{display:"flex", gap:6, marginBottom:8}}>
                  <input value={reportInput} onChange={e=>setReportInput(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter"&&reportInput.trim()){setReportItems([...reportItems,{id:Date.now(),date:reportDate,name:reportInput.trim()}]);setReportInput("");}}}
                    placeholder="会社名を入力してEnter"
                    style={{flex:1, background:"#12151E", border:"1px solid #2A2D3A", borderRadius:8, padding:"7px 10px", color:"#E8EAF0", fontSize:12, outline:"none"}}/>
                  <button onClick={()=>{if(reportInput.trim()){setReportItems([...reportItems,{id:Date.now(),date:reportDate,name:reportInput.trim()}]);setReportInput("");}}} style={{
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
                          <button onClick={()=>setReportItems(reportItems.filter(x=>x.id!==r.id))} style={{background:"none", border:"none", cursor:"pointer", color:"#FF5252", fontSize:11, padding:0}}>×</button>
                        </div>
                      ))}
                    </div>
                }
              </div>

              {/* ⑤ ポモドーロタイマー */}
              <div style={{background:"#1A1D26", borderRadius:14, border:`1px solid ${pomoMode==="work"?"#FF444430":"#34C75930"}`, padding:"12px 14px", minWidth:140, textAlign:"center"}}>
                <div style={{fontSize:10, color:pomoMode==="work"?"#FF5252":"#34C759", fontWeight:700, marginBottom:6, letterSpacing:"0.1em"}}>
                  {pomoMode==="work"?"🍅 集中中":"☕ 休憩中"}
                </div>
                <div style={{fontSize:32, fontWeight:800, color:pomoMode==="work"?"#FF5252":"#34C759", lineHeight:1, marginBottom:8, fontVariantNumeric:"tabular-nums"}}>
                  {pomoFmt(pomoTime)}
                </div>
                <div style={{display:"flex", gap:5, justifyContent:"center", marginBottom:6}}>
                  <button onClick={()=>setPomoRunning(!pomoRunning)} style={{
                    background:pomoRunning?"#FF444418":"#34C75918", border:`1px solid ${pomoRunning?"#FF4444":"#34C759"}`,
                    borderRadius:8, padding:"5px 12px", cursor:"pointer", fontSize:12, fontWeight:700,
                    color:pomoRunning?"#FF5252":"#34C759",
                  }}>{pomoRunning?"⏸":"▶"}</button>
                  <button onClick={pomoReset} style={{background:"#1E2230", border:"1px solid #2A2D3A", borderRadius:8, padding:"5px 10px", cursor:"pointer", fontSize:12, color:"#7A7D8A"}}>↺</button>
                </div>
                <div style={{fontSize:10, color:"#7A7D8A"}}>完了 {pomoCount} セット</div>
              </div>
            </div>

            {/* ② 営業日カウンター（独立） */}
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

            {/* ③ 進捗サマリー */}
            {boardData && (()=>{
              const today3   = new Date();
              const mLabel   = (today3.getMonth()+1)+"月";
              const months2  = boardData.months||HALF_MONTHS;
              const prods    = boardData.products||[];
              function fmt2(n){const v=Number(n)||0;return v>=10000?(v/10000).toFixed(1)+"万":v.toLocaleString();}
              function pct2(a,b){return b>0?Math.round((a/b)*100):0;}
              const passed      = getBizDaysPassed(today3.getFullYear(), today3.getMonth()+1);
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
                      // 累計
                      const cumTgt = months2.reduce((s,m)=>s+(Number(prod.monthlyTargets?.[m])||0),0);
                      const cumRes = months2.reduce((s,m)=>s+(Number(prod.monthlyResults?.[m])||0),0);
                      const cumP   = pct2(cumRes,cumTgt);
                      // 次のMS（金額未達のもので一番%が小さいもの）
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
            <CatFilterBar catTab={listCatTab} setCatTab={setListCatTab} catFilter={listCatFilter} setCatFilter={setListCatFilter}/>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10}}>
              <div style={{fontSize:12, color:"#5A5D6A"}}>{listTodos.length}件</div>
              <div style={{display:"flex", gap:6}}>
                <button onClick={deleteDoneTodos} style={{
                  padding:"6px 12px", borderRadius:9, border:"1px solid #FF525260", cursor:"pointer", fontSize:11, fontWeight:700,
                  background:"#FF525218", color:"#FF5252",
                }}>🗑 済を一括削除</button>
                <button onClick={()=>exportToExcel(todos)} style={{
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
              {listTodos.map(t=><TodoCard key={t.id} todo={t} showDate={true}/>)}
            </div>
          </div>
        )}

        {/* ════════ カレンダータブ ════════ */}
        {tab==="pipeline" && (
          <PipelineTab/>
        )}

        {tab==="board" && (
          <BoardTab/>
        )}

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
                    const hasHigh=dt.some(t=>t.priority==="high"&&!t.done);
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
                          const cats=Array.isArray(t.categories)&&t.categories.length>0?t.categories:(t.category?[t.category]:[]);
                          const firstCat=cats[0]; const cc=catColor(firstCat);
                          return <div key={t.id} style={{fontSize:9, padding:"1px 4px", borderRadius:3, marginBottom:2, background:cc+"20", color:cc, opacity:t.done?0.4:1, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis"}}>{ALL_CATEGORIES[firstCat]?.icon} {t.title}</div>;
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
                    const dt=todosFor(ds), d=new Date(ds), dow=d.getDay(), isToday=ds===todayStr;
                    return (
                      <div key={ds} style={{background:"#1A1D26", borderRadius:14, border:isToday?"1px solid #FFD70060":"1px solid #2A2D3A", overflow:"hidden"}}>
                        <div style={{padding:"10px 12px", borderBottom:"1px solid #2A2D3A", background:isToday?"#FFD70010":"transparent", display:"flex", alignItems:"center", gap:6}}>
                          <div style={{fontWeight:800, fontSize:20, color:dow===0?"#FF5252":dow===6?"#4FC3F7":"#E8EAF0"}}>{d.getDate()}</div>
                          <div>
                            <div style={{fontSize:10, color:"#7A7D8A"}}>{d.getMonth()+1}月 {DAYS_JP[dow]}曜</div>
                            {isToday&&<span style={{fontSize:9, background:"#FFD700", color:"#0D0F14", borderRadius:3, padding:"1px 5px", fontWeight:700}}>TODAY</span>}
                          </div>
                          <div style={{marginLeft:"auto", background:"#12151E", borderRadius:10, padding:"2px 8px", fontSize:11, color:"#7A7D8A"}}>{dt.length}件</div>
                        </div>
                        <div style={{padding:"8px", display:"flex", flexDirection:"column", gap:6}}>
                          {dt.length===0&&<div style={{textAlign:"center", color:"#3A3D4A", fontSize:11, padding:"10px 0"}}>タスクなし</div>}
                          {dt.map(t=>{
                            return (
                              <div key={t.id} onClick={()=>{setSelectedDate(ds);setCalView("day");}} style={{background:"#12151E", borderRadius:8, padding:"8px 10px", border:`1px solid ${t.done?"#2A2D3A":PRIORITIES[t.priority].color+"40"}`, opacity:t.done?0.5:1, cursor:"pointer"}}>
                                <div style={{fontSize:12, fontWeight:600, marginBottom:3, textDecoration:t.done?"line-through":"none", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis"}}>{t.title}</div>
                                <div style={{display:"flex", gap:4}}>
                                  <span style={{fontSize:9, padding:"1px 5px", borderRadius:10, background:PRIORITIES[t.priority].bg, color:PRIORITIES[t.priority].color, fontWeight:700}}>{PRIORITIES[t.priority].label}</span>
                                  {(()=>{
                                const cats3=Array.isArray(t.categories)&&t.categories.length>0?t.categories:(t.category?[t.category]:[]);
                                return cats3.slice(0,2).map(ck=>{const c3=ALL_CATEGORIES[ck];const cc3=catColor(ck);return c3?<span key={ck} style={{fontSize:9, padding:"1px 5px", borderRadius:10, background:cc3+"18", color:cc3}}>{c3.icon} {c3.label}</span>:null;});
                              })()}
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
                      {DAYS_JP[new Date(selectedDate).getDay()]}曜日
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
                  {dayTodos.map(t=><TodoCard key={t.id} todo={t}/>)}
                </div>
              </div>
            )}
          </div>
        )}
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
                  placeholder="例：山田商事" style={{width:"100%",background:"#12151E",border:"1px solid #2A2D3A",borderRadius:10,padding:"10px 14px",color:"#E8EAF0",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
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
                  {[{key:"membership",label:"加盟料",color:"#A78BFA"},{key:"cosmos",label:"COSMOS",color:"#34D399"},{key:"news",label:"ニュース",color:"#60A5FA"}].map(p=>{
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
                  placeholder="例：500000" style={{width:"100%",background:"#12151E",border:"1px solid #2A2D3A",borderRadius:10,padding:"10px 14px",color:"#E8EAF0",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
              </div>
              {/* 担当者 */}
              <div>
                <label style={{fontSize:11,color:"#7A7D8A",display:"block",marginBottom:5}}>担当者名</label>
                <input value={dealForm.person} onChange={e=>setDealForm({...dealForm,person:e.target.value})}
                  placeholder="例：田中部長" style={{width:"100%",background:"#12151E",border:"1px solid #2A2D3A",borderRadius:10,padding:"10px 14px",color:"#E8EAF0",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
              </div>
              {/* 備考 */}
              <div>
                <label style={{fontSize:11,color:"#7A7D8A",display:"block",marginBottom:5}}>備考</label>
                <textarea value={dealForm.note} onChange={e=>setDealForm({...dealForm,note:e.target.value})}
                  rows={2} placeholder="メモ..." style={{width:"100%",background:"#12151E",border:"1px solid #2A2D3A",borderRadius:10,padding:"10px 14px",color:"#E8EAF0",fontSize:14,outline:"none",resize:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
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
      <button onClick={()=>openAdd()} style={{
        position:"fixed", bottom:26, right:22,
        width:54, height:54, borderRadius:"50%",
        background:"linear-gradient(135deg,#FFD700,#FF8C00)",
        border:"none", cursor:"pointer", fontSize:26, color:"#0D0F14",
        boxShadow:"0 4px 20px #FF8C0050",
        display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, zIndex:200,
      }}>+</button>

      {/* モーダル */}
      {showModal&&(
        <div style={{position:"fixed", inset:0, background:"#000000BB", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:16}}
          onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={{background:"#1A1D26", borderRadius:20, padding:22, width:"100%", maxWidth:440, border:"1px solid #2A2D3A", maxHeight:"92vh", overflowY:"auto"}}>
            <div style={{fontWeight:800, fontSize:17, marginBottom:18}}>{editTodo?"タスク編集":"タスク追加"}</div>
            <div style={{display:"flex", flexDirection:"column", gap:13}}>
              <div>
                <label style={{fontSize:11, color:"#7A7D8A", display:"block", marginBottom:5}}>タスク名</label>
                <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="例：山田商事 提案書作成" style={inputStyle}/>
              </div>
              <div>
                <label style={{fontSize:11, color:"#7A7D8A", display:"block", marginBottom:5}}>日付</label>
                <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={inputStyle}/>
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
