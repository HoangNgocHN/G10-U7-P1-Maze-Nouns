// ═══════════════════════════════════════════════════════════════════════
//  ██████  DATA ZONE — EDIT HERE EASILY  ██████
// ═══════════════════════════════════════════════════════════════════════

const VOCAB = [
  { word:"office",       phonetic:"/ˈɒfɪs/",           vi:"văn phòng",  emoji:"🏢",
    scenario:"People work in a building. They sit at desks and use computers.",
    meaning:"A room or building where people do their work." },
  { word:"project",      phonetic:"/ˈprɒdʒekt/",        vi:"dự án",      emoji:"🎬",
    scenario:"Your English teacher says: 'Make a video about your school.' You plan, film, edit, then show it in class.",
    meaning:"A planned task with a specific goal." },
  { word:"field",        phonetic:"/fiːld/",            vi:"lĩnh vực",   emoji:"🔬",
    scenario:"Doctor. Teacher. IT Engineer. These are all different areas of work.",
    meaning:"An area of study or type of work / profession." },
  { word:"support",      phonetic:"/səˈpɔːt/",          vi:"sự hỗ trợ",  emoji:"🤝",
    scenario:"You fail a test 😓. Your friend helps you study again.",
    meaning:"Help given to someone who needs it." },
  { word:"opportunity",  phonetic:"/ˌɒpəˈtjuːnəti/",   vi:"cơ hội",     emoji:"🚀",
    scenario:"Your friend studies hard and gets a scholarship. He has more chances to succeed.",
    meaning:"A chance to do or achieve something." },
  { word:"programme",    phonetic:"/ˈprəʊɡræm/",        vi:"chương trình",emoji:"📋",
    scenario:"Your fitness coach gives you a plan: Monday — legs, Tuesday — arms, Wednesday — rest.",
    meaning:"A plan with many parts to help you learn or do something." },
  { word:"aim",          phonetic:"/eɪm/",              vi:"mục tiêu",   emoji:"🎯",
    scenario:"Your friend says: 'I want IELTS 7.0 this year.' That is what he wants to achieve.",
    meaning:"A goal or target someone wants to get." },
  { word:"education",    phonetic:"/ˌedʒuˈkeɪʃn/",     vi:"giáo dục",   emoji:"📚",
    scenario:"You go to school every day. You learn English, Maths, and Science over many years.",
    meaning:"The process of learning and gaining knowledge at school." },
  { word:"job training", phonetic:"/dʒɒb ˈtreɪnɪŋ/",  vi:"đào tạo nghề",emoji:"🔧",
    scenario:"A company teaches new workers how to use machines and follow safety rules.",
    meaning:"Learning the skills needed for a specific job." },
  { word:"workforce",    phonetic:"/ˈwɜːkfɔːs/",       vi:"lực lượng lao động",emoji:"👷",
    scenario:"The government reports: '54 million people are employed in Vietnam.'",
    meaning:"All the people available to work in a country or company." },
  { word:"attitude",     phonetic:"/ˈætɪtjuːd/",       vi:"thái độ",    emoji:"😤",
    scenario:"One student always says 'I can't do this.' Another says 'Let me try!' Both have different ways of thinking.",
    meaning:"The way you think or feel about something." },
];

const CONFIG = {
  questionsPerRound: VOCAB.length,   // auto = số từ
  timerSeconds:      28,             // seconds per question
  pointsCorrect:     100,
  pointsTimeBonus:   4,              // per second remaining
  pointsComboBonus:  20,
  maxCombo:          5,
  hpMax:             5,
  // ── Maze parameters ───────────────────────────────────────────────
  COLS: 9,    // rooms wide
  ROWS: 7,    // rooms tall
  TILE: 24,   // pixels per grid tile (grid = 2*COLS+1 × 2*ROWS+1)
  MOVE_SPEED: 4,  // pixels per animation frame
};

// Background music (same file as vocab-raid if placed in same parent folder)
const MUSIC = { file: '../G10-U7-P1-VocabRaid-Nouns/music.mp3', volume: 0.3 };

