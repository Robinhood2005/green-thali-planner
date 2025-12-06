
const API_BASE = "http://127.0.0.1:5000";

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return res.json();
}

// -------- THEME HANDLING --------
function applyStoredTheme() {
  const stored = localStorage.getItem("smp_theme") || "light";
  document.body.classList.toggle("dark-theme", stored === "dark");
}

function toggleTheme() {
  const isDark = document.body.classList.toggle("dark-theme");
  localStorage.setItem("smp_theme", isDark ? "dark" : "light");
}

// -------- REVEAL ANIMATIONS --------
function initRevealAnimations() {
  const revealEls = document.querySelectorAll(".card, .reveal");
  if (!("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("visible"));
    return;
  }
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealEls.forEach((el) => {
    el.classList.add("reveal");
    obs.observe(el);
  });
}

// -------- INDEX PAGE (LOGIN / REGISTER) --------
async function initIndexPage() {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const tabs = document.querySelectorAll(".tab");
  const tabsContainer = document.querySelector(".tabs");
  const loginMsg = document.getElementById("login-message");
  const registerMsg = document.getElementById("register-message");

  if (!loginForm || !registerForm) return;

  // Tab switching + animated pill
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");

      if (tabsContainer) {
        if (index === 0) {
          tabsContainer.classList.remove("right");
        } else {
          tabsContainer.classList.add("right");
        }
      }
    });
  });

  // If already logged in, go directly to dashboard
  const existingUserId = localStorage.getItem("smp_user_id");
  if (existingUserId) {
    window.location.href = "dashboard.html";
    return;
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginMsg.textContent = "";
    loginMsg.className = "msg";

    const email = document.getElementById("login_email").value.trim();
    const password = document.getElementById("login_password").value;

    try {
      const data = await fetchJSON(`${API_BASE}/api/login`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (data.error) {
        loginMsg.textContent = data.error;
        loginMsg.classList.add("error");
        return;
      }

      const user = data.user;
      localStorage.setItem("smp_user_id", user.id);
      localStorage.setItem("smp_name", user.name);
      localStorage.setItem("smp_diet", user.diet_type);
      localStorage.setItem("smp_household_size", user.household_size || 1);
      localStorage.setItem("smp_context", user.context || "home");
      loginMsg.textContent = "Login successful. Redirecting...";
      loginMsg.classList.add("success");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 600);
    } catch (err) {
      console.error(err);
      loginMsg.textContent = "Could not connect to backend. Make sure Flask server is running.";
      loginMsg.classList.add("error");
    }
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    registerMsg.textContent = "";
    registerMsg.className = "msg";

    const name = document.getElementById("reg_name").value.trim();
    const email = document.getElementById("reg_email").value.trim();
    const password = document.getElementById("reg_password").value;
    const diet_type = document.getElementById("reg_diet_type").value;
    const household_size = document.getElementById("reg_household_size").value || "1";
    const context = document.getElementById("reg_context").value || "home";

    try {
      const data = await fetchJSON(`${API_BASE}/api/register`, {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          diet_type,
          household_size,
          context,
        }),
      });

      if (data.error) {
        registerMsg.textContent = data.error;
        registerMsg.classList.add("error");
        return;
      }

      const user = data.user;
      localStorage.setItem("smp_user_id", user.id);
      localStorage.setItem("smp_name", user.name);
      localStorage.setItem("smp_diet", user.diet_type);
      localStorage.setItem("smp_household_size", user.household_size || 1);
      localStorage.setItem("smp_context", user.context || "home");
      registerMsg.textContent = "Registration successful. Redirecting...";
      registerMsg.classList.add("success");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 600);
    } catch (err) {
      console.error(err);
      registerMsg.textContent = "Could not connect to backend. Make sure Flask server is running.";
      registerMsg.classList.add("error");
    }
  });
}

// -------- DASHBOARD PAGE --------
let caloriesChart = null;
let wasteChart = null;
let macrosChart = null;


