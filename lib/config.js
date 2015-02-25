"use strict";
var path;

path = require("path");

exports.defaults = function() {
  return {
    require: {
      exclude: [],
      commonConfig: "common",
      tracking: {
        enabled: true,
        path: ".mimosa/require/tracking.json"
      },
      verify: {
        enabled: true,
        plugins: {
          css: "css",
          hbs: "hbs"
        }
      },
      optimize: {
        moduleCachingPath: ".mimosa/require/moduleCaching",
        inferConfig: true,
        modules: null,
        overrides: {},
        removeCombined: true
      }
    }
  };
};

exports.validate = function(config, validators) {
  var cameInAsForced, err, errors, javascriptDir, logger, obj, trackingData;
  logger = config.log;
  errors = [];
  if (validators.ifExistsIsObject(errors, "require config", config.require)) {
    javascriptDir = path.join(config.watch.compiledDir, config.watch.javascriptDir);
    validators.ifExistsFileExcludeWithRegexAndString(errors, "require.exclude", config.require, javascriptDir);
    if (validators.ifExistsIsObject(errors, "require.verify", config.require.verify)) {
      validators.ifExistsIsBoolean(errors, "require.verify.enabled", config.require.verify.enabled);
      if (validators.ifExistsIsObject(errors, "require.verify.plugins", config.require.verify.plugins)) {
        Object.keys(config.require.verify.plugins).forEach(function(key) {
          if (!((typeof config.require.verify.plugins[key] === "string") || config.require.verify.plugins[key] === null)) {
            return errors.push("require.verify.plugins values must be strings");
          }
        });
      }
    }
    if (validators.ifExistsIsObject(errors, "require.optimize", config.require.optimize)) {
      if (validators.ifExistsIsString(errors, "require.optimize.moduleCachingPath", config.require.optimize.moduleCachingPath)) {
        config.require.optimize.moduleCachingPathFull = path.join(config.root, config.require.optimize.moduleCachingPath);
      }
      if (validators.ifExistsIsArrayOfObjects(errors, "require.optimize.modules", config.require.optimize.modules)) {
        if (config.require.optimize.modules) {
          if (!(config.require.optimize.modules.length > 0)) {
            errors.push("require.optimize.modules array, when provided, cannot be empty.");
          }
        }
      }
      validators.ifExistsIsBoolean(errors, "require.optimize.inferConfig", config.require.optimize.inferConfig);
      if (config.require.optimize.overrides != null) {
        obj = config.require.optimize.overrides;
        if (!((typeof obj === "object" && !Array.isArray(obj)) || typeof obj === "function")) {
          errors.push("require.optimize.overrides must be an object or a function");
        }
      }
    }
    config.require.commonConfig = validators.ifExistsIsString(errors, "require.commonConfig", config.require.commonConfig) ? path.join(config.watch.compiledDir, config.watch.javascriptDir, config.require.commonConfig + ".js") : null;
    if (validators.ifExistsIsObject(errors, "require.verify", config.require.tracking)) {
      validators.ifExistsIsBoolean(errors, "require.tracking.enabled", config.require.tracking.enabled);
      if (validators.ifExistsIsString(errors, "require.tracking.path", config.require.tracking.path)) {
        config.require.tracking.pathFull = path.join(config.root, config.require.tracking.path);
      }
    }
  }
  if (errors.length === 0) {
    if (config.isOptimize && config.isMinify) {
      logger.info("Optimize and minify both selected, setting r.js optimize property to 'none'");
    }
    cameInAsForced = config.__forceJavaScriptRecompile === true;
    if (!cameInAsForced) {
      config.__forceJavaScriptRecompile = config.require.verify.enabled || config.isOptimize;
    }
    if (config.isWatch && config.require.tracking.enabled) {
      try {
        trackingData = require(config.require.tracking.pathFull);
        if (!cameInAsForced) {
          config.__forceJavaScriptRecompile = false;
        }
      } catch (_error) {
        err = _error;
        logger.debug("Problem requiring require tracking file", err);
        logger.debug("mimosa-require: javascript files need recompiling");
        config.__forceJavaScriptRecompile = true;
      }
    }
  }
  return errors;
};
