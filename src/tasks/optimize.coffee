"use strict"

path = require 'path'
fs =   require 'fs'

requirejs = null
logger =  null

class Optimize

  constructor: ->
    almondInPath  = path.join __dirname, "assets", "almond.js"
    @almondText = fs.readFileSync almondInPath, "utf8"

  execute: (config, runConfig, callback) =>
    logger = config.log
    if (runConfig.name? and runConfig.name isnt 'almond') or runConfig.name is null
      logger.info "r.js name changed from default of 'almond', so not using almond.js"
    else
      almondOutPath = path.join runConfig.baseUrl, "almond.js"
      unless fs.existsSync(almondOutPath)
        fs.writeFileSync almondOutPath, @almondText, 'utf8'

    @_executeOptimize runConfig, =>
      logger.info "Requirejs optimization complete."
      callback()

  _logRunConfig: (runConfig) ->
    if logger.isDebug()
      cache = []
      outString = JSON.stringify(runConfig, (key, value) ->
        if (typeof value is 'object' and value isnt null)
          return if cache.indexOf(value) isnt -1
          cache.push(value)
        value
      , 2)
      logger.debug "Config for r.js run:\n#{outString}"
      cache = null

  _executeOptimize: (runConfig, callback) =>
    if runConfig.out
      logger.info "Beginning r.js optimization to result in [[ #{runConfig.out} ]]"
    else
      logger.info "Beginning r.js optimization"

    @_logRunConfig runConfig

    unless requirejs
      requirejs = require 'requirejs'

    try
      requirejs.optimize runConfig, (buildResponse) =>
        if runConfig.out
          @_reportSingleFileOutput runConfig, buildResponse
        else if runConfig.dir
          @_reportMultiFileOutput runConfig
        else
          logger.debug "Unexpected exit, not .out, not .dir."
        callback()
    catch err
      logger.error "Error occured inside r.js optimizer, error is as follows... #{err}", {exitIfBuild:true}
      callback()

  _reportSingleFileOutput: (runConfig, buildResponse)->
    reportLines = buildResponse.split("\n")
    builtFile = undefined
    for reportLine, i in reportLines
      if reportLine.indexOf('---') is 0
        runConfig.filesUsed = reportLines.splice(i + 1, reportLines.length - (i + 2)).filter (used) ->
          used isnt builtFile
        break
      else
        builtFile = reportLine

    logger.success "The compiled file [[ #{builtFile} ]] is ready for use.", true

  _reportMultiFileOutput: (runConfig) ->
    buildTxtPath = path.join runConfig.dir, "build.txt"
    if fs.existsSync buildTxtPath
      buildResponse = fs.readFileSync buildTxtPath, "ascii"
      filesBuiltReportLines = buildResponse.split('\n\n')
      filesUsed = []
      for f in filesBuiltReportLines
        @_reportSingleFileOutput runConfig, f
        filesUsed = filesUsed.concat runConfig.filesUsed
      runConfig.filesUsed = filesUsed.map (f) -> path.join runConfig.dir, f
    else
      logger.info "Cannot locate build.txt for post r.js run cleanup purposes."

exports.execute = new Optimize().execute