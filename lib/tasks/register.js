var RequireRegister, fs, logger, path, track, _,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

path = require('path');

fs = require('fs');

_ = require('lodash');

logger = require('logmimosa');

track = require('./tracker');

module.exports = RequireRegister = (function() {
  function RequireRegister() {
    this._findDepsInCallback = __bind(this._findDepsInCallback, this);
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
    var define, e, exports, require, requirejs, window;
    require = requirejs = this._require(fileName);
    require.config = requirejs.config = require;
    define = this._define(fileName);
    define.amd = {
      jquery: true
    };
    exports = void 0;
    window = {};
    this._requirejs(requirejs);
    try {
      eval(source);
      if (!this.startupComplete && this.config.require.tracking.enabled) {
        return track.fileProcessed(fileName);
      }
    } catch (_error) {
      e = _error;
      this._logger("File named [[ " + fileName + " ]] is not wrapped in a 'require' or 'define' function call.", "warn");
      return this._logger("" + e, 'warn');
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
  Private
  */


  RequireRegister.prototype._removeFileFromCache = function(fileName) {
    var requireFileIndex;
    [this.shims, this.depsRegistry, this.aliasFiles, this.mappings].forEach(function(obj) {
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

  RequireRegister.prototype._require = function(fileName) {
    var _this = this;
    return function(deps, callback, errback, optional) {
      var config, _ref, _ref1, _ref2, _ref3, _ref4;
      _ref = _this._requireOverride(deps, callback, errback, optional), deps = _ref[0], config = _ref[1];
      if (config || deps) {
        if (__indexOf.call(_this.requireFiles, fileName) < 0) {
          _this.requireFiles.push(fileName);
        }
        if (_this.config.require.tracking.enabled) {
          track.requireFiles(_this.requireFiles);
        }
        if (config) {
          _this._handleConfigPaths(fileName, (_ref1 = config.map) != null ? _ref1 : null, (_ref2 = config.paths) != null ? _ref2 : null, (_ref3 = config.packages) != null ? _ref3 : null);
          _this._handleShims(fileName, (_ref4 = config.shim) != null ? _ref4 : null);
        }
      }
      if (config != null) {
        if (config.deps) {
          deps = deps.concat(config.deps);
        }
        _this._mergeOriginalConfig(config);
      }
      return _this._handleDeps(fileName, deps);
    };
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

  RequireRegister.prototype._define = function(fileName) {
    var _this = this;
    return function(id, deps, funct) {
      deps = _this._defineOverride(id, deps, funct);
      return _this._handleDeps(fileName, deps);
    };
  };

  RequireRegister.prototype._requirejs = function(r) {
    r.version = '';
    r.onError = function() {};
    r.jsExtRegExp = /^\/|:|\?|\.js$/;
    r.isBrowser = true;
    r.load = function() {};
    r.exec = function() {};
    r.toUrl = function() {
      return "";
    };
    r.undef = function() {};
    r.defined = function() {};
    return r.specified = function() {};
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
    var alias, config, dep, deps, name, _results;
    if (shims == null) {
      return;
    }
    _results = [];
    for (name in shims) {
      config = shims[name];
      if (!fs.existsSync(this._resolvePath(fileName, name))) {
        alias = this._findAlias(name, this.aliasFiles);
        if (!alias) {
          this._logger("Shim path [[ " + name + " ]] inside file [[ " + fileName + " ]] cannot be found.");
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
                _results1.push(this._logger("Shim [[ " + name + " ]] inside file [[ " + fileName + " ]] refers to a dependency that cannot be found [[ " + dep + " ]]."));
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
    var aDep, _i, _len, _ref;
    if (this.depsRegistry[dep] == null) {
      return;
    }
    _ref = this.depsRegistry[dep];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      aDep = _ref[_i];
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
        this._addDepsToTree(f, aDep, dep);
      }
    }
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
          continue;
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
          if (alias) {
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
    logger.debug("Verifying [[ " + fileName + " ]] packages:\n" + (JSON.stringify(packages)));
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
    pkgFormat = {
      name: '',
      location: '',
      main: 'main'
    };
    if ((packages != null) && Array.isArray(packages)) {
      packages = _.filter(packages, function(pkg) {
        if (_.isString(pkg) || _.isObject(pkg)) {
          return true;
        }
        return logger.debug("Package defined in unknown way, skipping pkg object of type : [[ " + (typeof pkg) + " ]]");
      });
      packages = _.map(packages, function(pkg) {
        if (_.isString(pkg)) {
          return _.extend({}, pkgFormat, {
            name: pkg
          });
        }
        return _.extend({}, pkgFormat, pkg);
      });
      return packages;
    }
    logger.debug("Packages defined in unknown way (expected an array) - skipping packages object of type : [[ " + (typeof packages) + " ]]");
    return null;
  };

  RequireRegister.prototype._resolvePackagePath = function(fileName, pkg, alias) {
    var pkgPath, relativePath;
    relativePath = path.join(pkg.location, pkg.main);
    pkgPath = this._resolvePath(fileName, relativePath);
    return pkgPath;
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

  RequireRegister.prototype._verifyDep = function(fileName, dep) {
    var alias, fileAliasList, fullDepPath, pathWithDirReplaced, plugin, _i, _len, _ref, _ref1;
    if (dep === 'require' || dep === 'module' || dep === 'exports') {
      return;
    }
    if (this._isWebPath(dep)) {
      return this._registerDependency(fileName, dep);
    }
    if (dep.indexOf('!') >= 0) {
      _ref = dep.split('!'), plugin = _ref[0], dep = _ref[1];
      this._verifyDep(fileName, plugin);
      if ((dep != null ? dep.length : void 0) === 0) {
        return;
      }
      plugin = true;
    }
    fullDepPath = dep.indexOf('MAPPED') === 0 ? this._findMappedDependency(fileName, dep) : this._resolvePath(fileName, dep, plugin);
    if (fs.existsSync(fullDepPath)) {
      _ref1 = _.values(this.aliasFiles);
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        fileAliasList = _ref1[_i];
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

  RequireRegister.prototype._defineOverride = function(name, deps, callback) {
    if (typeof name !== 'string') {
      callback = deps;
      deps = name;
    }
    if (!Array.isArray(deps)) {
      callback = deps;
      deps = [];
    }
    this._findDepsInCallback(callback, deps);
    return deps;
  };

  RequireRegister.prototype._requireOverride = function(deps, callback, errback, optional) {
    var config;
    if (!Array.isArray(deps) && typeof deps !== 'string') {
      config = deps;
      if (Array.isArray(callback)) {
        deps = callback;
        callback = errback;
      } else {
        deps = [];
      }
    }
    if (!Array.isArray(deps)) {
      deps = [];
    }
    this._findDepsInCallback(callback, deps);
    return [deps, config];
  };

  RequireRegister.prototype._findDepsInCallback = function(callback, deps) {
    if ((callback != null) && _.isFunction(callback)) {
      return callback.toString().replace(this.commentRegExp, '').replace(this.requireStringRegexForArrayDeps, function(match, dep) {
        return dep.split(',').map(function(str) {
          str = str.trim();
          return str.substring(1, str.length - 1);
        }).forEach(function(str) {
          return deps.push(str);
        });
      }).replace(this.requireStringRegex, function(match, dep) {
        return deps.push(dep);
      });
    }
  };

  return RequireRegister;

})();

module.exports = new RequireRegister();
