"use strict";
var Optimize, fs, logger, path, requirejs,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

path = require('path');

fs = require('fs');

requirejs = null;

logger = null;

Optimize = (function() {
  function Optimize() {
    this._executeOptimize = __bind(this._executeOptimize, this);
    this.execute = __bind(this.execute, this);
    var almondInPath;
    almondInPath = path.join(__dirname, "assets", "almond.js");
    this.almondText = fs.readFileSync(almondInPath, "utf8");
  }

  Optimize.prototype.execute = function(config, runConfig, callback) {
    var almondOutPath,
      _this = this;
    logger = config.log;
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
    if (logger.isDebug()) {
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
    if (runConfig.out) {
      logger.info("Beginning r.js optimization to result in [[ " + runConfig.out + " ]]");
    } else {
      logger.info("Beginning r.js optimization");
    }
    this._logRunConfig(runConfig);
    if (!requirejs) {
      requirejs = require('requirejs');
    }
    try {
      return requirejs.optimize(runConfig, function(buildResponse) {
        if (runConfig.out) {
          _this._reportSingleFileOutput(runConfig, buildResponse);
        } else if (runConfig.dir) {
          _this._reportMultiFileOutput(runConfig);
        } else {
          logger.debug("Unexpected exit, not .out, not .dir.");
        }
        return callback();
      });
    } catch (_error) {
      err = _error;
      logger.error("Error occured inside r.js optimizer, error is as follows... " + err, {
        exitIfBuild: true
      });
      return callback();
    }
  };

  Optimize.prototype._reportSingleFileOutput = function(runConfig, buildResponse) {
    var builtFile, i, reportLine, reportLines, _i, _len;
    reportLines = buildResponse.split("\n");
    builtFile = void 0;
    for (i = _i = 0, _len = reportLines.length; _i < _len; i = ++_i) {
      reportLine = reportLines[i];
      if (reportLine.indexOf('---') === 0) {
        runConfig.filesUsed = reportLines.splice(i + 1, reportLines.length - (i + 2)).filter(function(used) {
          return used !== builtFile;
        });
        break;
      } else {
        builtFile = reportLine;
      }
    }
    return logger.success("The compiled file [[ " + builtFile + " ]] is ready for use.", true);
  };

  Optimize.prototype._reportMultiFileOutput = function(runConfig) {
    var buildResponse, buildTxtPath, f, filesBuiltReportLines, filesUsed, _i, _len;
    buildTxtPath = path.join(runConfig.dir, "build.txt");
    if (fs.existsSync(buildTxtPath)) {
      buildResponse = fs.readFileSync(buildTxtPath, "ascii");
      filesBuiltReportLines = buildResponse.split('\n\n');
      filesUsed = [];
      for (_i = 0, _len = filesBuiltReportLines.length; _i < _len; _i++) {
        f = filesBuiltReportLines[_i];
        this._reportSingleFileOutput(runConfig, f);
        filesUsed = filesUsed.concat(runConfig.filesUsed);
      }
      return runConfig.filesUsed = filesUsed.map(function(f) {
        return path.join(runConfig.dir, f);
      });
    } else {
      return logger.info("Cannot locate build.txt for post r.js run cleanup purposes.");
    }
  };

  return Optimize;

})();

exports.execute = new Optimize().execute;
