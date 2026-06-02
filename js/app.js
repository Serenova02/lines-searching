import { GameEngine } from "./engine.js";

const CHAPTERS = [
  {
    id: "chapter1",
    label: "第一章 血色保单",
    levels: [
      { title: "第一节 老屋", file: "data/chapter1_part1.json", note: "已开放" },
      { title: "第二节 204客房的“自杀”者", file: "data/chapter1_part2.json", note: "已开放" },
      { title: "第三节 17号仓库的“黄雀”", file: "data/chapter1_part3.json", note: "已开放" },
    ],
  },
  {
    id: "chapter2",
    label: "第二章 钟摆之下的谎言",
    levels: [
      { title: "第一节 密室", file: "data/chapter2_part1.json", note: "已开放" },
      { title: "第二节 停电", file: "data/chapter2_part2.json", note: "已开放" },
      { title: "第三节 替身", file: "data/chapter2_part3.json", note: "已开放" },
      { title: "第四节 遗书", file: "data/chapter2_part4.json", note: "已开放" },
    ],
  },
  {
    id: "chapter3",
    label: "第三章 锈蚀的交响曲",
    levels: [
      { title: "第一节 断裂的序曲", file: "data/chapter3_part1.json", note: "已开放" },
      { title: "第二节 双重回响", file: "data/chapter3_part2.json", note: "已开放" },
      { title: "第三节 发条木偶的假面", file: "data/chapter3_part3.json", note: "已开放" },
      { title: "第四节 剧毒的协奏", file: "data/chapter3_part4.json", note: "已开放" },
      { title: "第五节 密闭琴房", file: "data/chapter3_part5.json", note: "已开放" },
      { title: "第六节 黄金剧院的终曲", file: "data/chapter3_part6.json", note: "已开放" },
    ],
  },
];

const NOTES_KEY = "tinw_notes";
const UNLOCK_CH2_KEY = "tinw_unlock_ch2";
const LAST_CHAPTER_KEY = "tinw_last_chapter";
const REDUCE_MOTION_KEY = "tinw_reduce_motion";
const THEME_KEY = "tinw_theme";

const $ = (sel) => document.querySelector(sel);

const engine = new GameEngine();

/** 节点在画布上的坐标（与关卡 JSON 分离，便于防重叠） @type {Map<string, {x:number,y:number}>} */
const layoutPos = new Map();

/** @type {HTMLDivElement|null} */
let dragGhostEl = null;

const els = {
  chapterSection: $("#chapter-section"),
  chapterLabel: $("#chapter-label"),
  progressLabel: $("#progress-label"),
  graphWrap: $("#graph-wrap"),
  graphViewport: $("#graph-viewport"),
  graphInner: $("#graph-inner"),
  nodesLayer: $("#nodes-layer"),
  edgeLayer: $("#edge-layer"),
  detailPanel: $("#detail-panel"),
  detailTitle: $("#detail-title"),
  detailBody: $("#detail-body"),
  detailActions: $("#detail-actions"),
  toast: $("#toast"),
  btnHint: $("#btn-hint"),
  btnRestart: $("#btn-restart"),
  btnBack: $("#btn-back"),
  modalChapters: $("#modal-chapters"),
  chapterList: $("#chapter-list"),
  modalChaptersClose: $("#modal-chapters-close"),
  
  modalClues: $("#modal-clues"),
  clueList: $("#clue-list"),
  modalTruth: $("#modal-truth"),
  truthModalTitle: $("#truth-modal-title"),
  truthModalHint: $("#truth-modal-hint"),
  truthSlots: $("#truth-slots"),
  truthPick: $("#truth-pick"),
  btnVerifyTruth: $("#btn-verify-truth"),
  modalTruthClose: $("#modal-truth-close"),
  modalEpilogue: $("#modal-epilogue"),
  epilogueBody: $("#epilogue-body"),
  btnNextChapter: $("#btn-next-chapter"),
  modalEpilogueClose: $("#modal-epilogue-close"),
  coverScreen: $("#cover-screen"),
  coverStart: $("#cover-start"),
  coverContinue: $("#cover-continue"),
  coverLevels: $("#cover-levels"),
  coverSettings: $("#cover-settings"),
  coverExit: $("#cover-exit"),
  modalCoverSettings: $("#modal-cover-settings"),
  modalCoverSettingsClose: $("#modal-cover-settings-close"),
  settingReduceMotion: $("#setting-reduce-motion"),
  settingThemeNormal: $("#setting-theme-normal"),
  settingThemeWork: $("#setting-theme-work"),
  
  modalOverview: $("#modal-overview"),
  overviewTitle: $("#overview-title"),
  overviewText: $("#overview-text"),
  modalOverviewClose: $("#modal-overview-close"),
  modalOverviewConfirm: $("#modal-overview-confirm"),
};

