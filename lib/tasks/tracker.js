"use strict";
var config, fs, logger, path, startupFilesProcessed, trackKeys, trackingFilePath, trackingInfo, wrench, _, _createEmptyTrackingInfo, _getFiles, _handlePathPreWrite, _removeFileFromObjectKey, _removeFileFromTracking, _setNewPathValues, _setVals, _tryFileWrite, _validateAndSetTrackingInfo, _writeTrackingObject;

fs = require('fs');

path = require('path');

wrench = require('wrench');

_ = require('lodash');

trackingInfo = {};

startupFilesProcessed = [];

trackKeys = ['shims', 'deps', 'aliases', 'mappings', 'packages'];

logger = null;

_createEmptyTrackingInfo = function() {
  return trackingInfo = {
    shims: {},
    deps: {},
    aliases: {},
    mappings: {},
    packages: {},
    originalConfig: {},
    requireFiles: []
  };
};

config = {};

trackingFilePath = "";

exports.setConfig = function(_config) {
  logger = _config.log;
  config = _config;
  return trackingFilePath = config.require.tracking.pathFull;
};

_handlePathPreWrite = function(f) {
  var truncPath;
  truncPath = f.replace(config.watch.compiledDir, '');
  if (process.platform === 'win32') {
    truncPath = truncPath.split(path.sep).join('/');
  }
  return truncPath;
};

exports.requireFiles = function(_requireFiles) {
  trackingInfo.requireFiles = [];
  _requireFiles.sort();
  _requireFiles.forEach(function(fName) {
    var f;
    f = _handlePathPreWrite(fName);
    return trackingInfo.requireFiles.push(f);
  });
  return _writeTrackingObject();
};

_setVals = function(type, fName, _vals) {
  var f, newObj;
  f = _handlePathPreWrite(fName);
  trackingInfo[type][f] = _vals;
  newObj = {};
  _(trackingInfo[type]).keys().sort().map(function(f) {
    return newObj[f] = trackingInfo[type][f];
  });
  trackingInfo[type] = newObj;
  return _writeTrackingObject();
};

exports.originalConfig = function(_originalConfig) {
  trackingInfo.originalConfig = _originalConfig;
  return _writeTrackingObject();
};

exports.deleteForFile = function(fileName) {
  fileName = fileName.replace(config.watch.compiledDir, '');
  trackKeys.forEach(function(key) {
    if ((trackingInfo[key][fileName] != null) || trackingInfo[key][fileName] === null) {
      return delete trackingInfo[key][fileName];
    }
  });
  if (trackingInfo.requireFiles.indexOf(fileName) > -1) {
    trackingInfo.requireFiles = _.without(trackingInfo.requireFiles, fileName);
  }
  return _writeTrackingObject();
};

_tryFileWrite = function(fPath, data) {
  return fs.writeFileSync(fPath, JSON.stringify(data, null, 2));
};

_writeTrackingObject = function() {
  var dir, err;
  try {
    return _tryFileWrite(trackingFilePath, trackingInfo);
  } catch (_error) {
    err = _error;
    dir = path.dirname(trackingFilePath);
    if (fs.existsSync(dir)) {
      return logger.error("Could not write tracking file [[ " + trackingFilePath + " ]]", err);
    } else {
      wrench.mkdirSyncRecursive(dir, 0x1ff);
      try {
        return _tryFileWrite(trackingFilePath, trackingInfo);
      } catch (_error) {
        err = _error;
        return logger.error("Could not write tracking file [[ " + trackingFilePath + " ]]", err);
      }
    }
  }
};

_validateAndSetTrackingInfo = function(ti) {
  var allPaths, badPaths, badPathsMsg, p, _i, _len;
  allPaths = ti.requireFiles;
  trackKeys.forEach(function(key) {
    return allPaths = allPaths.concat(Object.keys(ti[key]));
  });
  allPaths = _.uniq(allPaths);
  badPaths = [];
  for (_i = 0, _len = allPaths.length; _i < _len; _i++) {
    p = allPaths[_i];
    if (!fs.existsSync(p)) {
      badPaths.push(p);
    }
  }
  if (badPaths.length > 0) {
    logger.info("mimosa-require has bad tracking information and will need to rebuild its tracking information by forcing a recompile of all JavaScript. Nothing to worry about, this can be caused by moving, changing or deleting files while Mimosa isn't watching.");
    if (logger.isDebug()) {
      badPathsMsg = badPaths.join('\n');
      logger.debug(badPathsMsg);
    }
    config.__forceJavaScriptRecompile = true;
    _createEmptyTrackingInfo();
    return trackingInfo;
  } else {
    return ti;
  }
};

