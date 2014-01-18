"use strict"

fs = require 'fs'
path = require 'path'

logger = require 'logmimosa'
wrench = require "wrench"
_ = require 'lodash'

requireRegister = require './tasks/register'
optimizer = require './tasks/optimize'
builder = require './tasks/builder'
moduleCacher = require './tasks/caching'

exports.registration = (config, register) ->

  return unless config.require.verify.enabled or config.isOptimize
  e = config.extensions
  register ['postClean'],                     'init',                _clean
  register ['add','update','buildFile'],      'betweenCompileWrite', _requireRegister, e.javascript
  register ['add','update','buildExtension'], 'betweenCompileWrite', _requireRegister, e.template
  register ['remove'],                        'afterDelete',         _requireDelete,   e.javascript
  register ['postBuild'],                     'beforeOptimize',      _buildDone

  if config.isOptimize
    register ['add','update','remove'], 'beforeOptimize', _buildOptimizeConfigsFile, [e.javascript..., e.template...]
    register ['add','update','remove'], 'optimize',       _requireOptimize,          [e.javascript..., e.template...]
    register ['postBuild'],             'beforeOptimize', _buildOptimizeConfigs
    register ['postBuild'],             'optimize',       _requireOptimize

    if config.isBuild
      register ['add','update','remove'], 'afterOptimize',  _removeCombined,         [e.javascript..., e.template...]
      register ['postBuild'],             'optimize',       _removeCombined

  # remove the tracking file
  if config.isBuild and config.require.tracking.enabled
    if fs.existsSync config.require.tracking.pathFull
      fs.unlinkSync config.require.tracking.pathFull

  # If watching, and optimizing, and using modules, then need to cache the unmodified
  # files before r.js jacks them up, and then manage while watching
  if config.isWatch and config.isOptimize and config.require.optimize.modules
    register ['postBuild'], 'beforeOptimize', moduleCacher.cache
    register ['update'],    'beforeOptimize', moduleCacher.checkCache

  requireRegister.setConfig(config)

exports.aliasForPath = (libPath) ->
  requireRegister.aliasForPath(libPath)

exports.requireConfig = ->
  requireRegister.retrieveOriginalMergedConfig()

exports.dependencyInfo = (config) ->
  requireRegister.dependencyInfo config

exports.manipulatePathWithAlias = (filePath) ->
  requireRegister.manipulatePathWithAlias filePath

_clean = (config, options, next) ->
  jsDir = path.join config.watch.compiledDir, config.watch.javascriptDir
  if fs.existsSync jsDir
    files = wrench.readdirSyncRecursive(jsDir)
      .filter (f) ->
        keep = /-built\.js(\.map|\.src)?$/.test(f) or /almond\.js(\.map|\.src\.js)?/.test(f)
        if config.require.optimize.modules
          keep = keep or /build\.txt$/.test(f) or /\.js\.src\.js$/.test(f) or /\.js\.map$/.test(f)
        keep
      .map (f) ->
        f = path.join jsDir, f
        fs.unlinkSync f
        logger.success "Deleted file [[ #{f} ]]"

  if config.require.tracking.enabled
    if fs.existsSync config.require.tracking.pathFull
      fs.unlinkSync config.require.tracking.pathFull

  if fs.existsSync config.require.optimize.moduleCachingPathFull
    wrench.rmdirSyncRecursive config.require.optimize.moduleCachingPathFull

  next()

_requireDelete = (config, options, next) ->
  hasFiles = options.files?.length > 0
  return next() unless hasFiles
  requireRegister.remove(options.files[0].outputFileName)
  next()

_requireRegister = (config, options, next) ->
  hasFiles = options.files?.length > 0
  return next() unless hasFiles
  return next() if options.isVendor
  options.files.forEach (file) ->
    outf = file.outputFileName
    if outf?.match(/\.js$/) and file.outputFileText
      if config.require?.excludeRegex? and outf.match config.require.excludeRegex
        logger.debug "skipping require processing of [[ #{outf} ]], file is excluded via regex"
      else if config.require.exclude.indexOf(outf) > -1
        logger.debug "skipping require wrapping for [[ #{outf} ]], file is excluded via string path"
      else
        requireRegister.process outf, file.outputFileText

  next()

_buildOptimizeConfigsFile = (config, options, next) ->
  hasFiles = options.files?.length > 0
  return next() unless hasFiles

  filesDone = 0
  allRunConfigs = []
  done = (runConfigs) ->
    if runConfigs
      allRunConfigs = allRunConfigs.concat runConfigs

    if options.files.length is ++filesDone
      if allRunConfigs.length > 0
        options.runConfigs = allRunConfigs
      logger.debug "Total of [[ #{allRunConfigs.length} ]] r.js run configs generated."
      next()

  options.files.forEach (file) ->
    if file.outputFileName and file.outputFileText
      builder.buildRunConfig config, file.outputFileName, done
    else
      done()

_buildOptimizeConfigs = (config, options, next) ->
  builder.buildRunConfig config, null, (runConfigs) ->
    if runConfigs
      options.runConfigs = runConfigs
      logger.debug "Total of [[ #{runConfigs.length} ]] r.js run configs generated."
    else
      logger.debug "No r.js run configs generated."
    next()

_requireOptimize = (config, options, done) ->
  return done() unless options.runConfigs
  return done() if options.runConfigs.length is 0

  i = 0
  next = =>
    if i < options.runConfigs.length
      optimizer.execute options.runConfigs[i++], next
    else
      done()
  next()

_removeCombined = (config, options, next) ->
  return next() unless options.runConfigs

  for runConfig in options.runConfigs
    if runConfig.filesUsed? and Array.isArray(runConfig.filesUsed)
      for f in runConfig.filesUsed
        if fs.existsSync(f)
          logger.debug "Removing [[ #{f} ]]"
          fs.unlinkSync(f)

  jsDir = config.watch.compiledJavascriptDir
  directories = wrench.readdirSyncRecursive(jsDir).map (f) -> path.join jsDir, f
  directories = directories.filter (f) -> fs.statSync(f).isDirectory()

  _.sortBy(directories, 'length').reverse().forEach (dirPath) ->
    if fs.existsSync dirPath
      try
        fs.rmdirSync dirPath
        logger.debug "Deleted directory [[ #{dirPath} ]]"
      catch err
        if err?.code is not "ENOTEMPTY"
          logger.error "Unable to delete directory, #{dirPath}"
          logger.error err

  next()

_buildDone = (config, options, next) ->
  requireRegister.buildDone()
  next()
