"use strict";
var logger, path;

logger = require('logmimosa');

path = require("path");

exports.defaults = function() {
  return {
    require: {
      commonConfig: "common",
      verify: {
        enabled: true
      },
      optimize: {
        inferConfig: true,
        overrides: {}
      }
    }
  };
};

exports.placeholder = function() {
  return "\t\n\n  # require:                 # configuration for requirejs options.\n    # commonConfig: \"common\" # The path from 'javascriptDir' to the location of common requirejs\n                             # config. This is config shared across multiple requirejs modules.\n                             # The should be or a requirejs.config({}) function call. Defaults\n                             # to a file named `common` in the root of the javascriptDir. Does\n                             # not need to exist, so can be left alone if a commonConfig is not\n                             # being used.\n    # verify:                # settings for requirejs path verification\n      # enabled: true        # Whether or not to perform verification\n    # optimize :\n      # inferConfig:true     # Mimosa figures out all you'd need for a simple r.js optimizer run.\n                             # If you rather Mimosa not do that, set inferConfig to false and\n                             # provide your config in the overrides section. See here\n                             # https://github.com/dbashford/mimosa#requirejs-optimizer-defaults\n                             # to see what the defaults are.\n      # overrides:           # Optimization configuration and Mimosa overrides. If you need to\n                             # make tweaks uncomment this line and add the r.js config\n                             # (http://requirejs.org/docs/optimization.html#options) as new\n                             # paramters inside the overrides ojbect. To unset Mimosa's defaults,\n                             # set a property to null.\n                             #\n                             # overrides can also be a function that takes mimosa-require's\n                             # inferred config for each module. This allows the inferred config\n                             # to be updated and enhanced instead of just overridden.";
};

exports.validate = function(config, validators) {
  var errors, obj;
  errors = [];
  if (validators.ifExistsIsObject(errors, "require config", config.require)) {
    if (validators.ifExistsIsObject(errors, "require.verify", config.require.verify)) {
      validators.ifExistsIsBoolean(errors, "require.verify.enabled", config.require.verify.enabled);
    }
    if (validators.ifExistsIsObject(errors, "require.optimize", config.require.optimize)) {
      validators.ifExistsIsBoolean(errors, "require.optimize.inferConfig", config.require.optimize.inferConfig);
      if (config.require.optimize.overrides != null) {
        obj = config.require.optimize.overrides;
        if (!((typeof obj === "object" && !Array.isArray(obj)) || typeof obj === "function")) {
          errors.push("require.optimize.overrides must be an object or a function");
        }
      }
    }
    config.require.commonConfig = validators.ifExistsIsString(errors, "require.commonConfig", config.require.commonConfig) ? path.join(config.watch.compiledDir, config.watch.javascriptDir, config.require.commonConfig + ".js") : null;
  }
  if (errors.length === 0) {
    if (config.isOptimize && config.isMinify) {
      logger.info("Optimize and minify both selected, setting r.js optimize property to 'none'");
    }
    config.requireRegister = config.require.verify.enabled || config.isOptimize;
  }
  return errors;
};
