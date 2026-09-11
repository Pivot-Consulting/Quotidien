// One ordered manifest shared by the production build and the regression harnesses.
module.exports = {
  core: [
    ".build/core.js",
    ".build/os.js",
    ".build/personal.js",
    ".build/planning.js",
    ".build/intelligence.js",
    ".build/durable.js",
    ".build/connected.js",
    ".build/focus.js",
    ".build/routines.js",
    ".build/vault.js",
    ".build/automation.js",
  ],
  ui: [
    "modules/drafts-ui.js",
    "modules/focus-ui.js",
    "modules/routines-ui.js",
    "modules/vault-ui.js",
    "modules/automation-ui.js",
    "modules/os-ui.js",
    "modules/personal-ui.js",
    "modules/cockpit-ui.js",
    "app.js",
  ],
};
