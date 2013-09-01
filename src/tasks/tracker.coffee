"use strict"

fs = require 'fs'
path = require 'path'

wrench = require 'wrench'
_ = require 'lodash'
logger = require 'logmimosa'

trackingInfo = {}

_createEmptyTrackingInfo = ->
  trackingInfo =
    shims:{}
    deps:{}
    aliases:{}
    mappings:{}
    originalConfig:{}
    requireFiles:[]

config = {}
trackingFilePath = ""

exports.setConfig = (_config) ->
  config = _config
  trackingFilePath = config.require.tracking.pathFull

exports.requireFiles = (_requireFiles) ->
  trackingInfo.requireFiles = []
  _requireFiles.forEach (f) ->
    trackingInfo.requireFiles.push f.replace config.root, ''
  _writeTrackingObject()

_setVals = (type, fName, _vals) ->
  f = fName.replace config.root, ''
  trackingInfo[type][f] = _vals
  _writeTrackingObject()

exports.shims = (fileName, shims) ->
  _setVals 'shims', fileName, shims

exports.deps = (fileName, deps) ->
  _setVals 'deps', fileName, deps

exports.deleteForFile = (fileName) ->
  fileName = fileName.replace config.root, ''
  ['shims', 'deps', 'aliases', 'mappings'].forEach (key) ->
    if trackingInfo[key][fileName]? or trackingInfo[key][fileName] is null
      delete trackingInfo[key][fileName]

  if trackingInfo.requireFiles.indexOf(fileName) > -1
    trackingInfo.requireFiles = _.without(trackingInfo.requireFiles, fileName)

  _writeTrackingObject()

exports.aliases = (fileName, paths) ->
  _setVals 'aliases', fileName, paths

exports.mappings = (fileName, maps) ->
  _setVals 'mappings', fileName, maps

exports.originalConfig = (_originalConfig) ->
  trackingInfo.originalConfig = _originalConfig
  _writeTrackingObject()

tryFileWrite = (fPath, data) ->
  fs.writeFileSync fPath, JSON.stringify(data, null, 2)

_writeTrackingObject = ->
  try
    tryFileWrite trackingFilePath, trackingInfo
  catch err
    dir = path.dirname trackingFilePath
    if fs.exists dir
      logger.error "Could not write tracking file [[ #{trackingFilePath} ]]", err
    else
      wrench.mkdirSyncRecursive dir, 0o0777
      try
        tryFileWrite trackingFilePath, trackingInfo
      catch err
        logger.error "Could not write tracking file [[ #{trackingFilePath} ]]", err

_setNewPathValues = (nti, name) ->
  nti[name] = {}
  Object.keys(trackingInfo[name]).forEach (key) ->
    newKey = path.join config.root, key
    nti[name][newKey] = trackingInfo[name][key]

_validateAndSetTrackingInfo = (ti) ->

  allPaths = ti.requireFiles
  ['shims', 'deps', 'aliases', 'mappings'].forEach (key) ->
    allPaths = allPaths.concat Object.keys(ti[key])

  allPaths = _.uniq allPaths

  badPaths = []
  for p in allPaths
    unless fs.existsSync p
      badPaths.push p

  if badPaths.length > 0

    logger.info "mimosa-require has bad tracking information and will need to rebuild its tracking information by forcing a recompile of all JavaScript. Nothing to worry about, this can be caused by moving, changing or deleting files while Mimosa isn't watching."
    if logger.isDebug
      badPathsMsg = badPaths.join('\n')
      logger.debug badPathsMsg
    config.__forceJavaScriptRecompile = true
    _createEmptyTrackingInfo()
    trackingInfo
  else
    ti

exports.readTrackingObject = ->
  if fs.existsSync trackingFilePath
    trackingInfo = require trackingFilePath
    newTrackingInfo =
      originalConfig: trackingInfo.originalConfig

    newTrackingInfo.requireFiles = trackingInfo.requireFiles.map (f) -> path.join config.root, f

    _setNewPathValues newTrackingInfo, "aliases"
    _setNewPathValues newTrackingInfo, "shims"
    _setNewPathValues newTrackingInfo, "deps"
    _setNewPathValues newTrackingInfo, "mappings"

    _validateAndSetTrackingInfo newTrackingInfo
  else
    trackingInfo

_createEmptyTrackingInfo()