_removeFileFromTracking = function(f) {
  var requireFileIndex;
  trackKeys.forEach(function(key) {
    return _removeFileFromObjectKey(f, trackingInfo[key]);
  });
  requireFileIndex = trackingInfo.requireFiles.indexOf(f);
  if (requireFileIndex > -1) {
    return trackingInfo.requireFiles.splice(requireFileIndex, 1);
  }
};

_removeFileFromObjectKey = function(f, obj) {
  var deleteKeys, k, _i, _len, _results;
  deleteKeys = [];
  Object.keys(obj).forEach(function(k) {
    if (f === k) {
      return deleteKeys.push(k);
    }
  });
  _results = [];
  for (_i = 0, _len = deleteKeys.length; _i < _len; _i++) {
    k = deleteKeys[_i];
    _results.push(delete obj[k]);
  }
  return _results;
};

exports.validateTrackingInfoPostBuild = function(reigsterRemoveCb) {
  var compiledFiles, sourceFiles, transformedSourceFiles, w;
  w = config.watch;
  sourceFiles = _getFiles(config, config.extensions.javascript, w.sourceDir).map(function(f) {
    return f.replace(path.extname(f), ".js");
  });
  compiledFiles = _getFiles(config, ["js"], w.compiledDir);
  transformedSourceFiles = sourceFiles.map(function(f) {
    return f.replace(w.sourceDir, w.compiledDir);
  });
  return _.difference(compiledFiles, transformedSourceFiles).filter(function(f) {
    return startupFilesProcessed.indexOf(f) === -1;
  }).map(function(f) {
    return f.replace(config.watch.compiledDir, '');
  }).forEach(function(f) {
    logger.debug("Removing [[ " + f + " ]] from mimosa-require tracking information");
    _removeFileFromTracking(f);
    return reigsterRemoveCb(f);
  });
};

_getFiles = function(config, exts, dir) {
  return wrench.readdirSyncRecursive(dir).map(function(f) {
    return path.join(dir, f);
  }).filter(function(f) {
    return fs.statSync(f).isFile();
  }).filter(function(f) {
    var ext;
    ext = path.extname(f).substring(1);
    return exts.indexOf(ext) > -1;
  });
};

_setNewPathValues = function(nti, name) {
  nti[name] = {};
  return Object.keys(trackingInfo[name]).forEach(function(key) {
    var newKey;
    newKey = path.join(config.watch.compiledDir, key).split('/').join(path.sep);
    return nti[name][newKey] = trackingInfo[name][key];
  });
};

exports.readTrackingObject = function() {
  var newTrackingInfo;
  if (fs.existsSync(trackingFilePath)) {
    trackingInfo = require(trackingFilePath);
    newTrackingInfo = {
      originalConfig: trackingInfo.originalConfig
    };
    newTrackingInfo.requireFiles = trackingInfo.requireFiles.map(function(f) {
      var p;
      p = path.join(config.watch.compiledDir, f);
      if (process.platform === 'win32') {
        return p.split('/').join(path.sep);
      } else {
        return p;
      }
    });
    trackKeys.forEach(function(key) {
      return _setNewPathValues(newTrackingInfo, key);
    });
    return _validateAndSetTrackingInfo(newTrackingInfo);
  } else {
    return trackingInfo;
  }
};

exports.fileProcessed = function(f) {
  return startupFilesProcessed.push(f);
};

trackKeys.forEach(function(cfgKey) {
  return exports[cfgKey] = function(fileName, cfgSegment) {
    return _setVals(cfgKey, fileName, cfgSegment);
  };
});

_createEmptyTrackingInfo();
