exports.config =
  modules: ["jshint", "coffeescript", "copy"]
  watch:
    sourceDir: "src"
    compiledDir: "lib"
    javascriptDir: null
  coffeescript:
    options:
      sourceMap: false
  jshint:
    exclude:[/almond.js/]
    rules:
      node: true