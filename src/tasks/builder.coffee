"use strict"

path = require 'path'
fs = require 'fs'

_ = require 'lodash'

requireRegister = require './register'

logger =  null

exports.buildRunConfig = (config, fileName, doneCallback) ->
  return unless config.isOptimize

  logger = config.log

  if fileName?
    logger.debug "Going to optimize for [[ #{fileName} ]]"

  if config.require.optimize.inferConfig is false
    _configForNoInfer(config, doneCallback)
  else
    files = if fileName
      logger.debug "Looking for main modules that need optimizing for file [[ #{fileName} ]]"
      requireRegister.treeBasesForFile(fileName)
    else
      requireRegister.treeBases()

    # remove common config file if there
    if config.require.commonConfig
      files = files.filter (f) -> f isnt config.require.commonConfig

    numFiles = files.length
    logger.debug "Mimosa found #{numFiles} base config files"
    if numFiles is 0
      logger.info "No main modules found.  Not running optimization."
      doneCallback()
    else
      runConfigs = for file in files
        _setupConfigForModule(config, file)
      doneCallback(runConfigs)

_configForNoInfer = (config, callback) ->
  logger.debug "Optimizer will not be inferring config"
  ors = config.require.optimize.overrides
  if Object.keys(ors).length is 0
    logger.warn "inferConfig set to false, but no overrides have been provided"
    logger.warn "Cannot run optmization"
    callback()
  else
    # See https://github.com/jrburke/r.js/issues/262, must verify here to stop r.js from process.exit
    unless ors.name? or ors.include? or ors.modules?
      logger.error "Missing either a 'name', 'include' or 'modules' option in your require overrides", {exitIfBuild:true}
      logger.warn "Cannot run optmization, require.optimize.overrides is missing key value(s)"
      return callback()

    unless ors.out? or ors.dir?
      logger.error "Missing either an \"out\" or \"dir\" config value. If using \"appDir\" for a full project optimization, use \"dir\". If you want to optimize to one file, use \"out\".", {exitIfBuild:true}
      logger.warn "Cannot run optmization, require.optimize.overrides is missing key value(s)"
      return callback()

    callback([config.require.optimize.overrides])

_setupConfigForModule = (config, file) ->
  runConfig = if typeof config.require.optimize.overrides is "object"
    _.clone(config.require.optimize.overrides, true)
  else
    {}

  if config.isOptimize and config.isMinify
    runConfig.optimize = "none"
  else
    unless runConfig.optimize?
      runConfig.optimize = "uglify2"

  configFile = if fs.existsSync config.require.commonConfig then config.require.commonConfig else file
  baseUrl = path.join config.watch.compiledDir, config.watch.javascriptDir

  #runConfig.allowSourceOverwrites = true  unless runConfig.allowSourceOverwrites? or runConfig.allowSourceOverwrites is null
  runConfig.logLevel = 3                  unless runConfig.logLevel? or runConfig.logLevel is null
  runConfig.baseUrl = baseUrl             unless runConfig.baseUrl? or runConfig.baseUrl is null
  runConfig.wrap = true                   unless runConfig.wrap? or runConfig.wrap is null
  runConfig.findNestedDependencies = true unless runConfig.findNestedDependencies? or runConfig.findNestedDependencies is null
  runConfig.mainConfigFile = configFile   unless runConfig.mainConfigFile? or runConfig.mainConfigFile is null

  # When using modules, have different default config
  # need dir instead of out, need to keep build dir or r.js removes it
  if config.require.optimize.modules
    runConfig.dir = path.relative config.root, config.watch.compiledJavascriptDir
    runConfig.modules = _.clone config.require.optimize.modules, true
    runConfig.keepBuildDir = true
  else
    name = file.replace(baseUrl + path.sep, '').replace('.js', '').split(path.sep).join('/')
    runConfig.include = [name]              unless runConfig.include? or runConfig.include is null
    runConfig.insertRequire = [name]        unless runConfig.insertRequire? or runConfig.insertRequire is null
    runConfig.name = 'almond'               unless runConfig.name? or runConfig.name is null
    runConfig.out = if runConfig.out is null
      undefined
    else if runConfig.out
      path.join runConfig.baseUrl, runConfig.out
    else
      path.join runConfig.baseUrl, name.split('/').join(path.sep) + "-built.js"

  if typeof config.require.optimize.overrides is "function"
    config.require.optimize.overrides runConfig

  if config.require.optimize.modules and config.isWatch
    unless runConfig.generateSourceMaps?
      runConfig.generateSourceMaps = false
      logger.info "Disabling source maps for module-based r.js compiles. If you need source maps, use the overrides configuration. module-based source maps will only work with the initial compile and will not work with recompiles."
    else
      if runConfig.generateSourceMaps
        logger.warn "Source maps force enabled during 'mimosa watch' for modules optimization. When modules + source maps + watch used, optimization can only successfully be run once. Subsequent optimization runs during this 'mimosa watch' will likely result in bad output."

  if not config.isBuild and runConfig.optimize is "uglify2"
    runConfig.generateSourceMaps = true       unless runConfig.generateSourceMaps?
    runConfig.preserveLicenseComments = false unless runConfig.preserveLicenseComments?

  runConfig