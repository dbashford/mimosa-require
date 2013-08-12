"use strict";
var Optimizer, fs, logger, path, requireRegister, _,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

path = require('path');

fs = require('fs');

_ = require('lodash');

logger = require('logmimosa');

requireRegister = require('./register');

Optimizer = (function() {
  function Optimizer() {
    this._setupConfigForModule = __bind(this._setupConfigForModule, this);
    this.buildRunConfig = __bind(this.buildRunConfig, this);
  }

  Optimizer.prototype.buildRunConfig = function(config, fileName, doneCallback) {
    var file, files, numFiles, runConfigs;
    if (!config.isOptimize) {
      return;
    }
    if (fileName != null) {
      logger.debug("Going to optimize for [[ " + fileName + " ]]");
    }
    if (config.require.optimize.inferConfig === false) {
      return this._configForNoInfer(config, doneCallback);
    } else {
      files = fileName ? (logger.debug("Looking for main modules that need optimizing for file [[ " + fileName + " ]]"), requireRegister.treeBasesForFile(fileName)) : requireRegister.treeBases();
      if (config.require.commonConfig) {
        files = files.filter(function(f) {
          return f !== config.require.commonConfig;
        });
      }
      numFiles = files.length;
      logger.debug("Mimosa found " + numFiles + " base config files");
      if (numFiles === 0) {
        logger.warn("No main modules found.  Not running optimization.");
        return doneCallback();
      } else {
        runConfigs = (function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = files.length; _i < _len; _i++) {
            file = files[_i];
            _results.push(this._setupConfigForModule(config, file));
          }
          return _results;
        }).call(this);
        return doneCallback(runConfigs);
      }
    }
  };

  Optimizer.prototype._configForNoInfer = function(config, callback) {
    var ors;
    logger.debug("Optimizer will not be inferring config");
    ors = config.require.optimize.overrides;
    if (Object.keys(ors).length === 0) {
      logger.warn("inferConfig set to false, but no overrides have been provided");
      logger.warn("Cannot run optmization");
      return callback();
    } else {
      if (!((ors.name != null) || (ors.include != null) || (ors.modules != null))) {
        logger.error("Missing either a 'name', 'include' or 'modules' option in your require overrides");
        logger.warn("Cannot run optmization, require.optimize.overrides is missing key value(s)");
        return callback();
      }
      if (!((ors.out != null) || (ors.dir != null))) {
        logger.error("Missing either an \"out\" or \"dir\" config value. If using \"appDir\" for a full project optimization, use \"dir\". If you want to optimize to one file, use \"out\".");
        logger.warn("Cannot run optmization, require.optimize.overrides is missing key value(s)");
        return callback();
      }
      return callback([config.require.optimize.overrides]);
    }
  };

  Optimizer.prototype._setupConfigForModule = function(config, file) {
    var baseUrl, configFile, name, runConfig;
    runConfig = typeof config.require.optimize.overrides === "object" ? _.clone(config.require.optimize.overrides, true) : {};
    runConfig.optimize = config.isOptimize && config.isMinify ? "none" : "uglify2";
    baseUrl = path.join(config.watch.compiledDir, config.watch.javascriptDir);
    name = file.replace(baseUrl + path.sep, '').replace('.js', '').split(path.sep).join('/');
    if (!((runConfig.logLevel != null) || runConfig.logLevel === null)) {
      runConfig.logLevel = 3;
    }
    if (!((runConfig.baseUrl != null) || runConfig.baseUrl === null)) {
      runConfig.baseUrl = baseUrl;
    }
    configFile = fs.existsSync(config.require.commonConfig) ? config.require.commonConfig : file;
    if (!((runConfig.mainConfigFile != null) || runConfig.mainConfigFile === null)) {
      runConfig.mainConfigFile = configFile;
    }
    if (!((runConfig.findNestedDependencies != null) || runConfig.findNestedDependencies === null)) {
      runConfig.findNestedDependencies = true;
    }
    if (!((runConfig.include != null) || runConfig.include === null)) {
      runConfig.include = [name];
    }
    if (!((runConfig.insertRequire != null) || runConfig.insertRequire === null)) {
      runConfig.insertRequire = [name];
    }
    if (!((runConfig.wrap != null) || runConfig.wrap === null)) {
      runConfig.wrap = true;
    }
    if (!((runConfig.name != null) || runConfig.name === null)) {
      runConfig.name = 'almond';
    }
    runConfig.out = runConfig.out === null ? void 0 : runConfig.out ? path.join(runConfig.baseUrl, runConfig.out) : path.join(runConfig.baseUrl, name.split('/').join(path.sep) + "-built.js");
    if (typeof config.require.optimize.overrides === "function") {
      config.require.optimize.overrides(runConfig);
    }
    if (!config.isBuild && runConfig.optimize === "uglify2") {
      if (runConfig.generateSourceMaps == null) {
        runConfig.generateSourceMaps = true;
      }
      if (runConfig.preserveLicenseComments == null) {
        runConfig.preserveLicenseComments = false;
      }
    }
    return runConfig;
  };

  return Optimizer;

})();

exports.buildRunConfig = new Optimizer().buildRunConfig;
