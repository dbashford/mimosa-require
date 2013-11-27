exports.config =
  modules: ["jshint"]
  watch:
    sourceDir: "src"
    compiledDir: "lib"
    javascriptDir: null
  jshint:
    exclude:[/almond.js/]
    rules:
      node: true