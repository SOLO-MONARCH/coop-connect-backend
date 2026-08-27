document.addEventListener("DOMContentLoaded", () => {
  const navItems = document.querySelectorAll(".nav-item");

  navItems.forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");
      const target = document.querySelector(item.getAttribute("href"));
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });

      const label = item.textContent.trim();
      if (label === "Worker Network") loadFeature("/api/workers", "Worker network connected.");
      if (label === "Bookings") loadFeature("/api/bookings", "Bookings loaded.");
      if (label === "Customers") loadFeature("/api/users", "Customers loaded.");
      if (label === "AI Forecast") loadForecast();
    });
  });

  const serviceSelect = document.getElementById("serviceSelect");
  const statusMessage = document.getElementById("requestStatus");
  const setStatus = (message, error = false) => {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("error", error);
  };

  const loadFeature = async (path, successMessage) => {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error("Backend unavailable.");
      const data = await response.json();
      const count = Object.values(data).find((value) => Array.isArray(value))?.length ?? 0;
      setStatus(`${successMessage} ${count} records available.`);
    } catch (error) {
      setStatus(error.message, true);
    }
  };

  const loadForecast = async () => {
    try {
      const response = await fetch("/api/admin/predict-demand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service: serviceSelect.value, days_ahead: 7 }) });
      if (!response.ok) throw new Error("Forecast unavailable.");
      const data = await response.json();
      setStatus(`${data.demand_level}: ${data.action_recommended}`);
    } catch (error) {
      setStatus(error.message, true);
    }
  };

  document.querySelectorAll(".priority-option").forEach((option) => {
    option.addEventListener("click", () => {
      document.querySelectorAll(".priority-option").forEach((button) => button.classList.remove("active"));
      option.classList.add("active");
    });
  });

  document.getElementById("createRequestBtn").addEventListener("click", () => document.getElementById("requestSection").scrollIntoView({ behavior: "smooth" }));
  document.getElementById("exploreBtn").addEventListener("click", () => document.getElementById("workerNetwork").scrollIntoView({ behavior: "smooth" }));

  const dispatch = async () => {
    setStatus("Finding available workers...");
    try {
      const response = await fetch("/api/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service: serviceSelect.value, customer_lat: 22.5726, customer_lon: 88.3639 }) });
      if (!response.ok) throw new Error("Matching service unavailable.");
      const data = await response.json();
      const match = (data.matches || [])[0];
      setStatus(match ? `Best match: ${match.name} (${match.match_score}% match)` : "No workers available for this service.", !match);
    } catch (error) {
      setStatus(error.message, true);
    }
  };

  document.getElementById("submitRequestBtn").addEventListener("click", dispatch);
  document.getElementById("fastDispatchBtn").addEventListener("click", dispatch);

  fetch("/api/admin/stats").then((response) => {
    if (!response.ok) throw new Error("Backend unavailable.");
    return response.json();
  }).then((data) => {
    document.getElementById("workersOnline").textContent = data.total_workers ?? 0;
    document.getElementById("registeredUsers").textContent = data.total_customers ?? 0;
    document.getElementById("activeJobs").textContent = data.active_jobs ?? 0;
    document.getElementById("completedJobs").textContent = data.completed_jobs ?? 0;
  }).catch(() => setStatus("Backend unavailable. Set Netlify API_BASE_URL to your deployed Render API.", true));

  const points = [18, 26, 22, 30, 33, 41, 48].map((value, index) => `${18 + index * 80.6},${182 - value * 3.2}`);
  document.getElementById("chartLine").setAttribute("d", `M ${points.join(" L ")}`);
  document.getElementById("chartArea").setAttribute("d", `M ${points.join(" L ")} L 502,182 L 18,182 Z`);
});
