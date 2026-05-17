import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { sabado, domingo } from "./data.js";

const firebaseConfig = {
  apiKey: "AIzaSyC11TG-G5YyMVAAadTGlvKM9GgbNV0tHWQ",
  authDomain: "orden-pasos-ritmica-chile-sur.firebaseapp.com",
  projectId: "orden-pasos-ritmica-chile-sur",
  storageBucket: "orden-pasos-ritmica-chile-sur.firebasestorage.app",
  messagingSenderId: "1065354170747",
  appId: "1:1065354170747:web:1ed0738940befc9847edde"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const viewTabs = [...document.querySelectorAll(".tab")];
const list = document.querySelector("#list");
const rankingList = document.querySelector("#rankingList");
const eventName = document.querySelector("#eventName");
const syncStatus = document.querySelector("#syncStatus");
const template = document.querySelector("#itemTemplate");

const ordenFilters = document.querySelector("#ordenFilters");
const rankingFilters = document.querySelector("#rankingFilters");
const ordenDaySelect = document.querySelector("#ordenDay");
const ordenClubSelect = document.querySelector("#ordenClub");
const ordenSearchInput = document.querySelector("#ordenSearch");
const rankingDaySelect = document.querySelector("#rankingDay");
const rankingClubSelect = document.querySelector("#rankingClub");
const rankingCategorySelect = document.querySelector("#rankingCategory");

const byDay = {
  sabado: { title: "Fecha Sur 1 - 2026", items: sabado },
  domingo: { title: "Fecha Centro 1 - 2026", items: domingo }
};

const breakDefinitions = {
  sabado: [
    { after: 128, label: "Break 1 hora - premiacion. Vuelve 15:00 a 20:00" },
    { after: 263, label: "Break 15 minutos - 20:15 a 21:45" }
  ],
  domingo: [
    { after: 94, label: "Break 1 hora - premiacion. 13:30 a 15:45" },
    { after: 159, label: "Break 30 minutos - 15:45 a 17:30" }
  ]
};

const allEntries = [
  ...sabado.map((item, idx) => ({ ...item, day: "sabado", uid: `sabado-${idx + 1}` })),
  ...domingo.map((item, idx) => ({ ...item, day: "domingo", uid: `domingo-${idx + 1}` }))
];

const scoresStore = new Map();
let currentView = "orden";
let repaintTimer = null;
const orderNodeRefs = new Map();

function getDocId(item) {
  return `2026-${item.uid ?? `${item.day}-${item.banca}-${item.n}`}`;
}

function normalizeScore(raw) {
  if (!raw) return "";
  const cleaned = raw.replace(/[^0-9.,]/g, "").replace(",", ".");
  const value = Number(cleaned);
  if (Number.isNaN(value)) return "";
  return value.toFixed(2);
}

function buildClubOptions() {
  const clubs = [...new Set(allEntries.map((x) => x.club))].sort((a, b) => a.localeCompare(b, "es"));
  clubs.forEach((club) => {
    const o1 = document.createElement("option");
    o1.value = club;
    o1.textContent = club;
    ordenClubSelect.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = club;
    o2.textContent = club;
    rankingClubSelect.appendChild(o2);
  });
}

function updateRankingCategoryOptions() {
  const selectedDay = rankingDaySelect.value;
  const selectedClub = rankingClubSelect.value;
  const categories = [...new Set(
    allEntries
      .filter((item) => (selectedDay === "todos" ? true : item.day === selectedDay))
      .filter((item) => (selectedClub === "todos" ? true : item.club === selectedClub))
      .map((item) => item.categoria)
  )].sort((a, b) => a.localeCompare(b, "es"));

  const current = rankingCategorySelect.value;
  rankingCategorySelect.innerHTML = '<option value="todos">Todas</option>';
  categories.forEach((categoria) => {
    const option = document.createElement("option");
    option.value = categoria;
    option.textContent = categoria;
    rankingCategorySelect.appendChild(option);
  });

  if (categories.includes(current)) rankingCategorySelect.value = current;
}

function subscribeAllScores() {
  onSnapshot(
    collection(db, "scores"),
    (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "removed") {
          scoresStore.delete(change.doc.id);
          return;
        }

        const data = change.doc.data() || { score: "", notes: "" };
        scoresStore.set(change.doc.id, data);
        const refs = orderNodeRefs.get(change.doc.id);
        if (refs) {
          if (document.activeElement !== refs.scoreInput) refs.scoreInput.value = data.score ?? "";
          if (document.activeElement !== refs.notesInput) refs.notesInput.value = data.notes ?? "";
        }
      });
      syncStatus.textContent = "Sincronizado en vivo";
      if (currentView === "ranking") scheduleRepaint();
    },
    () => {
      syncStatus.textContent = "Sin conexion";
    }
  );
}

