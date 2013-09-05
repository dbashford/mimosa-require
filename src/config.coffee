"use strict"

logger = require 'logmimosa'

path = require "path"

exports.defaults = ->
  require:
    exclude:[]
    commonConfig: "common"
    tracking:
      enabled: false
      path: ".mimosa/require/tracking.json"
    verify:
      enabled: true
    optimize :
      inferConfig:true
      overrides:{}

exports.placeholder = ->
  """
  \t

    # require:                 # configuration for requirejs options.
      # exclude:[]             # Regex or string paths. Paths can be absolute or relative to the
                               # watch.javascriptDir. These files will be excluded from all
                               # require module functionality. That includes AMD verification and
                               # being considered a root level file to be optimized.
      # commonConfig: "common" # The path from 'javascriptDir' to the location of common requirejs
                               # config. This is config shared across multiple requirejs modules.
                               # This should be either a require.config({}) or a requirejs.config({}) function call.
                               # Defaults to the value `common` - referring to a file named common.js in the root of javascriptDir.
                               # Does not need to exist, so can be left alone if a commonConfig is not
                               # being used.
      # tracking:              # every time mimosa starts up, mimosa-require needs to be able to
                               # build a dependency graph for the codebase. It can do that by
                               # processing all the files, but that means each file needs to be
                               # processed when mimosa watch starts which slows down startup.
                               # tracking allows mimosa-require to write interim state to the file
                               # system so that from one mimosa run to another it can persist the
                               # important information and not need the entire application to be
                               # rebuilt
        # enabled: false       # whether or not tracking is enabled
        # path: ".mimosa/require/tracking.json" # the path to the tracking file relative to the
                               # root of the project.
      # verify:                # settings for requirejs path verification
        # enabled: true        # Whether or not to perform verification
      # optimize :
        # inferConfig:true     # Mimosa figures out all you'd need for a simple r.js optimizer run.
                               # If you rather Mimosa not do that, set inferConfig to false and
                               # provide your config in the overrides section. See here
                               # https://github.com/dbashford/mimosa#requirejs-optimizer-defaults
                               # to see what the defaults are.
        # overrides:           # Optimization configuration and Mimosa overrides. If you need to
                               # make tweaks uncomment this line and add the r.js config
                               # (http://requirejs.org/docs/optimization.html#options) as new
                               # paramters inside the overrides ojbect. To unset Mimosa's defaults,
                               # set a property to null.
                               #
                               # overrides can also be a function that takes mimosa-require's
                               # inferred config for each module. This allows the inferred config
                               # to be updated and enhanced instead of just overridden.
  """

exports.validate = (config, validators) ->
  errors = []
  if validators.ifExistsIsObject(errors, "require config", config.require)
    javascriptDir = path.join config.watch.compiledDir, config.watch.javascriptDir
    validators.ifExistsFileExcludeWithRegexAndString(errors, "require.exclude", config.require, javascriptDir)

    if validators.ifExistsIsObject(errors, "require.verify", config.require.verify)
      validators.ifExistsIsBoolean(errors, "require.verify.enabled", config.require.verify.enabled)

    if validators.ifExistsIsObject(errors, "require.optimize", config.require.optimize)
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
    config.__forceJavaScriptRecompile = config.require.verify.enabled or config.isOptimize

    # manage tracking
    if config.isWatch and config.require.tracking.enabled
      try
        trackingData = require config.require.tracking.pathFull
        config.__forceJavaScriptRecompile = false
      catch err
        logger.debug "Problem requiring require tracking file", err
        logger.debug "mimosa-require: javascript files need recompiling"
        config.__forceJavaScriptRecompile = true

  errors