let currentChapterIndex = 0;
let currentLevelIndex = 0;
let pan = { x: 0, y: 0, s: 0.82, dragging: false, px: 0, py: 0 };

function isCh2Unlocked() {
  try {
    return localStorage.getItem(UNLOCK_CH2_KEY) === "1";
  } catch {
    return false;
  }
}

function unlockCh2() {
  try {
    localStorage.setItem(UNLOCK_CH2_KEY, "1");
  } catch {
    /* ignore */
  }
}

function currentLevel() {
  return CHAPTERS[currentChapterIndex]?.levels?.[currentLevelIndex] ?? null;
}

function getNextPlayableLevel() {
  const chapter = CHAPTERS[currentChapterIndex];
  if (!chapter) return null;
  for (let i = currentLevelIndex + 1; i < chapter.levels.length; i++) {
    if (chapter.levels[i]?.file) {
      return { chapterIndex: currentChapterIndex, levelIndex: i, level: chapter.levels[i] };
    }
  }
  return null;
}

function persistLastChapter() {
  try {
    localStorage.setItem(
      LAST_CHAPTER_KEY,
      JSON.stringify({ chapter: currentChapterIndex, level: currentLevelIndex })
    );
  } catch {
    /* ignore */
  }
  updateCoverContinueState();
}

function updateCoverContinueState() {
  if (!els.coverContinue) return;
  try {
    els.coverContinue.disabled = localStorage.getItem(LAST_CHAPTER_KEY) === null;
  } catch {
    els.coverContinue.disabled = true;
  }
}

function applyReduceMotion() {
  try {
    const on = localStorage.getItem(REDUCE_MOTION_KEY) === "1";
    document.documentElement.classList.toggle("reduce-motion", on);
    if (els.settingReduceMotion) els.settingReduceMotion.checked = on;
  } catch {
    /* ignore */
  }
}

function applyTheme() {
  try {
    const theme = localStorage.getItem(THEME_KEY) || "normal";
    const isWork = theme === "work";
    document.body.classList.toggle("theme-work", isWork);
    if (els.settingThemeNormal) els.settingThemeNormal.checked = !isWork;
    if (els.settingThemeWork) els.settingThemeWork.checked = isWork;
  } catch {
    /* ignore */
  }
}

function hideCover() {
  if (els.coverScreen) els.coverScreen.hidden = true;
}

function showCover() {
  if (els.coverScreen) els.coverScreen.hidden = false;
  updateCoverContinueState();
}

function initLayoutFromLevel() {
  layoutPos.clear();
  const nodes = engine.level.nodes ?? [];
  if (!nodes.length) return;

  const center = nodes.reduce(
    (acc, n) => {
      acc.x += n.x;
      acc.y += n.y;
      return acc;
    },
    { x: 0, y: 0 }
  );
  center.x /= nodes.length;
  center.y /= nodes.length;

  const compactX = 0.9;
  const compactY = 0.88;

  for (const n of nodes) {
    layoutPos.set(n.id, {
      x: center.x + (n.x - center.x) * compactX,
      y: center.y + (n.y - center.y) * compactY,
    });
  }
}

/** 估算两节点中心至少相隔多少像素才不会重叠（与 .node-chip 尺寸规则一致） */
function chipMinCenterDist(na, nb) {
  const wa = Math.min(176, 54 + na.title.length * 12);
  const wb = Math.min(176, 54 + nb.title.length * 12);
  const h = 52;
  const ra = Math.hypot(wa / 2, h / 2) + 10;
  const rb = Math.hypot(wb / 2, h / 2) + 10;
  return ra + rb;
}

/**
 * 对当前可见节点做分离迭代，消除重叠
 * @param {any[]} visibleNodes
 */
