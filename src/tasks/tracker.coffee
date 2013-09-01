"use strict"

fs = require 'fs'
path = require 'path'

wrench = require 'wrench'
_ = require 'lodash'
logger = require 'logmimosa'

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
  writeTrackingObject()

setVals = (type, fName, _vals) ->
  f = fName.replace config.root, ''
  trackingInfo[type][f] = _vals
  writeTrackingObject()

exports.shims = (fileName, shims) ->
  setVals 'shims', fileName, shims

exports.deps = (fileName, deps) ->
  setVals 'deps', fileName, deps

exports.deleteForFile = (fileName) ->
  fileName = fileName.replace config.root, ''
  ['shims', 'deps', 'aliases', 'mappings'].forEach (key) ->
    if trackingInfo[key][fileName]? or trackingInfo[key][fileName] is null
      delete trackingInfo[key][fileName]

  if trackingInfo.requireFiles.indexOf(fileName) > -1
    trackingInfo.requireFiles = _.without(trackingInfo.requireFiles, fileName)

  writeTrackingObject()

exports.aliases = (fileName, paths) ->
  setVals 'aliases', fileName, paths

exports.mappings = (fileName, maps) ->
  setVals 'mappings', fileName, maps

exports.originalConfig = (_originalConfig) ->
  trackingInfo.originalConfig = _originalConfig
  writeTrackingObject()

tryFileWrite = (fPath, data) ->
  fs.writeFileSync fPath, JSON.stringify(data, null, 2)

writeTrackingObject = ->
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

setNewPathValues = (nti, name) ->
  nti[name] = {}
  Object.keys(trackingInfo[name]).forEach (key) ->
    newKey = path.join config.root, key
    nti[name][newKey] = trackingInfo[name][key]

exports.readTrackingObject = ->
  if fs.existsSync trackingFilePath
    trackingInfo = require trackingFilePath
    newTrackingInfo =
      originalConfig: trackingInfo.originalConfig

    newTrackingInfo.requireFiles = trackingInfo.requireFiles.map (f) -> path.join config.root, f

    setNewPathValues newTrackingInfo, "aliases"
    setNewPathValues newTrackingInfo, "shims"
    setNewPathValues newTrackingInfo, "deps"
    setNewPathValues newTrackingInfo, "mappings"

    newTrackingInfo
  else
    trackingInfo
