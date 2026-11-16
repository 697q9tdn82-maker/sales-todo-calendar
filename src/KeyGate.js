import { useState } from "react";
import { C } from "./constants";
import { loadKey, setKey, forgetKey, parseKey, generateKey, registrationUrl, migrateOldData } from "./vault";

// 合言葉がある端末だけアプリを表示する。ない端末には設定画面を出す
// （普段は何も表示されません。初めての端末で1回だけ出ます）
const box = { minHeight: "100vh", background: C.bg, color: C.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center", fontFamily: "'Noto Sans JP','Hiragino Sans',sans-serif" };
const btn = { padding: "11px 22px", borderRadius: 10, border: "none", background: C.grad, color: C.bg, fontWeight: 800, cursor: "pointer", fontSize: 14, fontFamily: "inherit" };
const subBtn = { ...btn, background: C.chip, color: C.sub, fontWeight: 700, fontSize: 12 };
const input = { width: "100%", maxWidth: 420, boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, background: C.panel2, color: C.text, fontSize: 13, fontFamily: "inherit" };

function CopyUrl() {
  const [copied, setCopied] = useState(false);
  const url = registrationUrl();
  return (
    <>
      <div style={{ ...input, wordBreak: "break-all", textAlign: "left", fontSize: 11, userSelect: "all" }}>{url}</div>
      <button style={btn} onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true)).catch(() => {})}>
        {copied ? "✓ コピーしました" : "登録用URLをコピー"}
      </button>
    </>
  );
}

export default function KeyGate({ children }) {
  const [hasKey, setHasKey] = useState(() => !!loadKey());
  const [step, setStep] = useState("ask");   // ask | working | created | error
  const [msg, setMsg] = useState("");
  const [text, setText] = useState("");
  const [showKey, setShowKey] = useState(false);

  if (hasKey && step !== "created") {
    return (
      <>
        {children}
        {/* 右下の小さな🔑：ほかの端末で使うための登録用URLを出す */}
        <button onClick={() => setShowKey(true)} aria-label="ほかの端末で使う" style={{ position: "fixed", left: 10, bottom: "calc(70px + env(safe-area-inset-bottom, 0px))", width: 30, height: 30, borderRadius: "50%", border: "none", background: C.chip, color: C.dim, fontSize: 13, cursor: "pointer", zIndex: 240, opacity: 0.7 }}>🔑</button>
        {showKey && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={(e) => e.target === e.currentTarget && setShowKey(false)}>
            <div style={{ background: C.panel2, borderRadius: 14, padding: 20, maxWidth: 460, width: "100%", display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center", color: C.text }}>
              <div style={{ fontWeight: 800 }}>🔑 ほかの端末で使う</div>
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.8 }}>使いたい端末でこのURLを1回開くと、その端末でも使えるようになります。<br />このURLは鍵そのものです。人に送ったり、画面共有で映したりしないでください。</div>
              <CopyUrl />
              <button style={subBtn} onClick={() => setShowKey(false)}>閉じる</button>
              <button style={{ ...subBtn, background: "none", color: C.dim, fontSize: 11 }} onClick={() => { if (window.confirm("この端末から合言葉を消しますか？（データは消えません。登録用URLを開けばまた使えます）")) { forgetKey(); setShowKey(false); setHasKey(false); setStep("ask"); } }}>この端末の登録を外す</button>
            </div>
          </div>
        )}
      </>
    );
  }

  // 最初の1台：合言葉を作って、これまでのデータを引っ越す
  const create = async () => {
    if (!window.confirm("この端末で合言葉を作り、これまでのデータを引っ越します。\n\n※ 最初の1台だけで行ってください。2台目からは、1台目で表示される「登録用URL」を開きます。")) return;
    setStep("working");
    setKey(generateKey());
    try {
      const counts = await migrateOldData();
      setMsg(`タスク${counts.sales_todos}件・案件${counts.sales_deals}件・日報${counts.sales_reports}件を引っ越しました。`);
      setStep("created");
      setHasKey(true);
    } catch (e) {
      forgetKey();
      setMsg(e?.code === "permission-denied"
        ? "すでに設定が済んでいるようです。設定済みの端末の🔑から「登録用URL」をコピーして、この端末で開いてください。"
        : `引っ越しに失敗しました。通信状況を確認して、もう一度お試しください。（${e?.code || e?.message || "不明なエラー"}）`);
      setStep("error");
    }
  };

  const usePasted = () => {
    const k = parseKey(text);
    if (!k) { setMsg("合言葉の形が正しくありません。登録用URLをそのまま貼り付けてください。"); setStep("error"); return; }
    setKey(k);
    setHasKey(true);
    setStep("ask");
  };

  if (step === "created") {
    return (
      <div style={box}>
        <div style={{ fontSize: 34 }}>🔑</div>
        <div style={{ fontWeight: 800, fontSize: 16 }}>設定できました</div>
        <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.9, maxWidth: 460 }}>
          {msg}<br />
          下の「登録用URL」を、<strong style={{ color: C.text }}>自分だけが見られる場所（メモアプリなど）に保存</strong>してください。<br />
          ほかの端末で使うとき・ブラウザのデータを消したときに必要です。この端末では、今まで通りのURLで開けます。
        </div>
        <CopyUrl />
        <button style={subBtn} onClick={() => setStep("ask")}>保存したので、アプリを開く</button>
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ fontSize: 34 }}>🔑</div>
      <div style={{ fontWeight: 800, fontSize: 16 }}>この端末はまだ登録されていません</div>
      {step === "working" ? (
        <div style={{ fontSize: 13, color: C.sub }}>データを引っ越しています…（そのままお待ちください）</div>
      ) : (
        <>
          {step === "error" && <div style={{ fontSize: 12.5, color: C.red, maxWidth: 460, lineHeight: 1.8 }}>{msg}</div>}
          <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.9, maxWidth: 460 }}>登録用URLを持っている場合は、ここに貼り付けてください。</div>
          <input style={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="登録用URL（…#k=…）を貼り付け" />
          <button style={btn} disabled={!text.trim()} onClick={usePasted}>この端末を登録する</button>
          <div style={{ height: 8 }} />
          <button style={subBtn} onClick={create}>はじめての設定（最初の1台だけ）</button>
        </>
      )}
    </div>
  );
}