function resolveOverlaps(visibleNodes) {
  const items = visibleNodes.map((n) => {
    const p = layoutPos.get(n.id) ?? { x: n.x, y: n.y };
    return { n, x: p.x, y: p.y };
  });
  const margin = 4;
  for (let iter = 0; iter < 140; iter++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const need = chipMinCenterDist(a.n, b.n) + margin;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist < need) {
          const push = (need - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  for (const it of items) {
    it.x = Math.max(72, Math.min(1928, it.x));
    it.y = Math.max(72, Math.min(1928, it.y));
    layoutPos.set(it.n.id, { x: it.x, y: it.y });
  }
}

function getLayout(id) {
  const n = engine.getNode(id);
  if (!n) return { x: 0, y: 0 };
  return layoutPos.get(id) ?? { x: n.x, y: n.y };
}

function applyInnerTransform() {
  els.graphInner.style.transform = `translate(${pan.x}px,${pan.y}px) scale(${pan.s})`;
}

function centerOnWorld(wx, wy) {
  const r = els.graphWrap.getBoundingClientRect();
  const cx = r.width / 2;
  const cy = r.height / 2;
  pan.x = cx - wx * pan.s;
  pan.y = cy - wy * pan.s;
  applyInnerTransform();
}

function showToast(msg, ms = 2200) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.remove("show"), ms);
}

function removeDragGhost() {
  dragGhostEl?.remove();
  dragGhostEl = null;
}

function showDragGhost(label) {
  removeDragGhost();
  const g = document.createElement("div");
  g.className = "drag-ghost";
  g.textContent = label;
  document.body.appendChild(g);
  dragGhostEl = g;
}

function moveDragGhost(clientX, clientY) {
  if (!dragGhostEl) return;
  dragGhostEl.style.left = `${clientX + 14}px`;
  dragGhostEl.style.top = `${clientY + 14}px`;
}

function edgeCurveDirection(fromId, toId) {
  let seed = 0;
  const key = `${fromId}|${toId}`;
  for (let i = 0; i < key.length; i++) {
    seed += key.charCodeAt(i);
  }
  return seed % 2 === 0 ? 1 : -1;
}

function buildEdgePath(pa, pb, fromId, toId) {
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const bend = Math.max(22, Math.min(78, dist * 0.18));
  const dir = edgeCurveDirection(fromId, toId);
  const cx = (pa.x + pb.x) / 2 + nx * bend * dir;
  const cy = (pa.y + pb.y) / 2 + ny * bend * dir;
  return `M ${pa.x} ${pa.y} Q ${cx} ${cy} ${pb.x} ${pb.y}`;
}

function hashText(text) {
  let seed = 0;
  for (let i = 0; i < text.length; i++) {
    seed = (seed * 31 + text.charCodeAt(i)) % 1000003;
  }
  return seed;
}

function renderEdges() {
  const svg = els.edgeLayer;
  svg.setAttribute("viewBox", "0 0 2000 2000");
  svg.innerHTML = "";
  const byId = (id) => engine.getNode(id);
  for (const e of engine.edges) {
    const a = byId(e.from);
    const b = byId(e.to);
    if (!a || !b) continue;
    const pa = getLayout(e.from);
    const pb = getLayout(e.to);
    const d = buildEdgePath(pa, pb, e.from, e.to);

    const shadow = document.createElementNS("http://www.w3.org/2000/svg", "path");
    shadow.setAttribute("d", d);
    shadow.classList.add("edge-thread-shadow");
    svg.appendChild(shadow);

    const thread = document.createElementNS("http://www.w3.org/2000/svg", "path");
    thread.setAttribute("d", d);
    thread.classList.add("edge-thread");
    if (e.isNew) thread.classList.add("new-edge");
    svg.appendChild(thread);

    const highlight = document.createElementNS("http://www.w3.org/2000/svg", "path");
    highlight.setAttribute("d", d);
    highlight.classList.add("edge-thread-highlight");
    if (e.isNew) highlight.classList.add("new-edge");
    svg.appendChild(highlight);

    const startPin = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    startPin.setAttribute("cx", String(pa.x));
    startPin.setAttribute("cy", String(pa.y));
    startPin.setAttribute("r", "4.4");
    startPin.classList.add("edge-pin");
    svg.appendChild(startPin);

    const startPinCore = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    startPinCore.setAttribute("cx", String(pa.x));
    startPinCore.setAttribute("cy", String(pa.y));
    startPinCore.setAttribute("r", "2.1");
    startPinCore.classList.add("edge-pin-core");
    if (e.isNew) startPinCore.classList.add("new-edge");
    svg.appendChild(startPinCore);

    const endPin = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    endPin.setAttribute("cx", String(pb.x));
    endPin.setAttribute("cy", String(pb.y));
    endPin.setAttribute("r", "4.4");
    endPin.classList.add("edge-pin");
    svg.appendChild(endPin);

    const endPinCore = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    endPinCore.setAttribute("cx", String(pb.x));
    endPinCore.setAttribute("cy", String(pb.y));
    endPinCore.setAttribute("r", "2.1");
    endPinCore.classList.add("edge-pin-core", "edge-pin-end");
    if (e.isNew) endPinCore.classList.add("new-edge");
    svg.appendChild(endPinCore);
  }
  if (engine.edges.some((e) => e.isNew)) {
    clearTimeout(renderEdges._t);
    renderEdges._t = setTimeout(() => {
      engine.consumeNewEdges();
      renderEdges();
    }, 2400);
  }
}

