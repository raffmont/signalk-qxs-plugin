async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function el(tag, attrs={}, children=[]) {
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return e;
}

function render(state) {
  const meta = document.getElementById('meta');
  meta.innerHTML = '';
  meta.appendChild(el('div', {}, [
    el('div', {}, [`Status: `, el('span', {class:'badge'}, [state.status || '—'])]),
    el('div', {}, [`KIP UUID: `, el('code', {}, [state.kipUuid || '—'])]),
    el('div', {}, [`Selected display: `, el('code', {}, [state.activeDisplayId ?? 'null'])]),
    el('div', {}, [`Last update: `, el('small', {}, [state.lastUpdated || '—'])]),
    state.errors?.length ? el('div', {class:'err'}, [`Errors: ${state.errors.length} (see console)`]) : el('div')
  ]));

  const cards = document.getElementById('cards');
  cards.innerHTML = '';

  const displays = state.displays || [];
  for (const d of displays) {
    const id = d.id;
    const isActive = id === state.activeDisplayId;
    const dashboards = state.dashboardsByDisplay?.[id] || null;
    const activeDash = state.activeDashboardByDisplay?.[id] ?? 0;
    const dashCount = dashboards ? dashboards.length : 0;

    const card = el('div', {class:'card'}, [
      el('div', {}, [
        el('b', {}, [id]),
        ' ',
        isActive ? el('span', {class:'badge'}, ['selected']) : el('span', {class:'badge'}, [''])
      ]),
      el('div', {}, [el('small', {}, ['Raw: ' + JSON.stringify(d.raw).slice(0, 120) + (JSON.stringify(d.raw).length > 120 ? '…' : '')])]),
      el('hr'),
      el('div', {}, [`Dashboards: `, el('code', {}, [String(dashCount)])]),
      el('div', {}, [`Active dashboard: `, el('code', {}, [String(activeDash)])]),
      el('div', {class:'row'}, [
        el('button', {class:'primary', onclick: async () => {
          await api('./display', {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({value:id})});
          await refresh();
        }}, ['Select display']),
        el('button', {onclick: async () => {
          await api('./dashboard', {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({displayId:id, index: Math.max(0, activeDash - 1)})});
          await refresh();
        }}, ['Prev dashboard']),
        el('button', {onclick: async () => {
          await api('./dashboard', {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({displayId:id, index: activeDash + 1})});
          await refresh();
        }}, ['Next dashboard'])
      ])
    ]);

    cards.appendChild(card);
  }
}

async function refresh() {
  const st = await api('./api/status');
  window.__qxs_state = st;
  render(st);
}

refresh();
setInterval(refresh, 1500);
