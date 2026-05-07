import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";

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

const ALL_CATEGORIES = { ...ACTION_CATEGORIES, ...PRODUCT_CATEGORIES };
const DAYS_JP   = ["日","月","火","水","木","金","土"];
const MONTHS_JP = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

// ── ユーティリティ ────────────────────────────────────

// ── Excel出力（今西さん提出用） ────────────────────────
function exportToExcel(todos) {
  const header = ["日付", "曜日", "タスク内容", "種類", "完了"];
  const rows = [...todos]
    .sort((a,b) => a.date.localeCompare(b.date))
    .map(t => {
      const d   = new Date(t.date);
      const cat = ALL_CATEGORIES[t.category];
      return [
        t.date,
        DAYS_JP[d.getDay()] + "曜日",
        t.title,
        (cat?.label || t.category),
        t.done ? "済" : "未",
      ];
    });
  const bom  = "﻿";
  const csv  = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("
");
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  const now  = new Date();
  a.href = url;
  a.download = `タスク一覧_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function makeDateStr(y,m,d) { return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }
function addDays(str,n) { const d=new Date(str); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function fmtDate(str) { const d=new Date(str); return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`; }
function catColor(key) { return PRODUCT_CATEGORIES[key]?.color ?? "#94A3B8"; }

const today    = new Date();
const todayStr = today.toISOString().slice(0,10);

// ── メインコンポーネント ──────────────────────────────
export default function App() {
  const [tab, setTab]           = useState("list");
  const [calView, setCalView]   = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Firestore リアルタイム同期
  const [todos, setTodos]   = useState([]);
  const [loading, setLoading] = useState(true);

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
  const [form, setForm] = useState({ title:"", date:todayStr, priority:"medium", category:"followup", note:"" });
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
    setForm({ title:"", date:ds||todayStr, priority:"medium", category:"followup", note:"" });
    setShowModal(true);
  }
  function openEdit(todo) {
    setEditTodo(todo);
    setForm({ title:todo.title, date:todo.date, priority:todo.priority, category:todo.category, note:todo.note });
    setShowModal(true);
  }
  async function saveTodo() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editTodo) {
        await updateDoc(doc(db, "sales_todos", editTodo.id), form);
      } else {
        await addDoc(collection(db, "sales_todos"), { ...form, done: false });
      }
      setShowModal(false);
    } catch(e) { alert("保存に失敗しました: " + e.message); }
    setSaving(false);
  }
  async function toggleDone(todo) {
    await updateDoc(doc(db, "sales_todos", todo.id), { done: !todo.done });
  }
  async function deleteTodo(id) {
    if (!window.confirm("削除しますか？")) return;
    await deleteDoc(doc(db, "sales_todos", id));
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
  const todosFor  = (ds) => todos.filter(t=>t.date===ds);

  // ── 統計 ─────────────────────────────────────────
  const monthPrefix = `${year}-${String(month+1).padStart(2,"0")}`;
  const monthTodos  = todos.filter(t=>t.date.startsWith(monthPrefix));
  const stats = {
    total:      todos.length,
    done:       todos.filter(t=>t.done).length,
    high:       todos.filter(t=>t.priority==="high"&&!t.done).length,
    monthTotal: monthTodos.length,
  };
  const completionRate = stats.total>0 ? Math.round((stats.done/stats.total)*100) : 0;

  // ── 一覧フィルタ ──────────────────────────────────
  let listTodos = [...todos];
  if (listFilter==="done")   listTodos = listTodos.filter(t=>t.done);
  if (listFilter==="undone") listTodos = listTodos.filter(t=>!t.done);
  if (listCatFilter!=="all") listTodos = listTodos.filter(t=>t.category===listCatFilter);
  if (listSort==="date")     listTodos.sort((a,b)=>a.date.localeCompare(b.date));
  if (listSort==="priority") {
    const rank={high:0,medium:1,low:2};
    listTodos.sort((a,b)=>rank[a.priority]-rank[b.priority]);
  }

  // ── カレンダー日次フィルタ ────────────────────────
  const dayTodos = (calCatFilter==="all" ? todos : todos.filter(t=>t.category===calCatFilter))
    .filter(t=>t.date===selectedDate);

  // ── 共通スタイル ──────────────────────────────────
  const inputStyle = {
    width:"100%", background:"#12151E", border:"1px solid #2A2D3A",
    borderRadius:10, padding:"10px 14px", color:"#E8EAF0", fontSize:14,
    outline:"none", boxSizing:"border-box", fontFamily:"inherit",
  };

  // ── TodoCard ─────────────────────────────────────
  function TodoCard({ todo, showDate=false }) {
    const cat = ALL_CATEGORIES[todo.category]||{label:todo.category,icon:"•"};
    const cc  = catColor(todo.category);
    return (
      <div style={{
        background:"#1A1D26", borderRadius:14, padding:"13px 15px",
        border:`1px solid ${todo.done?"#2A2D3A":PRIORITIES[todo.priority].color+"50"}`,
        opacity:todo.done?0.55:1,
        display:"flex", alignItems:"flex-start", gap:11,
      }}>
        <button onClick={()=>toggleDone(todo)} style={{
          width:22, height:22, borderRadius:"50%", flexShrink:0, marginTop:2,
          border:`2px solid ${todo.done?"#34C759":PRIORITIES[todo.priority].color}`,
          background:todo.done?"#34C759":"transparent",
          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
          color:"#fff", fontSize:12,
        }}>{todo.done?"✓":""}</button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap"}}>
            <span style={{fontSize:14, fontWeight:600, textDecoration:todo.done?"line-through":"none"}}>{todo.title}</span>
            <span style={{fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:700, background:PRIORITIES[todo.priority].bg, color:PRIORITIES[todo.priority].color}}>
              {PRIORITIES[todo.priority].label}
            </span>
            <span style={{fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:700, background:cc+"18", color:cc}}>
              {cat.icon} {cat.label}
            </span>
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
          {[["action","営業アクション"],["product","商品"]].map(([t,l])=>(
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
          {Object.entries(catTab==="action"?ACTION_CATEGORIES:PRODUCT_CATEGORIES).map(([key,cat])=>{
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

  // ── モーダル内カテゴリ選択 ────────────────────────
  function CategoryPicker() {
    return (
      <div>
        <label style={{fontSize:11, color:"#7A7D8A", display:"block", marginBottom:8}}>カテゴリ</label>
        <div style={{fontSize:10, color:"#5A5D6A", marginBottom:5}}>営業アクション</div>
        <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:10}}>
          {Object.entries(ACTION_CATEGORIES).map(([k,v])=>(
            <button key={k} onClick={()=>setForm({...form,category:k})} style={{
              padding:"5px 10px", borderRadius:16, border:"none", cursor:"pointer", fontSize:11, fontWeight:600,
              background:form.category===k?"#2A2D3A":"#12151E",
              color:form.category===k?"#E8EAF0":"#5A5D6A",
              outline:form.category===k?"1px solid #4FC3F7":"none",
            }}>{v.icon} {v.label}</button>
          ))}
        </div>
        <div style={{fontSize:10, color:"#5A5D6A", marginBottom:5}}>商品</div>
        <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
          {Object.entries(PRODUCT_CATEGORIES).map(([k,v])=>{
            const active=form.category===k;
            return (
              <button key={k} onClick={()=>setForm({...form,category:k})} style={{
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
            {[["list","📋 一覧"],["calendar","📅 カレンダー"]].map(([t,l])=>(
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
        <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:9, marginBottom:16}}>
          {[
            {label:"全タスク",   value:stats.total,          icon:"📌", accent:"#94A3B8"},
            {label:"完了率",     value:`${completionRate}%`, icon:"✅", accent:"#66BB6A"},
            {label:"緊急",       value:stats.high,           icon:"🔥", accent:"#FF5252"},
            {label:"今月",       value:stats.monthTotal,     icon:"📅", accent:"#4FC3F7"},
          ].map(s=>(
            <div key={s.label} style={{
              background:"#1A1D26", borderRadius:12, padding:"11px 13px",
              border:"1px solid #2A2D3A", position:"relative", overflow:"hidden",
            }}>
              <div style={{fontSize:16, marginBottom:2}}>{s.icon}</div>
              <div style={{fontSize:20, fontWeight:800, color:s.accent, lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:10, color:"#7A7D8A", marginTop:3}}>{s.label}</div>
              <div style={{position:"absolute", right:-8, bottom:-8, width:46, height:46, borderRadius:"50%", background:s.accent, opacity:0.07}}/>
            </div>
          ))}
        </div>

        {/* ════════ 一覧タブ ════════ */}
        {tab==="list" && (
          <div>
            <div style={{display:"flex", gap:8, marginBottom:12, alignItems:"center", flexWrap:"wrap"}}>
              <div style={{display:"flex", gap:5}}>
                {[["all","すべて"],["undone","未完了"],["done","完了済"]].map(([v,l])=>(
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
              <button onClick={()=>exportToExcel(todos)} style={{
                padding:"7px 14px", borderRadius:9, border:"1px solid #34D39960", cursor:"pointer", fontSize:12, fontWeight:700,
                background:"#34D39918", color:"#34D399", display:"flex", alignItems:"center", gap:5,
              }}>📥 今西さん提出用</button>
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
                          const cc=catColor(t.category);
                          return <div key={t.id} style={{fontSize:9, padding:"1px 4px", borderRadius:3, marginBottom:2, background:cc+"20", color:cc, opacity:t.done?0.4:1, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis"}}>{ALL_CATEGORIES[t.category]?.icon} {t.title}</div>;
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
                            const cc=catColor(t.category), cat=ALL_CATEGORIES[t.category];
                            return (
                              <div key={t.id} onClick={()=>{setSelectedDate(ds);setCalView("day");}} style={{background:"#12151E", borderRadius:8, padding:"8px 10px", border:`1px solid ${t.done?"#2A2D3A":PRIORITIES[t.priority].color+"40"}`, opacity:t.done?0.5:1, cursor:"pointer"}}>
                                <div style={{fontSize:12, fontWeight:600, marginBottom:3, textDecoration:t.done?"line-through":"none", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis"}}>{t.title}</div>
                                <div style={{display:"flex", gap:4}}>
                                  <span style={{fontSize:9, padding:"1px 5px", borderRadius:10, background:PRIORITIES[t.priority].bg, color:PRIORITIES[t.priority].color, fontWeight:700}}>{PRIORITIES[t.priority].label}</span>
                                  <span style={{fontSize:9, padding:"1px 5px", borderRadius:10, background:cc+"18", color:cc}}>{cat?.icon} {cat?.label}</span>
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