/**
 * @param {HTMLElement} chip
 * @param {string} id
 */
function bindChipPointer(chip, id) {
  /** @type {{ sx: number; sy: number; dragging: boolean } | null} */
  let ptr = null;

  chip.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    ptr = { sx: e.clientX, sy: e.clientY, dragging: false };
    try {
      chip.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  });

  chip.addEventListener("pointermove", (e) => {
    if (!ptr) return;
    const d = Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy);
    if (d > 12) {
      if (!ptr.dragging) {
        ptr.dragging = true;
        chip.classList.add("is-dragging");
        showDragGhost(chip.textContent?.trim() ?? "");
      }
      moveDragGhost(e.clientX, e.clientY);
    }
  });

  const finish = (e) => {
    if (!ptr) return;
    const s = ptr;
    ptr = null;
    try {
      chip.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    chip.classList.remove("is-dragging");
    removeDragGhost();

    const node = engine.getNode(id);
    if (s.dragging) {
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const tgt = under?.closest?.(".node-chip")?.dataset?.id;
      if (tgt && tgt !== id) {
        const r = engine.tryCombinePair(id, tgt);
        if (r.ok) {
          showToast(r.toast ?? "推理成功。");
          renderNodes();
        } else if (r.message) {
          showToast(r.message);
        }
      }
    } else {
      if (node?.type === "truth") {
        if (!engine.openTruthModal()) {
          return;
        }
        const t = engine.level.truthAssembly;
        els.truthModalTitle.textContent = t.title;
        els.truthModalHint.textContent = t.hint;
        renderTruthSlots();
        els.modalTruth.hidden = false;
      } else {
        openNodeDetail(id);
      }
    }
  };

  chip.addEventListener("pointerup", finish);
  chip.addEventListener("pointercancel", finish);
}

function renderNodes() {
  els.nodesLayer.innerHTML = "";

  const visible = engine.level.nodes.filter((n) => engine.states.get(n.id) !== "hidden");
  for (const n of visible) {
    if (!layoutPos.has(n.id)) {
      layoutPos.set(n.id, { x: n.x, y: n.y });
    }
  }
  resolveOverlaps(visible);

  for (const n of visible) {
    const st = engine.states.get(n.id);
    const p = getLayout(n.id);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "node-chip";
    btn.dataset.id = n.id;
    btn.textContent = n.title;
    btn.style.left = `${p.x}px`;
    btn.style.top = `${p.y}px`;
    const seed = hashText(`${n.id}:${n.type}`);
    const tilt = ((seed % 9) - 4) * 0.35;
    const pinLeft = 16 + (seed % 36);
    btn.style.setProperty("--tilt", `${tilt}deg`);
    btn.style.setProperty("--pin-left", `${pinLeft}px`);

    if (st === "new") btn.classList.add("new", "unread");
    if (st === "read") btn.classList.add("read");
    if (engine.focusedId === n.id) btn.classList.add("focused");
    if (n.type === "truth") btn.classList.add("truth-node");
    if (n.type === "conclusion") btn.classList.add("conclusion");
    if (n.type === "conclusion" && /(凶器|绠变腑涔嬬墿|缁撹|first_|weapon_|box_contents|conclusion_)/.test(`${n.title} ${n.id}`)) {
      btn.classList.add("key-conclusion");
    }
    if (n.actions?.length || n.type === "character") btn.classList.add("action-node");
    if (n.id === "hand" || n.id === "brother_corpse") btn.classList.add("hot");

    bindChipPointer(btn, n.id);
    els.nodesLayer.appendChild(btn);
  }

  renderEdges();
  els.progressLabel.textContent = engine.progressText();
}

