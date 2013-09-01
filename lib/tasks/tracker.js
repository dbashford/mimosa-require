"use strict";
var config, fs, logger, path, setNewPathValues, setVals, trackingFilePath, trackingInfo, tryFileWrite, wrench, writeTrackingObject, _;

fs = require('fs');

path = require('path');

wrench = require('wrench');

_ = require('lodash');

logger = require('logmimosa');

trackingInfo = {
  shims: {},
  deps: {},
  aliases: {},
  mappings: {},
  originalConfig: {},
  requireFiles: []
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
  return writeTrackingObject();
};

setVals = function(type, fName, _vals) {
  var f;
  f = fName.replace(config.root, '');
  trackingInfo[type][f] = _vals;
  return writeTrackingObject();
};

exports.shims = function(fileName, shims) {
  return setVals('shims', fileName, shims);
};

exports.deps = function(fileName, deps) {
  return setVals('deps', fileName, deps);
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
  return writeTrackingObject();
};

exports.aliases = function(fileName, paths) {
  return setVals('aliases', fileName, paths);
};

exports.mappings = function(fileName, maps) {
  return setVals('mappings', fileName, maps);
};

exports.originalConfig = function(_originalConfig) {
  trackingInfo.originalConfig = _originalConfig;
  return writeTrackingObject();
};

tryFileWrite = function(fPath, data) {
  return fs.writeFileSync(fPath, JSON.stringify(data, null, 2));
};

writeTrackingObject = function() {
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

setNewPathValues = function(nti, name) {
  nti[name] = {};
  return Object.keys(trackingInfo[name]).forEach(function(key) {
    var newKey;
    newKey = path.join(config.root, key);
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
      return path.join(config.root, f);
    });
    setNewPathValues(newTrackingInfo, "aliases");
    setNewPathValues(newTrackingInfo, "shims");
    setNewPathValues(newTrackingInfo, "deps");
    setNewPathValues(newTrackingInfo, "mappings");
    return newTrackingInfo;
  } else {
    return trackingInfo;
  }
};
