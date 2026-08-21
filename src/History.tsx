import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { HistoryEntry, Config } from './types';
import { ANSWERS } from './types';

const CONFIG_MESSAGES: Record<string, string> = {
  "person:1": "ここに person:1 の文章",
  "person:2": "ここに person:2 の文章",
  "person:3": "ここに person:3 の文章",

  "tablet:1": "ここに tablet:1 の文章",

  "desk:1": "ここに desk:1 の文章",

  "chair:2": "ここに chair:2 の文章",
  "chair:4": "ここに chair:4 の文章",

  "switch:1": "ここに switch:1 の文章",

  "partition:3": "ここに partition:3 の文章",
  "partition:4": "ここに partition:4 の文章",

  "stop:8": "ここに stop:8 の文章",

  "rubik:0": "ここに rubik:0 の文章",
  "rubik:1": "ここに rubik:1 の文章",

  "arubeki:0": "ここに arubeki:0 の文章",
  "arubeki:1": "ここに arubeki:1 の文章",
};

export const History: React.FC = () => {
  const [cum, setCum] = useState(0);
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [pins, setPins] = useState<string[]>([]);

  // 追加
  const [config, setConfig] = useState<Config>({
    person: 2,
    tablet: 1,
    desk: 1,
    chair: 2,
    switch: 1,
    partition: 4,
    stop: 8,
    rubik: 1,
    arubeki: 0,
  });

  const [achieved, setAchieved] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'history' | 'message'>('history');

  useEffect(() => {
    // 1. 初回データロード
    const loadData = async () => {
      const { data: statusData } =
        await supabase
          .from('status')
          .select('cumulative, pins, achieved')
          .eq('id', 1);

      if (statusData && statusData.length > 0) {
        setCum(statusData[0].cumulative || 0);
        setPins(statusData[0].pins || []);
        setAchieved(statusData[0].achieved || []);
      }

      const { data: historyData } = await supabase.from('history').select('*').order('ts', { ascending: false }).limit(50);
      if (historyData) setItems(historyData as HistoryEntry[]);

      const { data: settingsData } =
        await supabase
          .from('settings')
          .select('config')
          .eq('id', 1)
          .single();

      if (settingsData?.config) {
        setConfig(settingsData.config as Config);
      }

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

  const CONFIG_KEYS = [
    "person",
    "tablet",
    "desk",
    "chair",
    "switch",
    "partition",
    "stop",
    "rubik",
    "arubeki",
  ] as const;

  const CONFIG_ANSWER_KEYS: Record<string, string> = {
    switch: "switchg",
    stop: "stopmark",
  };

  const getConfigAnswer = (key: typeof CONFIG_KEYS[number]) => {
    const answerKey = CONFIG_ANSWER_KEYS[key] || key;
    const value = config[key];

    return ANSWERS[answerKey]?.[value]?.[0] || null;
  };

  const getConfigStatus = (
    key: typeof CONFIG_KEYS[number]
  ) => {
    const answer = getConfigAnswer(key);

    if (!answer) {
      return {
        answer: null,
        cleared: false,
        message: null,
      };
    }

    const cleared = achieved.includes(answer);

    return {
      answer,
      cleared,
      message: cleared
        ? CONFIG_MESSAGES[`${key}:${config[key]}`]
        : null,
    };
  };

  return (
    <div>
      <div className="top" style={{ position: "sticky", top: 0, zIndex: 2, background: "rgba(10,10,11,.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid #27272a", padding: "18px 20px" }}>
        <div className="wrap" style={{ maxWidth: "560px", margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: "20px" }}>挑戦の記録</h1>
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "16px",
            }}
          >
          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background:
                activeTab === 'history' ? "#00ffff" : "#27272a",
              color:
                activeTab === 'history' ? "#000" : "#a1a1aa",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            履歴
          </button>

          <button
            onClick={() => setActiveTab('message')}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background:
                activeTab === 'message' ? "#00ffff" : "#27272a",
              color:
                activeTab === 'message' ? "#000" : "#a1a1aa",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            達成メッセージ
          </button>
        </div>
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
          
          {activeTab === 'history' && (
            <>
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
            </>
          )}

          {activeTab === 'message' && (
            <div>
              <h2 style={{ fontSize: "16px", marginBottom: "16px" }}>
                現在の設定
              </h2>

              {CONFIG_KEYS.map((key) => {
                const status = getConfigStatus(key);

                // 正解していないものは何も表示しない
                if (!status.cleared) {
                  return null;
                }

                return (
                  <div
                    key={key}
                    style={{
                      background: "#141416",
                      border: "1px solid #27272a",
                      borderRadius: "12px",
                      padding: "16px",
                      marginBottom: "12px",
                    }}
                  >

                    <div
                      style={{
                        fontSize: "17px",
                        lineHeight: 1.7,
                      }}
                    >
                      {status.message}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          
        </div>
      </main>
    </div>
  );
};