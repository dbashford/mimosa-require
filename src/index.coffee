"use strict"

config = require './config'
plugin = require './plugin'

module.exports =
  registration:  plugin.registration
  aliasForPath:  plugin.aliasForPath
  requireConfig: plugin.requireConfig
  defaults:      config.defaults
  placeholder:   config.placeholder
  validate:      config.validate
