"use strict";
var config, fs, logger, path, startupFilesProcessed, trackingFilePath, trackingInfo, wrench, _, _createEmptyTrackingInfo, _getFiles, _removeFileFromObjectKey, _removeFileFromTracking, _setNewPathValues, _setVals, _tryFileWrite, _validateAndSetTrackingInfo, _writeTrackingObject;

fs = require('fs');

path = require('path');

wrench = require('wrench');

_ = require('lodash');

logger = require('logmimosa');

trackingInfo = {};

startupFilesProcessed = [];

_createEmptyTrackingInfo = function() {
  return trackingInfo = {
    shims: {},
    deps: {},
    aliases: {},
    mappings: {},
    originalConfig: {},
    requireFiles: []
  };
};

config = {};

trackingFilePath = "";

exports.setConfig = function(_config) {
  config = _config;
  return trackingFilePath = config.require.tracking.pathFull;
};

exports.requireFiles = function(_requireFiles) {
  trackingInfo.requireFiles = [];
  _requireFiles.forEach(function(f) {
    return trackingInfo.requireFiles.push(f.replace(config.root, ''));
  });
  return _writeTrackingObject();
};

_setVals = function(type, fName, _vals) {
  var f;
  f = fName.replace(config.root, '');
  trackingInfo[type][f] = _vals;
  return _writeTrackingObject();
};

exports.shims = function(fileName, shims) {
  return _setVals('shims', fileName, shims);
};

exports.deps = function(fileName, deps) {
  return _setVals('deps', fileName, deps);
};

exports.deleteForFile = function(fileName) {
  fileName = fileName.replace(config.root, '');
  ['shims', 'deps', 'aliases', 'mappings'].forEach(function(key) {
    if ((trackingInfo[key][fileName] != null) || trackingInfo[key][fileName] === null) {
      return delete trackingInfo[key][fileName];
    }
  });
  if (trackingInfo.requireFiles.indexOf(fileName) > -1) {
    trackingInfo.requireFiles = _.without(trackingInfo.requireFiles, fileName);
  }
  return _writeTrackingObject();
};

exports.aliases = function(fileName, paths) {
  return _setVals('aliases', fileName, paths);
};

exports.mappings = function(fileName, maps) {
  return _setVals('mappings', fileName, maps);
};

exports.originalConfig = function(_originalConfig) {
  trackingInfo.originalConfig = _originalConfig;
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
    if (fs.exists(dir)) {
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

_setNewPathValues = function(nti, name) {
  nti[name] = {};
  return Object.keys(trackingInfo[name]).forEach(function(key) {
    var newKey;
    newKey = path.join(config.root, key);
    return nti[name][newKey] = trackingInfo[name][key];
  });
};

_validateAndSetTrackingInfo = function(ti) {
  var allPaths, badPaths, badPathsMsg, p, _i, _len;
  allPaths = ti.requireFiles;
  ['shims', 'deps', 'aliases', 'mappings'].forEach(function(key) {
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
    if (logger.isDebug) {
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
  ['shims', 'deps', 'aliases', 'mappings'].forEach(function(key) {
    return _removeFileFromObjectKey(f, trackingInfo[key]);
  });
  requireFileIndex = trackingInfo.requireFiles.indexOf(f);
  if (requireFileIndex > -1) {
    return trackingInfo.requireFiles.splice(requireFileIndex, 1);
  }
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
    return f.replace(config.root, '');
  }).forEach(function(f) {
    logger.debug("Removing [[ " + f + " ]] from mimosa-require tracking information");
    _removeFileFromTracking(f);
    return reigsterRemoveCb(f);
  });
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

exports.fileProcessed = function(f) {
  return startupFilesProcessed.push(f);
};

exports.readTrackingObject = function() {
  var newTrackingInfo;
  if (fs.existsSync(trackingFilePath)) {
    trackingInfo = require(trackingFilePath);
    newTrackingInfo = {
      originalConfig: trackingInfo.originalConfig
    };
    newTrackingInfo.requireFiles = trackingInfo.requireFiles.map(function(f) {
      return path.join(config.root, f);
    });
    _setNewPathValues(newTrackingInfo, "aliases");
    _setNewPathValues(newTrackingInfo, "shims");
    _setNewPathValues(newTrackingInfo, "deps");
    _setNewPathValues(newTrackingInfo, "mappings");
    return _validateAndSetTrackingInfo(newTrackingInfo);
  } else {
    return trackingInfo;
  }
};

_createEmptyTrackingInfo();
