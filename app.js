const STORAGE_KEY = "study-deck-state-v7";
const todayKey = getLocalDateKey();
const now = () => Date.now();
const minuteMs = 60 * 1000;
const dayMs = 24 * 60 * minuteMs;

const schedulerDefaults = {
  learningStepsMinutes: [1, 10],
  relearningStepsMinutes: [10],
  graduatingInterval: 1,
  easyInterval: 4,
  hardFactor: 1.2,
  easyBonus: 1.3,
  intervalModifier: 1,
  minimumEase: 1.3,
};

const defaultUsers = [
  { id: "user-a", name: "使用者 A" },
  { id: "user-b", name: "使用者 B" },
];

const seedDictionary = {
  "食べる": {
    type: "word",
    partOfSpeech: "他動 G2",
    reading: "たべる",
    translations: ["吃", "食用", "生活；維生"],
    examples: [
      { ja: "朝ごはんを食べる。", zh: "吃早餐。" },
      { ja: "新鮮な魚を食べる。", zh: "吃新鮮的魚。" },
      { ja: "この仕事で食べている。", zh: "靠這份工作維生。" },
    ],
  },
  "見る": {
    type: "word",
    partOfSpeech: "他動 G2",
    reading: "みる",
    translations: ["看", "觀看", "確認；查看"],
    examples: [
      { ja: "空を見る。", zh: "看天空。" },
      { ja: "週末に映画を見る。", zh: "週末看電影。" },
      { ja: "予定を見る。", zh: "查看行程。" },
    ],
  },
  "見える": {
    type: "word",
    partOfSpeech: "自動 G2",
    reading: "みえる",
    translations: ["看得見", "似乎；看起來", "來；光臨"],
    examples: [
      { ja: "山が見える。", zh: "看得見山。" },
      { ja: "彼は疲れているように見える。", zh: "他看起來很累。" },
      { ja: "先生がお見えになりました。", zh: "老師來了。" },
    ],
  },
  "行く": {
    type: "word",
    partOfSpeech: "自動 G1",
    reading: "いく",
    translations: ["去", "前往", "進行；進展"],
    examples: [{ ja: "明日、学校へ行く。", zh: "明天去學校。" }],
  },
  "〜てもいい": {
    type: "grammar",
    partOfSpeech: "文法",
    reading: "てもいい",
    translations: ["可以……", "做……也可以", "允許……"],
    examples: [{ ja: "ここで写真を撮ってもいいですか。", zh: "可以在這裡拍照嗎？" }],
  },
  "〜なければならない": {
    type: "grammar",
    partOfSpeech: "文法",
    reading: "なければならない",
    translations: ["必須……", "不得不……", "一定要……"],
    examples: [{ ja: "宿題をしなければならない。", zh: "必須寫作業。" }],
  },
};

const mockLexiconEntries = Object.entries(seedDictionary).map(([term, data], index) => ({
  id: `mock-${index + 1}`,
  source: data.type === "grammar" ? "Local Grammar Seed" : "Mock JMdict",
  sourceId: data.type === "grammar" ? `grammar-${index + 1}` : `jmdict-${1000 + index}`,
  expression: term,
  reading: data.reading,
  type: data.type,
  partOfSpeech: data.partOfSpeech,
  senses: data.translations.map((translation, senseIndex) => ({
    order: senseIndex + 1,
    zhTw: translation,
    reviewed: senseIndex === 0,
  })),
  examples: data.examples.map((example, exampleIndex) => ({
    senseOrder: exampleIndex + 1,
    ja: example.ja,
    zhTw: example.zh,
    source: "Mock Tatoeba",
    reviewed: false,
  })),
}));

const initialState = {
  activeUserId: "user-a",
  users: structuredClone(defaultUsers),
  currentModule: "generic",
  tags: createDefaultTags(defaultUsers),
  cards: createDemoCards("user-a"),
  settings: {
    newLimit: 20,
    reviewLimit: 80,
    scheduler: schedulerDefaults,
  },
  notes: "",
  notesByUser: {
    "user-a": "",
    "user-b": "",
  },
  progress: {
    date: todayKey,
    newDone: 0,
    reviewDone: 0,
  },
  progressByUser: {
    "user-a": { date: todayKey, newDone: 0, reviewDone: 0 },
    "user-b": { date: todayKey, newDone: 0, reviewDone: 0 },
  },
};

function createDefaultTags(users) {
  return users.flatMap((user) => [
    { id: `${user.id}-generic-uncategorized`, name: "無分類", module: "generic", userId: user.id, system: true },
    { id: `${user.id}-nihongo-uncategorized`, name: "無分類", module: "nihongo", userId: user.id, system: true },
    { id: `${user.id}-words`, name: "單字", module: "nihongo", userId: user.id },
    { id: `${user.id}-grammar`, name: "文法", module: "nihongo", userId: user.id },
  ]);
}

function createDemoCards(userId = "user-a") {
  return ["食べる", "見る", "見える"].flatMap((term) => {
    const data = seedDictionary[term];
    return buildGeneratedCards({
      userId,
      term,
      module: "nihongo",
      type: data.type,
      partOfSpeech: data.partOfSpeech,
      tagIds: [`${userId}-words`],
      reading: data.reading,
      translations: data.translations,
      examples: data.examples,
    });
  });
}

let state = loadState();
let currentView = "review";
let activeReviewCardId = null;
let answerVisible = false;
let editingCardId = null;
let pendingDeleteCardId = null;
let isLoggedIn = false;
let loginEditMode = false;
let loginHelpVisible = false;
let renamingUserId = null;

