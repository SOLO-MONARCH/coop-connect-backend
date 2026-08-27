document.addEventListener("DOMContentLoaded", () => {
  const apiBase = window.location.hostname.endsWith("github.io")
    ? "https://coop-connect-backend-2.onrender.com"
    : "";
  const apiUrl = (path) => `${apiBase}${path}`;
  const navItems = document.querySelectorAll(".nav-item");

  navItems.forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");
      const target = document.querySelector(item.getAttribute("href"));
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });

      const label = item.textContent.trim();
      renderModule(label);
      if (label === "Map Match Search") {
        setTimeout(() => map.invalidateSize(), 250);
        searchWorkers();
      }
    });
  });

  const serviceSelect = document.getElementById("serviceSelect");
  const statusMessage = document.getElementById("requestStatus");
  const mapServiceSelect = document.getElementById("mapServiceSelect");
  const mapResults = document.getElementById("workerResults");
  const mapResultCount = document.getElementById("mapResultCount");
  const map = L.map("workerMap").setView([22.5726, 88.3639], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 19 }).addTo(map);
  const markers = L.layerGroup().addTo(map);
  const userMarker = L.marker([22.5726, 88.3639]).addTo(markers).bindPopup("Your location");
  let userLocation = { lat: 22.5726, lon: 88.3639 };
  const setStatus = (message, error = false) => {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("error", error);
  };

  const loadFeature = async (path, successMessage) => {
    try {
      const response = await fetch(apiUrl(path));
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
      const response = await fetch(apiUrl("/api/admin/predict-demand"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service: serviceSelect.value, days_ahead: 7 }) });
      if (!response.ok) throw new Error("Forecast unavailable.");
      const data = await response.json();
      setStatus(`${data.demand_level}: ${data.action_recommended}`);
    } catch (error) {
      setStatus(error.message, true);
    }
  };

  async function renderModule(label) {
    const moduleView = document.getElementById("moduleView");
    if (label === "Command Center") {
      document.getElementById("command-center").scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (label === "Citizen Dispatch") {
      document.getElementById("requestSection").scrollIntoView({ behavior: "smooth" });
      return;
    }
    const configurations = {
      "Worker Network": { path: "/api/workers", title: "Worker Network", empty: "No workers registered yet." },
      "Bookings": { path: "/api/bookings", title: "Bookings", empty: "No bookings created yet." },
      "Customers": { path: "/api/users", title: "Customers", empty: "No customers registered yet." },
      "Analytics": { path: "/api/admin/stats", title: "Analytics", empty: "No analytics available." },
      "AI Forecast": { path: "/api/admin/predict-demand", title: "AI Forecast", empty: "Forecast unavailable." }
    };
    const config = configurations[label];
    if (!config) return;
    moduleView.innerHTML = `<div class="module-header"><div><div class="subhead">OPERATIONS MODULE</div><h2>${config.title}</h2></div><span class="tag">Backend connected</span></div><div class="module-body">Loading ${config.title.toLowerCase()}...</div>`;
    moduleView.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const options = label === "AI Forecast" ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service: serviceSelect.value, days_ahead: 7 }) } : {};
      const response = await fetch(config.path, options);
      if (!response.ok) throw new Error("Backend unavailable.");
      const data = await response.json();
      const body = moduleView.querySelector(".module-body");
      if (label === "AI Forecast") body.innerHTML = `<div class="metric"><strong>${data.predicted_requests}</strong><span>estimated requests</span></div><div class="module-copy">${data.demand_level}<br>${data.action_recommended}</div>`;
      else if (label === "Analytics") body.innerHTML = Object.entries(data).map(([key, value]) => `<div class="metric"><strong>${value}</strong><span>${key.replaceAll("_", " ")}</span></div>`).join("");
      else { const records = Object.values(data).find((value) => Array.isArray(value)) || []; body.innerHTML = records.length ? records.map((record) => `<div class="record"><strong>${record.name || `Booking #${record.id}` || "Record"}</strong><span>${record.service || record.email || record.status || "Available"}</span></div>`).join("") : config.empty; }
    } catch (error) {
      moduleView.querySelector(".module-body").innerHTML = `<span class="error-text">${error.message}</span>`;
    }
  }

  async function searchWorkers() {
    const service = mapServiceSelect.value;
    mapResultCount.textContent = "Searching...";
    mapResults.innerHTML = "Finding available workers...";
    try {
      const response = await fetch(apiUrl("/api/match"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service, customer_lat: userLocation.lat, customer_lon: userLocation.lon }) });
      if (!response.ok) throw new Error("Backend unavailable.");
      const data = await response.json();
      const workers = data.matches || [];
      markers.clearLayers();
      userMarker.addTo(markers);
      workers.forEach((worker) => {
        if (worker.lat && worker.lon) L.marker([worker.lat, worker.lon]).addTo(markers).bindPopup(`<strong>${worker.name}</strong><br>${worker.service}<br>${worker.match_score}% match`);
      });
      map.setView([userLocation.lat, userLocation.lon], 13);
      mapResultCount.textContent = `${workers.length} found`;
      mapResults.innerHTML = workers.length ? workers.map((worker) => `<div class="worker-result"><strong>${worker.name}</strong><span>${worker.service} · ${worker.match_score}% match · ${worker.distance_km} km</span></div>`).join("") : "No available workers found.";
    } catch (error) {
      mapResultCount.textContent = "Unavailable";
      mapResults.innerHTML = `<span class="error-text">${error.message}</span>`;
    }
  }

  document.getElementById("searchWorkersBtn").addEventListener("click", searchWorkers);
  mapServiceSelect.addEventListener("change", searchWorkers);
  document.getElementById("useLocationBtn").addEventListener("click", () => {
    if (!navigator.geolocation) return setStatus("Location is not available in this browser.", true);
    navigator.geolocation.getCurrentPosition((position) => {
      userLocation = { lat: position.coords.latitude, lon: position.coords.longitude };
      userMarker.setLatLng([userLocation.lat, userLocation.lon]);
      map.setView([userLocation.lat, userLocation.lon], 13);
      setStatus("Location updated. Searching nearby workers...");
      searchWorkers();
    }, () => setStatus("Location permission was not granted.", true));
  });

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
      const response = await fetch(apiUrl("/api/match"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service: serviceSelect.value, customer_lat: 22.5726, customer_lon: 88.3639 }) });
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

  fetch(apiUrl("/api/admin/stats")).then((response) => {
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
  setTimeout(() => map.invalidateSize(), 100);
});
