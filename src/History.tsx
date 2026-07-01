import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { HistoryEntry } from './types';

export const History: React.FC = () => {
  const [cum, setCum] = useState(0);
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [pins, setPins] = useState<string[]>([]);

  useEffect(() => {
    // 1. 初回データロード
    const loadData = async () => {
      const { data: statusData } = await supabase.from('status').select('cumulative, pins').eq('id', 1);
      if (statusData && statusData.length > 0) {
        setCum(statusData[0].cumulative || 0);
        setPins(statusData[0].pins || []);
      }

      const { data: historyData } = await supabase.from('history').select('*').order('ts', { ascending: false }).limit(50);
      if (historyData) setItems(historyData as HistoryEntry[]);
    };
    loadData();

    // 2. リアルタイム購読（チャンネル名を変更し、より堅牢に）
    const channel = supabase
      .channel('history-page-channel') // チャンネル名をユニークに変更
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'status', filter: 'id=eq.1' }, (payload) => {
        const newData = payload.new as { cumulative: number; pins: string[] };
        setCum(newData.cumulative);
        setPins(newData.pins || []);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'history' }, (payload) => {
        // 履歴が追加されたら即座に配列に追加
        setItems((prev) => [payload.new as HistoryEntry, ...prev]);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log("Realtime 接続成功！");
        if (status === 'CHANNEL_ERROR') console.error("Realtime 接続エラー");
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  const progressWidth = Math.min(100, (cum / 15) * 100);

  return (
    <div>
      <div className="top" style={{ position: "sticky", top: 0, zIndex: 2, background: "rgba(10,10,11,.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid #27272a", padding: "18px 20px" }}>
        <div className="wrap" style={{ maxWidth: "560px", margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: "20px" }}>挑戦の記録</h1>
          <div className="progress" style={{ marginTop: "14px" }}>
            <div className="pbar" style={{ height: "10px", borderRadius: "999px", background: "#27272a", overflow: "hidden" }}>
              <div className="pfill" style={{ height: "100%", background: "linear-gradient(90deg,#ef4444,#f59e0b)", transition: "width .5s", width: `${progressWidth}%` }}></div>
            </div>
            <div className="pnum" style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginTop: "6px", color: "#a1a1aa" }}>
              <span><b style={{ color: cum >= 15 ? "#34d399" : "#f4f4f5", fontFamily: "monospace", fontSize: "16px" }}>{cum}</b> / 15</span>
            </div>
          </div>
        </div>
      </div>
      
      <main style={{ padding: "16px 20px 60px" }}>
        <div className="wrap" style={{ maxWidth: "560px", margin: "0 auto" }}>
          
          {pins.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "12px", color: "#f59e0b", marginBottom: "10px", fontWeight: "bold" }}>重要情報</div>
              {pins.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(245,158,11,.15)", border: "1px solid rgba(245,158,11,.3)", padding: "14px 16px", borderRadius: "12px", marginBottom: "10px" }}>
                  <span style={{ color: "#fcd34d", fontSize: "18px", fontFamily: "monospace", lineHeight: "1.4" }}>{p}</span>
                </div>
              ))}
            </div>
          )}

          <div id="list">
            {items.length === 0 ? (
              <div className="empty" style={{ textAlign: "center", color: "#52525b", padding: "60px 0" }}>まだ記録はありません</div>
            ) : (
              items.map((h, i) => {
                const bg = h.mark === "○" ? "rgba(239,68,68,.12)" : h.mark === "×" ? "rgba(96,165,250,.12)" : "rgba(252,165,165,.12)";
                const fg = h.mark === "○" ? "#ef4444" : h.mark === "×" ? "#60a5fa" : "#fca5a5";
                return (
                  <div key={i} className="item" style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 14px", borderRadius: "12px", background: "#141416", border: "1px solid #1f1f22", marginBottom: "8px" }}>
                    <span className="mk" style={{ width: "30px", height: "30px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "16px", flexShrink: 0, color: fg, background: bg }}>{h.mark}</span>
                    <span className="ans" style={{ flex: 1, fontFamily: "monospace", fontSize: "17px" }}>{h.answer}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
};