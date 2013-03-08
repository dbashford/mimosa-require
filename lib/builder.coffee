"use strict"

path = require 'path'

_ = require 'lodash'
logger =  require 'logmimosa'

requireRegister = require './register'

class Optimizer

  buildRunConfig: (config, fileName, doneCallback) =>
    return unless config.isOptimize
    if fileName?
      logger.debug "Going to optimize for [[ #{fileName} ]]"

    if config.require.optimize.inferConfig is false
      @_configForNoInfer(config, doneCallback)
    else
      files = if fileName
        logger.debug "Looking for main modules that need optimizing for file [[ #{fileName} ]]"
        requireRegister.treeBasesForFile(fileName)
      else
        requireRegister.treeBases()

      numFiles = files.length
      logger.debug "Mimosa found #{numFiles} base config files"
      if numFiles is 0
        logger.warn "No main modules found.  Not running optimization."
        doneCallback()
      else
        runConfigs = for file in files
          @_setupConfigForModule(config, file)
        doneCallback(runConfigs)

  _configForNoInfer: (config, callback) ->
    logger.debug "Optimizer will not be inferring config"
    ors = config.require.optimize.overrides
    if Object.keys(ors).length is 0
      logger.warn "inferConfig set to false, but no overrides have been provided"
      logger.warn "Cannot run optmization"
      callback()
    else
      # See https://github.com/jrburke/r.js/issues/262, must verify here to stop r.js from process.exit
      unless ors.name? or ors.include? or ors.modules?
        logger.error "Missing either a 'name', 'include' or 'modules' option in your require overrides"
        logger.warn "Cannot run optmization, require.optimize.overrides is missing key value(s)"
        return callback()

      unless ors.out? or ors.dir?
        logger.error "Missing either an \"out\" or \"dir\" config value. If using \"appDir\" for a full project optimization, use \"dir\". If you want to optimize to one file, use \"out\"."
        logger.warn "Cannot run optmization, require.optimize.overrides is missing key value(s)"
        return callback()

      callback([config.require.optimize.overrides])

  _setupConfigForModule: (config, file) =>
    runConfig = if typeof config.require.optimize.overrides is "object"
      _.clone(config.require.optimize.overrides, true)
    else
      {}

    runConfig.optimize = if config.isOptimize and config.isMinify
      "none"
    else
      "uglify2"

    baseUrl = path.join config.watch.compiledDir, config.watch.javascriptDir
    name = file.replace(baseUrl + path.sep, '').replace('.js', '')
    runConfig.logLevel = 3                  unless runConfig.logLevel? or runConfig.logLevel is null
    runConfig.baseUrl = baseUrl             unless runConfig.baseUrl? or runConfig.baseUrl is null
    runConfig.mainConfigFile = file         unless runConfig.mainConfigFile? or runConfig.mainConfigFile is null
    runConfig.findNestedDependencies = true unless runConfig.findNestedDependencies? or runConfig.findNestedDependencies is null
    runConfig.include = [name]              unless runConfig.include? or runConfig.include is null
    runConfig.insertRequire = [name]        unless runConfig.insertRequire? or runConfig.insertRequire is null
    runConfig.wrap = true                   unless runConfig.wrap? or runConfig.wrap is null
    runConfig.name = 'almond'               unless runConfig.name? or runConfig.name is null
    runConfig.out = if runConfig.out is null
      undefined
    else if runConfig.out
      path.join runConfig.baseUrl, runConfig.out
    else
      path.join runConfig.baseUrl, name + "-built.js"

    if typeof config.require.optimize.overrides is "function"
      config.require.optimize.overrides runConfig

    if !config.isBuild and runConfig.optimize is "uglify2"
      runConfig.generateSourceMaps = true       unless runConfig.generateSourceMaps?
      runConfig.preserveLicenseComments = false unless runConfig.preserveLicenseComments?

    runConfig

exports.buildRunConfig = new Optimizer().buildRunConfig