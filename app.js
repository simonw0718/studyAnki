const STORAGE_KEY = "study-deck-state-v7";
const todayKey = getLocalDateKey();

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
  currentModule: "generic",
  tags: [
    { id: "uncategorized", name: "無分類" },
    { id: "words", name: "單字" },
    { id: "grammar", name: "文法" },
  ],
  cards: createDemoCards(),
  settings: {
    newLimit: 20,
    reviewLimit: 80,
  },
  notes: "",
  progress: {
    date: todayKey,
    newDone: 0,
    reviewDone: 0,
  },
};

function createDemoCards() {
  return ["食べる", "見る", "見える"].flatMap((term) => {
    const data = seedDictionary[term];
    return buildGeneratedCards({
      term,
      module: "nihongo",
      type: data.type,
      partOfSpeech: data.partOfSpeech,
      tagIds: ["words"],
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

const els = {
  dailyMax: document.querySelector("#dailyMax"),
  newCount: document.querySelector("#newCount"),
  reviewCount: document.querySelector("#reviewCount"),
  viewEyebrow: document.querySelector("#viewEyebrow"),
  viewTitle: document.querySelector("#viewTitle"),
  brandMark: document.querySelector("#brandMark"),
  brandTitle: document.querySelector("#brandTitle"),
  brandSubtitle: document.querySelector("#brandSubtitle"),
  moduleSelect: document.querySelector("#moduleSelect"),
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
  reviewRemaining: document.querySelector("#reviewRemaining"),
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
  const merged = {
    ...structuredClone(initialState),
    ...input,
    currentModule: input.currentModule || initialState.currentModule,
    tags: input.tags || input.decks || initialState.tags,
    notes: input.notes || "",
    settings: { ...initialState.settings, ...(input.settings || {}) },
    progress: { ...initialState.progress, ...(input.progress || {}) },
  };
  merged.cards = (merged.cards || []).map((card) => ({
    ...card,
    module: card.module || "nihongo",
    tagIds: card.tagIds || (card.deckId ? [card.deckId] : ["uncategorized"]),
  }));
  if (merged.progress.date !== todayKey) {
    merged.progress = { date: todayKey, newDone: 0, reviewDone: 0 };
  }
  return merged;
}

function saveState() {
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
      module: "generic",
      type: "custom",
      tagIds: ["uncategorized"],
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
    tagIds: entry.tagIds.length ? entry.tagIds : ["uncategorized"],
    module: "nihongo",
    type: entry.type,
    partOfSpeech: entry.partOfSpeech,
    term: entry.term,
    reading: entry.reading,
    status: "needs-review",
    createdAt: new Date().toISOString(),
    due: todayKey,
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
      tagIds: entry.tagIds.length ? entry.tagIds : ["uncategorized"],
      module: "generic",
      type: "custom",
      partOfSpeech: "",
      term: entry.front,
      reading: "",
      status: "needs-review",
      createdAt: new Date().toISOString(),
      due: todayKey,
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
  const selectedTagIds = previousTagIds.length ? previousTagIds : ["words"];
  els.tagPicker.innerHTML = state.tags
    .map((tag) => {
      const checked = selectedTagIds.includes(tag.id) ? "checked" : "";
      return `
        <label>
          <input type="checkbox" value="${tag.id}" ${checked} />
          ${escapeHtml(tag.name)}
        </label>
      `;
    })
    .join("");
  const tagOptions = state.tags.map((tag) => `<option value="${tag.id}">${escapeHtml(tag.name)}</option>`).join("");
  els.cardTagFilter.innerHTML = `<option value="all">全部 Tag</option>${tagOptions}`;
}

function renderStats() {
  const rawDueCards = getRawDueCards();
  const dueCards = getDueCards();
  const rawNewDue = rawDueCards.filter((card) => card.reps === 0).length;
  const rawReviewDue = rawDueCards.filter((card) => card.reps > 0).length;
  const newDue = dueCards.filter((card) => card.reps === 0).length;
  const reviewDue = dueCards.filter((card) => card.reps > 0).length;
  const newRemaining = Math.max(0, state.settings.newLimit - state.progress.newDone);
  const reviewRemaining = Math.max(0, state.settings.reviewLimit - state.progress.reviewDone);
  els.dailyMax.textContent = String(rawDueCards.length);
  els.newCount.textContent = String(rawNewDue);
  els.reviewCount.textContent = String(rawReviewDue);
  els.newRemaining.textContent = `${newDue} / ${rawNewDue}`;
  els.reviewRemaining.textContent = `${reviewDue} / ${rawReviewDue}`;
  els.needsReviewCount.textContent = String(state.cards.filter((card) => card.status === "needs-review").length);
}

function getRawDueCards() {
  return state.cards
    .filter((card) => card.module === state.currentModule)
    .filter((card) => card.due <= todayKey)
    .sort((a, b) => a.due.localeCompare(b.due) || a.createdAt.localeCompare(b.createdAt));
}

function getDueCards() {
  return getRawDueCards()
    .filter((card) => {
      if (card.reps === 0) return state.progress.newDone < state.settings.newLimit;
      return state.progress.reviewDone < state.settings.reviewLimit;
    });
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
  const cardMeta = [tagText, card.partOfSpeech, getModuleLabel(card.module)].filter(Boolean).join(" · ");
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
  const wasNew = card.reps === 0;
  card.reps += 1;
  if (grade === "again") {
    card.interval = 0;
    card.ease = Math.max(1.3, card.ease - 0.2);
    card.lapses += 1;
    card.due = todayKey;
  } else if (grade === "hard") {
    card.interval = Math.max(1, Math.ceil(card.interval * 1.2));
    card.ease = Math.max(1.3, card.ease - 0.15);
    card.due = addDays(card.interval);
  } else if (grade === "easy") {
    card.interval = card.interval === 0 ? 4 : Math.ceil(card.interval * (card.ease + 0.25));
    card.ease += 0.15;
    card.due = addDays(card.interval);
  } else {
    card.interval = card.interval === 0 ? 1 : Math.ceil(card.interval * card.ease);
    card.due = addDays(card.interval);
  }
  if (wasNew) state.progress.newDone += 1;
  else state.progress.reviewDone += 1;
  activeReviewCardId = null;
  answerVisible = false;
  saveAndRender();
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

function renderCards() {
  const search = els.cardSearch.value.trim().toLowerCase();
  const tagFilter = els.cardTagFilter.value;
  const statusFilter = els.cardStatusFilter.value;
  const cards = state.cards.filter((card) => {
    if (card.module !== state.currentModule) return false;
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
  const cardMeta = [tagText, card.partOfSpeech, getModuleLabel(card.module), `到期 ${card.due}`].filter(Boolean).join(" · ");
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
  els.deckList.innerHTML = state.tags
    .map((tag) => {
      const count = state.cards.filter((card) => (card.tagIds || []).includes(tag.id)).length;
      const canDelete = tag.id !== "uncategorized";
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

function renderNotes() {
  if (els.notesInput.value !== state.notes) {
    els.notesInput.value = state.notes;
  }
}

function getModuleLabel(module) {
  return module === "nihongo" ? "日文" : "通用";
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
  renderNotes();
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

els.moduleSelect.addEventListener("change", () => {
  state.currentModule = els.moduleSelect.value;
  activeReviewCardId = null;
  answerVisible = false;
  editingCardId = null;
  pendingDeleteCardId = null;
  saveAndRender();
  switchView(currentView);
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
  state.tags.push({ id: id("tag"), name });
  els.deckNameInput.value = "";
  saveAndRender();
});

els.deckList.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action='delete-tag']");
  const row = event.target.closest("[data-tag-id]");
  if (!action || !row) return;
  const tag = state.tags.find((item) => item.id === row.dataset.tagId);
  if (!tag || tag.id === "uncategorized") return;
  const count = state.cards.filter((card) => (card.tagIds || []).includes(tag.id)).length;
  if (!confirm(`刪除 Tag「${tag.name}」？${count} 張卡片會移除這個 Tag。`)) return;
  state.cards.forEach((card) => {
    card.tagIds = (card.tagIds || []).filter((tagId) => tagId !== tag.id);
    if (!card.tagIds.length) card.tagIds = ["uncategorized"];
  });
  state.tags = state.tags.filter((item) => item.id !== tag.id);
  saveAndRender();
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
  switchView("review");
});

switchView("review");
