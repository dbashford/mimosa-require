var RequireRegister, fs, logger, parse, path, track, _,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

path = require('path');

fs = require('fs');

_ = require('lodash');

track = require('./tracker');

parse = null;

logger = null;

module.exports = RequireRegister = (function() {
  function RequireRegister() {
    this._removeFileFromCache = __bind(this._removeFileFromCache, this);
    this.dependencyInfo = __bind(this.dependencyInfo, this);
  }

  RequireRegister.prototype.depsRegistry = {};

  RequireRegister.prototype.aliasFiles = {};

  RequireRegister.prototype.aliasDirectories = {};

  RequireRegister.prototype.requireFiles = [];

  RequireRegister.prototype.tree = {};

  RequireRegister.prototype.mappings = {};

  RequireRegister.prototype.packages = {};

  RequireRegister.prototype.shims = {};

  RequireRegister.prototype.originalConfig = {};

  RequireRegister.prototype.requireStringRegex = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g;

  RequireRegister.prototype.requireStringRegexForArrayDeps = /[^.]\s*require\s*\(\s*\[\s*((["'][^'"\s]+["'][,\s]*?)+)\]/g;

  RequireRegister.prototype.commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;

  RequireRegister.prototype.webPathRegex = /^(\/\/[a-zA-Z]|http)/;

  RequireRegister.prototype.retrieveOriginalMergedConfig = function() {
    return this.originalConfig;
  };

  RequireRegister.prototype.dependencyInfo = function(mimosaConfig) {
    var aliasResolved, commonIndex, config, dep, depPath, deps, f, mappedPath, modRequireFiles, name, reg, resolvedDirectory, resolvedPath, shimConfigs, shimOrigConfigFile, _i, _j, _len, _len1, _ref, _ref1;
    reg = {};
    _ref = this.depsRegistry;
    for (f in _ref) {
      deps = _ref[f];
      reg[f] = [];
      for (_i = 0, _len = deps.length; _i < _len; _i++) {
        dep = deps[_i];
        if (fs.existsSync(dep)) {
          reg[f].push(dep);
        } else {
          aliasResolved = this._findAlias(dep, this.aliasFiles);
          if (aliasResolved) {
            if (aliasResolved.indexOf('MAPPED') === 0) {
              mappedPath = this._findMappedDependency(f, aliasResolved);
              if (mappedPath) {
                reg[f].push(mappedPath);
              }
            } else {
              reg[f].push(aliasResolved);
            }
          } else {
            resolvedDirectory = this._findPathWhenAliasDiectory(dep, false);
            if (resolvedDirectory) {
              reg[f].push(resolvedDirectory);
            }
          }
        }
      }
    }
    _ref1 = this.shims;
    for (shimOrigConfigFile in _ref1) {
      shimConfigs = _ref1[shimOrigConfigFile];
      for (name in shimConfigs) {
        config = shimConfigs[name];
        deps = Array.isArray(config) ? config : config.deps;
        if (deps != null) {
          resolvedPath = this._resolvePath(shimOrigConfigFile, name);
          f = fs.existsSync(resolvedPath) ? f = resolvedPath : f = this._findAlias(name, this.aliasFiles);
          if (f) {
            reg[f] = [];
            for (_j = 0, _len1 = deps.length; _j < _len1; _j++) {
              dep = deps[_j];
              depPath = this._resolvePath(shimOrigConfigFile, dep);
              if (fs.existsSync(depPath)) {
                reg[f].push(depPath);
              } else {
                aliasResolved = this._findAlias(dep, this.aliasFiles);
                if (aliasResolved) {
                  reg[f].push(aliasResolved);
                }
              }
            }
          }
        }
      }
    }
    commonIndex = this.requireFiles.indexOf(mimosaConfig.require.commonConfig);
    modRequireFiles = this.requireFiles;
    if (commonIndex !== -1) {
      modRequireFiles.splice(commonIndex, 1);
    }
    return {
      registry: reg,
      mainFiles: modRequireFiles
    };
  };

  RequireRegister.prototype.setConfig = function(config) {
    var previousTrackingInfo;
    this.config = config;
    logger = config.log;
    if (this.config.require.tracking.enabled) {
      track.setConfig(this.config);
      previousTrackingInfo = track.readTrackingObject();
      this.shims = _.clone(previousTrackingInfo.shims);
      this.depsRegistry = _.clone(previousTrackingInfo.deps);
      this.aliasFiles = _.clone(previousTrackingInfo.aliases);
      this.mappings = _.clone(previousTrackingInfo.mappings);
      this.originalConfig = _.clone(previousTrackingInfo.originalConfig);
      this.requireFiles = _.clone(previousTrackingInfo.requireFiles);
      this.packages = _.clone(previousTrackingInfo.packages);
    }
    this.verify = this.config.require.verify.enabled;
    if (this.rootJavaScriptDir == null) {
      return this.rootJavaScriptDir = path.join(this.config.watch.compiledDir, this.config.watch.javascriptDir);
    }
  };

  RequireRegister.prototype.process = function(fileName, source) {
    var fileData;
    fileData = this._parse(fileName, source);
    if (fileData) {
      if (fileData.requireFile) {
        this._require(fileName, fileData.deps, fileData.config);
      } else {
        this._handleDeps(fileName, fileData.deps);
      }
      if (!this.startupComplete && this.config.require.tracking.enabled) {
        return track.fileProcessed(fileName);
      }
    }
  };

  RequireRegister.prototype.remove = function(fileName) {
    if (this.config.require.tracking.enabled) {
      track.deleteForFile(fileName);
    }
    if (this.depsRegistry[fileName] != null) {
      delete this.depsRegistry[fileName];
    }
    this._deleteForFileName(fileName, this.aliasFiles);
    this._deleteForFileName(fileName, this.aliasDirectories);
    return this._verifyAll();
  };

  RequireRegister.prototype.buildDone = function(startupComplete) {
    this.startupComplete = startupComplete != null ? startupComplete : true;
    if (this.startupAlreadyDone) {
      return;
    }
    this.startupAlreadyDone = true;
    if (this.config.require.tracking.enabled) {
      track.validateTrackingInfoPostBuild(this._removeFileFromCache);
    }
    return this._verifyAll();
  };

  RequireRegister.prototype.treeBases = function() {
    return Object.keys(this.tree);
  };

  RequireRegister.prototype.treeBasesForFile = function(fileName) {
    var base, bases, deps, _ref;
    if (this.requireFiles.indexOf(fileName) >= 0) {
      return [fileName];
    }
    bases = [];
    _ref = this.tree;
    for (base in _ref) {
      deps = _ref[base];
      if (deps.indexOf(fileName) >= 0) {
        bases.push(base);
      }
    }
    return bases;
  };

  RequireRegister.prototype.aliasForPath = function(filePath) {
    var alias, dep, main, paths, _ref;
    _ref = this.aliasFiles;
    for (main in _ref) {
      paths = _ref[main];
      for (alias in paths) {
        dep = paths[alias];
        if (dep === filePath || dep === path.join(this.rootJavaScriptDir, "" + filePath + ".js")) {
          return alias;
        }
      }
    }
  };

  RequireRegister.prototype.manipulatePathWithAlias = function(filePath) {
    var allAliasObjects, anAlias, fullObject, key, osPath, sortedKeys, _i, _j, _len, _len1;
    allAliasObjects = _.values(this.aliasFiles).concat(_.values(this.aliasDirectories));
    fullObject = {};
    for (_i = 0, _len = allAliasObjects.length; _i < _len; _i++) {
      anAlias = allAliasObjects[_i];
      fullObject = _.extend(fullObject, anAlias);
    }
    fullObject = _.invert(fullObject);
    sortedKeys = Object.keys(fullObject).sort(function(a, b) {
      return b.length > a.length;
    });
    for (_j = 0, _len1 = sortedKeys.length; _j < _len1; _j++) {
      key = sortedKeys[_j];
      osPath = filePath.split('/').join(path.sep);
      if (osPath.indexOf(key) === 0) {
        return osPath.replace(key, fullObject[key]);
      }
    }
    return filePath;
  };

  /*
  */


  RequireRegister.prototype._parse = function(fileName, source) {
    var depsWithoutCommonJS, depsWithoutNestedRequire, err, isRequireFile, modName, numCommonJS, rci, result;
    modName = fileName.replace(this.rootJavaScriptDir, '').substring(1);
    modName = modName.replace(path.extname(modName), '');
    if (!parse) {
      parse = require('./rjs/parse');
    }
    try {
      result = parse(modName, fileName, source, {
        findNestedDependencies: true
      });
      rci = parse.findConfig(source);
    } catch (_error) {
      err = _error;
      logger.error("mimosa-require: unable to parse [[ " + fileName + " ]]", err, {
        exitIfBuild: true
      });
      return null;
    }
    depsWithoutNestedRequire = _.without(result, "NESTEDREQUIRE");
    isRequireFile = false;
    if (rci.requireCount) {
      numCommonJS = parse.findCjsDependencies(null, source).length;
      if (numCommonJS !== rci.requireCount && depsWithoutNestedRequire.length === result.length) {
        isRequireFile = true;
      }
    }
    depsWithoutCommonJS = _.without(depsWithoutNestedRequire, "COMMONJS");
    return {
      deps: depsWithoutCommonJS,
      config: rci.config,
      requireFile: isRequireFile
    };
  };

  RequireRegister.prototype._removeFileFromCache = function(fileName) {
    var requireFileIndex;
    [this.shims, this.depsRegistry, this.aliasFiles, this.mappings, this.packages].forEach(function(obj) {
      if ((obj[fileName] != null) || obj[fileName] === null) {
        return delete obj[fileName];
      }
    });
    requireFileIndex = this.requireFiles.indexOf(fileName);
    if (requireFileIndex > -1) {
      return this.requireFiles.splice(requireFileIndex, 1);
    }
  };

  RequireRegister.prototype._logger = function(message, method) {
    if (method == null) {
      method = 'error';
    }
    if (this.verify) {
      return logger[method](message);
    }
  };

  RequireRegister.prototype._require = function(fileName, deps, config) {
    var _ref, _ref1, _ref2, _ref3;
    if (__indexOf.call(this.requireFiles, fileName) < 0) {
      this.requireFiles.push(fileName);
    }
    if (this.config.require.tracking.enabled) {
      track.requireFiles(this.requireFiles);
    }
    if (config) {
      this._handleConfigPaths(fileName, (_ref = config.map) != null ? _ref : null, (_ref1 = config.paths) != null ? _ref1 : null, (_ref2 = config.packages) != null ? _ref2 : null);
      this._handleShims(fileName, (_ref3 = config.shim) != null ? _ref3 : null);
      if (config.deps) {
        deps = deps.concat(config.deps);
      }
      this._mergeOriginalConfig(config);
    }
    return this._handleDeps(fileName, deps);
  };

  RequireRegister.prototype._mergeOriginalConfig = function(config) {
    var _this = this;
    return ["shim", "paths", "map", "packages", "config"].forEach(function(name) {
      var conf;
      if (config[name] != null) {
        conf = _.clone(config[name]);
        if (_this.originalConfig[name] != null) {
          _this.originalConfig[name] = _.extend(_this.originalConfig[name], conf);
        } else {
          _this.originalConfig[name] = conf;
        }
        if (_this.config.require.tracking.enabled) {
          return track.originalConfig(_this.originalConfig);
        }
      }
    });
  };

  RequireRegister.prototype._deleteForFileName = function(fileName, aliases) {
    var alias, aliasPath, paths, _results;
    if (aliases[fileName]) {
      delete aliases[fileName];
    }
    _results = [];
    for (fileName in aliases) {
      paths = aliases[fileName];
      _results.push((function() {
        var _results1;
        _results1 = [];
        for (alias in paths) {
          aliasPath = paths[alias];
          if (aliasPath === fileName) {
            _results1.push(delete paths[alias]);
          } else {
            _results1.push(void 0);
          }
        }
        return _results1;
      })());
    }
    return _results;
  };

  RequireRegister.prototype._verifyAll = function() {
    var deps, file, shims, _i, _len, _ref, _ref1, _ref2;
    _ref = this.requireFiles;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      file = _ref[_i];
      this._verifyConfigForFile(file);
    }
    _ref1 = this.depsRegistry;
    for (file in _ref1) {
      deps = _ref1[file];
      this._verifyFileDeps(file, deps);
    }
    _ref2 = this.shims;
    for (file in _ref2) {
      shims = _ref2[file];
      this._verifyShims(file, shims);
    }
    return this._buildTree();
    /*
    for baseFile, deps of @tree
      console.log("\n" + deps.sort().join("\n"))
    
    total = 0;
    for i, v of @processed
      total+=v;
    
    console.log("TOTAL IS ", total)
    console.log("SYNC CALLS,", @syncCall)
    */

  };

  RequireRegister.prototype._handleShims = function(fileName, shims) {
    if (this.config.require.tracking.enabled) {
      track.shims(fileName, shims);
    }
    if (this.startupComplete) {
      return this._verifyShims(fileName, shims);
    } else {
      return this.shims[fileName] = shims;
    }
  };

  RequireRegister.prototype._verifyShims = function(fileName, shims) {
    var alias, config, dep, deps, name, pathWithDirReplaced, _results;
    if (shims == null) {
      return;
    }
    _results = [];
    for (name in shims) {
      config = shims[name];
      if (!fs.existsSync(this._resolvePath(fileName, name))) {
        alias = this._findAlias(name, this.aliasFiles);
        if (!alias) {
          pathWithDirReplaced = this._findPathWhenAliasDiectory(name, false);
          if (!((pathWithDirReplaced != null) && fs.existsSync(pathWithDirReplaced))) {
            this._logger("Shim path [[ " + name + " ]] inside file [[ " + fileName + " ]] cannot be found.");
          }
        }
      }
      deps = Array.isArray(config) ? config : config.deps;
      if (deps != null) {
        _results.push((function() {
          var _i, _len, _results1;
          _results1 = [];
          for (_i = 0, _len = deps.length; _i < _len; _i++) {
            dep = deps[_i];
            if (!fs.existsSync(this._resolvePath(fileName, dep))) {
              alias = this._findAlias(dep, this.aliasFiles);
              if (!alias) {
                pathWithDirReplaced = this._findPathWhenAliasDiectory(dep, false);
                if (!((pathWithDirReplaced != null) && fs.existsSync(pathWithDirReplaced))) {
                  _results1.push(this._logger("Shim [[ " + name + " ]] inside file [[ " + fileName + " ]] refers to a dependency that cannot be found [[ " + dep + " ]]."));
                } else {
                  _results1.push(void 0);
                }
              } else {
                _results1.push(void 0);
              }
            } else {
              _results1.push(void 0);
            }
          }
          return _results1;
        }).call(this));
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  RequireRegister.prototype._buildTree = function() {
    var f, _i, _len, _ref, _results;
    _ref = this.requireFiles;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      f = _ref[_i];
      this.tree[f] = [];
      _results.push(this._addDepsToTree(f, f, f));
    }
    return _results;
  };

  RequireRegister.prototype._addDepsToTree = function(f, dep, origDep) {
    /*
    if @processed[dep]
      @processed[dep] = @processed[dep] + 1
    else
      @processed[dep] = 1
    */

    var aDep, _i, _len, _ref;
    if (this.depsRegistry[dep] == null) {
      return;
    }
    _ref = this.depsRegistry[dep];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      aDep = _ref[_i];
      /*
      @depsRegistry[aDep].forEach (depToAdd) =>
        aliasDep = @_findAlias(depToAdd, @aliasFiles)
        depToAdd = aliasDep or depToAdd
        unless @tree[f].indexOf(depToAdd) > -1
      */

    }
    if (this.tree[f].indexOf(aDep) === -1) {
      if (!fs.existsSync(aDep)) {
        aDep = this._findAlias(aDep, this.aliasFiles);
        if (aDep == null) {
          return;
        }
        if (aDep.indexOf('MAPPED!') >= 0) {
          aDep = this._findMappedDependency(dep, aDep);
        }
      }
      if (this.tree[f].indexOf(aDep) < 0) {
        this.tree[f].push(aDep);
      }
      if (aDep !== origDep) {
        return this._addDepsToTree(f, aDep, dep);
      }
    }
  };

  RequireRegister.prototype._inAnyTree = function(aDep) {
    var baseFile, deps, _ref;
    _ref = this.tree;
    for (baseFile in _ref) {
      deps = _ref[baseFile];
      if (deps.indexOf(aDep) > -1) {
        return true;
      }
    }
    return false;
  };

  RequireRegister.prototype._handleConfigPaths = function(fileName, maps, paths, packages) {
    var deps, file, _ref, _results;
    packages = this._normalizeConfigPackages(packages);
    if (this.config.require.tracking.enabled) {
      track.aliases(fileName, paths);
      track.mappings(fileName, maps);
      track.packages(fileName, packages);
    }
    if (this.startupComplete) {
      this._verifyConfigForFile(fileName, maps, paths, packages);
      this.depsRegistry[fileName] = [];
      _ref = this.depsRegistry;
      _results = [];
      for (file in _ref) {
        deps = _ref[file];
        _results.push(this._verifyFileDeps(file, deps));
      }
      return _results;
    } else {
      this.packages[fileName] = packages;
      this.aliasFiles[fileName] = paths;
      return this.mappings[fileName] = maps;
    }
  };

  RequireRegister.prototype._handleDeps = function(fileName, deps) {
    if (this.config.require.tracking.enabled) {
      track.deps(fileName, deps);
    }
    if (this.startupComplete) {
      this._verifyFileDeps(fileName, deps);
      return this._buildTree();
    } else {
      return this.depsRegistry[fileName] = deps;
    }
  };

  RequireRegister.prototype._verifyConfigForFile = function(fileName, maps, paths, packages) {
    var alias, aliasPath;
    if (maps == null) {
      maps = this.mappings[fileName];
    }
    if (packages == null) {
      packages = this.packages[fileName];
    }
    paths = paths ? paths : (paths = {}, this.aliasFiles[fileName] != null ? paths = _.extend(paths, this.aliasFiles[fileName]) : void 0, this.aliasDirectories[fileName] != null ? paths = _.extend(paths, this.aliasDirectories[fileName]) : void 0, paths);
    this.aliasFiles[fileName] = {};
    this.aliasDirectories[fileName] = {};
    for (alias in paths) {
      aliasPath = paths[alias];
      this._verifyConfigPath(fileName, alias, aliasPath);
    }
    this._verifyConfigMappings(fileName, maps);
    return this._verifyConfigPackages(fileName, packages);
  };

  RequireRegister.prototype._verifyConfigMappings = function(fileName, maps) {
    var alias, aliasPath, fullDepPath, mappings, module, _results;
    for (module in maps) {
      mappings = maps[module];
      if (module !== '*') {
        fullDepPath = this._resolvePath(fileName, module);
        if (fs.existsSync(fullDepPath)) {
          delete maps[module];
          maps[fullDepPath] = mappings;
        } else {
          this._logger("Mapping inside file [[ " + fileName + " ]], refers to module that cannot be found [[ " + module + " ]].");
        }
      }
    }
    _results = [];
    for (module in maps) {
      mappings = maps[module];
      _results.push((function() {
        var _results1;
        _results1 = [];
        for (alias in mappings) {
          aliasPath = mappings[alias];
          fullDepPath = this._resolvePath(fileName, aliasPath);
          if (this._isWebPath(fullDepPath)) {
            this.aliasFiles[fileName][alias] = "MAPPED!" + alias;
            continue;
          }
          if (!fs.existsSync(fullDepPath)) {
            fullDepPath = this._findAlias(aliasPath, this.aliasFiles);
          }
          /*
          console.log "***************************"
          console.log module, alias, aliasPath
          console.log "alias?", alias
          console.log "dep path?", fullDepPath
          console.log "***************************"
          */

          if (fullDepPath) {
            this.aliasFiles[fileName][alias] = "MAPPED!" + alias;
            _results1.push(maps[module][alias] = fullDepPath);
          } else {
            _results1.push(this._logger("Mapping inside file [[ " + fileName + " ]], for module [[ " + module + " ]] has path that cannot be found [[ " + aliasPath + " ]]."));
          }
        }
        return _results1;
      }).call(this));
    }
    return _results;
  };

  RequireRegister.prototype._verifyConfigPackages = function(fileName, packages) {
    var fullDepPath, pkg, pkgFullDirPath, _i, _len, _results;
    if (!packages) {
      return;
    }
    _results = [];
    for (_i = 0, _len = packages.length; _i < _len; _i++) {
      pkg = packages[_i];
      pkgFullDirPath = path.join(this.rootJavaScriptDir, pkg.location);
      if (fs.existsSync(pkgFullDirPath)) {
        if (fs.statSync(pkgFullDirPath).isDirectory()) {
          this.aliasDirectories[fileName][pkg.name] = pkgFullDirPath;
        } else {
          this._logger("location for package [[ " + pkg.name + " ]] was found but is not a directory");
        }
      } else {
        this._logger("location for package [[ " + pkg.name + " ]] could not be found");
      }
      fullDepPath = this._resolvePackagePath(fileName, pkg);
      if (fs.existsSync(fullDepPath)) {
        _results.push(this.aliasFiles[fileName][pkg.name] = fullDepPath);
      } else {
        _results.push(this._logger("Mapping inside file [[ " + fileName + " ]], for module [[ " + module + " ]] has path that cannot be found [[ " + aliasPath + " ]]."));
      }
    }
    return _results;
  };

  RequireRegister.prototype._normalizeConfigPackages = function(packages) {
    var pkgFormat;
    if (!((packages != null) && Array.isArray(packages))) {
      return null;
    }
    packages = _.filter(packages, function(pkg) {
      if (_.isString(pkg) || _.isObject(pkg)) {
        return true;
      }
      return logger.debug("Package defined in unknown way, skipping pkg object of type : [[ " + (typeof pkg) + " ]]");
    });
    pkgFormat = {
      name: '',
      location: '',
      main: 'main'
    };
    return _.map(packages, function(pkg) {
      if (_.isString(pkg)) {
        return _.extend({}, pkgFormat, {
          name: pkg
        });
      }
      return _.extend({}, pkgFormat, pkg);
    });
  };

  RequireRegister.prototype._resolvePackagePath = function(fileName, pkg, alias) {
    var relativePath;
    relativePath = path.join(pkg.location, pkg.main);
    return this._resolvePath(fileName, relativePath);
  };

  RequireRegister.prototype._isWebPath = function(filePath) {
    return this.webPathRegex.test(filePath);
  };

  RequireRegister.prototype._verifyConfigPath = function(fileName, alias, aliasPath) {
    var aPath, fullDepPath, pathAsDirectory, _base, _i, _len;
    if (Array.isArray(aliasPath)) {
      for (_i = 0, _len = aliasPath.length; _i < _len; _i++) {
        aPath = aliasPath[_i];
        this._verifyConfigPath(fileName, alias, aPath);
      }
      return;
    }
    if (typeof aliasPath !== "string") {
      return this._logger("Expected string in paths config and instead got this: [[ " + (JSON.stringify(aliasPath)) + " ]] for file [[ " + fileName + " ]]");
    }
    if (aliasPath.indexOf("MAPPED") === 0) {
      return;
    }
    if (this._isWebPath(aliasPath)) {
      return this.aliasFiles[fileName][alias] = aliasPath;
    }
    fullDepPath = this._resolvePath(fileName, aliasPath);
    if (fs.existsSync(fullDepPath)) {
      if (fs.statSync(fullDepPath).isDirectory()) {
        return this.aliasDirectories[fileName][alias] = fullDepPath;
      } else {
        return this.aliasFiles[fileName][alias] = fullDepPath;
      }
    } else {
      pathAsDirectory = fullDepPath.replace(/.js$/, '');
      if (fs.existsSync(pathAsDirectory)) {
        if ((_base = this.aliasDirectories)[fileName] == null) {
          _base[fileName] = {};
        }
        return this.aliasDirectories[fileName][alias] = pathAsDirectory;
      } else {
        return this._logger("Dependency [[ " + aliasPath + " ]] for path alias [[ " + alias + " ]], inside file [[ " + fileName + " ]], cannot be found.");
      }
    }
  };

  RequireRegister.prototype._verifyFileDeps = function(fileName, deps) {
    var dep, _i, _len, _results;
    this.depsRegistry[fileName] = [];
    if (deps == null) {
      return;
    }
    _results = [];
    for (_i = 0, _len = deps.length; _i < _len; _i++) {
      dep = deps[_i];
      _results.push(this._verifyDep(fileName, dep));
    }
    return _results;
  };

  RequireRegister.prototype._findPluginPath = function(dep, fileName) {
    var fullPath, pathWithDirReplaced;
    fullPath = path.join(this.rootJavaScriptDir, dep);
    if (!fs.existsSync(fullPath)) {
      if (!this._findAlias(dep, this.aliasFiles)) {
        pathWithDirReplaced = this._findPathWhenAliasDiectory(dep, true);
        if (!(pathWithDirReplaced && fs.existsSync(pathWithDirReplaced))) {
          return this._logger("Plugin [[ " + dep + " ]], inside file [[ " + fileName + " ]], cannot be found.");
        }
      }
    }
  };

  RequireRegister.prototype._verifyDep = function(fileName, dep) {
    var alias, depPath, fileAliasList, fullDepPath, pathWithDirReplaced, plugin, plugins, _i, _len, _ref, _ref1, _ref2;
    if (dep === 'require' || dep === 'module' || dep === 'exports') {
      return;
    }
    if (this._isWebPath(dep)) {
      return this._registerDependency(fileName, dep);
    }
    if (dep.indexOf('!') >= 0) {
      _ref = dep.split('!'), plugin = _ref[0], dep = _ref[1];
      plugins = (_ref1 = this.config.require.verify) != null ? _ref1.plugins : void 0;
      if (plugins && (plugins[plugin] || plugins[plugin] === null)) {
        depPath = dep;
        if (plugins[plugin]) {
          depPath += "." + plugins[plugin];
        }
        return this._findPluginPath(depPath, fileName);
      } else {
        this._verifyDep(fileName, plugin);
        if ((dep != null ? dep.length : void 0) === 0) {
          return;
        }
        plugin = true;
      }
    }
    fullDepPath = dep.indexOf('MAPPED') === 0 ? this._findMappedDependency(fileName, dep) : this._resolvePath(fileName, dep, plugin);
    if (fs.existsSync(fullDepPath)) {
      _ref2 = _.values(this.aliasFiles);
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        fileAliasList = _ref2[_i];
        if (_.values(fileAliasList).indexOf(fullDepPath) > -1) {
          return logger.error("Dependency [[ " + dep + " ]] in [[ " + fileName + " ]] has been aliased in the paths config and the alias must be used.");
        }
      }
      return this._registerDependency(fileName, fullDepPath);
    } else {
      alias = this._findAlias(dep, this.aliasFiles);
      if (alias) {
        return this._registerDependency(fileName, dep);
      } else {
        pathWithDirReplaced = this._findPathWhenAliasDiectory(dep, plugin);
        if ((pathWithDirReplaced != null) && fs.existsSync(pathWithDirReplaced)) {
          return this._registerDependency(fileName, dep);
        } else {
          this._logger("Dependency [[ " + dep + " ]], inside file [[ " + fileName + " ]], cannot be found.");
          return this._registerDependency(fileName, dep);
        }
      }
    }
  };

  RequireRegister.prototype._findMappedDependency = function(fileName, dep) {
    var depName, mainFile, mappings, _ref, _ref1, _ref2, _ref3;
    depName = dep.split('!')[1];
    _ref = this.mappings;
    for (mainFile in _ref) {
      mappings = _ref[mainFile];
      if (((_ref1 = mappings[fileName]) != null ? _ref1[depName] : void 0) != null) {
        return mappings[fileName][depName];
      }
    }
    _ref2 = this.mappings;
    for (mainFile in _ref2) {
      mappings = _ref2[mainFile];
      if (((_ref3 = mappings['*']) != null ? _ref3[depName] : void 0) != null) {
        return mappings['*'][depName];
      }
    }
    return this._logger("Mimosa has a bug! Ack! Cannot find mapping and it really should have.");
  };

  RequireRegister.prototype._registerDependency = function(fileName, dependency) {
    this.depsRegistry[fileName].push(dependency);
    if (this._isCircular(fileName, dependency)) {
      return this._logger("A circular dependency exists between [[ " + fileName + " ]] and [[ " + dependency + " ]]", 'warn');
    }
  };

  RequireRegister.prototype._isCircular = function(dep1, dep2) {
    var oneHasTwo, twoHasOne, _ref, _ref1;
    oneHasTwo = ((_ref = this.depsRegistry[dep1]) != null ? _ref.indexOf(dep2) : void 0) >= 0;
    twoHasOne = ((_ref1 = this.depsRegistry[dep2]) != null ? _ref1.indexOf(dep1) : void 0) >= 0;
    return oneHasTwo && twoHasOne;
  };

  RequireRegister.prototype._findAlias = function(dep, aliases) {
    var fileName, paths;
    for (fileName in aliases) {
      paths = aliases[fileName];
      if (paths[dep] != null) {
        return paths[dep];
      }
    }
  };

  RequireRegister.prototype._resolvePath = function(fileName, dep, plugin) {
    var fullPath;
    if (plugin == null) {
      plugin = false;
    }
    if (dep.indexOf(this.rootJavaScriptDir) === 0) {
      return dep;
    }
    dep = dep.split('/').join(path.sep);
    fullPath = dep.charAt(0) === '.' ? path.resolve(path.dirname(fileName), dep) : path.join(this.rootJavaScriptDir, dep);
    if (fullPath.match(/\.\w+$/) && plugin) {
      return fullPath;
    } else {
      return "" + fullPath + ".js";
    }
  };

  RequireRegister.prototype._findPathWhenAliasDiectory = function(dep, plugin) {
    var alias, fullPath, pathPieces;
    pathPieces = dep.split('/');
    alias = this._findAlias(pathPieces[0], this.aliasDirectories);
    if (alias) {
      pathPieces[0] = alias;
      fullPath = pathPieces.join(path.sep);
      if (fullPath.match(/\.\w+$/) && plugin) {
        return fullPath;
      } else {
        return "" + (path.normalize(fullPath)) + ".js";
      }
    } else {
      return null;
    }
  };

  return RequireRegister;

})();

module.exports = new RequireRegister();