function renderTruthSlots() {
  els.truthSlots.innerHTML = "";
  els.truthPick.innerHTML = "";
  const req = engine.level.truthAssembly.requiredIds;
  for (let i = 0; i < 3; i++) {
    const sid = engine.truthSlots[i];
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "truth-slot" + (sid ? " filled" : "");
    slot.textContent = sid ? engine.getNode(sid)?.title ?? sid : `槽位 ${i + 1}（点击下方列表填入）`;
    slot.addEventListener("click", () => {
      engine.truthSlots[i] = null;
      renderTruthSlots();
    });
    els.truthSlots.appendChild(slot);
  }

  const hint = document.createElement("p");
  hint.className = "modal-hint";
  hint.style.marginTop = "0.75rem";
  hint.textContent = "点选下列核心结论填入空槽（点击已填槽位可清除）：";
  els.truthPick.appendChild(hint);

  const ul = document.createElement("ul");
  ul.className = "clue-list";
  for (const rid of req) {
    if (!engine.isVisible(rid)) continue;
    const node = engine.getNode(rid);
    const li = document.createElement("li");
    li.textContent = node?.title ?? rid;
    li.addEventListener("click", () => {
      engine.addTruthFromList(rid);
      renderTruthSlots();
    });
    ul.appendChild(li);
  }
  els.truthPick.appendChild(ul);
}

function openNodeDetail(nodeId) {
  const { node } = engine.openDetail(nodeId);
  if (!node) return;
  els.detailTitle.textContent = node.title;
  els.detailBody.textContent = node.description;
  els.detailActions.innerHTML = "";

  if (node.actions?.length) {
    for (const act of node.actions) {
      const key = `${nodeId}:${act.id}`;
      if (engine.usedActions.has(key)) continue;
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = act.label;
      b.addEventListener("click", () => {
        const r = engine.runAction(nodeId, act.id);
        if (r.ok && r.toast) showToast(r.toast);
        if (!r.ok && r.message) showToast(r.message);
        renderNodes();
        openNodeDetail(nodeId);
      });
      els.detailActions.appendChild(b);
    }
  }

  els.detailPanel.hidden = false;
  renderNodes();
}

function closeDetail() {
  engine.clearFocus();
  els.detailPanel.hidden = true;
  renderNodes();
}

function openChapterList() {
  if (els.coverScreen && !els.coverScreen.hidden) {
    els.modalChapters.classList.add("modal-front");
  }
  els.chapterList.innerHTML = "";
  CHAPTERS.forEach((ch, chapterIndex) => {
    const section = document.createElement("section");
    section.className = "chapter-group";
    if (chapterIndex > 0) section.classList.add("is-collapsed");

    const header = document.createElement("button");
    header.type = "button";
    header.className = "chapter-group-toggle";
    header.setAttribute("aria-expanded", chapterIndex === 0 ? "true" : "false");
    header.innerHTML = `<span class="chapter-group-title">${ch.label}</span><span class="chapter-group-arrow">${chapterIndex === 0 ? "-" : "+"}</span>`;
    header.addEventListener("click", () => {
      const collapsed = section.classList.toggle("is-collapsed");
      header.setAttribute("aria-expanded", collapsed ? "false" : "true");
      const arrow = header.querySelector(".chapter-group-arrow");
      if (arrow) arrow.textContent = collapsed ? "+" : "-";
    });
    section.appendChild(header);

    const list = document.createElement("div");
    list.className = "chapter-level-list";

    ch.levels.forEach((level, levelIndex) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chapter-level-item";
      b.innerHTML = `<span class="chapter-level-name">${level.title}</span><span class="chapter-level-meta">${level.note ?? ""}</span>`;
      b.addEventListener("click", () => {
        if (!level.file) return;
        hideCover();
        startChapter(chapterIndex, levelIndex);
        els.modalChapters.hidden = true;
        els.modalChapters.classList.remove("modal-front");
      });
      list.appendChild(b);
    });

    section.appendChild(list);
    els.chapterList.appendChild(section);
  });
  els.modalChapters.hidden = false;
}