// ═══════════════════════════════════════════════════════════════════════
//  DERIVED MAZE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════
const { COLS, ROWS, TILE } = CONFIG;
const GW  = 2 * COLS + 1;    // grid width  = 19
const GH  = 2 * ROWS + 1;    // grid height = 15
const GCX = 2 * Math.floor(COLS / 2) + 1;  // centre grid col = 9
const GCY = 2 * Math.floor(ROWS / 2) + 1;  // centre grid row = 7

// Fixed portal grid positions (edge tiles carved into boundary)
const PORTAL_GX = { up: GCX, down: GCX, left: 0,    right: GW - 1 };
const PORTAL_GY = { up: 0,   down: GH - 1, left: GCY, right: GCY  };

// Portal visual colours (same palette as Word Dodge for familiarity)
const PORTAL_COLOR = { up:'#00f5d4', down:'#a78bfa', left:'#fbbf24', right:'#f472b6' };
const PORTAL_RGB   = { up:'0,245,212', down:'167,139,250', left:'251,191,36', right:'244,114,182' };

// ═══════════════════════════════════════════════════════════════════════
//  MUSIC ENGINE
// ═══════════════════════════════════════════════════════════════════════
const MusicEngine = (() => {
  let audio = null, playing = false;
  function init() {
    if (audio || !MUSIC.file) return;
    audio = new Audio(MUSIC.file);
    audio.loop = true; audio.volume = MUSIC.volume;
    audio.addEventListener('error', () => { audio = null; });
  }
  function play()  { init(); if (!audio) return; audio.play().catch(()=>{}); playing = true; }
  function pause() { if (audio) audio.pause(); playing = false; }
  function toggle(){ playing ? pause() : play(); return playing; }
  function setVolume(v){ if (audio) audio.volume = v; }
  return { play, pause, toggle, setVolume, get isPlaying(){ return playing; } };
})();

// ═══════════════════════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════════════════════
let state = {
  player: '', questions: [], qi: 0,
  score: 0, combo: 1, bestCombo: 1, hp: CONFIG.hpMax,
  answered: false, log: [], sessionStart: null,
  timerLeft: 0,
};

let grid    = null;   // 2-D boolean array: true = wall
let player  = {};     // { gx, gy, px, py, tx, ty, trail[] }
let currentPortals = {};   // { up:{gx,gy,text,color}, … }
let keysHeld   = {};
let rafId      = null;
let timerInterval = null;
let gameRunning   = false;

const canvas = document.getElementById('mazeCanvas');
const ctx    = canvas.getContext('2d');

// ── Size the canvas ────────────────────────────────────────────────────
canvas.width  = GW * TILE;   // 456
canvas.height = GH * TILE;   // 360

// ═══════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════
(function init() {
  // Word index pills
  const idx = document.getElementById('wordIndex');
  VOCAB.forEach(v => {
    const pill = document.createElement('div');
    pill.className = 'wi-pill';
    pill.textContent = v.emoji + ' ' + v.word;
    pill.addEventListener('click', () => openModal(v));
    idx.appendChild(pill);
  });

  // Modal backdrop click
  document.getElementById('wordModal').addEventListener('click', function(e){
    if (e.target === this) closeModal();
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
      e.preventDefault();
      keysHeld[e.key] = true;
    }
    if (e.key === 'Escape' && gameRunning) endGame(false);
  });
  document.addEventListener('keyup', e => { keysHeld[e.key] = false; });
})();

// ═══════════════════════════════════════════════════════════════════════
//  MAZE GENERATOR  (Recursive-backtracker / DFS)
// ═══════════════════════════════════════════════════════════════════════
function generateMaze() {
  // Full grid: true = wall, false = open floor
  const g = Array.from({ length: GH }, () => new Array(GW).fill(true));

  // Carve room cells at odd (col,row) positions
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      g[2 * r + 1][2 * c + 1] = false;

  // DFS from centre room
  const vis = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
  const cx0 = Math.floor(COLS / 2), cy0 = Math.floor(ROWS / 2);
  vis[cy0][cx0] = true;
  const stack = [[cx0, cy0]];

  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const nb = [];
    if (r > 0       && !vis[r-1][c]) nb.push([c, r-1,  0, -1]);
    if (r < ROWS-1  && !vis[r+1][c]) nb.push([c, r+1,  0,  1]);
    if (c > 0       && !vis[r][c-1]) nb.push([c-1, r, -1,  0]);
    if (c < COLS-1  && !vis[r][c+1]) nb.push([c+1, r,  1,  0]);

    if (nb.length) {
      const [nc, nr, dc, dr] = nb[Math.floor(Math.random() * nb.length)];
      g[2*r+1+dr][2*c+1+dc] = false;  // remove wall between rooms
      vis[nr][nc] = true;
      stack.push([nc, nr]);
    } else {
      stack.pop();
    }
  }

  // Carve portal openings at boundary edges
  g[0][GCX]     = false;  // top
  g[GH-1][GCX]  = false;  // bottom
  g[GCY][0]     = false;  // left
  g[GCY][GW-1]  = false;  // right

  return g;
}

