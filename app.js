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

const tabs = [...document.querySelectorAll(".tab")];
const list = document.querySelector("#list");
const eventName = document.querySelector("#eventName");
const syncStatus = document.querySelector("#syncStatus");
const template = document.querySelector("#itemTemplate");

const byDay = {
  sabado: { title: "Fecha Sur 1 - 2026", items: sabado },
  domingo: { title: "Fecha Centro 1 - 2026", items: domingo }
};

let currentDay = "sabado";
const cache = new Map();

function docId(item) {
  return `2026-${currentDay}-${item.banca}-${item.n}`;
}

function normalizeScore(raw) {
  if (!raw) return "";
  const cleaned = raw.replace(/[^0-9.,]/g, "").replace(",", ".");
  const value = Number(cleaned);
  if (Number.isNaN(value)) return "";
  return value.toFixed(2);
}

function renderDay() {
  const { title, items } = byDay[currentDay];
  eventName.textContent = title;
  list.innerHTML = "";

  items.forEach((item) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const id = docId(item);

    node.querySelector(".chip").textContent = `Banca ${item.banca} #${item.n}`;
    node.querySelector(".category").textContent = item.categoria;
    node.querySelector(".name").textContent = item.nombre;
    node.querySelector(".meta").textContent = `${item.club}`;

    const scoreInput = node.querySelector(".score-input");
    const notesInput = node.querySelector(".notes-input");

    scoreInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/[^0-9.,]/g, "");
    });

    scoreInput.addEventListener("blur", async () => {
      const score = normalizeScore(scoreInput.value);
      scoreInput.value = score;
      await setDoc(
        doc(db, "scores", id),
        {
          score,
          notes: notesInput.value.trim(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    });

    notesInput.addEventListener("blur", async () => {
      await setDoc(
        doc(db, "scores", id),
        {
          score: normalizeScore(scoreInput.value),
          notes: notesInput.value.trim(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    });

    onSnapshot(
      doc(db, "scores", id),
      (snap) => {
        const data = snap.data() || { score: "", notes: "" };
        const signature = `${data.score ?? ""}|${data.notes ?? ""}`;
        if (cache.get(id) === signature) return;
        cache.set(id, signature);
        scoreInput.value = data.score ?? "";
        notesInput.value = data.notes ?? "";
        syncStatus.textContent = "Sincronizado en vivo";
      },
      () => {
        syncStatus.textContent = "Sin conexion";
      }
    );

    list.appendChild(node);
  });
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((x) => x.classList.remove("is-active"));
    tab.classList.add("is-active");
    currentDay = tab.dataset.day;
    renderDay();
  });
});

renderDay();
