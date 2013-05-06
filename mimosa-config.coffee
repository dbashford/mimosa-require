exports.config =
  modules: ["lint"]
  watch:
    sourceDir: "src"
    compiledDir: "lib"
    javascriptDir: null
  lint:
    exclude:[/almond.js/]
    rules:
      javascript:
        node: true