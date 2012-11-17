"use strict"

path = require 'path'
fs =   require 'fs'

requirejs = require 'requirejs'
logger =  require 'logmimosa'
jsp = require("uglify-js").parser
pro = require("uglify-js").uglify

class Optimize

  constructor: ->
    almondInPath  = path.join __dirname, "assets", "almond.js"
    @almondText = fs.readFileSync almondInPath, "utf8"
    try
      @almondText = jsp.parse @almondText
      @almondText = pro.ast_mangle @almondText, {except:['require','requirejs','define']}
      @almondText = pro.ast_squeeze @almondText
      @almondText = pro.gen_code @almondText
    catch err
      logger.warn "Minification failed on [[ #{almondInPath} ]], writing unminified source\n#{err}"

  execute: (runConfig, callback) =>
    if (runConfig.name? and runConfig.name isnt 'almond') or runConfig.name is null
      logger.info "r.js name changed from default of 'almond', so not using almond.js"
    else
      almondOutPath = path.join runConfig.baseUrl, "almond.js"
      fs.writeFileSync almondOutPath, @almondText, 'utf8'

    @_executeOptimize runConfig, =>
      if almondOutPath?
        logger.debug "Removing Almond at [[ #{almondOutPath} ]]"
        fs.unlinkSync almondOutPath if fs.existsSync almondOutPath
      logger.info "Requirejs optimization complete."
      callback()

  _executeOptimize: (runConfig, callback) =>
    logger.info "Beginning r.js optimization to result in [[ #{runConfig.out} ]]"
    logger.debug "Config for r.js run:\n#{JSON.stringify(runConfig, null, 2)}"
    try
      requirejs.optimize runConfig, (buildResponse) =>
        logger.success "The compiled file [[ #{runConfig.out} ]] is ready for use.", true
        callback()
    catch err
      logger.error "Error occured inside r.js optimizer, error is as follows... #{err}"
      callback()

exports.execute = new Optimize().execute