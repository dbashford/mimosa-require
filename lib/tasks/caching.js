"use strict";
var aliasFiles, baseUrl, cachingPath, fs, path, registry, wrench, _, _fetchAliasFiles, _firstFileNewer, _pathNames, _write;

fs = require('fs');

path = require('path');

wrench = require('wrench');

_ = require('lodash');

registry = require('./register');

baseUrl = null;

cachingPath = null;

aliasFiles = null;

exports.cache = function(config, options, next) {
  var rConfig;
  cachingPath = config.require.optimize.moduleCachingPathFull;
  baseUrl = options.runConfigs[0].baseUrl;
  if (!fs.existsSync(cachingPath)) {
    config.log.debug("Creating caching dir [[ " + cachingPath + " ]]");
    wrench.mkdirSyncRecursive(cachingPath, 0x1ff);
  }
  _fetchAliasFiles();
  rConfig = options.runConfigs[0];
  rConfig.modules.forEach(function(mod) {
    var cachePath, filePath, _ref;
    _ref = _pathNames(mod.name), cachePath = _ref.cachePath, filePath = _ref.filePath;
    return _write(filePath, cachePath);
  });
  return next();
};

exports.checkCache = function(config, options, next) {
  var rConfig;
  _fetchAliasFiles();
  rConfig = options.runConfigs[0];
  rConfig.modules.map(function(mod) {
    return _pathNames(mod.name);
  }).filter(function(paths) {
    var file, _i, _len, _ref;
    _ref = options.files;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      file = _ref[_i];
      if (file.outputFileName === paths.filePath) {
        _write(paths.filePath, paths.cachePath);
        return false;
      }
    }
    return true;
  }).forEach(function(paths) {
    return _write(paths.cachePath, paths.filePath);
  });
  return next();
};

_fetchAliasFiles = function() {
  return aliasFiles = registry.aliasFiles ? _(registry.aliasFiles).values().reduce(function(left, right) {
    return _.extend(left, right);
  }) : null;
};

_pathNames = function(modName) {
  var cachePath, filePath;
  if (aliasFiles != null ? aliasFiles[modName] : void 0) {
    modName = aliasFiles[modName].replace(baseUrl, '').replace(".js", '');
  }
  filePath = path.join(baseUrl, modName + ".js");
  cachePath = path.join(cachingPath, modName + ".js");
  return {
    filePath: filePath,
    cachePath: cachePath
  };
};

_write = function(thisFile, thatFile) {
  var text;
  text = fs.readFileSync(thisFile).toString();
  return fs.writeFileSync(thatFile, text);
};

_firstFileNewer = function(fileOne, fileTwo) {
  return fs.statSync(fileOne).mtime > fs.statSync(fileTwo).mtime;
};
