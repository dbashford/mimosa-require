"use strict";
var config, fs, logger, path, trackingFilePath, trackingInfo, tryFileWrite, wrench, _, _createEmptyTrackingInfo, _setNewPathValues, _setVals, _validateAndSetTrackingInfo, _writeTrackingObject;

fs = require('fs');

path = require('path');

wrench = require('wrench');

_ = require('lodash');

logger = require('logmimosa');

trackingInfo = {};

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

tryFileWrite = function(fPath, data) {
  return fs.writeFileSync(fPath, JSON.stringify(data, null, 2));
};

_writeTrackingObject = function() {
  var dir, err;
  try {
    return tryFileWrite(trackingFilePath, trackingInfo);
  } catch (_error) {
    err = _error;
    dir = path.dirname(trackingFilePath);
    if (fs.exists(dir)) {
      return logger.error("Could not write tracking file [[ " + trackingFilePath + " ]]", err);
    } else {
      wrench.mkdirSyncRecursive(dir, 0x1ff);
      try {
        return tryFileWrite(trackingFilePath, trackingInfo);
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