// ═══════════════════════════════════════════════════════════════════════
//  PLAYER HELPERS
// ═══════════════════════════════════════════════════════════════════════
function initPlayer() {
  player = {
    gx: GCX, gy: GCY,
    px: GCX * TILE, py: GCY * TILE,
    tx: GCX * TILE, ty: GCY * TILE,
    trail: [],
  };
}

function canWalk(gx, gy) {
  if (gx < 0 || gx >= GW || gy < 0 || gy >= GH) return false;
  return !grid[gy][gx];   // open = not wall
}

function tryMove() {
  // Only start a new move when player is stationary
  if (player.px !== player.tx || player.py !== player.ty) return;

  let dgx = 0, dgy = 0;
  if      (keysHeld['ArrowUp'])    dgy = -1;
  else if (keysHeld['ArrowDown'])  dgy =  1;
  else if (keysHeld['ArrowLeft'])  dgx = -1;
  else if (keysHeld['ArrowRight']) dgx =  1;
  if (dgx === 0 && dgy === 0) return;

  const ngx = player.gx + dgx;
  const ngy = player.gy + dgy;
  if (!canWalk(ngx, ngy)) return;

  // Save trail
  player.trail.unshift({ px: player.px, py: player.py });
  if (player.trail.length > 6) player.trail.pop();

  player.gx = ngx; player.gy = ngy;
  player.tx = ngx * TILE;
  player.ty = ngy * TILE;
}

