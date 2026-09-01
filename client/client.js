/**
 * dsh-workbuddy-market browser client — T1 walking-skeleton bundle, written
 * by hand in the harness client-bundle format: `window.__ModuleLoader__
 * .load({ id, factory })`, CJS-style module, externals resolved through the
 * injected `require`. There is no build step — this file IS the artifact
 * package.json exports as "./client".
 *
 * This bundle exists to complete the package contract (dsh.client platform
 * + inject declaration, a loadable ./client export) so the host half is a
 * fully installable plugin from day one. The market settings page — the
 * source-path editor, refresh button, and expert-card grid over the routes
 * in src/routes.js — lands with the client ticket (P2); until then apply()
 * mounts nothing and requires nothing from the module table.
 */
window.__ModuleLoader__.load({ id: "dsh-workbuddy-market", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;

// The `require` parameter is intentionally unused: the skeleton has no
// externals. P2 will require react here (React.createElement, no JSX).

function apply(_ctx) {
  // Skeleton: nothing to mount yet — P2 renders the market page here.
  return function () {}
}

// Array-form inject only (object form means intercept config in this cordis).
// Empty for the skeleton: no client service is a dependency yet. P2 declares
// 'slots' (settings.section) and 'locale' here as the sister plugin does.
module.exports = { name: "dsh-workbuddy-market", inject: [], apply: apply }
return module.exports;
} });
