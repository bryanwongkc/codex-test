import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const STORAGE_KEY = "helper-planner-v2";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PLACEHOLDER_KEY = "YOUR_FIREBASE_API_KEY";

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const cloudEnabled = firebaseConfig.apiKey !== PLACEHOLDER_KEY;

const modeBadge = document.getElementById("mode-badge");
const statusEl = document.getElementById("status");
const planner = document.getElementById("planner");

const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signupBtn = document.getElementById("signup-btn");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

const householdForm = document.getElementById("household-form");
const householdInput = document.getElementById("household-id");

const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");

const groceryForm = document.getElementById("grocery-form");
const groceryInput = document.getElementById("grocery-input");
const groceryList = document.getElementById("grocery-list");

const mealList = document.getElementById("meal-list");

let state = { tasks: [], groceries: [], meals: {} };
let auth = null;
let db = null;
let user = null;
let householdId = localStorage.getItem("household-id") || "";
let unsubscribers = [];

householdInput.value = householdId;
planner.classList.add("disabled");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = isError ? "status error" : "status";
}

function setPlannerEnabled(enabled) {
  planner.classList.toggle("disabled", !enabled);
}

function readCreds() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  return { email, password };
}

function wireLocalMode() {
  modeBadge.textContent = "Mode: Local-only fallback (add Firebase config for shared real-time)";
  authForm.classList.add("disabled");
  householdForm.classList.add("disabled");
  setStatus("Local mode active. Data is stored on this device only.");
  state = loadLocalState();
  setPlannerEnabled(true);
  render();
}

function stopListeners() {
  for (const unsub of unsubscribers) unsub();
  unsubscribers = [];
}

function householdRoot() {
  return `households/${householdId}`;
}

function wireCloudMode() {
  modeBadge.textContent = "Mode: Cloud real-time (Firebase)";

  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  signupBtn.addEventListener("click", async () => {
    const { email, password } = readCreds();
    if (!email || !password) return setStatus("Enter email + password.", true);
    await createUserWithEmailAndPassword(auth, email, password);
  });

  loginBtn.addEventListener("click", async () => {
    const { email, password } = readCreds();
    if (!email || !password) return setStatus("Enter email + password.", true);
    await signInWithEmailAndPassword(auth, email, password);
  });

  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    stopListeners();
    setPlannerEnabled(false);
    setStatus("Logged out.");
  });

  onAuthStateChanged(auth, (nextUser) => {
    user = nextUser;
    if (!user) {
      stopListeners();
      setPlannerEnabled(false);
      setStatus("Please log in.");
      return;
    }

    setStatus(`Logged in as ${user.email || user.uid}. Enter/connect household.`);
    if (householdId) connectHousehold();
  });
}

async function connectHousehold() {
  householdId = householdInput.value.trim();
  if (!householdId) return setStatus("Household ID is required.", true);

  localStorage.setItem("household-id", householdId);

  if (!cloudEnabled) {
    setStatus(`Connected local household '${householdId}'`);
    return;
  }

  if (!user) return setStatus("Log in first.", true);

  stopListeners();

  const mealsRef = doc(db, `${householdRoot()}/meta/meals`);
  const tasksRef = query(collection(db, `${householdRoot()}/tasks`), orderBy("createdAt", "desc"));
  const groceriesRef = query(collection(db, `${householdRoot()}/groceries`), orderBy("createdAt", "desc"));

  unsubscribers.push(
    onSnapshot(tasksRef, (snap) => {
      state.tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTasks();
    })
  );

  unsubscribers.push(
    onSnapshot(groceriesRef, (snap) => {
      state.groceries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderGroceries();
    })
  );

  unsubscribers.push(
    onSnapshot(mealsRef, (snap) => {
      state.meals = snap.exists() ? snap.data() : {};
      renderMeals();
    })
  );

  setPlannerEnabled(true);
  setStatus(`Connected to household '${householdId}'. Live sync is active.`);
}

householdForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await connectHousehold();
  } catch (error) {
    setStatus(error.message, true);
  }
});

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;

  try {
    if (cloudEnabled) {
      await addDoc(collection(db, `${householdRoot()}/tasks`), { text, done: false, createdAt: Date.now() });
    } else {
      state.tasks.unshift({ id: crypto.randomUUID(), text, done: false });
      saveLocalState();
      renderTasks();
    }
    taskInput.value = "";
  } catch (error) {
    setStatus(error.message, true);
  }
});

groceryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = groceryInput.value.trim();
  if (!text) return;

  try {
    if (cloudEnabled) {
      await addDoc(collection(db, `${householdRoot()}/groceries`), { text, done: false, createdAt: Date.now() });
    } else {
      state.groceries.unshift({ id: crypto.randomUUID(), text, done: false });
      saveLocalState();
      renderGroceries();
    }
    groceryInput.value = "";
  } catch (error) {
    setStatus(error.message, true);
  }
});

function renderChecklist(listEl, items, onToggle, onDelete) {
  listEl.innerHTML = "";
  for (const item of items) {
    const li = document.createElement("li");

    const label = document.createElement("label");
    label.className = "label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.done;
    checkbox.addEventListener("change", () => onToggle(item.id, item.done));

    const text = document.createElement("span");
    text.textContent = item.text;
    if (item.done) text.className = "done";

    const del = document.createElement("button");
    del.className = "small";
    del.textContent = "Delete";
    del.addEventListener("click", () => onDelete(item.id));

    label.append(checkbox, text);
    li.append(label, del);
    listEl.append(li);
  }
}

function renderTasks() {
  renderChecklist(taskList, state.tasks, toggleTask, deleteTask);
}

function renderGroceries() {
  renderChecklist(groceryList, state.groceries, toggleGrocery, deleteGrocery);
}

function renderMeals() {
  mealList.innerHTML = "";
  for (const day of DAYS) {
    const row = document.createElement("div");
    row.className = "meal-row";

    const dayEl = document.createElement("div");
    dayEl.className = "day";
    dayEl.textContent = day;

    const input = document.createElement("input");
    input.value = state.meals[day] || "";
    input.placeholder = "Plan meal";
    input.addEventListener("change", () => updateMeal(day, input.value.trim()));

    row.append(dayEl, input);
    mealList.append(row);
  }
}

function render() {
  renderTasks();
  renderGroceries();
  renderMeals();
}

async function toggleTask(id, done) {
  if (cloudEnabled) {
    await updateDoc(doc(db, `${householdRoot()}/tasks/${id}`), { done: !done });
    return;
  }
  const item = state.tasks.find((x) => x.id === id);
  if (item) item.done = !item.done;
  saveLocalState();
  renderTasks();
}

async function deleteTask(id) {
  if (cloudEnabled) {
    await deleteDoc(doc(db, `${householdRoot()}/tasks/${id}`));
    return;
  }
  state.tasks = state.tasks.filter((x) => x.id !== id);
  saveLocalState();
  renderTasks();
}

async function toggleGrocery(id, done) {
  if (cloudEnabled) {
    await updateDoc(doc(db, `${householdRoot()}/groceries/${id}`), { done: !done });
    return;
  }
  const item = state.groceries.find((x) => x.id === id);
  if (item) item.done = !item.done;
  saveLocalState();
  renderGroceries();
}

async function deleteGrocery(id) {
  if (cloudEnabled) {
    await deleteDoc(doc(db, `${householdRoot()}/groceries/${id}`));
    return;
  }
  state.groceries = state.groceries.filter((x) => x.id !== id);
  saveLocalState();
  renderGroceries();
}

async function updateMeal(day, value) {
  if (cloudEnabled) {
    const ref = doc(db, `${householdRoot()}/meta/meals`);
    state.meals[day] = value;
    await setDoc(ref, state.meals, { merge: true });
    return;
  }
  state.meals[day] = value;
  saveLocalState();
}

function loadLocalState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { tasks: [], groceries: [], meals: {} };
  try {
    return JSON.parse(raw);
  } catch {
    return { tasks: [], groceries: [], meals: {} };
  }
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js");
  });
}

if (cloudEnabled) {
  wireCloudMode();
} else {
  wireLocalMode();
}
