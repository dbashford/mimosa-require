"use strict"

config = require './config'
plugin = require './plugin'

module.exports =
  registration: plugin.registration
  aliasForPath: plugin.aliasForPath
  defaults:     config.defaults
  placeholder:  config.placeholder
  validate:     config.validate
