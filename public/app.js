// Define the plugin API base path used by all requests.
const BASE = "/plugins/signalk-qxs001-plugin/";
// Populate the UI with the API base so users can see where requests go.
document.getElementById("apiBase").textContent = BASE;

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

// Hold the latest state payload from the API.
let state = null;
// Hold the latest keys payload from the API.
let keys = null;
// Track which display is currently focused in the UI.
let activeDisplayId = null;

// Build an API URL for a relative path.
function apiUrl(p) {
  // Normalize the path and append it to the base.
  return BASE + p.replace(/^\//, "");
}

// Fetch JSON from the API with no caching.
async function getJson(p) {
  // Request the URL and disable cache.
  const res = await fetch(apiUrl(p), { cache: "no-store" });
  // Parse JSON safely, falling back to an empty object on errors.
  const data = await res.json().catch(() => ({}));
  // Return a consistent response envelope.
  return { ok: res.ok, status: res.status, data };
}

// Send JSON to the API via POST.
async function postJson(p, body) {
  // Issue a POST request with optional JSON payload.
  const res = await fetch(apiUrl(p), {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  // Parse JSON safely, falling back to an empty object on errors.
  const data = await res.json().catch(() => ({}));
  // Return a consistent response envelope.
  return { ok: res.ok, status: res.status, data };
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
  // Capture the selected display from state if present.
  const selected = state?.selected?.selectedDisplayId || null;

  // Build list items for each display.
  displays.forEach((d) => {
    // Create the list item container.
    const div = document.createElement("div");
    // Mark the selected display visually.
    div.className = "item" + (d.displayId === selected ? " sel" : "");
    // Show display name and current screen index.
    div.textContent = (d.displayName || d.displayId) + " (screenIndex " + (d.screenIndex ?? 0) + ")";
    // Set click handler to switch the active display.
    div.onclick = () => {
      // Update the active display id.
      activeDisplayId = d.displayId;
      // Refresh data to reflect the new selection.
      refresh();
    };
    // Append the item to the display list.
    elDisplayList.appendChild(div);
  });

  // Default to the selected display if none is active yet.
  if (!activeDisplayId) activeDisplayId = selected || (displays[0] && displays[0].displayId) || null;
}

// Render dashboards for the active display.
function renderDashboards() {
  // Clear any previous dashboard output.
  elDashTable.innerHTML = "";
  // Pull the display list or use an empty array.
  const displays = state?.displays || [];
  // Capture the selected display from state if present.
  const selected = state?.selected?.selectedDisplayId || null;

  // Choose the current display based on active or selected id.
  const cur =
    displays.find((d) => d.displayId === (activeDisplayId || selected)) ||
    displays.find((d) => d.displayId === selected) ||
    displays[0];

  // Exit early if no display is available.
  if (!cur) return;

  // Show the active display name.
  elActiveDisplayName.textContent = cur.displayName || cur.displayId;
  // Show the active display screen index.
  elActiveScreenTag.textContent = "screenIndex: " + (cur.screenIndex ?? 0);

  // Pull dashboards or use an empty array.
  const dashboards = cur.dashboards || [];
  // Determine the shown dashboard index.
  const shown = Number(cur.screenIndex ?? 0);
  // Pull binding metadata or use an empty object.
  const bindings = cur.bindings || {};

  // Render each dashboard entry.
  dashboards.forEach((dash, i) => {
    // Create the container for this dashboard row.
    const div = document.createElement("div");
    // Determine a friendly name for the dashboard.
    const name = dash.name || dash.id || ("Dashboard " + (i + 1));
    // Pull the binding action, or default to none.
    const action = bindings[dash.id] || { type: "none" };

    // Build the dashboard summary HTML.
    div.innerHTML =
      "<div><b>" + name + "</b> " + (i === shown ? "(shown)" : "") + "</div>" +
      "<div class='muted'>id: " + dash.id + "</div>" +
      "<div class='muted'>play: <code>" + JSON.stringify(action) + "</code></div>";

    // Create a show button for this dashboard.
    const btn = document.createElement("button");
    // Label the button for clarity.
    btn.textContent = "Show";
    // On click, request the KIP activeScreen change.
    btn.onclick = async () => {
      // Post the screen change for the current display.
      await postJson("api/kip/activeScreen", { displayId: cur.displayId, changeId: i });
      // Refresh to reflect the new state.
      await refresh();
    };

    // Attach the button to the dashboard container.
    div.appendChild(btn);
    // Add spacing between dashboard entries.
    div.style.marginTop = "10px";
    // Append the dashboard container to the table.
    elDashTable.appendChild(div);
  });
}

// Load state and keys, then repaint the UI.
async function refresh() {
  // Fetch state and keys concurrently.
  const [s, k] = await Promise.all([getJson("api/state"), getJson("api/keys")]);

  // Handle API failures with a helpful message.
  if (!s.ok || !k.ok) {
    // Flag the UI as error.
    elLastKey.textContent = "Error";
    // Provide status details for troubleshooting.
    elLastKeyAt.textContent = "Cannot reach plugin API (state=" + s.status + ", keys=" + k.status + ")";
    return;
  }

  // Store the latest state data.
  state = s.data;
  // Store the latest keys data.
  keys = k.data;

  // Update last key value.
  elLastKey.textContent = state.lastKey || "—";
  // Update last key timestamp.
  elLastKeyAt.textContent = state.lastKeyAt || "—";
  // Update last key code.
  elLastKeyCode.textContent = (state.lastKeyCode ?? "—");

  // Re-render the keypad.
  renderKeypad();
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
  const r = await postJson("api/triggerPlay");
  // Report success or error result payload.
  elTriggerResult.textContent = r.ok ? ("OK: " + JSON.stringify(r.data.action)) : ("ERR: " + JSON.stringify(r.data));
};

// Kick off the first UI refresh.
refresh();
// Poll regularly to keep the UI current.
setInterval(refresh, 1200);