const els = {
  loginScreen: document.querySelector("#loginScreen"),
  appShell: document.querySelector("#appShell"),
  loginEditBtn: document.querySelector("#loginEditBtn"),
  loginHelpBtn: document.querySelector("#loginHelpBtn"),
  loginTitle: document.querySelector("#loginTitle"),
  profileGrid: document.querySelector("#profileGrid"),
  loginUserForm: document.querySelector("#loginUserForm"),
  loginUserNameInput: document.querySelector("#loginUserNameInput"),
  loginHelpPanel: document.querySelector("#loginHelpPanel"),
  dailyMax: document.querySelector("#dailyMax"),
  newCount: document.querySelector("#newCount"),
  reviewCount: document.querySelector("#reviewCount"),
  viewEyebrow: document.querySelector("#viewEyebrow"),
  viewTitle: document.querySelector("#viewTitle"),
  brandMark: document.querySelector("#brandMark"),
  brandTitle: document.querySelector("#brandTitle"),
  brandSubtitle: document.querySelector("#brandSubtitle"),
  moduleSelect: document.querySelector("#moduleSelect"),
  showLoginBtn: document.querySelector("#showLoginBtn"),
  navItems: document.querySelectorAll(".nav-item"),
  entryForm: document.querySelector("#entryForm"),
  entryType: document.querySelector("#entryType"),
  partOfSpeechSelect: document.querySelector("#partOfSpeechSelect"),
  tagPicker: document.querySelector("#tagPicker"),
  frontInput: document.querySelector("#frontInput"),
  backInput: document.querySelector("#backInput"),
  termInput: document.querySelector("#termInput"),
  readingInput: document.querySelector("#readingInput"),
  translationsInput: document.querySelector("#translationsInput"),
  examplesInput: document.querySelector("#examplesInput"),
  lookupBtn: document.querySelector("#lookupBtn"),
  candidateList: document.querySelector("#candidateList"),
  previewList: document.querySelector("#previewList"),
  previewStatus: document.querySelector("#previewStatus"),
  reviewCard: document.querySelector("#reviewCard"),
  newRemaining: document.querySelector("#newRemaining"),
  learningRemaining: document.querySelector("#learningRemaining"),
  reviewRemaining: document.querySelector("#reviewRemaining"),
  relearningRemaining: document.querySelector("#relearningRemaining"),
  needsReviewCount: document.querySelector("#needsReviewCount"),
  cardSearch: document.querySelector("#cardSearch"),
  cardTagFilter: document.querySelector("#cardTagFilter"),
  cardStatusFilter: document.querySelector("#cardStatusFilter"),
  cardTable: document.querySelector("#cardTable"),
  deckForm: document.querySelector("#deckForm"),
  deckNameInput: document.querySelector("#deckNameInput"),
  deckList: document.querySelector("#deckList"),
  notesInput: document.querySelector("#notesInput"),
  clearNotesBtn: document.querySelector("#clearNotesBtn"),
  newLimitInput: document.querySelector("#newLimitInput"),
  reviewLimitInput: document.querySelector("#reviewLimitInput"),
  resetDemoBtn: document.querySelector("#resetDemoBtn"),
  activeUserLabel: document.querySelector("#activeUserLabel"),
  userForm: document.querySelector("#userForm"),
  userNameInput: document.querySelector("#userNameInput"),
  userList: document.querySelector("#userList"),
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(initialState);
  try {
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return structuredClone(initialState);
  }
}

function normalizeState(input) {
  const rawCards = input.cards || [];
  const rawTags = input.tags || input.decks || initialState.tags;
  const users = normalizeUsers(input.users);
  const activeUserId = users.some((user) => user.id === input.activeUserId) ? input.activeUserId : users[0].id;
  const notesByUser = normalizeNotesByUser(input, users, activeUserId);
  const progressByUser = normalizeProgressByUser(input, users, activeUserId);
  const merged = {
    ...structuredClone(initialState),
    ...input,
    activeUserId,
    users,
    currentModule: input.currentModule || initialState.currentModule,
    tags: normalizeTags(rawTags, rawCards, users, activeUserId, input.currentModule || initialState.currentModule),
    notes: notesByUser[activeUserId] || "",
    notesByUser,
    settings: {
      ...initialState.settings,
      ...(input.settings || {}),
      scheduler: {
        ...schedulerDefaults,
        ...((input.settings || {}).scheduler || {}),
      },
    },
    progress: getUserProgress(progressByUser, activeUserId),
    progressByUser,
  };
  merged.cards = (merged.cards || []).map((card) => {
    const userId = users.some((user) => user.id === card.userId) ? card.userId : activeUserId;
    const module = card.module || "nihongo";
    const tagIds = normalizeCardTagIds(card.tagIds || (card.deckId ? [card.deckId] : []), module, userId, merged.tags);
    return {
      ...card,
      userId,
      module,
      tagIds,
      queue: card.queue || (card.reps > 0 ? "review" : "new"),
      learningStep: Number.isFinite(card.learningStep) ? card.learningStep : 0,
      dueAt: card.dueAt || dateKeyToTimestamp(card.due || todayKey),
    };
  });
  if (merged.progress.date !== todayKey) {
    merged.progress = { date: todayKey, newDone: 0, reviewDone: 0 };
    merged.progressByUser[activeUserId] = merged.progress;
  }
  return merged;
}

function normalizeUsers(users) {
  const seen = new Set();
  const normalized = [...defaultUsers, ...(users || [])]
    .filter((user) => user && user.id && user.name)
    .filter((user) => {
      if (seen.has(user.id)) return false;
      seen.add(user.id);
      return true;
    })
    .map((user) => ({ id: user.id, name: user.name }));
  return normalized.length ? normalized : structuredClone(defaultUsers);
}

function normalizeNotesByUser(input, users, activeUserId) {
  const notesByUser = { ...(input.notesByUser || {}) };
  if (input.notes && !notesByUser[activeUserId]) notesByUser[activeUserId] = input.notes;
  users.forEach((user) => {
    if (notesByUser[user.id] == null) notesByUser[user.id] = "";
  });
  return notesByUser;
}

function normalizeProgressByUser(input, users, activeUserId) {
  const progressByUser = { ...(input.progressByUser || {}) };
  if (input.progress && !progressByUser[activeUserId]) progressByUser[activeUserId] = input.progress;
  users.forEach((user) => {
    progressByUser[user.id] = getUserProgress(progressByUser, user.id);
  });
  return progressByUser;
}

function getUserProgress(progressByUser, userId) {
  const progress = { ...initialState.progress, ...(progressByUser?.[userId] || {}) };
  return progress.date === todayKey ? progress : { date: todayKey, newDone: 0, reviewDone: 0 };
}

function normalizeTags(tags, cards, users, activeUserId, fallbackModule) {
  const baseTags = createDefaultTags(users);
  const seen = new Set(baseTags.map((tag) => tag.id));
  const normalized = [...baseTags];
  (tags || []).forEach((tag) => {
    if (!tag || tag.id === "uncategorized") return;
    const userId = users.some((user) => user.id === tag.userId) ? tag.userId : inferTagUser(tag.id, cards, activeUserId);
    const module = tag.module || inferTagModule(tag.id, cards, fallbackModule);
    const id = normalizeLegacyTagId(tag.id, userId);
    if (seen.has(id)) return;
    normalized.push({ ...tag, id, module, userId });
    seen.add(id);
  });
  return normalized;
}

