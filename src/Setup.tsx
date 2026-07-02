import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { Config, HistoryEntry } from './types';

const VARS = [
  { btn: 1, key: "person", label: "人の人数", values: [1, 2, 3, 4] },
  { btn: 2, key: "tablet", label: "タブレットの個数", values: [1] },
  { btn: 3, key: "desk", label: "机の個数", values: [1] },
  { btn: 4, key: "chair", label: "椅子の数", values: [2, 3, 4] },
  { btn: 5, key: "switch", label: "スイッチの個数", values: [1] },
  { btn: 6, key: "partition", label: "パーテーション", values: [3, 4] },
  { btn: 7, key: "stop", label: "ストップマークの個数", values: [8] },
  { btn: 8, key: "rubik", label: "ルービックキューブ", values: [0, 1] },
  { btn: 9, key: "arubeki", label: "スギちゃん", values: [0, 1] },
];

export const Setup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'setup' | 'history'>('setup');

  const [cfg, setCfg] = useState<Config>({ person: 2, tablet: 1, desk: 1, chair: 2, switch: 1, partition: 4, stop: 8, rubik: 1, arubeki: 0 });
  const [toast, setToast] = useState("");

  const [cum, setCum] = useState(0);
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [pins, setPins] = useState<string[]>([]);
  const [pinInput, setPinInput] = useState("");

  useEffect(() => {
    supabase.from('settings').select('config').eq('id', 1).single().then(({ data }) => {
      const row = data as { config?: Config } | null;
      if (row?.config) setCfg(row.config);
    });
  }, []);

  useEffect(() => {
    supabase.from('status').select('*').eq('id', 1).single().then(({ data }) => {
      const row = data as { cumulative?: number; pins?: string[] } | null;
      if (row?.cumulative !== undefined) setCum(row.cumulative);
      if (Array.isArray(row?.pins)) setPins(row.pins);
    });
    supabase.from('history').select('*').order('ts', { ascending: false }).limit(100).then(({ data }) => {
      if (data) setItems(data as HistoryEntry[]);
    });

    const channel = supabase.channel('setup-history-view')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'status' }, (payload) => {
        const row = payload.new as { cumulative?: number; pins?: string[] };
        if (row?.cumulative !== undefined) setCum(row.cumulative);
        if (Array.isArray(row?.pins)) setPins(row.pins);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'history' }, (payload) => {
        if (payload.new) setItems((prev) => [payload.new as HistoryEntry, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1600);
  };

  useEffect(() => {
    supabase.from('settings').select('config').eq('id', 1).single().then(({ data, error }) => {
      if(error){
        console.log('上書き失敗');
      }
      
      if (data?.config) {
        setCfg(data.config); // 取得した設定で上書き
      }
    });
  }, []);

  const saveConfig = async () => {
    // upsertではなく、明確にid:1を更新する
    const { error } = await supabase.from('settings')
      .update({ config: cfg })
      .eq('id', 1);
    
    if (error) {
      console.error("保存失敗:", error);
      showToast(`失敗: ${error.message}`);
    } else {
      showToast("設定を反映しました");
    }
  };

  const addPin = async (text: string) => {
  if (!text.trim() || pins.includes(text)) return;
  
  const newPins = [text, ...pins];
  setPins(newPins); // 画面を即時更新
  const { error } = await supabase.from('status').update({ pins: newPins }).eq('id', 1);
  
  if (error) {
    console.error("保存失敗:", error);
    showToast("保存に失敗しました");
  } else {
    setPinInput(""); // 成功時のみ入力欄を空にする
  }
};

  const removePin = async (text: string) => {
    const newPins = pins.filter(p => p !== text);
    setPins(newPins);
    await supabase.from('status').update({ pins: newPins }).eq('id', 1);
  };

  const progressWidth = Math.min(100, (cum / 15) * 100);

  return (
    <div className="wrap" style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "16px" }}>switch and</h1>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button onClick={() => setActiveTab('setup')} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: "bold", cursor: "pointer", background: activeTab === 'setup' ? "#00ffff" : "#27272a", color: activeTab === 'setup' ? "#000" : "#a1a1aa" }}>
          設定変更
        </button>
        <button onClick={() => setActiveTab('history')} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: "bold", cursor: "pointer", background: activeTab === 'history' ? "#00ffff" : "#27272a", color: activeTab === 'history' ? "#000" : "#a1a1aa" }}>
          履歴・状況
        </button>
      </div>

      {activeTab === 'setup' && (
        <div>
          <div id="varCards">
            {VARS.map(g => (
              <div key={g.key} className="card" style={{ background: "#18181b", padding: "16px", borderRadius: "8px", marginBottom: "12px" }}>
                <div className="lbl" style={{ marginBottom: "8px" }}><span style={{ color: "#71717a", marginRight: "8px" }}>#{g.btn}</span>{g.label}</div>
                <div className="opts" style={{ display: "flex", gap: "8px" }}>
                  {g.values.map(v => (
                    <button key={v} style={{ flex: 1, padding: "12px", borderRadius: "6px", border: "1px solid #3f3f46", background: cfg[g.key as keyof Config] === v ? "#00ffff" : "#27272a", color: cfg[g.key as keyof Config] === v ? "#000" : "#fff", fontWeight: cfg[g.key as keyof Config] === v ? "bold" : "normal", cursor: "pointer" }} onClick={() => setCfg(prevCfg => ({ ...prevCfg, [g.key]: v }))}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="actions" style={{ marginTop: "24px" }}>
            <button style={{ width: "100%", padding: "16px", borderRadius: "8px", background: "#10b981", color: "#000", fontSize: "16px", fontWeight: "bold", border: "none", cursor: "pointer" }} onClick={saveConfig}>
              設定を反映
            </button>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          <div className="progress" style={{ marginBottom: "24px", padding: "16px", background: "#18181b", borderRadius: "8px", border: "1px solid #27272a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "8px", color: "#a1a1aa" }}>
              <span>ゴールまで</span>
              <span><b style={{ color: cum >= 15 ? "#34d399" : "#f4f4f5", fontFamily: "monospace", fontSize: "18px" }}>{cum}</b> / 15</span>
            </div>
            <div className="pbar" style={{ height: "12px", borderRadius: "999px", background: "#27272a", overflow: "hidden" }}>
              <div className="pfill" style={{ height: "100%", background: "linear-gradient(90deg,#ef4444,#f59e0b)", transition: "width .5s", width: `${progressWidth}%` }}></div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
            <input 
              value={pinInput} onChange={e => setPinInput(e.target.value)}
              placeholder="オリジナルの文章を入力してピン留め"
              style={{ flex: 1, padding: "12px", borderRadius: "8px", background: "#18181b", border: "1px solid #3f3f46", color: "#f4f4f5", fontSize: "14px" }}
            />
            <button onClick={() => addPin(pinInput)} style={{ padding: "0 20px", borderRadius: "8px", background: "#00ffff", color: "#000", fontWeight: "bold", border: "none", cursor: "pointer", flexShrink: 0 }}>
              追加
            </button>
          </div>

          {pins.length > 0 && (
            <div style={{ marginBottom: "32px" }}>
              <div style={{ fontSize: "12px", color: "#f59e0b", marginBottom: "10px", fontWeight: "bold" }}>📌 ピン留め中</div>
              {pins.map(p => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(245,158,11,.15)", border: "1px solid rgba(245,158,11,.3)", padding: "12px 14px", borderRadius: "10px", marginBottom: "8px" }}>
                  <span style={{ flex: 1, color: "#fcd34d", fontSize: "16px", fontFamily: "monospace" }}>{p}</span>
                  <button onClick={() => removePin(p)} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: "13px", padding: "4px", flexShrink: 0 }}>解除</button>
                </div>
              ))}
            </div>
          )}

          <div id="list">
            {items.length === 0 ? (
              <div className="empty" style={{ textAlign: "center", color: "#52525b", padding: "40px 0" }}>まだ記録はありません</div>
            ) : (
              items.map((h, i) => {
                const bg = h.mark === "○" ? "rgba(239,68,68,.12)" : h.mark === "×" ? "rgba(96,165,250,.12)" : "rgba(252,165,165,.12)";
                const fg = h.mark === "○" ? "#ef4444" : h.mark === "×" ? "#60a5fa" : "#fca5a5";
                return (
                  <div key={i} className="item" style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 14px", borderRadius: "12px", background: "#141416", border: "1px solid #1f1f22", marginBottom: "8px" }}>
                    <span className="mk" style={{ width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "16px", flexShrink: 0, color: fg, background: bg }}>{h.mark}</span>
                    <span className="ans" style={{ flex: 1, fontFamily: "monospace", fontSize: "18px", color: "#f4f4f5" }}>{h.answer}</span>
                    <button 
                      onClick={() => addPin(`【${h.mark}】${h.answer}`)} 
                      style={{ background: "#27272a", color: "#a1a1aa", border: "none", padding: "6px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", flexShrink: 0 }}
                    >
                      ピン留め
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)", background: "#fff", color: "#000", padding: "8px 16px", borderRadius: "20px", opacity: toast ? 1 : 0, transition: "opacity 0.3s", pointerEvents: "none", zIndex: 100 }}>
        {toast}
      </div>
    </div>
  );
};