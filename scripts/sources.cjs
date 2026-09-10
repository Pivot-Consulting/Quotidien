// One ordered manifest shared by the production build and the regression harnesses.
module.exports = {
  core: [
    ".build/core.js",
    ".build/os.js",
    ".build/personal.js",
    ".build/planning.js",
    ".build/intelligence.js",
  ],
  ui: [
    "modules/os-ui.js",
    "modules/personal-ui.js",
    "modules/cockpit-ui.js",
    "app.js",
  ],
};
