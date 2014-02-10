"use strict";
var builder, fs, logger, moduleCacher, optimizer, path, requireRegister, wrench, _, _buildDone, _buildOptimizeConfigs, _buildOptimizeConfigsFile, _clean, _removeCombined, _requireDelete, _requireOptimize, _requireRegister,
  __slice = [].slice;

fs = require('fs');

path = require('path');

wrench = require("wrench");

_ = require('lodash');

requireRegister = require('./tasks/register');

optimizer = require('./tasks/optimize');

builder = require('./tasks/builder');

moduleCacher = require('./tasks/caching');

logger = null;

exports.registration = function(config, register) {
  var e;
  if (!(config.require.verify.enabled || config.isOptimize)) {
    return;
  }
  logger = config.log;
  e = config.extensions;
  register(['postClean'], 'init', _clean);
  register(['add', 'update', 'buildFile'], 'betweenCompileWrite', _requireRegister, e.javascript);
  register(['add', 'update', 'buildExtension'], 'betweenCompileWrite', _requireRegister, e.template);
  register(['remove'], 'afterDelete', _requireDelete, e.javascript);
  register(['postBuild'], 'beforeOptimize', _buildDone);
  if (config.isOptimize) {
    register(['add', 'update', 'remove'], 'beforeOptimize', _buildOptimizeConfigsFile, __slice.call(e.javascript).concat(__slice.call(e.template)));
    register(['add', 'update', 'remove'], 'optimize', _requireOptimize, __slice.call(e.javascript).concat(__slice.call(e.template)));
    register(['postBuild'], 'beforeOptimize', _buildOptimizeConfigs);
    register(['postBuild'], 'optimize', _requireOptimize);
    if (config.isBuild) {
      register(['add', 'update', 'remove'], 'afterOptimize', _removeCombined, __slice.call(e.javascript).concat(__slice.call(e.template)));
      register(['postBuild'], 'optimize', _removeCombined);
    }
  }
  if (config.isBuild && config.require.tracking.enabled) {
    if (fs.existsSync(config.require.tracking.pathFull)) {
      fs.unlinkSync(config.require.tracking.pathFull);
    }
  }
  if (config.isWatch && config.isOptimize && config.require.optimize.modules) {
    register(['postBuild'], 'beforeOptimize', moduleCacher.cache);
    register(['update'], 'beforeOptimize', moduleCacher.checkCache);
  }
  return requireRegister.setConfig(config);
};

exports.aliasForPath = function(libPath) {
  return requireRegister.aliasForPath(libPath);
};

exports.requireConfig = function() {
  return requireRegister.retrieveOriginalMergedConfig();
};

exports.dependencyInfo = function(config) {
  return requireRegister.dependencyInfo(config);
};

exports.manipulatePathWithAlias = function(filePath) {
  return requireRegister.manipulatePathWithAlias(filePath);
};

_clean = function(config, options, next) {
  var files, jsDir;
  jsDir = path.join(config.watch.compiledDir, config.watch.javascriptDir);
  if (fs.existsSync(jsDir)) {
    files = wrench.readdirSyncRecursive(jsDir).filter(function(f) {
      var keep;
      keep = /-built\.js(\.map|\.src)?$/.test(f) || /almond\.js(\.map|\.src\.js)?/.test(f);
      if (config.require.optimize.modules) {
        keep = keep || /build\.txt$/.test(f) || /\.js\.src\.js$/.test(f) || /\.js\.map$/.test(f);
      }
      return keep;
    }).map(function(f) {
      f = path.join(jsDir, f);
      fs.unlinkSync(f);
      return logger.success("Deleted file [[ " + f + " ]]");
    });
  }
  if (config.require.tracking.enabled) {
    if (fs.existsSync(config.require.tracking.pathFull)) {
      fs.unlinkSync(config.require.tracking.pathFull);
    }
  }
  if (fs.existsSync(config.require.optimize.moduleCachingPathFull)) {
    wrench.rmdirSyncRecursive(config.require.optimize.moduleCachingPathFull);
  }
  return next();
};

_requireDelete = function(config, options, next) {
  var hasFiles, _ref;
  hasFiles = ((_ref = options.files) != null ? _ref.length : void 0) > 0;
  if (!hasFiles) {
    return next();
  }
  requireRegister.remove(options.files[0].outputFileName);
  return next();
};

