// Define the plugin API base path used by plugin-specific requests.
const PLUGIN_BASE = "/plugins/signalk-qxs001-plugin/";
// Define the KIP API base path for display and dashboard data.
const KIP_BASE = "/plugins/kip/";
// Populate the UI with both API bases so users can see where requests go.
document.getElementById("apiBase").textContent = `${PLUGIN_BASE} + ${KIP_BASE}`;

// Cache the last-key display element for quick updates.
const elLastKey = document.getElementById("lastKey");
// Cache the last-key timestamp element for quick updates.
const elLastKeyAt = document.getElementById("lastKeyAt");
// Cache the last-key code element for quick updates.
const elLastKeyCode = document.getElementById("lastKeyCode");
// Cache the display list container element.
const elDisplayList = document.getElementById("displayList");
// Cache the keypad container element.
const elKbd = document.getElementById("kbd");
// Cache the test trigger result element.
const elTriggerResult = document.getElementById("triggerResult");
// Cache the active display name element.
const elActiveDisplayName = document.getElementById("activeDisplayName");
// Cache the active screen tag element.
const elActiveScreenTag = document.getElementById("activeScreenTag");
// Cache the dashboard table container element.
const elDashTable = document.getElementById("dashTable");

// Hold the latest display payload from the KIP API.
let state = null;
// Hold the latest keys payload from the API.
let keys = null;
// Track which display is currently focused in the UI.
let activeDisplayId = null;
// Track the active Signal K WebSocket connection.
let skSocket = null;
// Track the reconnect timer for Signal K streaming.
let skReconnectTimer = null;
// Cache the last selected display id from Signal K updates.
let lastSelectedDisplayId = null;
// Cache the last selected screen index from Signal K updates.
let lastSelectedScreenIndex = null;

