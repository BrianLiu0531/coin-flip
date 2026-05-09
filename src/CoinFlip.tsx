import { useState, useRef, useCallback, useEffect } from "react";

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Side = "heads" | "tails";
type TabMode = "manual" | "auto";
type WinLossMode = "reset" | "increase";

interface HistoryEntry { result: Side; won: boolean; }
interface CoinCard { id: number; prediction: Side; result: Side | null; revealed: boolean; }
interface Toast { message: string; type: "win" | "lose" | "info" | null; visible: boolean; }

/* ─── Constants ──────────────────────────────────────────────────────────── */
const MULT = 1.9;
const INIT_BAL = 10_000;
const FLIP_MS = 1250;
const HIST_MAX = 30;
const TOSS_OPTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };
const aMul = (n: number) => parseFloat(Math.pow(MULT, n).toFixed(2));
const aChance = (n: number) => parseFloat(((0.5 ** n) * 100).toFixed(4));
const mkCards = (n: number): CoinCard[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, prediction: "heads", result: null, revealed: false }));

/* ─── Coin SVGs ──────────────────────────────────────────────────────────── */
/* Heads — gold/orange */
const CoinHeads = ({ r = 40 }: { r?: number }) => (
  <svg width={r * 2} height={r * 2} viewBox="0 0 80 80" style={{ display: "block" }}>
    <defs>
      <radialGradient id="gh" cx="38%" cy="35%" r="60%">
        <stop offset="0%" stopColor="#fcd96a" />
        <stop offset="55%" stopColor="#f0a830" />
        <stop offset="100%" stopColor="#b87010" />
      </radialGradient>
    </defs>
    <circle cx="40" cy="40" r="38" fill="url(#gh)" stroke="#a06010" strokeWidth="2" />
    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,200,80,.25)" strokeWidth="1" />
    {/* star */}
    <polygon points="40,16 44.5,30 58,30 47,38.5 51,53 40,44.5 29,53 33,38.5 22,30 35.5,30"
      fill="#c07010" opacity="0.55" />
    <polygon points="40,19 44,31 56,31 46.5,39 50,52 40,44 30,52 33.5,39 24,31 36,31"
      fill="#fff0a0" />
  </svg>
);

/* Tails — bright green */
const CoinTails = ({ r = 40 }: { r?: number }) => (
  <svg width={r * 2} height={r * 2} viewBox="0 0 80 80" style={{ display: "block" }}>
    <defs>
      <radialGradient id="gt" cx="38%" cy="35%" r="60%">
        <stop offset="0%" stopColor="#6ee89a" />
        <stop offset="55%" stopColor="#2dc870" />
        <stop offset="100%" stopColor="#149a4c" />
      </radialGradient>
    </defs>
    <circle cx="40" cy="40" r="38" fill="url(#gt)" stroke="#0d7a3a" strokeWidth="2" />
    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(150,255,180,.25)" strokeWidth="1" />
    {/* crown */}
    <text x="40" y="50" textAnchor="middle" fontSize="26" fontWeight="bold"
      fill="rgba(10,80,40,.45)" fontFamily="serif">♛</text>
    <text x="40" y="49" textAnchor="middle" fontSize="26" fontWeight="bold"
      fill="#e8fff0" fontFamily="serif">♛</text>
  </svg>
);

/* ─── CSS ─────────────────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Share+Tech+Mono&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

/* ── Root ── */
.G{
  --bg:#191c2c; --panel:#1d2034; --inp:#111322; --card:#15172a;
  --border:rgba(80,90,160,.22); --acc:#7856f5; --acc2:#5f3ee0;
  --gbtn:#3d9e4a; --gbtn2:#2e7a39;
  --muted:#5e627e; --text:#cdd0e8; --dim:#9297b8;
  --gold:#f0a830; --red:#e05555; --gr:#3dbe6a;
  font-family:'Noto Sans TC',sans-serif; font-size:13px;
  background:var(--bg); color:var(--text);
  display:flex; width:100%; min-height:480px;
  border-radius:10px; overflow:hidden; user-select:none;
}

/* ── Left panel ── */
.L{ width:192px; min-width:192px; background:var(--panel); display:flex; flex-direction:column; border-right:1px solid var(--border); }

