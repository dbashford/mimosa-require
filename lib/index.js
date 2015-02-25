"use strict";
var config, plugin;

config = require('./config');

plugin = require('./plugin');

module.exports = {
  registration: plugin.registration,
  aliasForPath: plugin.aliasForPath,
  requireConfig: plugin.requireConfig,
  dependencyInfo: plugin.dependencyInfo,
  manipulatePathWithAlias: plugin.manipulatePathWithAlias,
  defaults: config.defaults,
  validate: config.validate
};