_requireRegister = function(config, options, next) {
  var hasFiles, _ref;
  hasFiles = ((_ref = options.files) != null ? _ref.length : void 0) > 0;
  if (!hasFiles) {
    return next();
  }
  if (options.isVendor) {
    return next();
  }
  options.files.forEach(function(file) {
    var outf, _ref1;
    outf = file.outputFileName;
    if ((outf != null ? outf.match(/\.js$/) : void 0) && file.outputFileText) {
      if ((((_ref1 = config.require) != null ? _ref1.excludeRegex : void 0) != null) && outf.match(config.require.excludeRegex)) {
        return logger.debug("skipping require processing of [[ " + outf + " ]], file is excluded via regex");
      } else if (config.require.exclude.indexOf(outf) > -1) {
        return logger.debug("skipping require wrapping for [[ " + outf + " ]], file is excluded via string path");
      } else {
        return requireRegister.process(outf, file.outputFileText);
      }
    }
  });
  return next();
};

_buildOptimizeConfigsFile = function(config, options, next) {
  var allRunConfigs, done, filesDone, hasFiles, _ref;
  hasFiles = ((_ref = options.files) != null ? _ref.length : void 0) > 0;
  if (!hasFiles) {
    return next();
  }
  filesDone = 0;
  allRunConfigs = [];
  done = function(runConfigs) {
    if (runConfigs) {
      allRunConfigs = allRunConfigs.concat(runConfigs);
    }
    if (options.files.length === ++filesDone) {
      if (allRunConfigs.length > 0) {
        options.runConfigs = allRunConfigs;
      }
      logger.debug("Total of [[ " + allRunConfigs.length + " ]] r.js run configs generated.");
      return next();
    }
  };
  return options.files.forEach(function(file) {
    if (file.outputFileName && file.outputFileText) {
      return builder.buildRunConfig(config, file.outputFileName, done);
    } else {
      return done();
    }
  });
};

_buildOptimizeConfigs = function(config, options, next) {
  return builder.buildRunConfig(config, null, function(runConfigs) {
    if (runConfigs) {
      options.runConfigs = runConfigs;
      logger.debug("Total of [[ " + runConfigs.length + " ]] r.js run configs generated.");
    } else {
      logger.debug("No r.js run configs generated.");
    }
    return next();
  });
};

_requireOptimize = function(config, options, done) {
  var i, next,
    _this = this;
  if (!options.runConfigs) {
    return done();
  }
  if (options.runConfigs.length === 0) {
    return done();
  }
  i = 0;
  next = function() {
    if (i < options.runConfigs.length) {
      return optimizer.execute(config, options.runConfigs[i++], next);
    } else {
      return done();
    }
  };
  return next();
};

_removeCombined = function(config, options, next) {
  var directories, f, jsDir, runConfig, _i, _j, _len, _len1, _ref, _ref1;
  if (!options.runConfigs) {
    return next();
  }
  _ref = options.runConfigs;
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    runConfig = _ref[_i];
    if ((runConfig.filesUsed != null) && Array.isArray(runConfig.filesUsed)) {
      _ref1 = runConfig.filesUsed;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        f = _ref1[_j];
        if (fs.existsSync(f)) {
          logger.debug("Removing [[ " + f + " ]]");
          fs.unlinkSync(f);
        }
      }
    }
  }
  jsDir = config.watch.compiledJavascriptDir;
  directories = wrench.readdirSyncRecursive(jsDir).map(function(f) {
    return path.join(jsDir, f);
  });
  directories = directories.filter(function(f) {
    return fs.statSync(f).isDirectory();
  });
  _.sortBy(directories, 'length').reverse().forEach(function(dirPath) {
    var err;
    if (fs.existsSync(dirPath)) {
      try {
        fs.rmdirSync(dirPath);
        return logger.debug("Deleted directory [[ " + dirPath + " ]]");
      } catch (_error) {
        err = _error;
        if ((err != null ? err.code : void 0) === !"ENOTEMPTY") {
          logger.error("Unable to delete directory [[ " + dirPath + " ]]");
          return logger.error(err);
        }
      }
    }
  });
  return next();
};

_buildDone = function(config, options, next) {
  requireRegister.buildDone();
  return next();
};
