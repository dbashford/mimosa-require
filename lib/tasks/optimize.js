"use strict";
var Optimize, fs, logger, path, requirejs,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

path = require('path');

fs = require('fs');

requirejs = require('requirejs');

logger = require('logmimosa');

Optimize = (function() {
  function Optimize() {
    this._executeOptimize = __bind(this._executeOptimize, this);
    this.execute = __bind(this.execute, this);
    var almondInPath;
    almondInPath = path.join(__dirname, "assets", "almond.js");
    this.almondText = fs.readFileSync(almondInPath, "utf8");
  }

  Optimize.prototype.execute = function(runConfig, callback) {
    var almondOutPath,
      _this = this;
    if (((runConfig.name != null) && runConfig.name !== 'almond') || runConfig.name === null) {
      logger.info("r.js name changed from default of 'almond', so not using almond.js");
    } else {
      almondOutPath = path.join(runConfig.baseUrl, "almond.js");
      if (!fs.existsSync(almondOutPath)) {
        fs.writeFileSync(almondOutPath, this.almondText, 'utf8');
      }
    }
    return this._executeOptimize(runConfig, function() {
      logger.info("Requirejs optimization complete.");
      return callback();
    });
  };

  Optimize.prototype._logRunConfig = function(runConfig) {
    var cache, outString;
    if (logger.isDebug) {
      cache = [];
      outString = JSON.stringify(runConfig, function(key, value) {
        if (typeof value === 'object' && value !== null) {
          if (cache.indexOf(value) !== -1) {
            return;
          }
          cache.push(value);
        }
        return value;
      }, 2);
      logger.debug("Config for r.js run:\n" + outString);
      return cache = null;
    }
  };

  Optimize.prototype._executeOptimize = function(runConfig, callback) {
    var err,
      _this = this;
    logger.info("Beginning r.js optimization to result in [[ " + runConfig.out + " ]]");
    this._logRunConfig(runConfig);
    try {
      return requirejs.optimize(runConfig, function(buildResponse) {
        var i, reportLine, reportLines, _i, _len;
        reportLines = buildResponse.split("\n");
        for (i = _i = 0, _len = reportLines.length; _i < _len; i = ++_i) {
          reportLine = reportLines[i];
          if (reportLine.indexOf('---') === 0) {
            runConfig.filesUsed = reportLines.splice(i + 1, reportLines.length - (i + 2));
            break;
          }
        }
        logger.success("The compiled file [[ " + runConfig.out + " ]] is ready for use.", true);
        return callback();
      });
    } catch (_error) {
      err = _error;
      logger.error("Error occured inside r.js optimizer, error is as follows... " + err);
      return callback();
    }
  };

  return Optimize;

})();

exports.execute = new Optimize().execute;