function closeOverview() {
  els.modalOverview.hidden = true;
}

function showOverview() {
  const levelData = engine.level;
  if (!levelData) return;

  const overview = levelData.overview;
  if (!overview) return;

  els.overviewTitle.textContent = overview.title || "背景概述";
  els.overviewText.textContent = overview.text || "";
  els.modalOverview.hidden = false;
}

async function startChapter(chapterIndex, levelIndex = 0) {
  currentChapterIndex = chapterIndex;
  currentLevelIndex = levelIndex;
  const level = currentLevel();
  if (!level?.file) return;
  await engine.loadLevel(level.file);
  initLayoutFromLevel();
  els.chapterSection.textContent = CHAPTERS[chapterIndex].label;
  els.chapterLabel.textContent = level.title;
  pan.s = 0.82;
  requestAnimationFrame(() => {
    centerOnWorld(1000, 920);
  });
  renderNodes();
  closeDetail();
  persistLastChapter();
  showOverview();
}

function setupPanZoom() {
  const vp = els.graphViewport;
  const wrap = els.graphWrap;
  let touches = [];
  let initialPinchDistance = 0;
  let initialPinchScale = 1;

  vp.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (e.target.closest(".node-chip")) return;
    
    touches.push({ id: e.pointerId, x: e.clientX, y: e.clientY });
    
    if (touches.length === 1) {
      pan.dragging = true;
      pan.px = e.clientX;
      pan.py = e.clientY;
      vp.classList.add("dragging");
    } else if (touches.length === 2) {
      pan.dragging = false;
      initialPinchDistance = getDistance(touches[0], touches[1]);
      initialPinchScale = pan.s;
    }
    
    vp.setPointerCapture(e.pointerId);
  });

  vp.addEventListener("pointermove", (e) => {
    if (touches.length === 2) {
      const touchIdx = touches.findIndex(t => t.id === e.pointerId);
      if (touchIdx !== -1) {
        touches[touchIdx] = { id: e.pointerId, x: e.clientX, y: e.clientY };
        const currentDistance = getDistance(touches[0], touches[1]);
        const scaleFactor = currentDistance / initialPinchDistance;
        const newScale = Math.min(1.45, Math.max(0.38, initialPinchScale * scaleFactor));
        
        const r = wrap.getBoundingClientRect();
        const midX = (touches[0].x + touches[1].x) / 2;
        const midY = (touches[0].y + touches[1].y) / 2;
        const mx = midX - r.left;
        const my = midY - r.top;
        const worldX = (mx - pan.x) / pan.s;
        const worldY = (my - pan.y) / pan.s;
        
        pan.x = mx - worldX * newScale;
        pan.y = my - worldY * newScale;
        pan.s = newScale;
        applyInnerTransform();
      }
    } else if (pan.dragging) {
      const dx = e.clientX - pan.px;
      const dy = e.clientY - pan.py;
      pan.px = e.clientX;
      pan.py = e.clientY;
      pan.x += dx;
      pan.y += dy;
      applyInnerTransform();
    }
  });

  const endDrag = (e) => {
    touches = touches.filter(t => t.id !== e.pointerId);
    
    if (touches.length === 0) {
      pan.dragging = false;
      vp.classList.remove("dragging");
    }
    
    try {
      vp.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  
  vp.addEventListener("pointerup", endDrag);
  vp.addEventListener("pointercancel", endDrag);

  wrap.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const worldX = (mx - pan.x) / pan.s;
      const worldY = (my - pan.y) / pan.s;
      const factor = e.deltaY > 0 ? 0.92 : 1.09;
      const nextS = Math.min(1.45, Math.max(0.38, pan.s * factor));
      pan.x = mx - worldX * nextS;
      pan.y = my - worldY * nextS;
      pan.s = nextS;
      applyInnerTransform();
    },
    { passive: false }
  );
}