function checkPortal() {
  for (const [dir, p] of Object.entries(currentPortals)) {
    if (player.gx === p.gx && player.gy === p.gy) {
      handleAnswer(dir);
      return;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  QUESTION BUILDER
// ═══════════════════════════════════════════════════════════════════════
function buildQuestions() {
  return shuffle([...VOCAB]).map(item => {
    const others   = shuffle(VOCAB.filter(v => v.word !== item.word));
    const choices  = shuffle([item.vi, ...others.slice(0, 3).map(v => v.vi)]);
    return { item, choices, correctStr: item.vi };
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  START GAME
// ═══════════════════════════════════════════════════════════════════════
function startGame() {
  const nameEl = document.getElementById('playerName');
  state.player = nameEl.value.trim() || 'EXPLORER';
  nameEl.value  = state.player;

  state.questions    = buildQuestions();
  state.qi           = 0;
  state.score        = 0;
  state.combo        = 1;
  state.bestCombo    = 1;
  state.hp           = CONFIG.hpMax;
  state.log          = [];
  state.sessionStart = new Date().toISOString();

  document.getElementById('hudPlayer').textContent = state.player;
  showScreen('screen-game');
  MusicEngine.play();
  nextQuestion();
}

// ═══════════════════════════════════════════════════════════════════════
//  NEXT QUESTION
// ═══════════════════════════════════════════════════════════════════════
function nextQuestion() {
  stopLoop();
  state.answered = false;
  keysHeld = {};

  grid = generateMaze();
  initPlayer();

  const q = state.questions[state.qi];
  document.getElementById('wbWord').textContent     = q.item.word;
  document.getElementById('wbPhonetic').textContent = q.item.phonetic;

  // Assign 4 choices to 4 portal directions (random shuffle)
  const dirs = shuffle(['up','down','left','right']);
  currentPortals = {};
  dirs.forEach((dir, i) => {
    currentPortals[dir] = {
      gx:    PORTAL_GX[dir],
      gy:    PORTAL_GY[dir],
      text:  q.choices[i],
      color: PORTAL_COLOR[dir],
      dir,
    };
    const el = document.getElementById('portal-' + dir);
    el.querySelector('.pl-text').textContent = q.choices[i];
    el.classList.remove('correct-portal','wrong-portal','player-near');
    // Re-trigger bounce-in animation
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  });

  updateHUD();
  startTimer();

  // READY flash, then start loop
  const readyEl = document.getElementById('mazeReady');
  readyEl.textContent = `Q${state.qi + 1} — NAVIGATE!`;
  readyEl.classList.add('show');
  setTimeout(() => {
    readyEl.classList.remove('show');
    gameRunning = true;
    rafId = requestAnimationFrame(gameLoop);
  }, 650);
}

// ═══════════════════════════════════════════════════════════════════════
//  GAME LOOP (rAF)
// ═══════════════════════════════════════════════════════════════════════
function gameLoop(ts) {
  if (!gameRunning) return;

  const sp = CONFIG.MOVE_SPEED;

  // Animate player toward target
  if (player.py !== player.ty) {
    const dy = player.ty - player.py;
    player.py += Math.sign(dy) * Math.min(sp, Math.abs(dy));
  } else if (player.px !== player.tx) {
    const dx = player.tx - player.px;
    player.px += Math.sign(dx) * Math.min(sp, Math.abs(dx));
  }

  // When arrived at tile
  if (player.px === player.tx && player.py === player.ty) {
    if (!state.answered) {
      checkPortal();
      if (!state.answered) tryMove();
    }
  }

  // Highlight portal-near
  highlightNearPortal();

  renderFrame(ts);
  rafId = requestAnimationFrame(gameLoop);
}

function stopLoop() {
  gameRunning = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ═══════════════════════════════════════════════════════════════════════
//  PORTAL PROXIMITY HIGHLIGHT
// ═══════════════════════════════════════════════════════════════════════
function highlightNearPortal() {
  for (const [dir, p] of Object.entries(currentPortals)) {
    const el  = document.getElementById('portal-' + dir);
    const dx  = Math.abs(player.gx - p.gx);
    const dy  = Math.abs(player.gy - p.gy);
    const near = (dx + dy) <= 3;
    el.classList.toggle('player-near', near &&
      !el.classList.contains('correct-portal') &&
      !el.classList.contains('wrong-portal'));
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  TIMER
// ═══════════════════════════════════════════════════════════════════════
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  state.timerLeft = CONFIG.timerSeconds;
  updateTimerBar();
  timerInterval = setInterval(() => {
    state.timerLeft--;
    updateTimerBar();
    if (state.timerLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      if (!state.answered) handleAnswer(null);
    }
  }, 1000);
}

function updateTimerBar() {
  const pct = state.timerLeft / CONFIG.timerSeconds;
  const fill = document.getElementById('timerFill');
  fill.style.width = (pct * 100) + '%';
  fill.className = 'timer-fill' + (pct <= 0.25 ? ' urgent' : pct <= 0.5 ? ' warn' : '');
}

// ═══════════════════════════════════════════════════════════════════════
//  HANDLE ANSWER
// ═══════════════════════════════════════════════════════════════════════
function handleAnswer(dir) {
  if (state.answered) return;
  state.answered = true;
  stopLoop();

  const q    = state.questions[state.qi];
  const isTO = dir === null;
  const chosen = isTO ? '__timeout__' : currentPortals[dir].text;
  const isOK   = !isTO && chosen === q.correctStr;

  let earned = 0;
  if (isOK) {
    earned = CONFIG.pointsCorrect
      + state.timerLeft * CONFIG.pointsTimeBonus
      + (state.combo - 1) * CONFIG.pointsComboBonus;
    state.score    += earned;
    state.combo     = Math.min(state.combo + 1, CONFIG.maxCombo);
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    document.getElementById('portal-' + dir).classList.add('correct-portal');
    flash(state.combo > 3 ? `COMBO x${state.combo}!` : '✓ CORRECT', true);
  } else {
    state.combo = 1;
    state.hp   -= 1;
    if (dir) document.getElementById('portal-' + dir).classList.add('wrong-portal');
    // Reveal correct portal
    for (const [d, p] of Object.entries(currentPortals)) {
      if (p.text === q.correctStr) {
        document.getElementById('portal-' + d).classList.add('correct-portal');
        break;
      }
    }
    flash(isTO ? '⏱ TIME OUT' : '✗ WRONG', false);
  }

  state.log.push({
    qi:       state.qi + 1,
    word:     q.item.word,
    correct:  isOK,
    timeout:  isTO,
    chosen:   isTO ? '(timeout)' : chosen,
    expected: q.correctStr,
    timerLeft: state.timerLeft,
    earned,
    comboAt:  state.combo,
    ts:       new Date().toISOString(),
  });

  updateHUD();
  // One final render to show the feedback colour on portals
  renderFrame(performance.now());

  setTimeout(() => {
    if (state.hp <= 0 || state.qi + 1 >= state.questions.length) {
      showResults(state.hp > 0);
    } else {
      state.qi++;
      nextQuestion();
    }
  }, 1100);
}

function endGame(completed) {
  stopLoop();
  showResults(completed);
}

// ═══════════════════════════════════════════════════════════════════════
//  CANVAS RENDERER
// ═══════════════════════════════════════════════════════════════════════
function renderFrame(ts) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── Background ──────────────────────────────────────────────────────
  ctx.fillStyle = '#0c0c1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ── Walls & floors ──────────────────────────────────────────────────
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const x = gx * TILE, y = gy * TILE;
      if (grid[gy][gx]) {
        // Wall base
        ctx.fillStyle = '#1c1c2e';
        ctx.fillRect(x, y, TILE, TILE);
        // Top-left bevel highlight
        ctx.fillStyle = 'rgba(93,113,224,0.1)';
        ctx.fillRect(x, y, TILE, 1);
        ctx.fillRect(x, y, 1, TILE);
        // Bottom-right shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x, y + TILE - 1, TILE, 1);
        ctx.fillRect(x + TILE - 1, y, 1, TILE);
      } else {
        // Floor
        ctx.fillStyle = '#111128';
        ctx.fillRect(x, y, TILE, TILE);
        // Subtle floor dot at centre
        ctx.fillStyle = 'rgba(93,113,224,0.07)';
        ctx.fillRect(x + TILE/2 - 1, y + TILE/2 - 1, 2, 2);
      }
    }
  }

  // ── Portals (pulsing glow circles at edge tiles) ─────────────────────
  const pulse = 0.5 + 0.5 * Math.sin(ts * 0.0028);
  for (const [dir, p] of Object.entries(currentPortals)) {
    const cx = p.gx * TILE + TILE / 2;
    const cy = p.gy * TILE + TILE / 2;

    ctx.save();
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 24 + pulse * 14;

    // Outer glow ring
    ctx.strokeStyle = p.color;
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = 0.35 + pulse * 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy, TILE * 0.65, 0, Math.PI * 2);
    ctx.stroke();

    // Inner fill
    ctx.fillStyle   = p.color;
    ctx.globalAlpha = 0.55 + pulse * 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy, TILE * 0.38, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── Player trail ─────────────────────────────────────────────────────
  const TRAIL_ALPHA = [0.07, 0.12, 0.17, 0.22, 0.28, 0.33];
  player.trail.forEach((t, i) => {
    const alpha = TRAIL_ALPHA[i] ?? 0.06;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = '#00f5d4';
    ctx.shadowColor = '#00f5d4';
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.arc(t.px + TILE/2, t.py + TILE/2, TILE * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // ── Player ────────────────────────────────────────────────────────────
  const pcx = player.px + TILE / 2;
  const pcy = player.py + TILE / 2;
  const pr  = TILE * 0.3;
  const playerPulse = 0.5 + 0.5 * Math.sin(ts * 0.004);

  ctx.save();
  ctx.shadowColor = '#00f5d4';
  ctx.shadowBlur  = 14 + playerPulse * 8;

  // Outer ring
  ctx.strokeStyle = '#00f5d4';
  ctx.lineWidth   = 1.5;
  ctx.globalAlpha = 0.6 + playerPulse * 0.3;
  ctx.beginPath();
  ctx.arc(pcx, pcy, pr + 4, 0, Math.PI * 2);
  ctx.stroke();

  // Core fill
  ctx.fillStyle   = '#00f5d4';
  ctx.globalAlpha = 0.85 + playerPulse * 0.1;
  ctx.beginPath();
  ctx.arc(pcx, pcy, pr, 0, Math.PI * 2);
  ctx.fill();

  // Inner bright dot
  ctx.fillStyle   = '#ffffff';
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(pcx - pr * 0.3, pcy - pr * 0.3, pr * 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════
//  RESULTS
// ═══════════════════════════════════════════════════════════════════════
function showResults(completed) {
  stopLoop();
  MusicEngine.pause();

  const correct  = state.log.filter(l => l.correct).length;
  const total    = state.log.length;
  const acc      = total ? Math.round(correct / total * 100) : 0;

  document.getElementById('resScore').textContent     = state.score;
  document.getElementById('resCorrect').textContent   = `${correct}/${total}`;
  document.getElementById('resAccuracy').textContent  = acc + '%';
  document.getElementById('resBestCombo').textContent = `x${state.bestCombo}`;

  const title = document.getElementById('resultsTitle');
  if (!completed)   { title.textContent = 'ELIMINATED';  title.className = 'results-title lose'; }
  else if (acc >= 90){ title.textContent = 'LEGENDARY!'; title.className = 'results-title win'; }
  else if (acc >= 70){ title.textContent = 'ESCAPED!';   title.className = 'results-title win'; }
  else               { title.textContent = 'SURVIVED';   title.className = 'results-title win'; }

  document.getElementById('rankBadge').textContent =
    acc >= 95 ? '🏆 S — GRANDMASTER' :
    acc >= 85 ? '⭐ A — ELITE' :
    acc >= 70 ? '🥇 B — VETERAN' :
    acc >= 50 ? '🥈 C — RECRUIT' : '💀 D — TRY HARDER';

  const rl = document.getElementById('reviewList');
  rl.innerHTML = '<h3>Debrief — Word Log</h3>';
  state.log.forEach(l => {
    const div = document.createElement('div');
    div.className = 'review-item';
    const note = l.correct
      ? `+${l.earned} pts · combo x${l.comboAt} · ${l.timerLeft}s left`
      : `Expected: "${l.expected}"`;
    div.innerHTML = `
      <div class="ri-icon">${l.correct ? '✅' : '❌'}</div>
      <div>
        <div class="ri-word">${l.word}</div>
        <div class="ri-note">${note}</div>
      </div>`;
    rl.appendChild(div);
  });

  showScreen('screen-results');
}

// ═══════════════════════════════════════════════════════════════════════
//  NAV
// ═══════════════════════════════════════════════════════════════════════
function playAgain() { startGame(); }

function showTitle() {
  stopLoop();
  MusicEngine.pause();
  showScreen('screen-title');
}

// ═══════════════════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════════════════
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function flash(text, ok) {
  const el = document.getElementById('feedbackFlash');
  el.textContent  = text;
  el.className    = 'feedback-flash';
  void el.offsetWidth;
  el.className    = 'feedback-flash ' + (ok ? 'show-ok' : 'show-bad');
}

function updateHUD() {
  const total = state.questions.length;
  document.getElementById('hudQ').textContent     = `${state.qi + 1}/${total}`;
  document.getElementById('hudScore').textContent  = state.score;
  document.getElementById('hudCombo').textContent  = `x${state.combo}`;
  document.getElementById('hudHp').textContent     =
    '❤️'.repeat(Math.max(0, state.hp)) + '🖤'.repeat(Math.max(0, CONFIG.hpMax - state.hp));
  document.getElementById('progressFill').style.width =
    (state.qi / total * 100) + '%';
}

function openModal(v) {
  document.getElementById('modal-word').textContent     = v.emoji + ' ' + v.word;
  document.getElementById('modal-phonetic').textContent = v.phonetic;
  document.getElementById('modal-body').innerHTML =
    `<span style="color:#00f5d4;font-size:1.15em;font-weight:700">🇻🇳 ${v.vi}</span><br><br>` +
    `${v.scenario}<br><br>📖 ${v.meaning}`;
  document.getElementById('wordModal').classList.add('open');
}

function closeModal() {
  document.getElementById('wordModal').classList.remove('open');
}