async function initDashboardPage() {
  const mealTableBody = document.querySelector("#meal-table tbody");
  if (!mealTableBody) return;

  const greetingEl = document.getElementById("greeting");
  const dietBadge = document.getElementById("diet-badge");
  const householdInfoEl = document.getElementById("household-info");
  const shoppingListEl = document.getElementById("shopping-list");
  const statsRow = document.getElementById("plan-stats");
  const seasonalHighlight = document.getElementById("seasonal-highlight");
  const wasteForm = document.getElementById("waste-form");
  const wasteLogList = document.getElementById("waste-log-list");
  const wasteInsights = document.getElementById("waste-insights");
  const themeToggle = document.getElementById("theme-toggle");
  const logoutBtn = document.getElementById("logout-btn");

  const searchTermInput = document.getElementById("search_term");
  const maxCaloriesInput = document.getElementById("max_calories");
  const maxCarbonInput = document.getElementById("max_carbon");
  const applyFiltersBtn = document.getElementById("apply-filters");
  const recipeListEl = document.getElementById("recipe-list");
  const reminderBtn = document.getElementById("reminder-btn");
  const reminderStatus = document.getElementById("reminder-status");

  const userId = localStorage.getItem("smp_user_id");
  if (!userId) {
    window.location.href = "index.html";
    return;
  }

  let allRecipes = [];
  let profileDiet = "veg";
  let caloriesPerDay = [];
  let macrosPerDay = [];

  themeToggle.addEventListener("click", toggleTheme);
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("smp_user_id");
    localStorage.removeItem("smp_name");
    localStorage.removeItem("smp_diet");
    localStorage.removeItem("smp_household_size");
    localStorage.removeItem("smp_context");
    window.location.href = "index.html";
  });

  function contextLabel(code) {
    switch (code) {
      case "student":
        return "Student / PG";
      case "hostel":
        return "Hostel / Mess";
      case "office":
        return "Office canteen";
      case "hospital":
        return "Hospital / Clinic";
      default:
        return "Home / Family";
    }
  }


  function setReminderStatus(message) {
    if (reminderStatus) {
      reminderStatus.textContent = message || "";
      reminderStatus.className = "msg";
    }
  }

  function initReminders() {
    if (!reminderBtn) return;

    const stored = localStorage.getItem("smp_reminders");
    if (stored === "on") {
      setReminderStatus("Weekly reminder is enabled on this browser.");
      // fire a gentle notification a few seconds after load as demo
      if ("Notification" in window && Notification.permission === "granted") {
        setTimeout(() => {
          new Notification("GreenThali", {
            body: "Time to quickly review your weekly meal plan.",
          });
        }, 5000);
      }
    }

    reminderBtn.addEventListener("click", async () => {
      if (!("Notification" in window)) {
        setReminderStatus("Notifications are not supported in this browser.");
        return;
      }

      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        setReminderStatus("Notification permission was denied.");
        return;
      }

      localStorage.setItem("smp_reminders", "on");
      setReminderStatus("Reminder enabled! A sample notification will appear shortly.");

      setTimeout(() => {
        new Notification("GreenThali", {
          body: "Sample reminder: plan or adjust this week's meals.",
        });
      }, 8000);
    });
  }

  async function loadProfile() {
    try {
      const profile = await fetchJSON(`${API_BASE}/api/profile?user_id=${userId}`);
      const name = profile?.name || localStorage.getItem("smp_name") || "Friend";
      const diet = profile?.diet_type || localStorage.getItem("smp_diet") || "veg";
      const householdSize = profile?.household_size || parseInt(localStorage.getItem("smp_household_size") || "1", 10);
      const ctx = profile?.context || localStorage.getItem("smp_context") || "home";

      profileDiet = diet;
      greetingEl.textContent = `Hi, ${name}! Here is your sustainable meal plan for the week.`;
      dietBadge.textContent = diet === "veg" ? "Vegetarian" : "Non-Vegetarian";
      householdInfoEl.textContent = `Cooking for approx. ${householdSize} people • Context: ${contextLabel(ctx)}`;

      // keep local cache in sync
      localStorage.setItem("smp_household_size", householdSize);
      localStorage.setItem("smp_context", ctx);

      return { name, diet, householdSize, ctx };
    } catch (e) {
      console.error(e);
      greetingEl.textContent = "Hi! (Backend not reachable, using default profile.)";
      dietBadge.textContent = "Unknown diet";
      householdInfoEl.textContent = "";
      return { name: "Friend", diet: "veg", householdSize: 1, ctx: "home" };
    }
  }

  function showLoadingRow() {
    mealTableBody.innerHTML = "";
    const row = document.createElement("tr");
    row.className = "loading-row";
    const td = document.createElement("td");
    td.colSpan = 4;
    td.className = "skeleton";
    row.appendChild(td);
    mealTableBody.appendChild(row);
  }

  function renderMealPlan(planData) {
    const { plan, stats, season, shopping_list } = planData;
    caloriesPerDay = stats.calories_per_day || [];
    macrosPerDay = stats.macros_per_day || [];
    mealTableBody.innerHTML = "";

    plan.forEach((dayRow) => {
      const tr = document.createElement("tr");
      const dayTd = document.createElement("td");
      dayTd.textContent = dayRow.day;
      tr.appendChild(dayTd);

      ["breakfast", "lunch", "dinner"].forEach((mt) => {
        const meal = dayRow.meals[mt];
        const td = document.createElement("td");
        if (meal) {
          const nameSpan = document.createElement("span");
          nameSpan.className = "meal-tag";
          nameSpan.textContent = meal.name;

          const calSpan = document.createElement("span");
          calSpan.className = "meal-meta";
          calSpan.textContent = `${meal.calories} kcal • ${mt}`;

          td.appendChild(nameSpan);
          td.appendChild(calSpan);

          if (meal.seasonal) {
            const chipSeason = document.createElement("span");
            chipSeason.className = "meal-chip";
            chipSeason.textContent = "Seasonal";
            td.appendChild(chipSeason);
          }

          const chipCarbon = document.createElement("span");
          chipCarbon.className = "meal-chip carbon";
          chipCarbon.textContent = `Carbon score: ${meal.carbon_score}`;
          td.appendChild(chipCarbon);
        } else {
          td.textContent = "-";
        }
        tr.appendChild(td);
      });

      mealTableBody.appendChild(tr);
    });

    // Stats
    statsRow.innerHTML = "";
    const stat1 = document.createElement("div");
    stat1.className = "stat-pill";
    stat1.textContent = `Weekly calories (approx per person): ${stats.total_calories} kcal`;
    const stat2 = document.createElement("div");
    stat2.className = "stat-pill";
    stat2.textContent = `Avg carbon score: ${stats.avg_carbon_score} / 5`;
    const stat3 = document.createElement("div");
    stat3.className = "stat-pill";
    stat3.textContent = `Season: ${season.toUpperCase()}`;
    const stat4 = document.createElement("div");
    stat4.className = "stat-pill";
    stat4.textContent = `Scaled for ~${stats.household_size} people`;

    statsRow.appendChild(stat1);
    statsRow.appendChild(stat2);
    statsRow.appendChild(stat3);
    statsRow.appendChild(stat4);

    // Shopping list
    shoppingListEl.innerHTML = "";
    shopping_list.forEach((item) => {
      const li = document.createElement("li");
      const left = document.createElement("span");
      const right = document.createElement("span");
      left.textContent = item.ingredient;
      right.className = "meta";
      right.textContent = `${item.quantity} ${item.unit}`;
      li.appendChild(left);
      li.appendChild(right);
      shoppingListEl.appendChild(li);
    });

    // Seasonal highlight
    seasonalHighlight.innerHTML = "";
    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.style.marginBottom = "4px";
    title.textContent = "Seasonal focus for this week";
    const body = document.createElement("div");
    body.textContent =
      stats.seasonal_ingredients && stats.seasonal_ingredients.length
        ? `We are prioritising these seasonal ingredients: ${stats.seasonal_ingredients.join(", ")}`
        : "No seasonal data available.";
    seasonalHighlight.appendChild(title);
    seasonalHighlight.appendChild(body);

    updateCaloriesChart();
    updateMacrosChart();
  }

  async function loadMealPlan() {
    try {
      showLoadingRow();
      const data = await fetchJSON(`${API_BASE}/api/meal-plan?user_id=${userId}`);
      if (data.error) {
        alert("Error generating meal plan: " + data.error);
        return;
      }
      renderMealPlan(data);
    } catch (e) {
      console.error(e);
      alert("Failed to load meal plan. Check if backend is running.");
    }
  }

  async function loadWasteLogs() {
    try {
      const data = await fetchJSON(`${API_BASE}/api/waste-logs?user_id=${userId}`);
      wasteLogList.innerHTML = "";
      (data.logs || []).forEach((log) => {
        const li = document.createElement("li");
        const left = document.createElement("span");
        const right = document.createElement("span");
        left.textContent = `${log.date} • ${log.ingredient}`;
        right.className = "meta";
        right.textContent = `${log.quantity} ${log.unit}`;
        li.appendChild(left);
        li.appendChild(right);
        wasteLogList.appendChild(li);
      });

      wasteInsights.innerHTML = "";
      const title = document.createElement("div");
      title.style.fontWeight = "600";
      title.style.marginBottom = "4px";
      title.textContent = "Quick insight";
      const msg = document.createElement("div");
      if (data.insights && data.insights.most_wasted_ingredient) {
        msg.textContent = `You most often waste: ${data.insights.most_wasted_ingredient}. Try reducing cooked quantity or reusing it creatively next time.`;
      } else {
        msg.textContent = "No waste data yet. Try logging leftovers after meals.";
      }
      wasteInsights.appendChild(title);
      wasteInsights.appendChild(msg);

      updateWasteChart(data.insights && data.insights.waste_per_ingredient);
    } catch (e) {
      console.error(e);
    }
  }

  wasteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ingredient = document.getElementById("w_ingredient").value.trim();
    const quantity = document.getElementById("w_quantity").value;
    const unit = document.getElementById("w_unit").value;
    const notes = document.getElementById("w_notes").value.trim();

    if (!ingredient || !quantity) {
      alert("Please fill ingredient and quantity.");
      return;
    }

    try {
      await fetchJSON(`${API_BASE}/api/waste-logs?user_id=${userId}`, {
        method: "POST",
        body: JSON.stringify({ ingredient, quantity, unit, notes }),
      });
      document.getElementById("w_ingredient").value = "";
      document.getElementById("w_quantity").value = "";
      document.getElementById("w_notes").value = "";
      await loadWasteLogs();
    } catch (err) {
      console.error(err);
      alert("Could not save waste entry.");
    }
  });

  // Recipe Explorer
  async function loadAllRecipes() {
    try {
      const data = await fetchJSON(
        `${API_BASE}/api/recipes?diet=${encodeURIComponent(profileDiet)}`
      );
      allRecipes = data;
      applyRecipeFilters();
    } catch (err) {
      console.error(err);
    }
  }

  function applyRecipeFilters() {
    if (!recipeListEl) return;
    const term = (searchTermInput.value || "").toLowerCase();
    const maxCal = parseFloat(maxCaloriesInput.value);
    const maxCarbon = parseFloat(maxCarbonInput.value);

    recipeListEl.innerHTML = "";

    allRecipes
      .filter((r) => {
        if (term && !r.name.toLowerCase().includes(term)) return false;
        if (!isNaN(maxCal) && r.calories > maxCal) return false;
        if (!isNaN(maxCarbon) && r.carbon_score > maxCarbon) return false;
        return true;
      })
      .forEach((r) => {
        const li = document.createElement("li");
        const left = document.createElement("span");
        const right = document.createElement("span");
        left.textContent = r.name;
        right.className = "meta";
        right.textContent = `${r.calories} kcal • carbon ${r.carbon_score}/5`;
        li.appendChild(left);
        li.appendChild(right);
        recipeListEl.appendChild(li);
      });

    if (!recipeListEl.children.length) {
      const li = document.createElement("li");
      li.textContent = "No recipes match the selected filters.";
      recipeListEl.appendChild(li);
    }
  }

  applyFiltersBtn.addEventListener("click", applyRecipeFilters);
  searchTermInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") applyRecipeFilters();
  });

  
  function updateCaloriesChart() {
    const ctx = document.getElementById("caloriesChart");
    if (!ctx || !caloriesPerDay || !caloriesPerDay.length) return;

    const labels = caloriesPerDay.map((d) => d.day);
    const values = caloriesPerDay.map((d) => d.calories);

    if (caloriesChart) {
      caloriesChart.data.labels = labels;
      caloriesChart.data.datasets[0].data = values;
      caloriesChart.update();
      return;
    }

    caloriesChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Calories per day",
            data: values,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  }

  function updateWasteChart(wasteData) {
    const ctx = document.getElementById("wasteChart");
    if (!ctx) return;
    const list = Array.isArray(wasteData) ? wasteData : [];

    if (!list.length) {
      if (wasteChart) {
        wasteChart.destroy();
        wasteChart = null;
      }
      return;
    }

    const labels = list.map((x) => x.ingredient);
    const values = list.map((x) => x.quantity);

    if (wasteChart) {
      wasteChart.data.labels = labels;
      wasteChart.data.datasets[0].data = values;
      wasteChart.update();
      return;
    }

    wasteChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Waste quantity",
            data: values,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  }

  function updateMacrosChart() {
    const ctx = document.getElementById("macrosChart");
    if (!ctx || !macrosPerDay || !macrosPerDay.length) return;

    const labels = macrosPerDay.map((d) => d.day);
    const protein = macrosPerDay.map((d) => d.protein_g);
    const carbs = macrosPerDay.map((d) => d.carbs_g);
    const fat = macrosPerDay.map((d) => d.fat_g);

    if (macrosChart) {
      macrosChart.data.labels = labels;
      macrosChart.data.datasets[0].data = protein;
      macrosChart.data.datasets[1].data = carbs;
      macrosChart.data.datasets[2].data = fat;
      macrosChart.update();
      return;
    }

    macrosChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Protein (g)", data: protein },
          { label: "Carbs (g)", data: carbs },
          { label: "Fat (g)", data: fat },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
        },
        scales: {
          x: { stacked: true },
          y: { beginAtZero: true, stacked: true },
        },
      },
    });
  }

  await loadProfile();
  initReminders();
  await loadMealPlan();
  await loadWasteLogs();
  await loadAllRecipes();
}

// -------- ROUTER --------
document.addEventListener("DOMContentLoaded", () => {
  applyStoredTheme();
  initRevealAnimations();
  const path = window.location.pathname;
  if (path.endsWith("index.html") || path.endsWith("/")) {
    initIndexPage();
  } else if (path.endsWith("dashboard.html")) {
    initDashboardPage();
  }
});
