import { useState, useEffect } from "react";

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
  membership: { label: "加盟料",  icon: "🏅", color: "#A78BFA" },
  news:       { label: "ニュース", icon: "📰", color: "#60A5FA" },
  cos:        { label: "COS",    icon: "💼", color: "#34D399" },
  att:        { label: "ATT",    icon: "📡", color: "#FBBF24" },
  net:        { label: "NET",    icon: "🌐", color: "#F87171" },
  ticket:     { label: "チケット", icon: "🎟️", color: "#FB923C" },
};

const ALL_CATEGORIES = { ...ACTION_CATEGORIES, ...PRODUCT_CATEGORIES };

const DAYS_JP   = ["日","月","火","水","木","金","土"];
const MONTHS_JP = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

function generateId() { return Math.random().toString(36).slice(2, 9); }

function makeDateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}
function addDays(str, n) {
  const d = new Date(str); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10);
}
function fmtDate(str) {
  const d = new Date(str);
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}

const today    = new Date();
const todayStr = today.toISOString().slice(0,10);

const INITIAL_TODOS = [
  { id: generateId(), title: "株式会社ABC 初回アポ",  date: todayStr,             priority: "high",   category: "prospect",   done: false, note: "代表取締役と面談" },
  { id: generateId(), title: "山田商事 ニュース提案",  date: todayStr,             priority: "high",   category: "news",       done: false, note: "電子版プランで" },
  { id: generateId(), title: "佐藤工業 COS更新確認",   date: todayStr,             priority: "medium", category: "cos",        done: false, note: "" },
  { id: generateId(), title: "加盟料 鈴木商事",        date: addDays(todayStr,1),  priority: "high",   category: "membership", done: false, note: "来月末期限" },
  { id: generateId(), title: "ATTパッケージ提案",      date: addDays(todayStr,1),  priority: "medium", category: "att",        done: false, note: "" },
  { id: generateId(), title: "NET切替フォロー",        date: addDays(todayStr,2),  priority: "medium", category: "net",        done: false, note: "3社まとめて" },
  { id: generateId(), title: "チケット案内 田中社",    date: addDays(todayStr,2),  priority: "low",    category: "ticket",     done: false, note: "野球シーズン" },
  { id: generateId(), title: "週次レポート作成",       date: addDays(todayStr,3),  priority: "low",    category: "admin",      done: false, note: "" },
];

function catColor(key) {
  return PRODUCT_CATEGORIES[key] ? PRODUCT_CATEGORIES[key].color : "#94A3B8";
}