/* Tab toggle */
.T-wrap{ margin:10px 10px 0; background:#0e1020; border-radius:7px; padding:3px; display:flex; flex-shrink:0; }
.T-btn{ flex:1; padding:6px 0; border:none; border-radius:5px; background:transparent; color:var(--muted); font-size:13px; font-weight:700; cursor:pointer; transition:all .18s; letter-spacing:.3px; }
.T-btn.on{ background:#ffffff; color:#111322; }

/* Scrollable area */
.L-body{ flex:1; overflow-y:auto; display:flex; flex-direction:column; }
.L-body::-webkit-scrollbar{ width:3px; }
.L-body::-webkit-scrollbar-thumb{ background:var(--border); border-radius:2px; }

/* Section */
.S{ padding:10px 12px; border-bottom:1px solid var(--border); }
.lbl{ font-size:11px; color:var(--muted); margin-bottom:5px; letter-spacing:.3px; }

/* Bet input row */
.bet-row{ display:flex; gap:4px; align-items:stretch; }
.bet-field{ position:relative; flex:1; min-width:0; }
.bet-field input{
  width:100%; background:var(--inp); border:1px solid var(--border);
  border-radius:6px; padding:7px 34px 7px 8px;
  color:var(--text); font-family:'Share Tech Mono',monospace; font-size:12px;
  outline:none; transition:border-color .15s;
}
.bet-field input:focus{ border-color:var(--acc); }
.bet-field input:disabled{ opacity:.4; cursor:not-allowed; }
.bet-eur{
  position:absolute; right:7px; top:50%; transform:translateY(-50%);
  font-size:10px; color:var(--muted); pointer-events:none; font-weight:600;
}
.hx-btn{
  background:var(--inp); border:1px solid var(--border); border-radius:6px;
  color:var(--dim); font-size:11px; font-weight:700; padding:0 7px;
  cursor:pointer; transition:all .15s; white-space:nowrap;
}
.hx-btn:hover:not(:disabled){ border-color:var(--acc); color:var(--text); }
.hx-btn:disabled{ opacity:.35; cursor:not-allowed; }

/* Purple bet button */
.bet-btn{
  width:100%; padding:10px; background:var(--acc); border:none;
  border-radius:7px; color:#fff; font-size:14px; font-weight:700;
  cursor:pointer; letter-spacing:.5px; transition:all .15s;
}
.bet-btn:hover:not(:disabled){ background:var(--acc2); }
.bet-btn:disabled{ opacity:.45; cursor:not-allowed; }

/* Green auto start button */
.go-btn{
  width:100%; padding:10px; background:var(--gbtn); border:none;
  border-radius:7px; color:#fff; font-size:14px; font-weight:700;
  cursor:pointer; letter-spacing:.5px; transition:all .15s;
}
.go-btn:hover:not(:disabled){ background:var(--gbtn2); }
.go-btn.stop{ background:#b52828; }
.go-btn.stop:hover:not(:disabled){ background:#8e1e1e; }
.go-btn:disabled{ opacity:.45; cursor:not-allowed; }

/* Gray outline button */
.gray-btn{
  width:100%; padding:8px; background:transparent;
  border:1px solid var(--border); border-radius:6px;
  color:var(--dim); font-size:12px; font-weight:500; cursor:pointer;
  transition:all .15s; letter-spacing:.2px;
}
.gray-btn:hover:not(:disabled){ border-color:var(--acc); color:var(--text); }
.gray-btn:disabled{ opacity:.35; cursor:not-allowed; }

/* Side select buttons */
.sides{ display:flex; gap:6px; }
.side-btn{
  flex:1; padding:8px 4px; background:var(--inp);
  border:1px solid var(--border); border-radius:7px;
  color:var(--dim); font-size:12px; font-weight:600;
  cursor:pointer; text-align:center; transition:all .15s;
  display:flex; align-items:center; justify-content:center; gap:4px;
}
.side-btn:hover{ border-color:var(--dim); color:var(--text); }
.side-btn.h-on{ border-color:#7856f5; color:#b09aff; background:rgba(120,86,245,.1); }
.side-btn.t-on{ border-color:#2dc870; color:#6ee8a0; background:rgba(45,200,112,.1); }
.side-icon{ font-size:11px; }

/* Profit display (input-style) */
.profit-field{
  display:flex; align-items:center; justify-content:space-between;
  background:var(--inp); border:1px solid var(--border); border-radius:6px;
  padding:7px 8px;
}
.profit-val{ font-family:'Share Tech Mono',monospace; font-size:13px; }
.profit-eur{ font-size:10px; color:var(--muted); font-weight:600; }

/* Cashout button (inside profit box) */
.cash-btn{
  padding:4px 10px; background:linear-gradient(135deg,#f9a825,#e67e00);
  border:none; border-radius:5px; color:#1a1000; font-size:11px;
  font-weight:700; cursor:pointer; transition:all .15s; letter-spacing:.3px;
  animation:cashGlow 1.8s ease-in-out infinite;
}
.cash-btn:hover{ background:linear-gradient(135deg,#ffc107,#f9a825); }
/* Main cashout button (same position as bet button) */
.cash-main-btn{
width:100%; padding:10px; background:var(--acc); border:none;
  border-radius:7px; color:#fff; font-size:14px; font-weight:700;
  cursor:pointer; letter-spacing:.5px; transition:all .15s;
  animation:cashGlow 1.8s ease-in-out infinite;
}
.cash-main-btn:hover{ background:var(--acc2);}

/* Multiplier history badge */
.mul-badge{
  background:var(--card); border:1px solid var(--border);
  border-radius:6px; padding:4px 8px;
  font-family:"Share Tech Mono",monospace; font-size:11px;
  font-weight:600; white-space:nowrap;
}

@keyframes cashGlow{
  0%,100%{ box-shadow:0 0 0 0 rgba(240,160,0,0); }
  50%    { box-shadow:0 0 10px 3px rgba(240,160,0,.4); }
}

/* Dropdown select */
.cf-sel{
  width:100%; background:var(--inp); border:1px solid var(--border);
  border-radius:6px; padding:7px 28px 7px 8px; color:var(--text);
  font-size:13px; outline:none; cursor:pointer; appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%235e627e' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat:no-repeat; background-position:right 8px center;
  transition:border-color .15s;
}
.cf-sel:focus{ border-color:var(--acc); }
.cf-sel:disabled{ opacity:.4; cursor:not-allowed; }

/* Count row */
.cnt-row{ display:flex; gap:4px; align-items:center; }
.cnt-inp{
  flex:1; background:var(--inp); border:1px solid var(--border);
  border-radius:6px; padding:7px 8px; color:var(--text);
  font-family:'Share Tech Mono',monospace; font-size:12px; outline:none;
  transition:border-color .15s; min-width:0;
}
.cnt-inp:focus{ border-color:var(--acc); }
.cnt-inp:disabled{ opacity:.4; cursor:not-allowed; }
.inf-btn{
  background:var(--inp); border:1px solid var(--border);
  border-radius:6px; color:var(--dim); padding:7px 9px;
  font-size:14px; cursor:pointer; transition:all .15s; line-height:1;
}
.inf-btn:hover{ border-color:var(--acc); color:var(--text); }
.inf-btn.on{ border-color:var(--acc); color:#b09aff; background:rgba(120,86,245,.1); }
.inf-btn:disabled{ opacity:.4; cursor:not-allowed; }

/* Win/loss row */
.wl-row{ display:flex; gap:4px; align-items:center; margin-top:5px; }
.wl-btn{
  flex:1; padding:5px 0; background:var(--inp); border:1px solid var(--border);
  border-radius:5px; color:var(--muted); font-size:11px; font-weight:600;
  cursor:pointer; text-align:center; transition:all .15s;
}
.wl-btn:hover:not(:disabled){ border-color:var(--dim); color:var(--text); }
.wl-btn.on{ border-color:var(--acc); color:#b09aff; background:rgba(120,86,245,.1); }
.wl-btn:disabled{ opacity:.4; cursor:not-allowed; }
.pct-inp{
  width:38px; background:var(--inp); border:1px solid var(--border);
  border-radius:5px; padding:5px 4px; color:var(--text);
  font-family:'Share Tech Mono',monospace; font-size:11px; outline:none; text-align:right;
}
.pct-inp:focus{ border-color:var(--acc); }
.pct-inp:disabled{ opacity:.4; cursor:not-allowed; }
.pct-lbl{ font-size:11px; color:var(--muted); flex-shrink:0; }

/* Full-width input */
.full-inp{
  width:100%; background:var(--inp); border:1px solid var(--border);
  border-radius:6px; padding:7px 8px; color:var(--text);
  font-family:'Share Tech Mono',monospace; font-size:12px; outline:none;
  transition:border-color .15s;
}
.full-inp:focus{ border-color:var(--acc); }
.full-inp:disabled{ opacity:.4; cursor:not-allowed; }

/* ── Right panel ── */
.R{ flex:1; display:flex; flex-direction:column; background:var(--bg); min-width:0; position:relative; }

/* Top bar */
.topbar{
  display:flex; align-items:center; justify-content:space-between;
  padding:10px 14px 0;
}
.bal-badge{
  background:var(--card); border:1px solid var(--border);
  border-radius:20px; padding:4px 12px;
  font-family:'Share Tech Mono',monospace; font-size:12px; color:var(--dim);
  display:flex; align-items:center; gap:5px;
}
.bal-badge::before{ content:'◈'; color:var(--gold); font-size:11px; }
.close-btn{
  width:28px; height:28px; background:var(--card); border:1px solid var(--border);
  border-radius:50%; color:var(--dim); font-size:16px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:all .15s; line-height:1;
}
.close-btn:hover{ border-color:var(--muted); color:var(--text); }

/* Stage */
.stage{
  flex:1; display:flex; align-items:center; justify-content:center;
  position:relative; padding:20px; min-height:260px;
}

/* Manual coin */
.coin-wrap{ perspective:700px; }
.coin{
  width:140px; height:140px; position:relative;
  transform-style:preserve-3d;
}
.coin.spin{ animation:cfSpin 1.2s cubic-bezier(.25,.46,.45,.94) forwards; }
@keyframes cfSpin{
  0%  { transform:rotateY(0deg) rotateX(12deg); }
  20% { transform:rotateY(360deg) rotateX(12deg) translateY(-32px); }
  50% { transform:rotateY(900deg) rotateX(12deg) translateY(-55px); }
  80% { transform:rotateY(1260deg) rotateX(12deg) translateY(-20px); }
  100%{ transform:rotateY(var(--fr,1440deg)) rotateX(0deg) translateY(0); }
}
.face{
  position:absolute; width:100%; height:100%;
  border-radius:50%; backface-visibility:hidden;
  display:flex; align-items:center; justify-content:center;
}
.face-h{ /* heads face — coin already has bg */ }
.face-t{ transform:rotateY(180deg); }

/* Auto grid */
.auto-grid{
  display:flex; flex-wrap:wrap; gap:10px;
  justify-content:center; align-items:flex-start; width:100%;
}
.a-card{
  position:relative; width:96px; height:96px;
  background:var(--card); border:1.5px solid var(--border);
  border-radius:10px; display:flex; flex-direction:column;
  align-items:center; justify-content:center; cursor:pointer;
  transition:border-color .18s, background .18s;
}
.a-card:hover{ border-color:var(--muted); }
.a-card.sh{ border-color:#7856f5; background:rgba(120,86,245,.06); }
.a-card.st{ border-color:#2dc870; background:rgba(45,200,112,.06); }
.a-card.ok{ border-color:var(--gr); background:rgba(61,190,106,.08); }
.a-card.no{ border-color:var(--red); background:rgba(224,85,85,.08); }
.a-num{
  position:absolute; top:5px; right:5px;
  width:16px; height:16px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-size:9px; font-weight:700; color:#fff;
}
.a-num-def{ background:rgba(120,120,180,.4); }
.a-num-ok { background:#2dc870; }
.a-num-no { background:#e05555; }
/* Small prediction coin - top-left of card */
.card-pred{
  position:absolute; top:5px; left:5px; z-index:2;
  opacity:.85; filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));
}

/* Stats bar */
.stats-bar{
  background:var(--panel); border-top:1px solid var(--border);
  padding:10px 14px; display:flex; gap:12px; flex-wrap:wrap;
}
.stat-block{ display:flex; flex-direction:column; gap:4px; }
.stat-label{ font-size:10px; color:var(--muted); letter-spacing:.3px; }
.stat-val{
  display:flex; align-items:center; gap:0;
  background:var(--inp); border:1px solid var(--border);
  border-radius:6px; padding:5px 8px;
  font-family:'Share Tech Mono',monospace; font-size:13px; color:var(--text);
}
.stat-unit{ font-size:10px; color:var(--muted); margin-left:6px; font-weight:600; }

/* History */
.hist{
  background:var(--panel); border-top:1px solid var(--border);
  padding:8px 14px; flex-shrink:0;
}
.hist-label{ font-size:10px; color:var(--muted); margin-bottom:6px; letter-spacing:.3px; }
.hist-dots{ display:flex; gap:4px; overflow:hidden; }
.h-dot{
  width:18px; height:18px; border-radius:50%; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  font-size:7px; font-weight:700; color:#fff;
}
.h-dot.heads{ background:#7856f5; }
.h-dot.tails{ background:#2dc870; }
.h-dot.empty{ background:var(--card); border:1px solid var(--border); }

/* Overlays */
.ov-res{
  position:absolute; top:18%; left:50%; transform:translateX(-50%);
  font-size:18px; font-weight:700; letter-spacing:1.5px;
  padding:7px 18px; border-radius:7px; opacity:0; transition:opacity .3s;
  pointer-events:none; white-space:nowrap; z-index:6;
}
.ov-res.show{ opacity:1; }
.ov-res.win { color:var(--gr);  border:1.5px solid var(--gr);  background:rgba(61,190,106,.1); }
.ov-res.lose{ color:var(--red); border:1.5px solid var(--red); background:rgba(224,85,85,.1); }
.ov-toast{
  position:absolute; top:12px; right:44px; padding:6px 12px;
  border-radius:6px; font-size:12px; font-weight:600; opacity:0;
  transform:translateY(-6px); transition:all .28s; pointer-events:none; z-index:10;
}
.ov-toast.show{ opacity:1; transform:translateY(0); }
.ov-toast.win { background:rgba(61,190,106,.15); border:1px solid var(--gr);  color:var(--gr); }
.ov-toast.lose{ background:rgba(224,85,85,.15);  border:1px solid var(--red); color:var(--red); }
.ov-toast.info{ background:rgba(240,160,0,.15);  border:1px solid var(--gold); color:var(--gold); }

.pulse{ animation:cfPulse 1.5s ease-in-out infinite; }
@keyframes cfPulse{ 0%,100%{opacity:1} 50%{opacity:.5} }

/* Portrait */
@media(max-width:540px){
  .G{ flex-direction:column; border-radius:0; min-height:unset; }
  .L{ width:100%!important; min-width:unset!important; border-right:none!important; border-bottom:1px solid var(--border); }
  .coin{ width:110px!important; height:110px!important; }
  .stage{ min-height:200px!important; }
  .a-card{ width:78px!important; height:78px!important; }
  .auto-grid{ gap:8px!important; }
}
`;

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function CoinFlip() {
  /* shared */
  const [tab, setTab] = useState<TabMode>("manual");
  const [balance, setBalance] = useState(INIT_BAL);
  const [pending, setPending] = useState(0);   // winnings held for cashout
  const [sessNet, setSessNet] = useState(0);   // net display
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [mulHist, setMulHist] = useState<number[]>([]);  // recent round multipliers
  const [toast, setToast] = useState<Toast>({ message: "", type: null, visible: false });
  const [resOv, setResOv] = useState<{ text: string; type: "win" | "lose" | null; visible: boolean }>({ text: "", type: null, visible: false });

  /* manual */
  const [bet, setBet] = useState("2.00");
  const [side, setSide] = useState<Side>("heads");
  const [flipping, setFlipping] = useState(false);
  const [flipAnim, setFlipAnim] = useState(false);
  const [fr, setFr] = useState(0);
  const [coinRot, setCoinRot] = useState(0);

  /* auto */
  const [aBet, setABet] = useState("2.00");
  const [toss, setToss] = useState(5);
  const [betCnt, setBetCnt] = useState("0");
  const [inf, setInf] = useState(true);
  const [wMode, setWMode] = useState<WinLossMode>("reset");
  const [wPct, setWPct] = useState("0");
  const [lMode, setLMode] = useState<WinLossMode>("reset");
  const [lPct, setLPct] = useState("0");
  const [stopP, setStopP] = useState("0.00");
  const [stopL, setStopL] = useState("0.00");
  const [cards, setCards] = useState<CoinCard[]>(() => mkCards(5));
  const [running, setRunning] = useState(false);
  const [roundP, setRoundP] = useState(0);
  const [revealing, setRevealing] = useState(false);

  const toastTmr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resTmr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTmr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runRef = useRef(false);
  const balRef = useRef(INIT_BAL);

  useEffect(() => { balRef.current = balance; }, [balance]);
  useEffect(() => { setCards(mkCards(toss)); }, [toss]);

  /* ── helpers ── */
  const fireToast = useCallback((message: string, type: "win" | "lose" | "info") => {
    if (toastTmr.current) clearTimeout(toastTmr.current);
    setToast({ message, type, visible: true });
    toastTmr.current = setTimeout(() => setToast(p => ({ ...p, visible: false })), 2400);
  }, []);

  const fireRes = useCallback((text: string, type: "win" | "lose") => {
    if (resTmr.current) clearTimeout(resTmr.current);
    setResOv({ text, type, visible: true });
    resTmr.current = setTimeout(() => setResOv(p => ({ ...p, visible: false })), 2400);
  }, []);

  const pushHist = useCallback((result: Side, won: boolean) => {
    setHistory(p => [{ result, won }, ...p].slice(0, HIST_MAX));
  }, []);

  /* ── cashout ── */
  const cashOut = () => {
    if (pending <= 0) return;
    setBalance(v => v + pending);
    fireToast(`💰 提現 ${pending.toFixed(2)} EUR 成功！`, "info");
    setPending(0);
  };

  /* ── manual flip ── */
  const doFlip = useCallback((forceSide?: Side) => {
    if (flipping) return;
    const b = num(bet);
    if (b <= 0 || b > balRef.current) { fireToast(b > balRef.current ? "餘額不足！" : "無效金額", "lose"); return; }
    const chosen: Side = forceSide ?? side;
    setSide(chosen);
    setFlipping(true);
    const result: Side = Math.random() < .5 ? "heads" : "tails";
    const won = result === chosen;
    const rot = result === "heads" ? 1440 : 1620;
    setFr(rot); setFlipAnim(true);
    setBalance(v => v - b);
    setTimeout(() => {
      setCoinRot(result === "heads" ? 0 : 180);
      setFlipAnim(false);
      const gain = won ? b * (MULT - 1) : -b;
      if (won) {
        setPending(p => p + b * MULT);
        setSessNet(p => p + gain);
        fireRes(`勝利！ ＋${gain.toFixed(2)}`, "win");
        fireToast(`🎉 贏了 ${gain.toFixed(2)} EUR`, "win");
      } else {
        setSessNet(p => p + gain);
        fireRes(`輸了 −${b.toFixed(2)}`, "lose");
        fireToast(`💀 輸了 ${b.toFixed(2)} EUR`, "lose");
      }
      pushHist(result, won);
      setMulHist(p => [won ? MULT : 0, ...p].slice(0, 5));
      setFlipping(false);
    }, FLIP_MS);
  }, [flipping, bet, side, fireToast, fireRes, pushHist]);

  const randomBet = () => { const s: Side = Math.random() < .5 ? "heads" : "tails"; doFlip(s); };

  /* ── auto ── */
  const stopAuto = useCallback(() => {
    runRef.current = false; setRunning(false); setRevealing(false);
    if (autoTmr.current) clearTimeout(autoTmr.current);
  }, []);

  const runRound = useCallback((
    cb: number, rem: number, sP: number,
    sp: number, sl: number,
    wm: WinLossMode, wp: number,
    lm: WinLossMode, lp: number,
    preds: Side[], base: number,
  ) => {
    if (!runRef.current) return;
    const bal = balRef.current;
    if (sp > 0 && sP >= sp) { stopAuto(); return; }
    if (sl > 0 && sP <= -sl) { stopAuto(); return; }
    if (!inf && rem <= 0) { stopAuto(); return; }
    const b = Math.min(cb, bal);
    if (b <= 0) { stopAuto(); return; }
    setBalance(v => v - b); setRevealing(true);
    const results: Side[] = preds.map(() => Math.random() < .5 ? "heads" : "tails");
    const allOk = results.every((r, i) => r === preds[i]);
    let delay = 0;
    results.forEach((res, i) => {
      delay += 270;
      const d = delay;
      autoTmr.current = setTimeout(() => setCards(prev => prev.map(c => c.id === i + 1 ? { ...c, result: res, revealed: true } : c)), d);
    });
    autoTmr.current = setTimeout(() => {
      const payout = allOk ? b * aMul(preds.length) : 0;
      const gain = payout - b;
      if (allOk) { setPending(p => p + payout); fireToast(`🎉 全中！ ＋${gain.toFixed(2)}`, "win"); }
      else fireToast(`💀 輸了 ${b.toFixed(2)} EUR`, "lose");
      const nP = sP + gain;
      setRoundP(nP); setSessNet(p => p + gain);
      pushHist(allOk ? "heads" : "tails", allOk);
      let nb = allOk ? (wm === "reset" ? base : cb * (1 + wp / 100)) : (lm === "reset" ? base : cb * (1 + lp / 100));
      const nRem = inf ? rem : rem - 1;
      setRevealing(false);
      if (!runRef.current) return;
      setTimeout(() => {
        setCards(prev => prev.map(c => ({ ...c, result: null, revealed: false })));
        autoTmr.current = setTimeout(() => {
          if (!runRef.current) return;
          runRound(nb, nRem, nP, sp, sl, wm, wp, lm, lp, preds, base);
        }, 400);
      }, 700);
    }, delay + 400);
  }, [fireToast, pushHist, stopAuto, inf]);

  const startAuto = () => {
    if (running) { stopAuto(); return; }
    const b = num(aBet);
    if (b <= 0 || b > balance) { fireToast(b > balance ? "餘額不足！" : "無效金額", "lose"); return; }
    const preds = cards.map(c => c.prediction);
    const sp = parseFloat(stopP) || 0, sl = parseFloat(stopL) || 0;
    const wp = parseFloat(wPct) || 0, lp = parseFloat(lPct) || 0;
    const cnt = inf ? Infinity : num(betCnt);
    runRef.current = true; setRunning(true); setRoundP(0);
    setCards(prev => prev.map(c => ({ ...c, result: null, revealed: false })));
    runRound(b, cnt as number, 0, sp, sl, wMode, wp, lMode, lp, preds, b);
  };

  /* ── derived ── */
  const mul = aMul(toss);
  const chance = aChance(toss);
  const potWin = (num(aBet) * mul - num(aBet)).toFixed(2);
  const hdots = Array.from({ length: HIST_MAX }, (_, i) => history[i] || null);

  const cardCls = (c: CoinCard) => {
    if (c.revealed) return "a-card " + (c.result === c.prediction ? "ok" : "no");
    return "a-card " + (c.prediction === "heads" ? "sh" : "st");
  };

  /* ── render ── */
  return (
    <>
      <style>{CSS}</style>
      <div className="G">

        {/* ══ LEFT ══ */}
        <div className="L">
          {/* Tab toggle */}
          <div className="T-wrap">
            <button className={`T-btn ${tab === "manual" ? "on" : ""}`}
              onClick={() => !running && setTab("manual")}>手動</button>
            <button className={`T-btn ${tab === "auto" ? "on" : ""}`}
              onClick={() => !flipping && setTab("auto")}>自動</button>
          </div>

          <div className="L-body">

            {/* ── MANUAL ── */}
            {tab === "manual" && (<>
              <div className="S">
                <div className="lbl">下注金額</div>
                <div className="bet-row">
                  <div className="bet-field">
                    <input type="number" min="0.01" step="0.01" value={bet}
                      disabled={flipping} onChange={e => setBet(e.target.value)} />
                    <span className="bet-eur">EUR</span>
                  </div>
                  <button className="hx-btn" disabled={flipping}
                    onClick={() => setBet(v => Math.max(0.01, num(v) / 2).toFixed(2))}>½</button>
                  <button className="hx-btn" disabled={flipping}
                    onClick={() => setBet(v => (num(v) * 2).toFixed(2))}>2x</button>
                </div>
              </div>

              <div className="S">
                {pending > 0 ? (
                  <button className="cash-main-btn" onClick={cashOut}>提現</button>
                ) : (
                  <button className="bet-btn" disabled={flipping} onClick={() => doFlip()}>下注</button>
                )}
              </div>

              <div className="S">
                <button className="gray-btn" disabled={flipping} onClick={randomBet}>
                  隨機選擇一面
                </button>
              </div>

              <div className="S">
                <div className="sides">
                  <button className={`side-btn ${side === "heads" ? "h-on" : ""}`}
                    onClick={() => setSide("heads")}>
                    <span className="side-icon" style={{ color: "#f0c040" }}>★</span> 正面
                  </button>
                  <button className={`side-btn ${side === "tails" ? "t-on" : ""}`}
                    onClick={() => setSide("tails")}>
                    <span className="side-icon" style={{ color: "#3dbe6a" }}>♛</span> 反面
                  </button>
                </div>
              </div>

              <div className="S">
                <div className="lbl">總利潤 (1.00×)</div>
                <div className="profit-field">
                  <span className="profit-val"
                    style={{ color: pending > 0 ? "var(--gr)" : sessNet < 0 ? "var(--red)" : "var(--text)" }}>
                    {pending > 0 ? pending.toFixed(2) : "0.00"}
                  </span>
                  <span className="profit-eur">EUR</span>
                </div>
              </div>
            </>)}

            {/* ── AUTO ── */}
            {tab === "auto" && (<>
              <div className="S">
                <div className="lbl">下注金額</div>
                <div className="bet-row">
                  <div className="bet-field">
                    <input type="number" min="0.01" step="0.01" value={aBet}
                      disabled={running} onChange={e => setABet(e.target.value)} />
                    <span className="bet-eur">EUR</span>
                  </div>
                  <button className="hx-btn" disabled={running}
                    onClick={() => setABet(v => Math.max(0.01, num(v) / 2).toFixed(2))}>½</button>
                  <button className="hx-btn" disabled={running}
                    onClick={() => setABet(v => (num(v) * 2).toFixed(2))}>2x</button>
                </div>
              </div>

              <div className="S">
                <div className="lbl">投擲</div>
                <select className="cf-sel" value={toss} disabled={running}
                  onChange={e => setToss(Number(e.target.value))}>
                  {TOSS_OPTS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="S">
                <div className="lbl">下注次數</div>
                <div className="cnt-row">
                  <input className="cnt-inp" type="number" min="1" value={betCnt}
                    disabled={running || inf} style={{ opacity: inf ? .4 : 1 }}
                    onChange={e => setBetCnt(e.target.value)} />
                  <button className={`inf-btn ${inf ? "on" : ""}`} disabled={running}
                    onClick={() => setInf(p => !p)}>∞</button>
                </div>
              </div>

              <div className="S">
                <div className="lbl">贏得時</div>
                <div className="wl-row">
                  <button className={`wl-btn ${wMode === "reset" ? "on" : ""}`}
                    disabled={running} onClick={() => setWMode("reset")}>重置</button>
                  <button className={`wl-btn ${wMode === "increase" ? "on" : ""}`}
                    disabled={running} onClick={() => setWMode("increase")}>增加</button>
                  <input className="pct-inp" type="number" min="0" value={wPct}
                    disabled={running || wMode === "reset"} style={{ opacity: wMode === "reset" ? .4 : 1 }}
                    onChange={e => setWPct(e.target.value)} />
                  <span className="pct-lbl">%</span>
                </div>
              </div>

              <div className="S">
                <div className="lbl">輸掉時</div>
                <div className="wl-row">
                  <button className={`wl-btn ${lMode === "reset" ? "on" : ""}`}
                    disabled={running} onClick={() => setLMode("reset")}>重置</button>
                  <button className={`wl-btn ${lMode === "increase" ? "on" : ""}`}
                    disabled={running} onClick={() => setLMode("increase")}>增加</button>
                  <input className="pct-inp" type="number" min="0" value={lPct}
                    disabled={running || lMode === "reset"} style={{ opacity: lMode === "reset" ? .4 : 1 }}
                    onChange={e => setLPct(e.target.value)} />
                  <span className="pct-lbl">%</span>
                </div>
              </div>

              <div className="S">
                <div className="lbl">在利潤時停止</div>
                <input className="full-inp" type="number" min="0" step="0.01"
                  value={stopP} disabled={running} onChange={e => setStopP(e.target.value)} />
              </div>

              <div className="S">
                <div className="lbl">在損失時停止</div>
                <input className="full-inp" type="number" min="0" step="0.01"
                  value={stopL} disabled={running} onChange={e => setStopL(e.target.value)} />
              </div>

              <div className="S">
                <button className="gray-btn" disabled={running}
                  onClick={() => setCards(p => p.map(c => ({
                    ...c,
                    prediction: Math.random() < .5 ? "heads" : "tails", result: null, revealed: false
                  })))}>
                  隨機選擇
                </button>
              </div>

              <div className="S">
                <button className={`go-btn ${running ? "stop" : ""}`} onClick={startAuto}>
                  {running ? <>停止自動下注 <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#fff", verticalAlign: "middle", marginLeft: 2 }} /></> : "開始自動下注"}
                </button>
              </div>

              {pending > 0 && (
                <div className="S">
                  <div className="lbl">可提現利潤</div>
                  <div className="profit-field">
                    <span className="profit-val" style={{ color: "var(--gr)" }}>
                      {pending.toFixed(2)}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="profit-eur">EUR</span>
                      <button className="cash-btn" onClick={cashOut}>提現</button>
                    </div>
                  </div>
                </div>
              )}
            </>)}
          </div>
        </div>

        {/* ══ RIGHT ══ */}
        <div className="R">
          <div className="topbar">
            <div className="bal-badge">{balance.toFixed(2)} EUR</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {mulHist.map((m, i) => (
                <div key={i} className="mul-badge" style={{ color: m > 0 ? "var(--gr)" : "var(--dim)" }}>
                  {m > 0 ? m.toFixed(2) : "0.00"}×
                </div>
              ))}
              <button className="close-btn">✕</button>
            </div>
          </div>

          <div className="stage">
            <div className={`ov-res ${resOv.visible ? "show" : ""} ${resOv.type ?? ""}`}>{resOv.text}</div>
            <div className={`ov-toast ${toast.visible ? "show" : ""} ${toast.type ?? ""}`}>{toast.message}</div>

            {/* Manual coin */}
            {tab === "manual" && (
              <div className="coin-wrap">
                <div
                  className={`coin${flipAnim ? " spin" : ""}`}
                  style={{
                    "--fr": `${fr}deg`,
                    transform: flipAnim ? undefined : `rotateY(${coinRot}deg)`
                  } as React.CSSProperties}
                >
                  <div className="face face-h"><CoinHeads r={70} /></div>
                  <div className="face face-t"><CoinTails r={70} /></div>
                </div>
              </div>
            )}

            {/* Auto grid */}
            {tab === "auto" && (
              <div className="auto-grid">
                {cards.map(c => (
                  <div key={c.id} className={cardCls(c)}
                    onClick={() => {
                      if (running || revealing) return;
                      setCards(p => p.map(x => x.id === c.id
                        ? { ...x, prediction: x.prediction === "heads" ? "tails" : "heads", result: null, revealed: false } : x));
                    }}>
                    {/* Number badge - top right */}
                    <span className={`a-num ${c.revealed ? (c.result === c.prediction ? "a-num-ok" : "a-num-no") : "a-num-def"}`}>{c.id}</span>
                    {/* Prediction coin - top left (only when revealed) */}
                    {c.revealed && (
                      <div className="card-pred">
                        {c.prediction === "heads" ? <CoinHeads r={15} /> : <CoinTails r={15} />}
                      </div>
                    )}
                    {/* Main result/prediction coin - center */}
                    {(c.revealed && c.result)
                      ? (c.result === "heads" ? <CoinHeads r={34} /> : <CoinTails r={34} />)
                      : (c.prediction === "heads" ? <CoinHeads r={34} /> : <CoinTails r={34} />)
                    }
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats bar (auto only) */}
          {tab === "auto" && (
            <div className="stats-bar">
              <div className="stat-block">
                <span className="stat-label">贏得利潤 ({mul}×)</span>
                <div className="stat-val">
                  <span className={running ? "pulse" : ""}>{potWin}</span>
                  <span className="stat-unit">EUR</span>
                </div>
              </div>
              <div className="stat-block">
                <span className="stat-label">機會</span>
                <div className="stat-val">
                  <span>{chance}</span>
                  <span className="stat-unit">%</span>
                </div>
              </div>
              {running && (
                <div className="stat-block">
                  <span className="stat-label">本輪利潤</span>
                  <div className="stat-val" style={{ color: roundP >= 0 ? "var(--gr)" : "var(--red)" }}>
                    <span>{roundP >= 0 ? "+" : ""}{roundP.toFixed(2)}</span>
                    <span className="stat-unit">EUR</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History */}
          <div className="hist">
            <div className="hist-label">歷史記錄</div>
            <div className="hist-dots">
              {hdots.map((e, i) => (
                <div key={i} className={`h-dot ${e ? e.result : "empty"}`}>
                  {e ? (e.result === "heads" ? "H" : "T") : ""}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}