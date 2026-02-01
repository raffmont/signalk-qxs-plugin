# Plugin endpoints

Mounted at: `/plugins/signalk-qxs-plugin/`

- `GET  /plugins/signalk-qxs-plugin/api/status` -> JSON status for the UI
- `GET  /plugins/signalk-qxs-plugin/display` -> `{ value: <displayId|null> }`
- `PUT  /plugins/signalk-qxs-plugin/display` -> body `{ value: <displayId|null> }`
- `PUT  /plugins/signalk-qxs-plugin/dashboard` -> body `{ displayId, index }`

The requirement mentions `/plugins/qxs/display`. In Signal K, plugin routers are normally mounted at
`/plugins/<plugin-id>/...`. This plugin provides `/plugins/signalk-qxs-plugin/display`.

If you *must* have the exact path `/plugins/qxs/display`, you can add a reverse-proxy rule or rename
the plugin id to `qxs` (not recommended if you want the npm name to remain signalk-qxs-plugin).
