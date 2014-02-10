"use strict"

fs = require 'fs'
path = require 'path'

wrench = require 'wrench'
_ = require 'lodash'

registry = require './register'

baseUrl = null
cachingPath = null
aliasFiles = null

exports.cache = (config, options, next) ->
  cachingPath = config.require.optimize.moduleCachingPathFull
  baseUrl = options.runConfigs[0].baseUrl
  unless fs.existsSync cachingPath
    config.log.debug "Creating caching dir [[ #{cachingPath} ]]"
    wrench.mkdirSyncRecursive cachingPath, 0o0777

  _fetchAliasFiles()

  rConfig = options.runConfigs[0]
  rConfig.modules.forEach (mod) ->
    {cachePath, filePath} = _pathNames mod.name
    _write filePath, cachePath

  next()

exports.checkCache = (config, options, next) ->
  _fetchAliasFiles()
  rConfig = options.runConfigs[0]
  rConfig.modules.map (mod) ->
    _pathNames mod.name
  .filter (paths) ->
    for file in options.files
      if file.outputFileName is paths.filePath
        # is new file, write to cache
        _write paths.filePath, paths.cachePath
        return false
    true
  .forEach (paths) ->
    # not new mods so need to be copied over from cache
    _write paths.cachePath, paths.filePath

  next()

_fetchAliasFiles = ->
  aliasFiles =  if registry.aliasFiles
    _(registry.aliasFiles).values().reduce((left, right) -> _.extend(left, right))
  else
    null

_pathNames = (modName) ->
  if aliasFiles?[modName]
    modName = aliasFiles[modName].replace(baseUrl, '').replace(".js", '')
  filePath = path.join baseUrl, modName + ".js"
  cachePath = path.join cachingPath, modName + ".js"

  filePath: filePath
  cachePath: cachePath

_write = (thisFile, thatFile) ->
  text = fs.readFileSync(thisFile).toString()
  fs.writeFileSync thatFile, text

_firstFileNewer = (fileOne, fileTwo) ->
  fs.statSync(fileOne).mtime > fs.statSync(fileTwo).mtime