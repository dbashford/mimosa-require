"use strict"

fs = require 'fs'
path = require 'path'

wrench = require 'wrench'
_ = require 'lodash'
logger = require 'logmimosa'

trackingInfo = {}

startupFilesProcessed = []

trackKeys = ['shims', 'deps', 'aliases', 'mappings']

_createEmptyTrackingInfo = ->
  trackingInfo =
    shims:{}
    deps:{}
    aliases:{}
    mappings:{}
    originalConfig:{}
    requireFiles:[]
    packages:[]

config = {}
trackingFilePath = ""

exports.setConfig = (_config) ->
  config = _config
  trackingFilePath = config.require.tracking.pathFull

_handlePathPreWrite = (f) ->
  truncPath = f.replace config.watch.compiledDir, ''
  if process.platform is 'win32'
    truncPath = truncPath.split(path.sep).join('/')

  truncPath

exports.requireFiles = (_requireFiles) ->
  trackingInfo.requireFiles = []
  _requireFiles.sort()
  _requireFiles.forEach (fName) ->
    f = _handlePathPreWrite fName
    trackingInfo.requireFiles.push f
  _writeTrackingObject()

_setVals = (type, fName, _vals) ->
  f = _handlePathPreWrite fName
  trackingInfo[type][f] = _vals

  newObj  = {}
  _(trackingInfo[type]).keys().sort().map (f) -> newObj[f] = trackingInfo[type][f]
  trackingInfo[type] = newObj

  _writeTrackingObject()

['shims', 'deps', 'aliases', 'mappings', 'packages'].forEach (cfgKey) ->
  exports[cfgKey] = (fileName, cfgSegment) ->
    _setVals cfgKey, fileName, cfgSegment

exports.originalConfig = (_originalConfig) ->
  trackingInfo.originalConfig = _originalConfig
  _writeTrackingObject()

exports.deleteForFile = (fileName) ->
  fileName = fileName.replace config.watch.compiledDir, ''
  trackKeys.forEach (key) ->
    if trackingInfo[key][fileName]? or trackingInfo[key][fileName] is null
      delete trackingInfo[key][fileName]

  if trackingInfo.requireFiles.indexOf(fileName) > -1
    trackingInfo.requireFiles = _.without(trackingInfo.requireFiles, fileName)

  _writeTrackingObject()

_tryFileWrite = (fPath, data) ->
  fs.writeFileSync fPath, JSON.stringify(data, null, 2)

_writeTrackingObject = ->
  # don't go looking to verify the folder is there every time
  # just catch it the one time it is not
  try
    _tryFileWrite trackingFilePath, trackingInfo
  catch err
    dir = path.dirname trackingFilePath
    if fs.exists dir
      logger.error "Could not write tracking file [[ #{trackingFilePath} ]]", err
    else
      wrench.mkdirSyncRecursive dir, 0o0777
      try
        _tryFileWrite trackingFilePath, trackingInfo
      catch err
        logger.error "Could not write tracking file [[ #{trackingFilePath} ]]", err

_validateAndSetTrackingInfo = (ti) ->
  allPaths = ti.requireFiles
  trackKeys.forEach (key) ->
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

_removeFileFromTracking = (f) ->
  trackKeys.forEach (key) ->
    _removeFileFromObjectKey f, trackingInfo[key]

  requireFileIndex = trackingInfo.requireFiles.indexOf f
  if requireFileIndex > -1
    trackingInfo.requireFiles.splice requireFileIndex, 1

_removeFileFromObjectKey = (f, obj) ->
  deleteKeys = []
  Object.keys(obj).forEach (k) ->
    if f is k
      deleteKeys.push k

  for k in deleteKeys
    delete obj[k]

# This will get called once all the files are built to verify that all the files referenced
# in the tracking info are valid. It checks all the files that are built against the tracking
# info, and checks the output files vs input files to make sure no stale files are left in
# the tracking info
exports.validateTrackingInfoPostBuild = (reigsterRemoveCb)->
  w = config.watch
  sourceFiles = _getFiles(config, config.extensions.javascript, w.sourceDir).map (f) ->
    f.replace path.extname(f), ".js"
  compiledFiles = _getFiles(config, ["js"], w.compiledDir)
  transformedSourceFiles = sourceFiles.map (f) -> f.replace w.sourceDir, w.compiledDir
  _.difference(compiledFiles, transformedSourceFiles).filter (f) ->
    startupFilesProcessed.indexOf(f) is -1
  .map (f) ->
    f.replace config.watch.compiledDir, ''
  .forEach (f) ->
    logger.debug "Removing [[ #{f} ]] from mimosa-require tracking information"
    _removeFileFromTracking f
    reigsterRemoveCb f

_getFiles = (config, exts,  dir) ->
  wrench.readdirSyncRecursive(dir)
    .map (f) ->
      path.join dir, f
    .filter (f) ->
      fs.statSync(f).isFile()
    .filter (f) ->
      ext = path.extname(f).substring(1)
      exts.indexOf(ext) > -1

_setNewPathValues = (nti, name) ->
  nti[name] = {}
  Object.keys(trackingInfo[name]).forEach (key) ->
    newKey = path.join(config.watch.compiledDir, key).split('/').join(path.sep)
    nti[name][newKey] = trackingInfo[name][key]

exports.readTrackingObject = ->
  if fs.existsSync trackingFilePath
    trackingInfo = require trackingFilePath
    newTrackingInfo =
      originalConfig: trackingInfo.originalConfig

    newTrackingInfo.requireFiles = trackingInfo.requireFiles.map (f) ->
      p = path.join(config.watch.compiledDir, f)
      if process.platform is 'win32'
        p.split('/').join(path.sep)
      else
        p

    trackKeys.forEach (key) ->
      _setNewPathValues newTrackingInfo, key

    _validateAndSetTrackingInfo newTrackingInfo
  else
    trackingInfo

exports.fileProcessed = (f) ->
  startupFilesProcessed.push f

_createEmptyTrackingInfo()