export default function SalesTodoCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [view, setView]       = useState("month");
  const [todos, setTodos] = useState(() => {
    try {
      const saved = localStorage.getItem("sales-todos");
      return saved ? JSON.parse(saved) : INITIAL_TODOS;
    } catch { return INITIAL_TODOS; }
  });

  useEffect(() => {
    try { localStorage.setItem("sales-todos", JSON.stringify(todos)); } catch {}
  }, [todos]);
  const [showModal, setShowModal] = useState(false);
  const [editTodo, setEditTodo]   = useState(null);
  const [form, setForm] = useState({ title:"", date:todayStr, priority:"medium", category:"followup", note:"" });
  const [filterCat, setFilterCat] = useState("all");
  const [catTab, setCatTab]       = useState("action");

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthPrefix = `${year}-${String(month+1).padStart(2,"0")}`;
  const monthTodos  = todos.filter(t => t.date.startsWith(monthPrefix));
  const stats = {
    total: monthTodos.length,
    done:  monthTodos.filter(t => t.done).length,
    high:  monthTodos.filter(t => t.priority==="high" && !t.done).length,
  };
  const completionRate = stats.total > 0 ? Math.round((stats.done/stats.total)*100) : 0;

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const calendarDays = [];
  for (let i=0; i<firstDay; i++) calendarDays.push(null);
  for (let d=1; d<=daysInMonth; d++) calendarDays.push(d);

  const threeDays = [selectedDate, addDays(selectedDate,1), addDays(selectedDate,2)];

  const todosFor = (ds) => todos.filter(t => t.date===ds);
  const dayTodos = (filterCat==="all" ? todos : todos.filter(t=>t.category===filterCat))
    .filter(t => t.date===selectedDate);

  function openAdd(ds) {
    setEditTodo(null);
    setForm({ title:"", date: ds||selectedDate, priority:"medium", category:"followup", note:"" });
    setShowModal(true);
  }
  function openEdit(todo) {
    setEditTodo(todo);
    setForm({ title:todo.title, date:todo.date, priority:todo.priority, category:todo.category, note:todo.note });
    setShowModal(true);
  }
  function saveTodo() {
    if (!form.title.trim()) return;
    if (editTodo) {
      setTodos(todos.map(t => t.id===editTodo.id ? {...t,...form} : t));
    } else {
      setTodos([...todos, { id:generateId(), ...form, done:false }]);
    }
    setShowModal(false);
  }
  function toggleDone(id) { setTodos(todos.map(t => t.id===id ? {...t,done:!t.done} : t)); }
  function deleteTodo(id) { setTodos(todos.filter(t => t.id!==id)); }

  function shiftSelected(n) { setSelectedDate(addDays(selectedDate,n)); }
  function clickDay(d) { setSelectedDate(makeDateStr(year,month,d)); setView("day"); }

  const inputStyle = {
    width:"100%", background:"#12151E", border:"1px solid #2A2D3A",
    borderRadius:10, padding:"10px 14px", color:"#E8EAF0", fontSize:14,
    outline:"none", boxSizing:"border-box", fontFamily:"inherit",
  };

  function ViewBtn({ v, label }) {
    const active = view===v;
    return (
      <button onClick={()=>setView(v)} style={{
        padding:"6px 14px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, fontWeight:700,
        background: active ? "linear-gradient(135deg,#FFD700,#FF8C00)" : "#1E2230",
        color: active ? "#0D0F14" : "#7A7D8A", transition:"all 0.2s",
      }}>{label}</button>
    );
  }

  function TodoCard({ todo }) {
    const cat = ALL_CATEGORIES[todo.category] || { label:todo.category, icon:"•" };
    const cc  = catColor(todo.category);
    return (
      <div style={{
        background:"#1A1D26", borderRadius:14, padding:"13px 15px",
        border:`1px solid ${todo.done ? "#2A2D3A" : PRIORITIES[todo.priority].color+"50"}`,
        opacity: todo.done ? 0.55 : 1,
        display:"flex", alignItems:"flex-start", gap:11,
      }}>
        <button onClick={()=>toggleDone(todo.id)} style={{
          width:22, height:22, borderRadius:"50%", flexShrink:0, marginTop:2,
          border:`2px solid ${todo.done ? "#34C759" : PRIORITIES[todo.priority].color}`,
          background: todo.done ? "#34C759" : "transparent",
          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
          color:"#fff", fontSize:12,
        }}>{todo.done?"✓":""}</button>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap"}}>
            <span style={{fontSize:14, fontWeight:600, textDecoration:todo.done?"line-through":"none"}}>{todo.title}</span>
            <span style={{fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:700, background:PRIORITIES[todo.priority].bg, color:PRIORITIES[todo.priority].color}}>
              {PRIORITIES[todo.priority].label}
            </span>
            <span style={{fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:700, background:cc+"18", color:cc}}>
              {cat.icon} {cat.label}
            </span>
          </div>
          {todo.note && <div style={{fontSize:12, color:"#7A7D8A", marginTop:3}}>{todo.note}</div>}
        </div>
        <div style={{display:"flex", gap:5, flexShrink:0}}>
          <button onClick={()=>openEdit(todo)} style={{background:"#1E2230", border:"none", borderRadius:6, width:28, height:28, cursor:"pointer", color:"#7A7D8A", fontSize:13}}>✏️</button>
          <button onClick={()=>deleteTodo(todo.id)} style={{background:"#1E2230", border:"none", borderRadius:6, width:28, height:28, cursor:"pointer", color:"#FF5252", fontSize:13}}>🗑</button>
        </div>
      </div>
    );
  }

  function FilterBar() {
    return (
      <div style={{marginBottom:14}}>
        <div style={{display:"flex", gap:6, marginBottom:8, alignItems:"center"}}>
          {[["action","営業アクション"],["product","商品"]].map(([t,l]) => (
            <button key={t} onClick={()=>setCatTab(t)} style={{
              padding:"4px 11px", borderRadius:6, border:"none", cursor:"pointer", fontSize:11, fontWeight:700,
              background: catTab===t ? "#2A2D3A" : "transparent",
              color: catTab===t ? "#E8EAF0" : "#5A5D6A",
            }}>{l}</button>
          ))}
          <button onClick={()=>setFilterCat("all")} style={{
            marginLeft:"auto", padding:"4px 11px", borderRadius:6, border:"none", cursor:"pointer", fontSize:11, fontWeight:700,
            background: filterCat==="all" ? "#FFD700" : "#1E2230",
            color: filterCat==="all" ? "#0D0F14" : "#7A7D8A",
          }}>すべて</button>
        </div>
        <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
          {Object.entries(catTab==="action" ? ACTION_CATEGORIES : PRODUCT_CATEGORIES).map(([key,cat]) => {
            const active = filterCat===key;
            const cc = catColor(key);
            return (
              <button key={key} onClick={()=>setFilterCat(key)} style={{
                padding:"4px 10px", borderRadius:16,
                border: active ? `1px solid ${cc}` : "1px solid transparent",
                cursor:"pointer", fontSize:11, fontWeight:600,
                background: active ? cc+"18" : "#1A1D26",
                color: active ? cc : "#7A7D8A",
              }}>{cat.icon} {cat.label}</button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh", background:"#0D0F14", fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif", color:"#E8EAF0"}}>

      {/* Header */}
      <div style={{
        background:"linear-gradient(135deg,#1A1D26 0%,#12151E 100%)",
        borderBottom:"1px solid #2A2D3A", padding:"15px 18px",
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
          <div style={{display:"flex", gap:5}}>
            <ViewBtn v="month" label="月次" />
            <ViewBtn v="3day"  label="3日" />
            <ViewBtn v="day"   label="日次" />
          </div>
        </div>
      </div>

      <div style={{maxWidth:980, margin:"0 auto", padding:"16px 13px 100px"}}>

        {/* Stats */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16}}>
          {[
            {label:"月間タスク", value:stats.total,          icon:"📌", accent:"#4FC3F7"},
            {label:"完了率",     value:`${completionRate}%`, icon:"✅", accent:"#66BB6A"},
            {label:"緊急",       value:stats.high,           icon:"🔥", accent:"#FF5252"},
          ].map(s => (
            <div key={s.label} style={{
              background:"#1A1D26", borderRadius:12, padding:"12px 14px",
              border:"1px solid #2A2D3A", position:"relative", overflow:"hidden",
            }}>
              <div style={{fontSize:17, marginBottom:2}}>{s.icon}</div>
              <div style={{fontSize:22, fontWeight:800, color:s.accent, lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:10, color:"#7A7D8A", marginTop:3}}>{s.label}</div>
              <div style={{position:"absolute", right:-8, bottom:-8, width:50, height:50, borderRadius:"50%", background:s.accent, opacity:0.07}}/>
            </div>
          ))}
        </div>

        {/* ─── MONTH VIEW ─── */}
        {view==="month" && (
          <div style={{background:"#1A1D26", borderRadius:18, border:"1px solid #2A2D3A", overflow:"hidden"}}>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 17px", borderBottom:"1px solid #2A2D3A"}}>
              <button onClick={()=>setCurrentDate(new Date(year,month-1,1))} style={{background:"#12151E", border:"1px solid #2A2D3A", borderRadius:8, width:30, height:30, cursor:"pointer", color:"#E8EAF0", fontSize:16}}>‹</button>
              <div style={{fontWeight:700, fontSize:17}}>{year}年 {MONTHS_JP[month]}</div>
              <button onClick={()=>setCurrentDate(new Date(year,month+1,1))} style={{background:"#12151E", border:"1px solid #2A2D3A", borderRadius:8, width:30, height:30, cursor:"pointer", color:"#E8EAF0", fontSize:16}}>›</button>
            </div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(7,1fr)", textAlign:"center"}}>
              {DAYS_JP.map((d,i) => (
                <div key={d} style={{padding:"7px 0", fontSize:11, fontWeight:700, color:i===0?"#FF5252":i===6?"#4FC3F7":"#7A7D8A", borderBottom:"1px solid #2A2D3A"}}>{d}</div>
              ))}
            </div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(7,1fr)"}}>
              {calendarDays.map((d,i) => {
                if (!d) return <div key={`e${i}`} style={{minHeight:68, borderRight:"1px solid #1E2230", borderBottom:"1px solid #1E2230"}}/>;
                const ds       = makeDateStr(year,month,d);
                const dt       = todosFor(ds);
                const isToday  = ds===todayStr;
                const isSel    = ds===selectedDate;
                const dow      = (firstDay+d-1)%7;
                const hasHigh  = dt.some(t=>t.priority==="high"&&!t.done);
                return (
                  <div key={d} onClick={()=>clickDay(d)} style={{
                    minHeight:68, padding:"5px", cursor:"pointer",
                    borderRight:"1px solid #1E2230", borderBottom:"1px solid #1E2230",
                    background: isSel?"#1E2538":isToday?"#1A2028":"transparent",
                  }}>
                    <div style={{
                      width:24, height:24, borderRadius:"50%",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      background: isToday?"linear-gradient(135deg,#FFD700,#FF8C00)":"transparent",
                      color: isToday?"#0D0F14":dow===0?"#FF5252":dow===6?"#4FC3F7":"#E8EAF0",
                      fontSize:12, fontWeight:isToday?800:500, marginBottom:3, position:"relative",
                    }}>
                      {d}
                      {hasHigh&&<span style={{position:"absolute",top:-1,right:-1,width:6,height:6,borderRadius:"50%",background:"#FF4444"}}/>}
                    </div>
                    {dt.slice(0,2).map(t => {
                      const cc = catColor(t.category);
                      return (
                        <div key={t.id} style={{
                          fontSize:9, padding:"1px 4px", borderRadius:3, marginBottom:2,
                          background:cc+"20", color:cc, opacity:t.done?0.4:1,
                          overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis",
                        }}>
                          {ALL_CATEGORIES[t.category]?.icon} {t.title}
                        </div>
                      );
                    })}
                    {dt.length>2&&<div style={{fontSize:9,color:"#7A7D8A"}}>+{dt.length-2}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── 3-DAY VIEW ─── */}
        {view==="3day" && (
          <div>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14}}>
              <button onClick={()=>shiftSelected(-3)} style={{background:"#1A1D26", border:"1px solid #2A2D3A", borderRadius:8, padding:"6px 13px", cursor:"pointer", color:"#E8EAF0", fontSize:13}}>‹ 前3日</button>
              <div style={{fontWeight:700, fontSize:13, color:"#7A7D8A"}}>
                {fmtDate(threeDays[0])} 〜 {fmtDate(threeDays[2])}
              </div>
              <button onClick={()=>shiftSelected(3)} style={{background:"#1A1D26", border:"1px solid #2A2D3A", borderRadius:8, padding:"6px 13px", cursor:"pointer", color:"#E8EAF0", fontSize:13}}>次3日 ›</button>
            </div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10}}>
              {threeDays.map(ds => {
                const dt      = todosFor(ds);
                const d       = new Date(ds);
                const dow     = d.getDay();
                const isToday = ds===todayStr;
                return (
                  <div key={ds} style={{
                    background:"#1A1D26", borderRadius:14,
                    border: isToday?"1px solid #FFD70060":"1px solid #2A2D3A",
                    overflow:"hidden",
                  }}>
                    <div style={{
                      padding:"10px 12px", borderBottom:"1px solid #2A2D3A",
                      background: isToday?"#FFD70010":"transparent",
                      display:"flex", alignItems:"center", gap:6,
                    }}>
                      <div style={{fontWeight:800, fontSize:20, color:dow===0?"#FF5252":dow===6?"#4FC3F7":"#E8EAF0"}}>
                        {d.getDate()}
                      </div>
                      <div>
                        <div style={{fontSize:10, color:"#7A7D8A"}}>{d.getMonth()+1}月 {DAYS_JP[dow]}曜</div>
                        {isToday&&<span style={{fontSize:9, background:"#FFD700", color:"#0D0F14", borderRadius:3, padding:"1px 5px", fontWeight:700}}>TODAY</span>}
                      </div>
                      <div style={{marginLeft:"auto", background:"#12151E", borderRadius:10, padding:"2px 8px", fontSize:11, color:"#7A7D8A"}}>{dt.length}件</div>
                    </div>
                    <div style={{padding:"8px", display:"flex", flexDirection:"column", gap:6}}>
                      {dt.length===0&&(
                        <div style={{textAlign:"center", color:"#3A3D4A", fontSize:11, padding:"12px 0"}}>タスクなし</div>
                      )}
                      {dt.map(t => {
                        const cc  = catColor(t.category);
                        const cat = ALL_CATEGORIES[t.category];
                        return (
                          <div key={t.id} onClick={()=>{setSelectedDate(ds);setView("day");}} style={{
                            background:"#12151E", borderRadius:8, padding:"8px 10px",
                            border:`1px solid ${t.done?"#2A2D3A":PRIORITIES[t.priority].color+"40"}`,
                            opacity:t.done?0.5:1, cursor:"pointer",
                          }}>
                            <div style={{fontSize:12, fontWeight:600, marginBottom:3, textDecoration:t.done?"line-through":"none", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis"}}>{t.title}</div>
                            <div style={{display:"flex", gap:4}}>
                              <span style={{fontSize:9, padding:"1px 5px", borderRadius:10, background:PRIORITIES[t.priority].bg, color:PRIORITIES[t.priority].color, fontWeight:700}}>{PRIORITIES[t.priority].label}</span>
                              <span style={{fontSize:9, padding:"1px 5px", borderRadius:10, background:cc+"18", color:cc}}>{cat?.icon} {cat?.label}</span>
                            </div>
                          </div>
                        );
                      })}
                      <button onClick={()=>{setSelectedDate(ds);openAdd(ds);}} style={{
                        width:"100%", background:"transparent", border:"1px dashed #2A2D3A",
                        borderRadius:8, padding:"6px", cursor:"pointer", color:"#5A5D6A", fontSize:11,
                      }}>+ 追加</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── DAY VIEW ─── */}
        {view==="day" && (
          <div>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14}}>
              <button onClick={()=>shiftSelected(-1)} style={{background:"#1A1D26", border:"1px solid #2A2D3A", borderRadius:8, padding:"6px 13px", cursor:"pointer", color:"#E8EAF0", fontSize:13}}>‹ 前日</button>
              <div style={{textAlign:"center"}}>
                <div style={{fontWeight:800, fontSize:20}}>{fmtDate(selectedDate)}</div>
                <div style={{fontSize:12, color:"#7A7D8A"}}>
                  {DAYS_JP[new Date(selectedDate).getDay()]}曜日
                  {selectedDate===todayStr&&<span style={{marginLeft:6, background:"#FFD700", color:"#0D0F14", borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700}}>TODAY</span>}
                </div>
              </div>
              <button onClick={()=>shiftSelected(1)} style={{background:"#1A1D26", border:"1px solid #2A2D3A", borderRadius:8, padding:"6px 13px", cursor:"pointer", color:"#E8EAF0", fontSize:13}}>翌日 ›</button>
            </div>
            <FilterBar />
            <div style={{display:"flex", flexDirection:"column", gap:10}}>
              {dayTodos.length===0&&(
                <div style={{background:"#1A1D26", borderRadius:14, padding:"36px 20px", textAlign:"center", color:"#7A7D8A", border:"1px dashed #2A2D3A"}}>
                  <div style={{fontSize:28, marginBottom:8}}>📭</div>
                  <div>タスクなし</div>
                </div>
              )}
              {dayTodos.map(t => <TodoCard key={t.id} todo={t}/>)}
            </div>
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

      {/* Modal */}
      {showModal&&(
        <div style={{
          position:"fixed", inset:0, background:"#000000BB",
          display:"flex", alignItems:"center", justifyContent:"center",
          zIndex:300, padding:16,
        }} onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={{
            background:"#1A1D26", borderRadius:20, padding:22, width:"100%", maxWidth:440,
            border:"1px solid #2A2D3A", maxHeight:"90vh", overflowY:"auto",
          }}>
            <div style={{fontWeight:800, fontSize:17, marginBottom:18}}>{editTodo?"タスク編集":"タスク追加"}</div>
            <div style={{display:"flex", flexDirection:"column", gap:13}}>

              <div>
                <label style={{fontSize:11, color:"#7A7D8A", display:"block", marginBottom:5}}>タスク名</label>
                <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}
                  placeholder="例：山田商事 提案書作成" style={inputStyle}/>
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
                      background: form.priority===k ? v.bg : "#12151E",
                      color: form.priority===k ? v.color : "#5A5D6A",
                      outline: form.priority===k ? `1px solid ${v.color}` : "none",
                    }}>{v.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{fontSize:11, color:"#7A7D8A", display:"block", marginBottom:8}}>カテゴリ</label>
                <div style={{fontSize:10, color:"#5A5D6A", marginBottom:5}}>営業アクション</div>
                <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:10}}>
                  {Object.entries(ACTION_CATEGORIES).map(([k,v])=>(
                    <button key={k} onClick={()=>setForm({...form,category:k})} style={{
                      padding:"5px 10px", borderRadius:16, border:"none", cursor:"pointer", fontSize:11, fontWeight:600,
                      background: form.category===k ? "#2A2D3A" : "#12151E",
                      color: form.category===k ? "#E8EAF0" : "#5A5D6A",
                      outline: form.category===k ? "1px solid #4FC3F7" : "none",
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
                        background: active ? v.color+"18" : "#12151E",
                        color: active ? v.color : "#5A5D6A",
                        outline: active ? `1px solid ${v.color}` : "none",
                      }}>{v.icon} {v.label}</button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{fontSize:11, color:"#7A7D8A", display:"block", marginBottom:5}}>メモ</label>
                <textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})}
                  rows={2} placeholder="補足メモ..." style={{...inputStyle,resize:"none"}}/>
              </div>

              <div style={{display:"flex", gap:10, marginTop:2}}>
                <button onClick={()=>setShowModal(false)} style={{
                  flex:1, padding:"11px", borderRadius:12, border:"1px solid #2A2D3A",
                  background:"transparent", color:"#7A7D8A", cursor:"pointer", fontSize:13, fontWeight:600,
                }}>キャンセル</button>
                <button onClick={saveTodo} style={{
                  flex:2, padding:"11px", borderRadius:12, border:"none",
                  background:"linear-gradient(135deg,#FFD700,#FF8C00)",
                  color:"#0D0F14", cursor:"pointer", fontSize:13, fontWeight:800,
                }}>保存する</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
