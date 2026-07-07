import { useState } from "react";
import { STAGES, PRODUCTS } from "../constants";

// ── 案件パイプライン(かんばん) ────────────────────────
// ドラッグ&ドロップでステージ移動可(PCはドラッグ、スマホは従来のボタン)
export default function PipelineTab({ deals, dealsLoading, todayStr, openAddDeal, openEditDeal, deleteDeal, moveDeal }) {
  const [dragOverStage, setDragOverStage] = useState(null);

  function fmt(n){ const v=Number(n)||0; return v>=10000?(v/10000).toFixed(1)+"万":v>0?v.toLocaleString():"―"; }

  if (dealsLoading) return <div style={{textAlign:"center",color:"#7A7D8A",padding:"40px"}}>読み込み中...</div>;

  // ステージ別集計
  const stageTotal = (stageKey) => deals
    .filter(d=>d.stage===stageKey)
    .reduce((s,d)=>s+(Number(d.amount)||0),0);

  function onDropStage(e, stageKey) {
    e.preventDefault();
    setDragOverStage(null);
    const id = e.dataTransfer.getData("text/plain");
    const deal = deals.find(d=>d.id===id);
    if (deal && deal.stage!==stageKey) moveDeal(deal, stageKey);
  }

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
      <div style={{display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:9, marginBottom:16}}>
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
      <div style={{display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10}}>
        {STAGES.map(stage=>{
          const stageDeals = deals.filter(d=>d.stage===stage.key);
          const isOver = dragOverStage===stage.key;
          return (
            <div key={stage.key}
              onDragOver={e=>{e.preventDefault(); setDragOverStage(stage.key);}}
              onDragLeave={()=>setDragOverStage(s=>s===stage.key?null:s)}
              onDrop={e=>onDropStage(e, stage.key)}
              style={{
                background:"#1A1D26", borderRadius:14,
                border:`1px ${isOver?"dashed":"solid"} ${stage.color}${isOver?"":"30"}`,
                overflow:"hidden",
              }}>
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
                  const prods = (deal.products||[]).map(k=>PRODUCTS.find(p=>p.key===k)).filter(Boolean);
                  const naColor = deal.nextAction
                    ? (deal.nextAction < todayStr ? "#FF5252" : deal.nextAction===todayStr ? "#FFD700" : "#7A7D8A")
                    : null;
                  return (
                    <div key={deal.id}
                      draggable
                      onDragStart={e=>e.dataTransfer.setData("text/plain", deal.id)}
                      onDoubleClick={()=>openEditDeal(deal)}
                      style={{
                        background:"#12151E", borderRadius:10, padding:"10px 11px",
                        border:"1px solid #2A2D3A", cursor:"grab",
                      }}>
                      <div style={{display:"flex", alignItems:"center", gap:5, marginBottom:5}}>
                        <div style={{fontWeight:700, fontSize:13, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis", flex:1}}>{deal.company}</div>
                        {deal.fromTask && <span style={{fontSize:9, background:"#FBBF2418", color:"#FBBF24", borderRadius:4, padding:"1px 5px", flexShrink:0}}>自動</span>}
                      </div>
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
                      {deal.nextAction && (
                        <div style={{fontSize:10, color:naColor, marginTop:4, fontWeight:700}}>
                          📅 次アクション {deal.nextAction.slice(5).replace("-","/")}
                          {deal.nextAction<todayStr && " (超過)"}
                          {deal.nextAction===todayStr && " (今日)"}
                        </div>
                      )}
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