function inferTagUser(tagId, cards, fallbackUserId = "user-a") {
  const counts = new Map();
  (cards || []).forEach((card) => {
    if ((card.tagIds || (card.deckId ? [card.deckId] : [])).includes(tagId)) {
      const userId = card.userId || fallbackUserId;
      counts.set(userId, (counts.get(userId) || 0) + 1);
    }
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || fallbackUserId;
}

function normalizeLegacyTagId(tagId, userId) {
  if (tagId === "generic-uncategorized") return `${userId}-generic-uncategorized`;
  if (tagId === "nihongo-uncategorized") return `${userId}-nihongo-uncategorized`;
  if (tagId === "words") return `${userId}-words`;
  if (tagId === "grammar") return `${userId}-grammar`;
  return tagId;
}

function inferTagModule(tagId, cards, fallbackModule = "generic") {
  const counts = { generic: 0, nihongo: 0 };
  (cards || []).forEach((card) => {
    if ((card.tagIds || (card.deckId ? [card.deckId] : [])).includes(tagId)) {
      counts[card.module || "nihongo"] += 1;
    }
  });
  if (counts.nihongo > counts.generic) return "nihongo";
  if (counts.generic > counts.nihongo) return "generic";
  return fallbackModule || "generic";
}

function normalizeCardTagIds(tagIds, module, userId, tags) {
  const defaultTagId = getDefaultTagId(module, userId);
  const nextIds = (tagIds || [])
    .map((tagId) => (tagId === "uncategorized" ? defaultTagId : tagId))
    .map((tagId) => normalizeLegacyTagId(tagId, userId))
    .filter((tagId) => tags.some((tag) => tag.id === tagId && tag.module === module && tag.userId === userId));
  return nextIds.length ? [...new Set(nextIds)] : [defaultTagId];
}

function saveState() {
  state.progressByUser[state.activeUserId] = state.progress;
  state.notesByUser[state.activeUserId] = state.notes;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyToTimestamp(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

function timestampToDateKey(timestamp) {
  return getLocalDateKey(new Date(timestamp));
}

function addMinutes(minutes) {
  return now() + minutes * minuteMs;
}

function addDaysTimestamp(days) {
  return now() + days * dayMs;
}

function parseLines(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseExamples(value) {
  return parseLines(value).map((line) => {
    const [ja, zh = ""] = line.split("｜").map((part) => part.trim());
    return { ja, zh };
  });
}

function formatMeaningExamples(translations, examples, partOfSpeech = "") {
  const meanings = translations.length ? translations : ["待補中文解釋"];
  return meanings
    .map((meaning, index) => {
      const example = examples[index] || {};
      const exampleLine = example.ja || example.zh || "例句待補";
      const label = partOfSpeech ? `${partOfSpeech} ${meaning}` : meaning;
      return `${label}\n${exampleLine}`;
    })
    .join("\n");
}

function getEntryData() {
  if (state.currentModule === "generic") {
    return {
      userId: state.activeUserId,
      module: "generic",
      type: "custom",
      tagIds: [getDefaultTagId("generic", state.activeUserId)],
      front: els.frontInput.value.trim(),
      back: els.backInput.value.trim(),
    };
  }
  const term = els.termInput.value.trim();
  const lookup = findLexiconCandidates(term)[0];
  const type = els.entryType.value;
  const partOfSpeech = els.partOfSpeechSelect.value;
  const reading = els.readingInput.value.trim() || lookup?.reading || "";
  const translations = parseLines(els.translationsInput.value || "").length
    ? parseLines(els.translationsInput.value)
    : lookup?.senses.map((sense) => sense.zhTw) || [];
  const examples = parseExamples(els.examplesInput.value || "").length
    ? parseExamples(els.examplesInput.value)
    : lookup?.examples.map((example) => ({ ja: example.ja, zh: example.zhTw })) || [];
  return {
    userId: state.activeUserId,
    term,
    module: "nihongo",
    type,
    partOfSpeech,
    tagIds: getSelectedTagIds(),
    reading,
    translations,
    examples,
  };
}

function buildGeneratedCards(entry) {
  if (entry.module === "generic") return buildGenericCard(entry);
  if (!entry.term) return [];
  const entryId = id("entry");
  const typeLabel = entry.type === "grammar" ? "文法" : "單字";
  const meaningExamples = formatMeaningExamples(entry.translations, entry.examples, entry.partOfSpeech);
  const japaneseFront = [entry.term, entry.reading].filter(Boolean).join("\n");

  const cards = [
    {
      template: `${typeLabel} 日文→中文`,
      front: japaneseFront,
      back: meaningExamples,
    },
    {
      template: `${typeLabel} 中文→日文`,
      front: meaningExamples,
      back: entry.term,
    },
  ];

  return cards.map((card) => ({
    id: id("card"),
    entryId,
    userId: entry.userId || state.activeUserId,
    tagIds: entry.tagIds.length ? entry.tagIds : [getDefaultTagId("nihongo", entry.userId || state.activeUserId)],
    module: "nihongo",
    type: entry.type,
    partOfSpeech: entry.partOfSpeech,
    term: entry.term,
    reading: entry.reading,
    status: "needs-review",
    createdAt: new Date().toISOString(),
    due: todayKey,
    dueAt: now(),
    queue: "new",
    learningStep: 0,
    interval: 0,
    ease: 2.5,
    lapses: 0,
    reps: 0,
    ...card,
  }));
}

function buildGenericCard(entry) {
  if (!entry.front || !entry.back) return [];
  return [
    {
      id: id("card"),
      entryId: id("entry"),
      userId: entry.userId || state.activeUserId,
      tagIds: entry.tagIds.length ? entry.tagIds : [getDefaultTagId("generic", entry.userId || state.activeUserId)],
      module: "generic",
      type: "custom",
      partOfSpeech: "",
      term: entry.front,
      reading: "",
      status: "needs-review",
      createdAt: new Date().toISOString(),
      due: todayKey,
      dueAt: now(),
      queue: "new",
      learningStep: 0,
      interval: 0,
      ease: 2.5,
      lapses: 0,
      reps: 0,
      template: "自訂",
      front: entry.front,
      back: entry.back,
    },
  ];
}

function applyLookup() {
  if (state.currentModule !== "nihongo") return;
  const term = els.termInput.value.trim();
  els.previewStatus.textContent = "查詢中...";
  lookupLexiconCandidates(term).then((candidates) => {
    if (!candidates.length) {
      els.previewStatus.textContent = "查無候選資料";
      renderCandidates([]);
      renderPreview();
      return;
    }
    renderCandidates(candidates);
    applyLexiconEntry(candidates[0]);
  });
}

async function lookupLexiconCandidates(term) {
  const localCandidates = findLexiconCandidates(term);
  try {
    const response = await fetch(`/api/jisho?keyword=${encodeURIComponent(term)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const onlineCandidates = mapJishoPayload(payload);
    return mergeCandidates(onlineCandidates, localCandidates);
  } catch {
    return localCandidates;
  }
}

function mergeCandidates(primary, fallback) {
  const seen = new Set();
  return [...primary, ...fallback].filter((entry) => {
    const key = `${entry.expression}:${entry.reading}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapJishoPayload(payload) {
  return (payload.data || []).slice(0, 5).map((item, index) => {
    const japanese = item.japanese?.find((entry) => entry.word) || item.japanese?.[0] || {};
    const senses = (item.senses || []).slice(0, 5).map((sense, senseIndex) => ({
      order: senseIndex + 1,
      zhTw: (sense.english_definitions || []).join("; "),
      reviewed: false,
      partsOfSpeech: sense.parts_of_speech || [],
    }));
    return {
      id: `jisho-${index}-${item.slug || japanese.word || japanese.reading}`,
      source: "Jisho API",
      sourceId: item.slug || `result-${index + 1}`,
      expression: japanese.word || japanese.reading || item.slug || "",
      reading: japanese.reading || "",
      type: inferTypeFromSenses(item.senses || []),
      partOfSpeech: inferPartOfSpeech(item.senses || []),
      senses,
      examples: senses.map((sense) => ({
        senseOrder: sense.order,
        ja: "例句待補",
        zhTw: "",
        source: "pending",
        reviewed: false,
      })),
    };
  }).filter((entry) => entry.expression);
}

function inferTypeFromSenses(senses) {
  return senses.some((sense) => (sense.parts_of_speech || []).some((pos) => pos.toLowerCase().includes("expression")))
    ? "grammar"
    : "word";
}

function inferPartOfSpeech(senses) {
  const posText = senses.flatMap((sense) => sense.parts_of_speech || []).join(" ").toLowerCase();
  const isIntransitive = posText.includes("intransitive");
  const isTransitive = posText.includes("transitive") && !isIntransitive;
  const isIchidan = posText.includes("ichidan");
  const isGodan = posText.includes("godan");
  const isSuru = posText.includes("suru") || posText.includes("kuru");
  if (isTransitive) return `他動 ${isSuru ? "G3" : isIchidan ? "G2" : isGodan ? "G1" : "G1"}`;
  if (isIntransitive) return `自動 ${isSuru ? "G3" : isIchidan ? "G2" : isGodan ? "G1" : "G1"}`;
  if (posText.includes("i-adjective")) return "い形容詞";
  if (posText.includes("na-adjective")) return "な形容詞";
  if (posText.includes("adverb")) return "副詞";
  if (posText.includes("noun")) return "名詞";
  if (posText.includes("particle")) return "助詞";
  if (posText.includes("expression")) return "文法";
  return "名詞";
}

function findLexiconCandidates(term) {
  const query = term.trim();
  if (!query) return [];
  return mockLexiconEntries.filter((entry) => {
    return entry.expression.includes(query) || entry.reading.includes(query) || query.includes(entry.expression);
  });
}

function applyLexiconEntry(entry) {
  els.entryType.value = entry.type;
  els.partOfSpeechSelect.value = entry.partOfSpeech || (entry.type === "grammar" ? "文法" : "名詞");
  els.termInput.value = entry.expression;
  els.readingInput.value = entry.reading;
  els.translationsInput.value = entry.senses.map((sense) => sense.zhTw).join("\n");
  els.examplesInput.value = entry.senses
    .map((sense) => {
      const example = entry.examples.find((item) => item.senseOrder === sense.order) || entry.examples[sense.order - 1];
      return example ? `${example.ja}｜${example.zhTw}` : "";
    })
    .filter(Boolean)
    .join("\n");
  els.previewStatus.textContent = `已套用 ${entry.source}`;
  renderPreview();
}

function renderCandidates(candidates) {
  if (state.currentModule !== "nihongo") {
    els.candidateList.innerHTML = "";
    return;
  }
  els.candidateList.innerHTML = candidates.length
    ? `
      <div class="candidate-head">
        <strong>資料庫候選</strong>
        <span>${candidates.length} 筆</span>
      </div>
      ${candidates.map(candidateRow).join("")}
    `
    : "";
}

function candidateRow(entry) {
  const senses = entry.senses.map((sense) => sense.zhTw).join(" / ");
  return `
    <button class="candidate-item" type="button" data-candidate-id="${entry.id}">
      <span>
        <strong>${escapeHtml(entry.expression)}</strong>
        <small>${escapeHtml(entry.reading)} · ${escapeHtml(entry.partOfSpeech)}</small>
      </span>
      <span>
        <small>${escapeHtml(entry.source)} · ${escapeHtml(entry.sourceId)}</small>
        <em>${escapeHtml(senses)}</em>
      </span>
    </button>
  `;
}

function renderPreview() {
  const cards = buildGeneratedCards(getEntryData());
  els.previewList.innerHTML = "";
  els.previewStatus.textContent = cards.length ? `${cards.length} 張，皆標注待檢查` : "等待輸入";
  cards.forEach((card) => {
    const item = document.createElement("article");
    item.className = "mini-card";
    item.innerHTML = `
      <span class="pill warn">待檢查</span>
      <h4>${escapeHtml(card.template)}：${escapeHtml(card.front)}</h4>
      <p>${escapeHtml(card.back).replaceAll("\n", "<br>")}</p>
    `;
    els.previewList.appendChild(item);
  });
}

function getSelectedTagIds() {
  return Array.from(els.tagPicker.querySelectorAll("input:checked")).map((input) => input.value);
}

function renderTagOptions() {
  const previousTagIds = getSelectedTagIds();
  const moduleTags = getCurrentModuleTags();
  const wordsTagId = `${state.activeUserId}-words`;
  const defaultTagId = state.currentModule === "nihongo" && moduleTags.some((tag) => tag.id === wordsTagId)
    ? wordsTagId
    : getDefaultTagId(state.currentModule, state.activeUserId);
  const selectedTagIds = previousTagIds.filter((tagId) => moduleTags.some((tag) => tag.id === tagId));
  const activeTagIds = selectedTagIds.length ? selectedTagIds : [defaultTagId];
  els.tagPicker.innerHTML = moduleTags
    .map((tag) => {
      const checked = activeTagIds.includes(tag.id) ? "checked" : "";
      return `
        <label>
          <input type="checkbox" value="${tag.id}" ${checked} />
          ${escapeHtml(tag.name)}
        </label>
      `;
    })
    .join("");
  const tagOptions = moduleTags.map((tag) => `<option value="${tag.id}">${escapeHtml(tag.name)}</option>`).join("");
  els.cardTagFilter.innerHTML = `<option value="all">全部 Tag</option>${tagOptions}`;
}

function renderStats() {
  const rawDueCards = getRawDueCards();
  const dueCards = getDueCards();
  const rawNewDue = rawDueCards.filter((card) => card.queue === "new").length;
  const rawLearningDue = rawDueCards.filter((card) => card.queue === "learning").length;
  const rawReviewDue = rawDueCards.filter((card) => card.queue === "review").length;
  const rawRelearningDue = rawDueCards.filter((card) => card.queue === "relearning").length;
  const newDue = dueCards.filter((card) => card.queue === "new").length;
  const reviewDue = dueCards.filter((card) => card.queue === "review").length;
  els.dailyMax.textContent = String(rawDueCards.length);
  els.newCount.textContent = String(rawNewDue);
  els.reviewCount.textContent = String(rawLearningDue + rawReviewDue + rawRelearningDue);
  els.newRemaining.textContent = `${newDue} / ${rawNewDue}`;
  els.learningRemaining.textContent = String(rawLearningDue);
  els.reviewRemaining.textContent = `${reviewDue} / ${rawReviewDue}`;
  els.relearningRemaining.textContent = String(rawRelearningDue);
  els.needsReviewCount.textContent = String(state.cards.filter((card) => card.userId === state.activeUserId && card.status === "needs-review").length);
}

function getRawDueCards() {
  const currentTime = now();
  return state.cards
    .filter((card) => card.userId === state.activeUserId)
    .filter((card) => card.module === state.currentModule)
    .filter((card) => getCardDueAt(card) <= currentTime)
    .sort((a, b) => getQueuePriority(a) - getQueuePriority(b) || getCardDueAt(a) - getCardDueAt(b) || a.createdAt.localeCompare(b.createdAt));
}

function getDueCards() {
  return getRawDueCards()
    .filter((card) => {
      if (card.queue === "new") return state.progress.newDone < state.settings.newLimit;
      if (card.queue === "review") return state.progress.reviewDone < state.settings.reviewLimit;
      return true;
    });
}

function getCardDueAt(card) {
  return card.dueAt || dateKeyToTimestamp(card.due || todayKey);
}

function getQueuePriority(card) {
  return {
    learning: 0,
    relearning: 1,
    review: 2,
    new: 3,
  }[card.queue || "new"] ?? 4;
}

function getQueueLabel(queue) {
  return {
    new: "新卡",
    learning: "學習中",
    review: "複習",
    relearning: "重新學習",
  }[queue || "new"] || "新卡";
}

function formatDueTime(card) {
  const timestamp = getCardDueAt(card);
  const dateKey = timestampToDateKey(timestamp);
  if (dateKey !== todayKey) return dateKey;
  return new Date(timestamp).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

function renderReview() {
  const card = activeReviewCardId
    ? state.cards.find((item) => item.id === activeReviewCardId)
    : getDueCards()[0];
  activeReviewCardId = card?.id || null;

  if (!card) {
    els.reviewCard.innerHTML = `<p class="muted">今天沒有到期卡片，或已達每日上限。</p>`;
    renderStats();
    return;
  }

  const tagText = getTagNames(card.tagIds).join(", ") || "無分類";
  const cardMeta = [getQueueLabel(card.queue), tagText, card.partOfSpeech, getModuleLabel(card.module)].filter(Boolean).join(" · ");
  els.reviewCard.innerHTML = `
    <div class="review-front">
      <span class="pill ${card.status === "needs-review" ? "warn" : ""}">${card.status === "needs-review" ? "待檢查" : "已確認"} · ${escapeHtml(cardMeta)}</span>
      <h3>${escapeHtml(card.front)}</h3>
      <p class="muted">${escapeHtml(card.template)}</p>
    </div>
    <div class="answer ${answerVisible ? "visible" : ""}">
      <p>${escapeHtml(card.back).replaceAll("\n", "<br>")}</p>
    </div>
    <div class="review-actions">
      ${
        answerVisible
          ? `<button class="ghost" data-grade="again">重來</button>
             <button class="ghost" data-grade="hard">困難</button>
             <button class="primary" data-grade="good">普通</button>
             <button class="primary" data-grade="easy">簡單</button>`
          : `<button class="primary" id="showAnswerBtn">顯示答案</button>`
      }
    </div>
  `;
}

function gradeCard(cardId, grade) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return;
  const previousQueue = card.queue || (card.reps > 0 ? "review" : "new");
  card.reps += 1;
  if (previousQueue === "new" || previousQueue === "learning") {
    gradeLearningCard(card, grade);
  } else if (previousQueue === "relearning") {
    gradeRelearningCard(card, grade);
  } else {
    gradeReviewCard(card, grade);
  }
  if (previousQueue === "new") state.progress.newDone += 1;
  if (previousQueue === "review") state.progress.reviewDone += 1;
  activeReviewCardId = null;
  answerVisible = false;
  saveAndRender();
}

function gradeLearningCard(card, grade) {
  const steps = state.settings.scheduler.learningStepsMinutes;
  const currentStep = card.queue === "learning" ? card.learningStep || 0 : -1;
  if (grade === "again") {
    card.queue = "learning";
    card.learningStep = 0;
    card.interval = 0;
    card.ease = Math.max(state.settings.scheduler.minimumEase, card.ease - 0.2);
    setCardDueInMinutes(card, steps[0] || 1);
    return;
  }
  if (grade === "easy") {
    graduateCard(card, state.settings.scheduler.easyInterval);
    card.ease += 0.15;
    return;
  }
  if (grade === "hard") {
    card.queue = "learning";
    card.learningStep = Math.max(0, currentStep);
    card.ease = Math.max(state.settings.scheduler.minimumEase, card.ease - 0.15);
    setCardDueInMinutes(card, Math.max(5, steps[card.learningStep] || steps[0] || 5));
    return;
  }
  const nextStep = currentStep + 1;
  if (nextStep < steps.length) {
    card.queue = "learning";
    card.learningStep = nextStep;
    setCardDueInMinutes(card, steps[nextStep]);
    return;
  }
  graduateCard(card, state.settings.scheduler.graduatingInterval);
}

function gradeRelearningCard(card, grade) {
  const steps = state.settings.scheduler.relearningStepsMinutes;
  if (grade === "again") {
    card.lapses += 1;
    card.ease = Math.max(state.settings.scheduler.minimumEase, card.ease - 0.2);
    card.queue = "relearning";
    card.learningStep = 0;
    setCardDueInMinutes(card, steps[0] || 10);
    return;
  }
  if (grade === "easy") {
    graduateCard(card, Math.max(1, card.interval));
    card.ease += 0.15;
    return;
  }
  if (grade === "hard") {
    card.ease = Math.max(state.settings.scheduler.minimumEase, card.ease - 0.15);
    card.queue = "relearning";
    card.learningStep = 0;
    setCardDueInMinutes(card, Math.max(5, steps[0] || 10));
    return;
  }
  graduateCard(card, Math.max(1, Math.ceil(card.interval * 0.5)));
}

function gradeReviewCard(card, grade) {
  if (grade === "again") {
    card.lapses += 1;
    card.ease = Math.max(state.settings.scheduler.minimumEase, card.ease - 0.2);
    card.interval = Math.max(1, Math.ceil(card.interval * 0.5));
    card.queue = "relearning";
    card.learningStep = 0;
    setCardDueInMinutes(card, state.settings.scheduler.relearningStepsMinutes[0] || 10);
    return;
  }
  if (grade === "hard") {
    card.interval = Math.max(1, Math.ceil(card.interval * state.settings.scheduler.hardFactor * state.settings.scheduler.intervalModifier));
    card.ease = Math.max(state.settings.scheduler.minimumEase, card.ease - 0.15);
    scheduleReviewCard(card);
    return;
  }
  if (grade === "easy") {
    card.interval = Math.max(1, Math.ceil(card.interval * card.ease * state.settings.scheduler.easyBonus * state.settings.scheduler.intervalModifier));
    card.ease += 0.15;
    scheduleReviewCard(card);
    return;
  }
  card.interval = Math.max(1, Math.ceil(card.interval * card.ease * state.settings.scheduler.intervalModifier));
  scheduleReviewCard(card);
}

function graduateCard(card, interval) {
  card.queue = "review";
  card.learningStep = 0;
  card.interval = Math.max(1, Math.ceil(interval));
  scheduleReviewCard(card);
}

function scheduleReviewCard(card) {
  card.queue = "review";
  card.dueAt = addDaysTimestamp(card.interval);
  card.due = timestampToDateKey(card.dueAt);
}

function setCardDueInMinutes(card, minutes) {
  card.dueAt = addMinutes(minutes);
  card.due = timestampToDateKey(card.dueAt);
}

function renderCards() {
  const search = els.cardSearch.value.trim().toLowerCase();
  const tagFilter = els.cardTagFilter.value;
  const statusFilter = els.cardStatusFilter.value;
  const cards = state.cards.filter((card) => {
    if (card.userId !== state.activeUserId || card.module !== state.currentModule) return false;
    const tagNames = getTagNames(card.tagIds);
    const haystack = [card.front, card.back, card.term, card.partOfSpeech || "", tagNames.join(" ")].join(" ").toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    const matchesTag = tagFilter === "all" || (card.tagIds || []).includes(tagFilter);
    const matchesStatus = statusFilter === "all" || card.status === statusFilter;
    return matchesSearch && matchesTag && matchesStatus;
  });
  els.cardTable.innerHTML = cards.length
    ? cards.map(cardRow).join("")
    : `<div class="card-row"><p class="muted">沒有符合條件的卡片。</p></div>`;
}

function cardRow(card) {
  const tagText = getTagNames(card.tagIds).join(", ") || "無分類";
  const cardMeta = [tagText, card.partOfSpeech, getModuleLabel(card.module), getQueueLabel(card.queue), `到期 ${formatDueTime(card)}`].filter(Boolean).join(" · ");
  if (editingCardId === card.id) {
    return `
      <article class="card-row editing" data-card-id="${card.id}">
        <div class="card-row-head">
          <div>
            <span class="pill warn">編輯中</span>
            <h4>${escapeHtml(card.template)}</h4>
          </div>
          <span class="muted">${escapeHtml(cardMeta)}</span>
        </div>
        <div class="edit-card-form">
          <label>
            <span>正面</span>
            <textarea data-edit-field="front" rows="4">${escapeHtml(card.front)}</textarea>
          </label>
          <label>
            <span>反面</span>
            <textarea data-edit-field="back" rows="6">${escapeHtml(card.back)}</textarea>
          </label>
        </div>
        <div class="row-actions">
          <button data-action="save-edit" type="button">儲存</button>
          <button data-action="cancel-edit" type="button">取消</button>
        </div>
      </article>
    `;
  }
  return `
    <article class="card-row" data-card-id="${card.id}">
      <div class="card-row-head">
        <div>
          <span class="pill ${card.status === "needs-review" ? "warn" : ""}">${card.status === "needs-review" ? "待檢查" : "已確認"}</span>
          <h4>${escapeHtml(card.front)}</h4>
        </div>
        <span class="muted">${escapeHtml(cardMeta)}</span>
      </div>
      <p>${escapeHtml(card.back).replaceAll("\n", "<br>")}</p>
      <div class="row-actions">
        ${
          pendingDeleteCardId === card.id
            ? `<button class="danger" data-action="confirm-delete">確認刪除</button>
               <button data-action="cancel-delete">取消</button>`
            : `<button data-action="approve">標為已檢查</button>
               <button data-action="edit">編輯</button>
               <button data-action="delete">刪除</button>`
        }
      </div>
    </article>
  `;
}

function getTagNames(tagIds = []) {
  return tagIds
    .map((tagId) => state.tags.find((tag) => tag.id === tagId)?.name)
    .filter(Boolean);
}

function renderDecks() {
  const moduleTags = getCurrentModuleTags();
  els.deckList.innerHTML = moduleTags
    .map((tag) => {
      const count = state.cards.filter((card) => card.userId === state.activeUserId && card.module === state.currentModule && (card.tagIds || []).includes(tag.id)).length;
      const canDelete = !tag.system;
      return `
        <div class="deck-item" data-tag-id="${tag.id}">
          <strong>${escapeHtml(tag.name)}</strong>
          <div class="deck-item-actions">
            <span class="muted">${count} 張卡片</span>
            ${canDelete ? `<button class="danger" data-action="delete-tag">刪除</button>` : ""}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderSettings() {
  els.newLimitInput.value = state.settings.newLimit;
  els.reviewLimitInput.value = state.settings.reviewLimit;
}

function renderUsers() {
  const activeUser = getActiveUser();
  els.activeUserLabel.textContent = activeUser.name;
  els.showLoginBtn.textContent = `${activeUser.name} · 切換`;
  els.userList.innerHTML = state.users
    .map((user) => {
      const cardCount = state.cards.filter((card) => card.userId === user.id).length;
      const tagCount = state.tags.filter((tag) => tag.userId === user.id && !tag.system).length;
      const isActive = user.id === state.activeUserId;
      const canDelete = state.users.length > 1;
      const isRenaming = renamingUserId === user.id;
      return `
        <div class="user-item" data-user-id="${user.id}">
          <div>
            ${
              isRenaming
                ? `<input class="user-rename-input" data-rename-input value="${escapeHtml(user.name)}" />`
                : `<strong>${escapeHtml(user.name)}</strong>`
            }
            <p class="muted">${cardCount} 張卡片 · ${tagCount} 個自訂 Tag</p>
          </div>
          <div class="user-item-actions">
            ${
              isRenaming
                ? `<button data-action="save-rename-user" type="button">儲存</button>
                   <button data-action="cancel-rename-user" type="button">取消</button>`
                : `${isActive ? `<span class="pill">目前</span>` : `<button data-action="switch-user" type="button">切換</button>`}
                   <button data-action="rename-user" type="button">更名</button>
                   ${canDelete ? `<button class="danger" data-action="delete-user" type="button">刪除</button>` : ""}`
            }
          </div>
        </div>
      `;
    })
    .join("");
}

function renderLogin() {
  els.loginScreen.hidden = isLoggedIn;
  els.appShell.hidden = !isLoggedIn;
  els.loginTitle.textContent = loginEditMode ? "管理使用者" : "誰要開始複習？";
  els.loginEditBtn.textContent = loginEditMode ? "完成" : "編輯使用者";
  els.loginHelpBtn.textContent = loginHelpVisible ? "關閉說明" : "使用說明";
  els.loginUserForm.hidden = !loginEditMode;
  els.loginHelpPanel.hidden = !loginHelpVisible;
  els.profileGrid.innerHTML = state.users.map(profileCard).join("");
}

function profileCard(user) {
  const cardCount = state.cards.filter((card) => card.userId === user.id).length;
  const isActive = user.id === state.activeUserId;
  const initial = user.name.trim().slice(0, 1) || "人";
  const isRenaming = renamingUserId === user.id;
  const profileContent = `
    <span class="profile-avatar">${escapeHtml(initial)}</span>
    ${
      isRenaming
        ? `<input class="user-rename-input" data-rename-input value="${escapeHtml(user.name)}" />`
        : `<strong>${escapeHtml(user.name)}</strong>`
    }
    <small>${cardCount} 張卡片</small>
  `;
  return `
    <article class="profile-card ${isActive ? "active" : ""}" data-user-id="${user.id}">
      ${
        loginEditMode
          ? `<div class="profile-card-button">${profileContent}</div>`
          : `<button class="profile-card-button" data-action="login-user" type="button">${profileContent}</button>`
      }
      ${
        loginEditMode
          ? `<div class="profile-edit-actions">
              ${
                isRenaming
                  ? `<button data-action="login-save-rename-user" type="button">儲存</button>
                     <button data-action="login-cancel-rename-user" type="button">取消</button>`
                  : `<button data-action="login-switch-user" type="button">${isActive ? "目前" : "切換"}</button>
                     <button data-action="login-rename-user" type="button">更名</button>
                     <button class="danger" data-action="login-delete-user" type="button">刪除</button>`
              }
            </div>`
          : ""
      }
    </article>
  `;
}

function enterApp(userId) {
  switchUser(userId, false);
  isLoggedIn = true;
  loginEditMode = false;
  loginHelpVisible = false;
  saveAndRender();
}

function renderNotes() {
  if (els.notesInput.value !== state.notes) {
    els.notesInput.value = state.notes;
  }
}

function getActiveUser() {
  return state.users.find((user) => user.id === state.activeUserId) || state.users[0];
}

function switchUser(userId, shouldRender = true) {
  if (userId === state.activeUserId || !state.users.some((user) => user.id === userId)) return;
  state.progressByUser[state.activeUserId] = state.progress;
  state.notesByUser[state.activeUserId] = state.notes;
  state.activeUserId = userId;
  state.progress = getUserProgress(state.progressByUser, userId);
  state.notes = state.notesByUser[userId] || "";
  activeReviewCardId = null;
  answerVisible = false;
  editingCardId = null;
  pendingDeleteCardId = null;
  if (shouldRender) saveAndRender();
}

function addUser(name) {
  const cleanName = name.trim();
  if (!cleanName) return;
  const user = { id: id("user"), name: cleanName };
  state.users.push(user);
  state.tags.push(...createDefaultTags([user]));
  state.notesByUser[user.id] = "";
  state.progressByUser[user.id] = { date: todayKey, newDone: 0, reviewDone: 0 };
  switchUser(user.id);
}

function startRenameUser(userId) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;
  renamingUserId = userId;
  renderUsers();
  renderLogin();
  requestAnimationFrame(() => {
    const input = document.querySelector(`[data-user-id="${CSS.escape(userId)}"] [data-rename-input]`);
    input?.focus();
    input?.select();
  });
}

function saveRenameUser(userId, container) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;
  const nextName = container.querySelector("[data-rename-input]")?.value.trim();
  if (!nextName) return;
  user.name = nextName;
  renamingUserId = null;
  saveAndRender();
}

function cancelRenameUser() {
  renamingUserId = null;
  renderUsers();
  renderLogin();
}

function deleteUser(userId, shouldRender = true) {
  if (state.users.length <= 1) return;
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;
  const cardCount = state.cards.filter((card) => card.userId === userId).length;
  if (!confirm(`刪除「${user.name}」？${cardCount} 張卡片與這位使用者的 Tag/筆記/進度會一起刪除。`)) return;
  const nextUser = state.users.find((item) => item.id !== userId);
  state.users = state.users.filter((item) => item.id !== userId);
  state.cards = state.cards.filter((card) => card.userId !== userId);
  state.tags = state.tags.filter((tag) => tag.userId !== userId);
  delete state.notesByUser[userId];
  delete state.progressByUser[userId];
  if (state.activeUserId === userId && nextUser) {
    state.activeUserId = nextUser.id;
    state.notes = state.notesByUser[nextUser.id] || "";
    state.progress = getUserProgress(state.progressByUser, nextUser.id);
  }
  if (shouldRender) saveAndRender();
}

function getModuleLabel(module) {
  return module === "nihongo" ? "日文" : "通用";
}

function getCurrentModuleTags() {
  return state.tags.filter((tag) => tag.userId === state.activeUserId && tag.module === state.currentModule);
}

function getDefaultTagId(module = state.currentModule, userId = state.activeUserId) {
  return module === "nihongo" ? `${userId}-nihongo-uncategorized` : `${userId}-generic-uncategorized`;
}

function updateModuleUI() {
  const isNihongo = state.currentModule === "nihongo";
  els.moduleSelect.value = state.currentModule;
  document.title = isNihongo ? "Nihongo Deck" : "Study Deck";
  els.brandMark.textContent = isNihongo ? "日" : "卡";
  els.brandTitle.textContent = isNihongo ? "Nihongo Deck" : "Study Deck";
  els.brandSubtitle.textContent = isNihongo ? "日文製卡與複習" : "泛用製卡與複習";
  document.querySelectorAll("[data-module-field]").forEach((element) => {
    element.hidden = element.dataset.moduleField !== state.currentModule;
  });
  els.frontInput.required = !isNihongo;
  els.backInput.required = !isNihongo;
  els.termInput.required = isNihongo;
  els.entryType.innerHTML = isNihongo
    ? `<option value="word">單字</option><option value="grammar">文法</option>`
    : `<option value="custom">自訂</option>`;
  els.candidateList.innerHTML = isNihongo ? els.candidateList.innerHTML : "";
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll(".view").forEach((el) => el.classList.toggle("active", el.id === `view-${view}`));
  els.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  const titles = {
    add: ["Add", state.currentModule === "nihongo" ? "新增日文單字 / 文法" : "新增自訂卡片"],
    review: ["Review", "複習"],
    cards: ["Browser", "卡片瀏覽與編輯"],
    decks: ["Tags", "Tag 管理"],
    settings: ["Options", "每日上限"],
    notes: ["Notes", "筆記清單"],
  };
  els.viewEyebrow.textContent = titles[view][0];
  els.viewTitle.textContent = titles[view][1];
  saveAndRender(false);
}

function saveAndRender(shouldSave = true) {
  if (shouldSave) saveState();
  updateModuleUI();
  renderTagOptions();
  renderPreview();
  renderStats();
  renderReview();
  renderCards();
  renderDecks();
  renderSettings();
  renderUsers();
  renderNotes();
  renderLogin();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.navItems.forEach((item) => item.addEventListener("click", () => switchView(item.dataset.view)));

els.loginEditBtn.addEventListener("click", () => {
  loginEditMode = !loginEditMode;
  renderLogin();
});

els.loginHelpBtn.addEventListener("click", () => {
  loginHelpVisible = !loginHelpVisible;
  renderLogin();
});

els.profileGrid.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  const row = event.target.closest("[data-user-id]");
  if (!action || !row) return;
  if (action.dataset.action === "login-user") enterApp(row.dataset.userId);
  if (action.dataset.action === "login-switch-user") switchUser(row.dataset.userId);
  if (action.dataset.action === "login-rename-user") startRenameUser(row.dataset.userId);
  if (action.dataset.action === "login-save-rename-user") saveRenameUser(row.dataset.userId, row);
  if (action.dataset.action === "login-cancel-rename-user") cancelRenameUser();
  if (action.dataset.action === "login-delete-user") {
    deleteUser(row.dataset.userId);
    renderLogin();
  }
});

els.profileGrid.addEventListener("keydown", (event) => {
  const row = event.target.closest("[data-user-id]");
  if (!row || !event.target.matches("[data-rename-input]")) return;
  if (event.key === "Enter") saveRenameUser(row.dataset.userId, row);
  if (event.key === "Escape") cancelRenameUser();
});

els.loginUserForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addUser(els.loginUserNameInput.value);
  els.loginUserNameInput.value = "";
  renderLogin();
});

els.moduleSelect.addEventListener("change", () => {
  state.currentModule = els.moduleSelect.value;
  activeReviewCardId = null;
  answerVisible = false;
  editingCardId = null;
  pendingDeleteCardId = null;
  saveAndRender();
  switchView(currentView);
});

els.showLoginBtn.addEventListener("click", () => {
  isLoggedIn = false;
  loginEditMode = false;
  loginHelpVisible = false;
  renamingUserId = null;
  saveAndRender();
});

["input", "change"].forEach((eventName) => {
  [els.frontInput, els.backInput, els.termInput, els.readingInput, els.translationsInput, els.examplesInput, els.entryType, els.partOfSpeechSelect, els.tagPicker].forEach((field) => {
    field.addEventListener(eventName, renderPreview);
  });
});

els.lookupBtn.addEventListener("click", applyLookup);

els.candidateList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-candidate-id]");
  if (!button) return;
  const entry = mockLexiconEntries.find((item) => item.id === button.dataset.candidateId);
  if (!entry) return;
  applyLexiconEntry(entry);
});

els.entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const cards = buildGeneratedCards(getEntryData());
  if (!cards.length) return;
  state.cards.unshift(...cards);
  els.entryForm.reset();
  els.candidateList.innerHTML = "";
  saveAndRender();
  switchView("cards");
});

els.reviewCard.addEventListener("click", (event) => {
  const show = event.target.closest("#showAnswerBtn");
  const grade = event.target.closest("[data-grade]");
  if (show) {
    answerVisible = true;
    renderReview();
  }
  if (grade && activeReviewCardId) gradeCard(activeReviewCardId, grade.dataset.grade);
});

els.cardTable.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  const row = event.target.closest("[data-card-id]");
  if (!action || !row) return;
  const card = state.cards.find((item) => item.id === row.dataset.cardId);
  if (!card) return;
  if (action.dataset.action === "approve") card.status = "active";
  if (action.dataset.action === "delete") {
    pendingDeleteCardId = card.id;
    editingCardId = null;
    renderCards();
    return;
  }
  if (action.dataset.action === "cancel-delete") {
    pendingDeleteCardId = null;
    renderCards();
    return;
  }
  if (action.dataset.action === "confirm-delete") {
    state.cards = state.cards.filter((item) => item.id !== card.id);
    if (editingCardId === card.id) editingCardId = null;
    if (pendingDeleteCardId === card.id) pendingDeleteCardId = null;
  }
  if (action.dataset.action === "edit") {
    editingCardId = card.id;
    pendingDeleteCardId = null;
    renderCards();
    return;
  }
  if (action.dataset.action === "cancel-edit") {
    editingCardId = null;
    renderCards();
    return;
  }
  if (action.dataset.action === "save-edit") {
    const front = row.querySelector("[data-edit-field='front']").value.trim();
    const back = row.querySelector("[data-edit-field='back']").value.trim();
    if (!front || !back) {
      alert("正面和反面都需要內容。");
      return;
    }
    card.front = front;
    card.back = back;
    card.status = "active";
    editingCardId = null;
  }
  saveAndRender();
});

[els.cardSearch, els.cardTagFilter, els.cardStatusFilter].forEach((field) => {
  field.addEventListener("input", renderCards);
  field.addEventListener("change", renderCards);
});

els.deckForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.deckNameInput.value.trim();
  if (!name) return;
  state.tags.push({ id: id("tag"), name, module: state.currentModule });
  els.deckNameInput.value = "";
  saveAndRender();
});

els.deckList.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action='delete-tag']");
  const row = event.target.closest("[data-tag-id]");
  if (!action || !row) return;
  const tag = state.tags.find((item) => item.id === row.dataset.tagId);
  if (!tag || tag.system || tag.module !== state.currentModule) return;
  const count = state.cards.filter((card) => card.userId === state.activeUserId && card.module === state.currentModule && (card.tagIds || []).includes(tag.id)).length;
  if (!confirm(`刪除 Tag「${tag.name}」？${count} 張卡片會移除這個 Tag。`)) return;
  state.cards.forEach((card) => {
    if (card.userId !== state.activeUserId || card.module !== state.currentModule) return;
    card.tagIds = (card.tagIds || []).filter((tagId) => tagId !== tag.id);
    if (!card.tagIds.length) card.tagIds = [getDefaultTagId(state.currentModule, state.activeUserId)];
  });
  state.tags = state.tags.filter((item) => item.id !== tag.id);
  saveAndRender();
});

els.userForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addUser(els.userNameInput.value);
  els.userNameInput.value = "";
});

els.userList.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  const row = event.target.closest("[data-user-id]");
  if (!action || !row) return;
  if (action.dataset.action === "switch-user") switchUser(row.dataset.userId);
  if (action.dataset.action === "rename-user") startRenameUser(row.dataset.userId);
  if (action.dataset.action === "save-rename-user") saveRenameUser(row.dataset.userId, row);
  if (action.dataset.action === "cancel-rename-user") cancelRenameUser();
  if (action.dataset.action === "delete-user") deleteUser(row.dataset.userId);
});

els.userList.addEventListener("keydown", (event) => {
  const row = event.target.closest("[data-user-id]");
  if (!row || !event.target.matches("[data-rename-input]")) return;
  if (event.key === "Enter") saveRenameUser(row.dataset.userId, row);
  if (event.key === "Escape") cancelRenameUser();
});

[els.newLimitInput, els.reviewLimitInput].forEach((input) => {
  input.addEventListener("change", () => {
    state.settings.newLimit = Number(els.newLimitInput.value) || 0;
    state.settings.reviewLimit = Number(els.reviewLimitInput.value) || 0;
    saveAndRender();
  });
});

els.notesInput.addEventListener("input", () => {
  state.notes = els.notesInput.value;
  saveState();
});

els.clearNotesBtn.addEventListener("click", () => {
  if (!state.notes.trim()) return;
  if (!confirm("清空筆記清單？")) return;
  state.notes = "";
  saveAndRender();
});

els.resetDemoBtn.addEventListener("click", () => {
  if (!confirm("重置會清除目前本機資料，確定嗎？")) return;
  state = structuredClone(initialState);
  saveAndRender();
  switchView("review");
});

switchView("review");
