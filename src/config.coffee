"use strict"

path = require "path"

exports.defaults = ->
  require:
    exclude:[]
    commonConfig: "common"
    tracking:
      enabled: true
      path: ".mimosa/require/tracking.json"
    verify:
      enabled: true
      plugins:
        css:"css"
        hbs:"hbs"
    optimize :
      moduleCachingPath: ".mimosa/require/moduleCaching"
      inferConfig:true
      modules:null
      overrides:{}
      removeCombined: true

exports.validate = (config, validators) ->
  logger = config.log
  errors = []
  if validators.ifExistsIsObject(errors, "require config", config.require)
    javascriptDir = path.join config.watch.compiledDir, config.watch.javascriptDir
    validators.ifExistsFileExcludeWithRegexAndString(errors, "require.exclude", config.require, javascriptDir)

    if validators.ifExistsIsObject(errors, "require.verify", config.require.verify)
      validators.ifExistsIsBoolean(errors, "require.verify.enabled", config.require.verify.enabled)

      if validators.ifExistsIsObject(errors, "require.verify.plugins", config.require.verify.plugins)
        Object.keys(config.require.verify.plugins).forEach (key) ->
          unless (typeof config.require.verify.plugins[key] is "string") or config.require.verify.plugins[key] is null
            errors.push "require.verify.plugins values must be strings"

    if validators.ifExistsIsObject(errors, "require.optimize", config.require.optimize)
      if validators.ifExistsIsString(errors, "require.optimize.moduleCachingPath", config.require.optimize.moduleCachingPath)
        config.require.optimize.moduleCachingPathFull = path.join config.root, config.require.optimize.moduleCachingPath

      if validators.ifExistsIsArrayOfObjects(errors, "require.optimize.modules", config.require.optimize.modules)
        if config.require.optimize.modules
          unless config.require.optimize.modules.length > 0
            errors.push "require.optimize.modules array, when provided, cannot be empty."
      validators.ifExistsIsBoolean(errors, "require.optimize.inferConfig", config.require.optimize.inferConfig)
      if config.require.optimize.overrides?
        obj = config.require.optimize.overrides
        unless (typeof obj is "object" and not Array.isArray(obj)) or typeof obj is "function"
          errors.push "require.optimize.overrides must be an object or a function"

    config.require.commonConfig = if validators.ifExistsIsString(errors, "require.commonConfig", config.require.commonConfig)
      path.join config.watch.compiledDir, config.watch.javascriptDir, config.require.commonConfig + ".js"
    else
      null

    if validators.ifExistsIsObject(errors, "require.verify", config.require.tracking)
      validators.ifExistsIsBoolean(errors, "require.tracking.enabled", config.require.tracking.enabled)
      if validators.ifExistsIsString(errors, "require.tracking.path", config.require.tracking.path)
        config.require.tracking.pathFull = path.join config.root, config.require.tracking.path

  if errors.length is 0
    # need to set some requirejs stuff
    if config.isOptimize and config.isMinify
      logger.info "Optimize and minify both selected, setting r.js optimize property to 'none'"

    # helpful shortcut
    # But don't change it if something else set it to true
    cameInAsForced = config.__forceJavaScriptRecompile is true
    unless cameInAsForced
      config.__forceJavaScriptRecompile = config.require.verify.enabled or config.isOptimize

    # manage tracking
    if config.isWatch and config.require.tracking.enabled
      try
        trackingData = require config.require.tracking.pathFull
        unless cameInAsForced
          config.__forceJavaScriptRecompile = false
      catch err
        logger.debug "Problem requiring require tracking file", err
        logger.debug "mimosa-require: javascript files need recompiling"
        config.__forceJavaScriptRecompile = true

  errors