function scheduleRepaint() {
  if (repaintTimer) return;
  repaintTimer = setTimeout(() => {
    repaintTimer = null;
    if (currentView === "orden") renderOrden();
    else renderRanking();
  }, 50);
}

function getFilteredOrdenItems() {
  const day = ordenDaySelect.value;
  const club = ordenClubSelect.value;
  const search = ordenSearchInput.value.trim().toLowerCase();
  const base = byDay[day].items.map((item) => ({ ...item, day }));
  const enriched = base.map((item, idx) => ({ ...item, uid: `${day}-${idx + 1}` }));
  const filtered = enriched
    .filter((x) => (club === "todos" ? true : x.club === club))
    .filter((x) => {
      if (!search) return true;
      return `${x.nombre} ${x.club} ${x.categoria}`.toLowerCase().includes(search);
    });

  return injectBreaks(day, filtered, enriched.length);
}

function injectBreaks(day, filteredItems, totalLength) {
  const itemsWithBreaks = [...filteredItems];
  const breaks = breakDefinitions[day] || [];

  breaks.forEach((pause) => {
    if (pause.after > totalLength) return;
    const insertAt = itemsWithBreaks.findIndex((item) => Number(item.uid.split("-")[1]) > pause.after);
    const breakItem = {
      kind: "break",
      uid: `${day}-break-${pause.after}`,
      day,
      label: pause.label
    };
    if (insertAt === -1) itemsWithBreaks.push(breakItem);
    else itemsWithBreaks.splice(insertAt, 0, breakItem);
  });

  return itemsWithBreaks;
}

function renderOrden() {
  list.innerHTML = "";
  orderNodeRefs.clear();

  const items = getFilteredOrdenItems();
  const day = ordenDaySelect.value;
  eventName.textContent = byDay[day].title;

  if (!items.length) {
    list.innerHTML = '<article class="card"><p>No hay gimnastas para ese filtro.</p></article>';
    return;
  }

  const queue = [...items];
  const chunkSize = 28;

  function drawChunk() {
    const batch = queue.splice(0, chunkSize);
    if (!batch.length) return;

    const fragment = document.createDocumentFragment();

    batch.forEach((item) => {
    if (item.kind === "break") {
      const breakNode = document.createElement("article");
      breakNode.className = "break-card";
      breakNode.innerHTML = `
        <p class="break-title">${item.day === "sabado" ? "Sabado" : "Domingo"}</p>
        <p class="break-text">${item.label}</p>
      `;
      fragment.appendChild(breakNode);
      return;
    }

    const id = getDocId(item);
    const node = template.content.firstElementChild.cloneNode(true);
    const scoreInput = node.querySelector(".score-input");
    const notesInput = node.querySelector(".notes-input");

    node.querySelector(".chip").textContent = `Banca ${item.banca} #${item.n}`;
    node.querySelector(".category").textContent = item.categoria;
    node.querySelector(".name").textContent = item.nombre;
    node.querySelector(".meta").textContent = `${item.club} · ${item.day === "sabado" ? "Sabado" : "Domingo"}`;

    scoreInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/[^0-9.,]/g, "");
    });

    scoreInput.addEventListener("blur", async () => {
      const score = normalizeScore(scoreInput.value);
      scoreInput.value = score;
      await setDoc(
        doc(db, "scores", id),
        { score, notes: notesInput.value.trim(), updatedAt: serverTimestamp() },
        { merge: true }
      );
    });

    notesInput.addEventListener("blur", async () => {
      await setDoc(
        doc(db, "scores", id),
        { score: normalizeScore(scoreInput.value), notes: notesInput.value.trim(), updatedAt: serverTimestamp() },
        { merge: true }
      );
    });

    const current = scoresStore.get(id) || { score: "", notes: "" };
    scoreInput.value = current.score ?? "";
    notesInput.value = current.notes ?? "";
    orderNodeRefs.set(id, { scoreInput, notesInput });
    fragment.appendChild(node);
    });

    list.appendChild(fragment);
    if (queue.length) requestAnimationFrame(drawChunk);
  }

  requestAnimationFrame(drawChunk);
}

