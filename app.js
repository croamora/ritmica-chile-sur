import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
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

const allEntries = [
  ...sabado.map((item, idx) => ({ ...item, day: "sabado", uid: `sabado-${idx + 1}` })),
  ...domingo.map((item, idx) => ({ ...item, day: "domingo", uid: `domingo-${idx + 1}` }))
];

const scoresStore = new Map();
const scoreUnsubs = [];
let currentView = "orden";

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
  allEntries.forEach((item) => {
    const id = getDocId(item);
    const unsub = onSnapshot(
      doc(db, "scores", id),
      (snap) => {
        const data = snap.data() || { score: "", notes: "" };
        scoresStore.set(id, data);
        syncStatus.textContent = "Sincronizado en vivo";
        if (currentView === "orden") renderOrden();
        if (currentView === "ranking") renderRanking();
      },
      () => {
        syncStatus.textContent = "Sin conexion";
      }
    );
    scoreUnsubs.push(unsub);
  });
}

function getFilteredOrdenItems() {
  const day = ordenDaySelect.value;
  const club = ordenClubSelect.value;
  const search = ordenSearchInput.value.trim().toLowerCase();
  const base = byDay[day].items.map((item) => ({ ...item, day }));
  const enriched = base.map((item, idx) => ({ ...item, uid: `${day}-${idx + 1}` }));
  return enriched
    .filter((x) => (club === "todos" ? true : x.club === club))
    .filter((x) => {
      if (!search) return true;
      return `${x.nombre} ${x.club} ${x.categoria}`.toLowerCase().includes(search);
    });
}

function renderOrden() {
  list.innerHTML = "";

  const items = getFilteredOrdenItems();
  const day = ordenDaySelect.value;
  eventName.textContent = byDay[day].title;

  if (!items.length) {
    list.innerHTML = '<article class="card"><p>No hay gimnastas para ese filtro.</p></article>';
    return;
  }

  items.forEach((item) => {
    const id = getDocId(item);
    const node = template.content.firstElementChild.cloneNode(true);
    const scoreInput = node.querySelector(".score-input");
    const notesInput = node.querySelector(".notes-input");

    node.querySelector(".chip").textContent = `Banca ${item.banca} #${item.n}`;
    node.querySelector(".category").textContent = item.categoria;
    node.querySelector(".name").textContent = item.nombre;
    node.querySelector(".meta").textContent = item.club;

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
    list.appendChild(node);
  });
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
  const withScores = source
    .map((item) => {
      const id = getDocId(item);
      const score = Number(scoresStore.get(id)?.score);
      return { ...item, score: Number.isNaN(score) ? null : score };
    })
    .filter((x) => x.score !== null);

  if (!withScores.length) {
    rankingList.innerHTML = '<article class="card"><p>No hay puntajes para este filtro.</p></article>';
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
        .sort((a, b) => b.score - a.score)
        .forEach((entry, idx) => {
          const row = document.createElement("div");
          row.className = "ranking-item";
          row.innerHTML = `
            <span class="place">${idx + 1}</span>
            <div>
              <strong>${entry.nombre}</strong>
              <div class="ranking-meta">${entry.club} - ${entry.day === "sabado" ? "Sabado" : "Domingo"}</div>
            </div>
            <span class="ranking-score">${entry.score.toFixed(2)}</span>
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
