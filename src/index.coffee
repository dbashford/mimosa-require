"use strict"

config = require './config'
plugin = require './plugin'

module.exports =
  registration:            plugin.registration
  aliasForPath:            plugin.aliasForPath
  requireConfig:           plugin.requireConfig
  dependencyInfo:          plugin.dependencyInfo
  manipulatePathWithAlias: plugin.manipulatePathWithAlias
  defaults:                config.defaults
  placeholder:             config.placeholder
  validate:                config.validate