// Build an API URL for a relative path.
function pluginUrl(p) {
  // Normalize the path and append it to the plugin base.
  return PLUGIN_BASE + p.replace(/^\//, "");
}

// Build a KIP API URL for a relative path.
function kipUrl(p) {
  // Normalize the path and append it to the KIP base.
  return KIP_BASE + p.replace(/^\//, "");
}

// Fetch JSON from the plugin API with no caching.
async function getPluginJson(p) {
  // Request the URL and disable cache.
  const res = await fetch(pluginUrl(p), { cache: "no-store" });
  // Parse JSON safely, falling back to an empty object on errors.
  const data = await res.json().catch(() => ({}));
  // Return a consistent response envelope.
  return { ok: res.ok, status: res.status, data };
}

// Fetch JSON from the KIP API with no caching.
async function getKipJson(p) {
  // Request the URL and disable cache.
  const res = await fetch(kipUrl(p), { cache: "no-store" });
  // Parse JSON safely, falling back to an empty object on errors.
  const data = await res.json().catch(() => ({}));
  // Return a consistent response envelope.
  return { ok: res.ok, status: res.status, data };
}

// Send JSON to the plugin API via POST.
async function postPluginJson(p, body) {
  // Issue a POST request with optional JSON payload.
  const res = await fetch(pluginUrl(p), {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  // Parse JSON safely, falling back to an empty object on errors.
  const data = await res.json().catch(() => ({}));
  // Return a consistent response envelope.
  return { ok: res.ok, status: res.status, data };
}

// Send JSON to the KIP API via POST.
async function postKipJson(p, body) {
  // Issue a POST request with optional JSON payload.
  const res = await fetch(kipUrl(p), {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  // Parse JSON safely, falling back to an empty object on errors.
  const data = await res.json().catch(() => ({}));
  // Return a consistent response envelope.
  return { ok: res.ok, status: res.status, data };
}

// Normalize a display list response into an array.
function normalizeDisplayList(payload) {
  // Return the payload when it is already an array.
  if (Array.isArray(payload)) return payload;
  // Return nested displays when present.
  if (payload && Array.isArray(payload.displays)) return payload.displays;
  // Return nested items when present.
  if (payload && Array.isArray(payload.items)) return payload.items;
  // Default to an empty array.
  return [];
}

// Normalize a dashboards response into an array.
function normalizeDashboards(payload) {
  // Return the payload when it is already an array.
  if (Array.isArray(payload)) return payload;
  // Return nested dashboards when present.
  if (payload && Array.isArray(payload.dashboards)) return payload.dashboards;
  // Return nested items when present.
  if (payload && Array.isArray(payload.items)) return payload.items;
  // Default to an empty array.
  return [];
}

// Normalize a screenIndex payload into a number.
function normalizeScreenIndex(payload) {
  // Return numeric payloads directly.
  if (Number.isFinite(payload)) return Number(payload);
  // Return nested screenIndex when present.
  if (payload && Number.isFinite(payload.screenIndex)) return Number(payload.screenIndex);
  // Return nested index when present.
  if (payload && Number.isFinite(payload.index)) return Number(payload.index);
  // Return nested activeScreen when present.
  if (payload && Number.isFinite(payload.activeScreen)) return Number(payload.activeScreen);
  // Default to null when no usable index exists.
  return null;
}

// Ensure the keys payload has the expected shape.
function ensureKeysState() {
  // Initialize the keys container when missing.
  if (!keys) keys = {};
  // Initialize the last-key container when missing.
  if (!keys.last) keys.last = {};
}

// Update the last-key UI labels from the keys payload.
function updateLastKeyUi() {
  // Show the last key value.
  elLastKey.textContent = keys?.last?.lastKey || "—";
  // Show the last key timestamp.
  elLastKeyAt.textContent = keys?.last?.lastKeyAt || "—";
  // Show the last key code.
  elLastKeyCode.textContent = (keys?.last?.lastKeyCode ?? "—");
}

// Show an API error in the last-key status area.
function showApiError(message) {
  // Mark the last-key label as an error.
  elLastKey.textContent = "Error";
  // Provide context for troubleshooting.
  elLastKeyAt.textContent = message;
}

// Render the on-screen keypad from the keys payload.
function renderKeypad() {
  // Clear any previous keypad content.
  elKbd.innerHTML = "";
  // Exit early if there is no keys payload.
  if (!keys) return;

  // Pull the keypad layout rows or use an empty array.
  const layout = keys.layout || [];
  // Track the last pressed key (if present).
  const last = keys.last?.lastKey || null;

  // Build rows and buttons for each key.
  layout.forEach((row) => {
    // Create a row container element.
    const rowEl = document.createElement("div");
    // Apply the keypad row class for styling.
    rowEl.className = "kbdRow";
    // Iterate each key in the row.
    row.forEach((k) => {
      // Create a key button element.
      const b = document.createElement("div");
      // Highlight the button if it is the last pressed key.
      b.className = "btnKey" + (k === last ? " active" : "");
      // Set the visible key label.
      b.textContent = k;
      // Append the key to the current row.
      rowEl.appendChild(b);
    });
    // Append the row to the keypad container.
    elKbd.appendChild(rowEl);
  });
}

// Render the list of displays from the state payload.
function renderDisplays() {
  // Clear any previous display list content.
  elDisplayList.innerHTML = "";
  // Pull the display list or use an empty array.
  const displays = state?.displays || [];

  // Build list items for each display.
  displays.forEach((d) => {
    // Create the list item container.
    const div = document.createElement("div");
    // Mark the selected display visually.
    div.className = "item" + (d.id === activeDisplayId ? " sel" : "");
    // Show display name and current screen index.
    div.textContent = (d.name || d.id) + " (screenIndex " + (d.screenIndex ?? 0) + ")";
    // Set click handler to switch the active display.
    div.onclick = () => {
      // Update the active display id.
      activeDisplayId = d.id;
      // Refresh data to reflect the new selection.
      refreshKipData();
    };
    // Append the item to the display list.
    elDisplayList.appendChild(div);
  });

  // Default to the selected display if none is active yet.
  if (!activeDisplayId) activeDisplayId = (displays[0] && displays[0].id) || null;
}

// Render dashboards for the active display.
function renderDashboards() {
  // Clear any previous dashboard output.
  elDashTable.innerHTML = "";
  // Pull the display list or use an empty array.
  const displays = state?.displays || [];

  // Choose the current display based on active or selected id.
  const cur =
    displays.find((d) => d.id === activeDisplayId) ||
    displays[0];

  // Exit early if no display is available.
  if (!cur) return;

  // Show the active display name.
  elActiveDisplayName.textContent = cur.name || cur.id;
  // Show the active display screen index.
  elActiveScreenTag.textContent = "screenIndex: " + (cur.screenIndex ?? 0);

  // Pull dashboards or use an empty array.
  const dashboards = cur.dashboards || [];
  // Determine the shown dashboard index.
  const shown = Number(cur.screenIndex ?? 0);
  // Render each dashboard entry.
  dashboards.forEach((dash, i) => {
    // Create the container for this dashboard row.
    const div = document.createElement("div");
    // Determine a friendly name for the dashboard.
    const name = dash.name || dash.id || ("Dashboard " + (i + 1));

    // Build the dashboard summary HTML.
    div.innerHTML =
      "<div><b>" + name + "</b> " + (i === shown ? "(shown)" : "") + "</div>" +
      "<div class='muted'>id: " + dash.id + "</div>" +
      "<div class='muted'>play: <code>none</code></div>";

    // Create a show button for this dashboard.
    const btn = document.createElement("button");
    // Label the button for clarity.
    btn.textContent = "Show";
    // On click, request the KIP activeScreen change.
    btn.onclick = async () => {
      // Post the screen change for the current display.
      await postKipJson(`displays/${encodeURIComponent(cur.id)}/activeScreen`, { changeId: dash.id });
      // Refresh to reflect the new state.
      await refreshKipData();
    };

    // Attach the button to the dashboard container.
    div.appendChild(btn);
    // Add spacing between dashboard entries.
    div.style.marginTop = "10px";
    // Append the dashboard container to the table.
    elDashTable.appendChild(div);
  });
}

// Load key layout and last-key data from the plugin API.
async function refreshKeysLayout() {
  // Request the plugin keys payload.
  const k = await getPluginJson("api/keys");
  // Report errors clearly when the plugin API is unavailable.
  if (!k.ok) {
    showApiError("Cannot reach plugin API (keys=" + k.status + ")");
    return;
  }
  // Store the latest keys data for rendering.
  keys = k.data;
  // Ensure the keys payload has the expected structure.
  ensureKeysState();
  // Update the last-key UI from the payload.
  updateLastKeyUi();
  // Render the keypad layout.
  renderKeypad();
}

// Load KIP display/dashboard data and repaint the UI.
async function refreshKipData() {
  // Request the KIP display list.
  const d = await getKipJson("displays");
  // Report errors clearly when the KIP API is unavailable.
  if (!d.ok) {
    showApiError("Cannot reach KIP API (kip=" + d.status + ")");
    return;
  }

  // Normalize the KIP display list response.
  const displayList = normalizeDisplayList(d.data);
  // Build the detailed display data for dashboards and screen indices.
  const displayData = await Promise.all(
    displayList.map(async (display) => {
      // Pull the display id from KIP payloads.
      const id = String(display?.id || display?.displayId || "").trim();
      // Skip entries without an id.
      if (!id) return null;
      // Pull a friendly display name from KIP payloads.
      const name = String(display?.name || id);
      // Fetch dashboards and screen index concurrently.
      const [dashRes, idxRes] = await Promise.all([
        getKipJson(`displays/${encodeURIComponent(id)}`),
        getKipJson(`displays/${encodeURIComponent(id)}/screenIndex`)
      ]);
      // Normalize dashboards or default to an empty array.
      const dashboards = dashRes.ok ? normalizeDashboards(dashRes.data) : [];
      // Normalize screen index or default to zero.
      const screenIndex = idxRes.ok ? (normalizeScreenIndex(idxRes.data) ?? 0) : 0;
      // Return the normalized display data for rendering.
      return { id, name, dashboards, screenIndex };
    })
  );
  // Store the latest KIP display data for rendering.
  state = { displays: displayData.filter(Boolean) };

  // Prefer the selected display id from Signal K if present.
  if (lastSelectedDisplayId) activeDisplayId = lastSelectedDisplayId;

  // Re-render the display list.
  renderDisplays();
  // Re-render dashboards for the active display.
  renderDashboards();
}

// Wire the test trigger button to the API call.
document.getElementById("triggerPlay").onclick = async () => {
  // Show a loading message while triggering.
  elTriggerResult.textContent = "Triggering...";
  // Call the trigger play endpoint.
  const r = await postPluginJson("api/triggerPlay");
  // Report success or error result payload.
  elTriggerResult.textContent = r.ok ? ("OK: " + JSON.stringify(r.data.action)) : ("ERR: " + JSON.stringify(r.data));
};

// Build the Signal K WebSocket stream URL for subscriptions.
function buildSignalKStreamUrl() {
  // Choose wss for https and ws for http.
  const protocol = location.protocol === "https:" ? "wss://" : "ws://";
  // Point to the Signal K stream endpoint on this host.
  return protocol + location.host + "/signalk/v1/stream";
}

// Schedule a reconnect attempt for the Signal K stream.
function scheduleStreamReconnect() {
  // Avoid stacking reconnect timers.
  if (skReconnectTimer) return;
  // Retry after a short delay to avoid hammering the server.
  skReconnectTimer = setTimeout(() => {
    // Clear the timer before reconnecting.
    skReconnectTimer = null;
    // Restart the Signal K subscription.
    startSignalKSubscription();
  }, 2000);
}

// Handle a single delta value update.
function handleDeltaValue(path, value) {
  // Ignore updates without a path.
  if (!path) return;
  // Ensure the keys payload has a target container.
  ensureKeysState();

  // Update the last key name.
  if (path === "self.qxs001.lastKey") {
    // Store the updated key label.
    keys.last.lastKey = value;
    // Refresh the last-key UI text.
    updateLastKeyUi();
    // Re-render the keypad highlight.
    renderKeypad();
    return;
  }

  // Update the last key timestamp.
  if (path === "self.qxs001.lastKeyAt") {
    // Store the updated timestamp.
    keys.last.lastKeyAt = value;
    // Refresh the last-key UI text.
    updateLastKeyUi();
    return;
  }

  // Update the last key numeric code.
  if (path === "self.qxs001.lastKeyCode") {
    // Store the updated key code.
    keys.last.lastKeyCode = value;
    // Refresh the last-key UI text.
    updateLastKeyUi();
    return;
  }

  // Update the selected display id when it changes.
  if (path === "self.qxs001.kip.selectedDisplayId") {
    // Normalize the display id value.
    const nextId = String(value || "").trim();
    // Ignore empty or unchanged selections.
    if (!nextId || nextId === lastSelectedDisplayId) return;
    // Cache the selection and update UI focus.
    lastSelectedDisplayId = nextId;
    // Keep the active display aligned with the selected display.
    activeDisplayId = nextId;
    // Refresh KIP data to reflect the new selection.
    refreshKipData();
    return;
  }

  // Update the selected screen index when it changes.
  if (path === "self.qxs001.kip.selectedScreenIndex") {
    // Normalize the screen index to a number.
    const nextIndex = Number(value);
    // Ignore non-numeric updates.
    if (!Number.isFinite(nextIndex)) return;
    // Ignore unchanged screen index updates.
    if (nextIndex === lastSelectedScreenIndex) return;
    // Cache the new screen index.
    lastSelectedScreenIndex = nextIndex;
    // Refresh KIP data to show the newly selected dashboard.
    refreshKipData();
  }
}

// Handle Signal K delta messages from the stream.
function handleDeltaMessage(payload) {
  // Ignore payloads without updates.
  if (!payload || !Array.isArray(payload.updates)) return;
  // Iterate through updates in the delta message.
  payload.updates.forEach((update) => {
    // Iterate through the updated values.
    (update.values || []).forEach((entry) => {
      // Apply each delta value update.
      handleDeltaValue(entry?.path, entry?.value);
    });
  });
}

// Start the Signal K WebSocket subscription.
function startSignalKSubscription() {
  // Close any existing socket to avoid duplicate streams.
  if (skSocket) skSocket.close();
  // Build the stream URL for this host.
  const url = buildSignalKStreamUrl();
  // Create a new WebSocket connection.
  const ws = new WebSocket(url);
  // Track the socket so it can be closed or reused later.
  skSocket = ws;

  // Send the subscription request when the socket opens.
  ws.onopen = () => {
    // Build the subscription message for qxs001 paths.
    const msg = {
      context: "vessels.self",
      subscribe: [{ path: "self.qxs001", period: 0 }]
    };
    // Send the subscription message as JSON.
    ws.send(JSON.stringify(msg));
  };

  // Parse incoming delta messages.
  ws.onmessage = (event) => {
    // Prepare a container for the parsed JSON.
    let data = null;
    try {
      // Attempt to parse the JSON payload.
      data = JSON.parse(event.data || "{}");
    } catch (_) {
      // Skip invalid JSON payloads.
      return;
    }
    // Apply delta updates to the UI.
    handleDeltaMessage(data);
  };

  // Reconnect when the stream closes.
  ws.onclose = () => {
    // Schedule a reconnect attempt.
    scheduleStreamReconnect();
  };

  // Reconnect on errors after closing the socket.
  ws.onerror = () => {
    // Close the socket to trigger the reconnect logic.
    ws.close();
  };
}

// Kick off the initial data load and stream subscription.
(async () => {
  // Load the initial keys layout and last-key values.
  await refreshKeysLayout();
  // Load the initial display and dashboard data.
  await refreshKipData();
  // Start the Signal K subscription for live updates.
  startSignalKSubscription();
})();
