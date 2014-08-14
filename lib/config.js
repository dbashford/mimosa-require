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
        overrides: {}
      }
    }
  };
};

exports.placeholder = function() {
  return "\t\n\n  require:                   # configuration for requirejs options.\n    exclude:[]               # Regex or string paths. Paths can be absolute or relative to the\n                             # watch.javascriptDir. These files will be excluded from all\n                             # require module functionality. That includes AMD verification and\n                             # being considered a root level file to be optimized.\n    commonConfig: \"common\"   # The path from 'javascriptDir' to the location of common requirejs\n                             # config. This is config shared across multiple requirejs modules.\n                             # This should be either a require.config({}) or a requirejs.config({})\n                             # function call. Defaults to the value `common` - referring to a file\n                             # named common.js in the root of javascriptDir. Does not need to\n                             #  exist, so can be left alone if a commonConfig is not being used.\n    tracking:                # every time mimosa starts up, mimosa-require needs to be able to\n                             # build a dependency graph for the codebase. It can do that by\n                             # processing all the files, but that means each file needs to be\n                             # processed when mimosa watch starts which slows down startup.\n                             # tracking allows mimosa-require to write interim state to the file\n                             # system so that from one mimosa run to another it can persist the\n                             # important information and not need the entire application to be\n                             # rebuilt\n      enabled: true          # whether or not tracking is enabled\n      path: \".mimosa/require/tracking.json\" # the path to the tracking file relative to the\n                             # root of the project.\n    verify:                  # settings for requirejs path verification\n      enabled: true          # Whether or not to perform verification\n      plugins:               # config for plugins. mimosa-require will verify plugin paths that\n                             # are listed as dependencies. It does not keep track of plugins\n                             # otherwise.\n        css:\"css\"            # these are the built-in default plugins. The key is the name of the\n        hbs:\"hbs\"            # plugin, the value before the !, and the value is the extension used\n                             # for those files. If you update this setting to add a new plugin,\n                             # consider opening a mimosa-require issue to make that plugin another\n                             # default. If the extension is already a part of the dependency path\n                             # set the value to null.\n    optimize :\n      inferConfig:true       # Mimosa figures out all you'd need for a simple r.js optimizer run.\n                             # If you rather Mimosa not do that, set inferConfig to false and\n                             # provide your config in the overrides section. See here\n                             # https://github.com/dbashford/mimosa#requirejs-optimizer-defaults\n                             # to see what the defaults are.\n      modules:               # If using a modules config, place it here. mimosa-require will use\n                             # the modules config directly, but also base many other r.js config\n                             # options based on a modules setup instead of a single file setup.\n      moduleCachingPath: \".mimosa/require/moduleCaching\" # Only valid if using modules. This\n                             # path is where pristine root module files are kept in between r.js\n                             # runs. This cache allows you to keep \"mimosa watch\" running while\n                             # building and rebuilding your application.\n      overrides:             # Optimization configuration and Mimosa overrides. If you need to\n                             # make tweaks uncomment this line and add the r.js config\n                             # (http://requirejs.org/docs/optimization.html#options) as new\n                             # paramters inside the overrides ojbect. To unset Mimosa's defaults,\n                             # set a property to null.\n                             #\n                             # overrides can also be a function that takes mimosa-require's\n                             # inferred config for each module. This allows the inferred config\n                             # to be updated and enhanced instead of just overridden.\n";
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