function getDistance(t1, t2) {
  const dx = t2.x - t1.x;
  const dy = t2.y - t1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function bindUi() {
  els.btnHint.addEventListener("click", () => {
    showToast(engine.nextHint(), 5000);
  });

  els.btnRestart.addEventListener("click", async () => {
    await startChapter(currentChapterIndex, currentLevelIndex);
  });

  els.btnBack.addEventListener("click", () => {
    showCover();
  });

  els.modalChaptersClose.addEventListener("click", () => {
    els.modalChapters.hidden = true;
    els.modalChapters.classList.remove("modal-front");
  });

  els.modalTruthClose.addEventListener("click", () => {
    els.modalTruth.hidden = true;
  });

  els.btnVerifyTruth.addEventListener("click", () => {
    const r = engine.verifyTruth();
    if (!r.ok) {
      showToast(r.message);
      return;
    }
    els.modalTruth.hidden = true;
    els.epilogueBody.textContent = r.epilogue ?? "";
    els.modalEpilogue.hidden = false;
    const nextLevel = getNextPlayableLevel();
    els.btnNextChapter.hidden = !nextLevel;
    els.btnNextChapter.textContent = nextLevel ? "下一节" : "关闭";
    renderNodes();
  });

  els.modalEpilogueClose.addEventListener("click", () => {
    els.modalEpilogue.hidden = true;
  });

  els.btnNextChapter.addEventListener("click", async () => {
    els.modalEpilogue.hidden = true;
    const nextLevel = getNextPlayableLevel();
    if (nextLevel) {
      await startChapter(nextLevel.chapterIndex, nextLevel.levelIndex);
    }
  });

  window.addEventListener("resize", () => {
    applyInnerTransform();
  });

  els.modalOverviewClose.addEventListener("click", () => {
    closeOverview();
  });

  els.modalOverviewConfirm.addEventListener("click", () => {
    closeOverview();
  });
}

function bindCoverUi() {
  els.coverStart?.addEventListener("click", async () => {
    hideCover();
    await startChapter(0, 0);
  });

  els.coverContinue?.addEventListener("click", async () => {
    let idx = 0;
    let levelIdx = 0;
    try {
      const raw = localStorage.getItem(LAST_CHAPTER_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      idx = Number.isInteger(parsed?.chapter) ? parsed.chapter : 0;
      levelIdx = Number.isInteger(parsed?.level) ? parsed.level : 0;
    } catch {
      idx = 0;
      levelIdx = 0;
    }
    if (Number.isNaN(idx) || idx < 0) idx = 0;
    if (idx >= CHAPTERS.length) idx = CHAPTERS.length - 1;
    if (levelIdx < 0) levelIdx = 0;
    if (levelIdx >= (CHAPTERS[idx]?.levels?.length ?? 1)) levelIdx = 0;
    if (idx === 1 && !isCh2Unlocked()) {
      idx = 0;
      levelIdx = 0;
      showToast("第二章尚未解锁，已从第一章进入。");
    }
    hideCover();
    await startChapter(idx, levelIdx);
  });

  els.coverLevels?.addEventListener("click", () => {
    openChapterList();
  });

  els.coverSettings?.addEventListener("click", () => {
    applyReduceMotion();
    applyTheme();
    els.modalCoverSettings.hidden = false;
    els.modalCoverSettings.classList.add("modal-front");
  });

  els.modalCoverSettingsClose?.addEventListener("click", () => {
    els.modalCoverSettings.hidden = true;
    els.modalCoverSettings.classList.remove("modal-front");
    applyTheme();
  });

  els.settingReduceMotion?.addEventListener("change", () => {
    try {
      localStorage.setItem(REDUCE_MOTION_KEY, els.settingReduceMotion.checked ? "1" : "0");
    } catch {
      /* ignore */
    }
    applyReduceMotion();
  });

  els.settingThemeNormal?.addEventListener("change", () => {
    if (els.settingThemeNormal.checked) {
      try {
        localStorage.setItem(THEME_KEY, "normal");
      } catch {
        /* ignore */
      }
    }
  });

  els.settingThemeWork?.addEventListener("change", () => {
    if (els.settingThemeWork.checked) {
      try {
        localStorage.setItem(THEME_KEY, "work");
      } catch {
        /* ignore */
      }
    }
  });

  els.coverExit?.addEventListener("click", () => {
    showToast("网页版请直接关闭浏览器标签页即可退出。", 3200);
  });
}

async function boot() {
  applyReduceMotion();
  applyTheme();
  setupPanZoom();
  bindUi();
  bindCoverUi();
  updateCoverContinueState();
}

boot().catch((err) => {
  console.error(err);
  showToast("加载失败：" + err.message, 5000);
});
