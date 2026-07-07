import { HALF_MONTHS, MILESTONES, PROD_COLORS } from "../constants";
import { getBizDaysInMonth, getBizDaysPassed } from "../utils";

// ── 営業ボード(目標・実績管理) ────────────────────────
export default function BoardTab({ boardData, setBoardData, saveBoardData, boardLoading, boardEdit, setBoardEdit }) {
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

  // 今月の営業日数
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