function getRankingSource() {
  const selectedDay = rankingDaySelect.value;
  const selectedClub = rankingClubSelect.value;
  const selectedCategory = rankingCategorySelect.value;
  return allEntries.filter((item) => {
    const matchesDay = selectedDay === "todos" ? true : item.day === selectedDay;
    const matchesClub = selectedClub === "todos" ? true : item.club === selectedClub;
    const matchesCategory = selectedCategory === "todos" ? true : item.categoria === selectedCategory;
    return matchesDay && matchesClub && matchesCategory;
  });
}

function renderRanking() {
  rankingList.innerHTML = "";
  eventName.textContent = "Lugares por categoria";

  const source = getRankingSource();
  const withScores = source.map((item) => {
    const id = getDocId(item);
    const score = Number(scoresStore.get(id)?.score);
    return { ...item, score: Number.isNaN(score) ? null : score };
  });

  if (!source.length) {
    rankingList.innerHTML = '<article class="card"><p>No hay participantes para este filtro.</p></article>';
    return;
  }

  const grouped = new Map();
  withScores.forEach((item) => {
    if (!grouped.has(item.categoria)) grouped.set(item.categoria, []);
    grouped.get(item.categoria).push(item);
  });

  [...grouped.keys()]
    .sort((a, b) => a.localeCompare(b, "es"))
    .forEach((categoria) => {
      const groupWrap = document.createElement("article");
      groupWrap.className = "ranking-group";

      const title = document.createElement("h3");
      title.className = "ranking-title";
      title.textContent = categoria;
      groupWrap.appendChild(title);

      grouped
        .get(categoria)
        .sort((a, b) => {
          const aHas = a.score !== null;
          const bHas = b.score !== null;
          if (aHas && bHas) return b.score - a.score;
          if (aHas && !bHas) return -1;
          if (!aHas && bHas) return 1;
          return a.nombre.localeCompare(b.nombre, "es");
        })
        .forEach((entry, idx) => {
          const row = document.createElement("div");
          row.className = "ranking-item";
          row.innerHTML = `
            <span class="place">${idx + 1}</span>
            <div>
              <strong>${entry.nombre}</strong>
              <div class="ranking-meta">${entry.club} - ${entry.day === "sabado" ? "Sabado" : "Domingo"}</div>
            </div>
            <span class="ranking-score">${entry.score === null ? "--" : entry.score.toFixed(2)}</span>
          `;
          groupWrap.appendChild(row);
        });

      rankingList.appendChild(groupWrap);
    });
}

function switchView(view) {
  currentView = view;
  const isOrden = view === "orden";

  viewTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === view);
  });

  ordenFilters.classList.toggle("hidden", !isOrden);
  list.classList.toggle("hidden", !isOrden);
  rankingFilters.classList.toggle("hidden", isOrden);
  rankingList.classList.toggle("hidden", isOrden);

  if (isOrden) renderOrden();
  else renderRanking();
}

buildClubOptions();
subscribeAllScores();
viewTabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
ordenDaySelect.addEventListener("change", renderOrden);
ordenClubSelect.addEventListener("change", renderOrden);
ordenSearchInput.addEventListener("input", renderOrden);
rankingDaySelect.addEventListener("change", () => {
  updateRankingCategoryOptions();
  renderRanking();
});
rankingClubSelect.addEventListener("change", () => {
  updateRankingCategoryOptions();
  renderRanking();
});
rankingCategorySelect.addEventListener("change", renderRanking);

updateRankingCategoryOptions();

renderOrden();
