/** @typedef {'hidden'|'new'|'read'} NodeState */

function sortIds(ids) {
  return [...ids].sort();
}

function setsEqual(a, b) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

export class GameEngine {
  /** @type {any} */
  level = null;
  /** @type {Map<string, NodeState>} */
  states = new Map();
  appliedRead = new Set();
  /** @type {Set<string>} */
  usedActions = new Set();
  /** @type {{from:string,to:string,isNew?:boolean}[]} */
  edges = [];
  /** @type {(string|null)[]} */
  truthSlots = [null, null, null];
  chapterCompleted = false;
  hintIndex = 0;
  /** @type {string|null} */
  focusedId = null;
  /** @type {Set<string>} */
  collectingForRule = new Set();

  async loadLevel(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`加载关卡失败: ${url}`);
    this.level = await res.json();
    this.resetStates();
  }

  resetStates() {
    this.states.clear();
    this.appliedRead.clear();
    this.usedActions.clear();
    this.edges = [];
    this.truthSlots = [null, null, null];
    this.chapterCompleted = false;
    this.focusedId = null;
    this.hintIndex = 0;

    for (const n of this.level.nodes) {
      this.states.set(n.id, "hidden");
    }
    for (const id of this.level.startNodeIds) {
      this.states.set(id, "new");
    }
    const tid = this.level.truthAssembly?.truthNodeId;
    if (tid) this.states.set(tid, "hidden");
    this.checkTruthAppear();
  }

  getNode(id) {
    return this.level.nodes.find((n) => n.id === id) ?? null;
  }

  isVisible(id) {
    return this.states.get(id) !== "hidden";
  }

  reveal(id, fromId, markNewEdge = false) {
    if (this.states.get(id) === "hidden") {
      this.states.set(id, "new");
      if (fromId) {
        this.edges.push({ from: fromId, to: id, isNew: markNewEdge });
      }
    }
    this.checkTruthAppear();
  }

  checkTruthAppear() {
    const t = this.level.truthAssembly;
    if (!t) return;
    const ready = t.appearWhenAllDiscovered.every((id) => this.isVisible(id));
    if (ready && this.states.get(t.truthNodeId) === "hidden") {
      this.states.set(t.truthNodeId, "new");
    }
  }

  /**
   * @param {string} nodeId
   */
  openDetail(nodeId) {
    const n = this.getNode(nodeId);
    if (!n || !this.isVisible(nodeId)) return { node: null };

    this.focusedId = nodeId;

    if (!this.appliedRead.has(nodeId)) {
      this.appliedRead.add(nodeId);
      const unlocks = n.readUnlocks ?? [];
      for (const uid of unlocks) {
        this.reveal(uid, nodeId, true);
      }
    }
    if (this.states.get(nodeId) === "new") {
      this.states.set(nodeId, "read");
    }

    return { node: n };
  }

  clearFocus() {
    this.focusedId = null;
  }

  /**
   * @param {string} nodeId
   * @param {string} actionId
   */
  runAction(nodeId, actionId) {
    const n = this.getNode(nodeId);
    if (!n?.actions) return { ok: false, message: "" };
    const key = `${nodeId}:${actionId}`;
    if (this.usedActions.has(key)) return { ok: false, message: "你已经做过这个操作了。" };

    const act = n.actions.find((a) => a.id === actionId);
    if (!act) return { ok: false, message: "" };

    this.usedActions.add(key);
    for (const uid of act.unlockIds ?? []) {
      this.reveal(uid, nodeId, true);
    }
    this.checkTruthAppear();
    return { ok: true, toast: act.toast ?? "" };
  }

  tryCollectForRule(idA, idB) {
    if (idA === idB) return { collected: false };
    if (!this.isVisible(idA) || !this.isVisible(idB)) return { collected: false };
    const na = this.getNode(idA);
    const nb = this.getNode(idB);
    if (na?.type === "truth" || nb?.type === "truth") {
      return { collected: false };
    }

    const allCombos = this.level.combinations ?? [];

    for (const rule of allCombos) {
      if (rule.ids.length <= 2) continue;
      const ruleIds = new Set(rule.ids);
      
      if (ruleIds.has(idA) && ruleIds.has(idB)) {
        if (this.isVisible(rule.resultId)) continue;

        const newlyCollected = new Set(this.collectingForRule);
        newlyCollected.add(idA);
        newlyCollected.add(idB);

        let allCollected = true;
        for (const rid of rule.ids) {
          if (!newlyCollected.has(rid)) {
            allCollected = false;
            break;
          }
        }

        if (allCollected) {
          this.collectingForRule.clear();
          this.reveal(rule.resultId, null, true);
          for (const sid of rule.ids) {
            this.edges.push({ from: sid, to: rule.resultId, isNew: true });
          }
          this.checkTruthAppear();
          return { collected: true, ok: true, resultId: rule.resultId, toast: rule.toast ?? "推理成功。" };
        } else {
          this.collectingForRule = newlyCollected;
          const remaining = rule.ids.filter((x) => !newlyCollected.has(x));
          return { collected: true, ok: false, partial: true, remainingCount: remaining.length };
        }
      }
    }

    return { collected: false };
  }

  /**
   * @param {string} idA
   * @param {string} idB
   */
  tryCombinePair(idA, idB) {
    if (idA === idB) return { ok: false, message: "" };
    if (!this.isVisible(idA) || !this.isVisible(idB)) return { ok: false, message: "" };
    const na = this.getNode(idA);
    const nb = this.getNode(idB);
    if (na?.type === "truth" || nb?.type === "truth") {
      return { ok: false, message: "两者之间似乎没有什么关联……" };
    }

    const multi = this.tryCollectForRule(idA, idB);
    if (multi.collected) {
      if (multi.ok) {
        return { ok: true, resultId: multi.resultId, toast: multi.toast };
      } else if (multi.partial) {
        return { ok: false, message: `还需要 ${multi.remainingCount} 个线索才能完成这个组合……` };
      }
    }

    const pair = sortIds([idA, idB]);
    const rule = (this.level.combinations ?? []).find((c) => {
      if (c.ids.length !== 2) return false;
      return setsEqual(sortIds(c.ids), pair);
    });
    if (!rule) {
      this.collectingForRule.clear();
      return { ok: false, message: "两者之间似乎没有什么关联……" };
    }
    const resultId = rule.resultId;
    if (this.isVisible(resultId)) {
      return { ok: false, message: "你已经得出过这条结论" };
    }
    this.collectingForRule.clear();
    this.reveal(resultId, null, true);
    for (const sid of rule.ids) {
      this.edges.push({ from: sid, to: resultId, isNew: true });
    }
    this.checkTruthAppear();
    return { ok: true, resultId, toast: rule.toast ?? "推理成功" };
  }

  openTruthModal() {
    const t = this.level.truthAssembly;
    if (!t) return false;
    if (!this.isVisible(t.truthNodeId)) return false;
    this.truthSlots = [null, null, null];
    return true;
  }

  /** 从列表点选：填入第一个空槽 */
  addTruthFromList(nodeId) {
    const t = this.level.truthAssembly;
    if (!t?.requiredIds.includes(nodeId)) return;
    const idx = this.truthSlots.findIndex((x) => x === null);
    if (idx < 0) return;
    for (let i = 0; i < 3; i++) {
      if (this.truthSlots[i] === nodeId) this.truthSlots[i] = null;
    }
    this.truthSlots[idx] = nodeId;
  }

  verifyTruth() {
    const t = this.level.truthAssembly;
    if (!t) return { ok: false, message: "" };
    const filled = this.truthSlots.filter(Boolean);
    if (filled.length < 3) return { ok: false, message: "请凑齐三个核心结论" };
    if (setsEqual(sortIds(filled), sortIds(t.requiredIds))) {
      this.chapterCompleted = true;
      this.states.set(t.truthNodeId, "read");
      return { ok: true, epilogue: t.epilogue };
    }
    return { ok: false, message: "三项核心结论缺一不可，再检查一遍。" };
  }

  nextHint() {
    const hints = this.level.hints ?? [];
    if (!hints.length) return "暂无提示";
    const h = hints[this.hintIndex % hints.length];
    this.hintIndex++;
    return h;
  }

  progressText() {
    const total = this.level.nodes.length;
    const vis = [...this.states.values()].filter((s) => s !== "hidden").length;
    return `已发现 ${vis} / ${total} 个节点`;
  }

  consumeNewEdges() {
    for (const e of this.edges) e.isNew = false;
  }
}
