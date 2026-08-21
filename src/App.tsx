import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Setup } from './Setup';
import { Play } from './Play';
import { History } from './History';

function App() {
  return (
    <BrowserRouter>
      {/* ナビゲーションは削除しました（参加者に見せないため） */}
      <Routes>
        <Route path="/" element={<History />} />
        <Route path="/Qscts66i_jbd" element={<Setup />} />
        <Route path="/Z_W_78BzfcLQ" element={<Play />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;