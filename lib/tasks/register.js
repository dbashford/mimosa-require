var RequireRegister, fs, logger, path, _,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

path = require('path');

fs = require('fs');

_ = require('lodash');

logger = require('logmimosa');

module.exports = RequireRegister = (function() {
  function RequireRegister() {
    this._findDepsInCallback = __bind(this._findDepsInCallback, this);
  }

  RequireRegister.prototype.depsRegistry = {};

  RequireRegister.prototype.aliasFiles = {};

  RequireRegister.prototype.aliasDirectories = {};

  RequireRegister.prototype.requireFiles = [];

  RequireRegister.prototype.tree = {};

  RequireRegister.prototype.mappings = {};

  RequireRegister.prototype.shims = {};

  RequireRegister.prototype.requireStringRegex = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g;

  RequireRegister.prototype.requireStringRegexForArrayDeps = /[^.]\s*require\s*\(\s*\[\s*((["'][^'"\s]+["'][,\s]*?)+)\]/g;

  RequireRegister.prototype.commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;

  RequireRegister.prototype.setConfig = function(config) {
    this.config = config;
    this.verify = this.config.require.verify.enabled;
    if (this.rootJavaScriptDir == null) {
      return this.rootJavaScriptDir = this.config.isVirgin ? path.join(this.config.watch.sourceDir, this.config.watch.javascriptDir) : path.join(this.config.watch.compiledDir, this.config.watch.javascriptDir);
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
      return eval(source);
    } catch (_error) {
      e = _error;
      this._logger("File named [[ " + fileName + " ]] is not wrapped in a 'require' or 'define' function call.", "warn");
      return this._logger("" + e, 'warn');
    }
  };

  RequireRegister.prototype.remove = function(fileName) {
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

  /*
  Private
  */


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
      var config, _ref, _ref1, _ref2, _ref3;

      _ref = _this._requireOverride(deps, callback, errback, optional), deps = _ref[0], config = _ref[1];
      if (config || deps) {
        if (__indexOf.call(_this.requireFiles, fileName) < 0) {
          _this.requireFiles.push(fileName);
        }
        if (config) {
          _this._handleConfigPaths(fileName, (_ref1 = config.map) != null ? _ref1 : null, (_ref2 = config.paths) != null ? _ref2 : null);
          _this._handleShims(fileName, (_ref3 = config.shim) != null ? _ref3 : null);
        }
      }
      return _this._handleDeps(fileName, deps);
    };
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
    if (!this.config.isVirgin) {
      return this._buildTree();
    }
  };

  RequireRegister.prototype._handleShims = function(fileName, shims) {
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
      if (!this._fileExists(this._resolvePath(fileName, name))[0]) {
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
            if (!this._fileExists(this._resolvePath(fileName, dep))[0]) {
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
    var aDep, exists, _i, _len, _ref;

    if (this.depsRegistry[dep] == null) {
      return;
    }
    _ref = this.depsRegistry[dep];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      aDep = _ref[_i];
      exists = this._fileExists(aDep)[0];
      if (!exists) {
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

  RequireRegister.prototype._handleConfigPaths = function(fileName, maps, paths) {
    var deps, file, _ref, _results;

    if (this.startupComplete) {
      this._verifyConfigForFile(fileName, maps, paths);
      this.depsRegistry[fileName] = [];
      _ref = this.depsRegistry;
      _results = [];
      for (file in _ref) {
        deps = _ref[file];
        _results.push(this._verifyFileDeps(file, deps));
      }
      return _results;
    } else {
      this.aliasFiles[fileName] = paths;
      return this.mappings[fileName] = maps;
    }
  };

  RequireRegister.prototype._handleDeps = function(fileName, deps) {
    if (this.startupComplete) {
      this._verifyFileDeps(fileName, deps);
      if (!this.config.isVirgin) {
        return this._buildTree();
      }
    } else {
      return this.depsRegistry[fileName] = deps;
    }
  };

  RequireRegister.prototype._verifyConfigForFile = function(fileName, maps, paths) {
    var alias, aliasPath;

    maps = maps != null ? maps : this.mappings[fileName];
    paths = paths ? paths : (paths = {}, this.aliasFiles[fileName] != null ? paths = _.extend(paths, this.aliasFiles[fileName]) : void 0, this.aliasDirectories[fileName] != null ? paths = _.extend(paths, this.aliasDirectories[fileName]) : void 0, paths);
    this.aliasFiles[fileName] = {};
    this.aliasDirectories[fileName] = {};
    for (alias in paths) {
      aliasPath = paths[alias];
      this._verifyConfigPath(fileName, alias, aliasPath);
    }
    return this._verifyConfigMappings(fileName, maps);
  };

  RequireRegister.prototype._verifyConfigMappings = function(fileName, maps) {
    var alias, aliasPath, exists, fullDepPath, mappings, module, _ref, _results;

    for (module in maps) {
      mappings = maps[module];
      if (module !== '*') {
        fullDepPath = this._resolvePath(fileName, module);
        _ref = this._fileExists(fullDepPath), exists = _ref[0], fullDepPath = _ref[1];
        if (exists) {
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
        var _ref1, _results1;

        _results1 = [];
        for (alias in mappings) {
          aliasPath = mappings[alias];
          fullDepPath = this._resolvePath(fileName, aliasPath);
          if (fullDepPath.indexOf('http') === 0) {
            this.aliasFiles[fileName][alias] = "MAPPED!" + alias;
            continue;
          }
          _ref1 = this._fileExists(fullDepPath), exists = _ref1[0], fullDepPath = _ref1[1];
          if (!exists) {
            alias = this._findAlias(aliasPath, this.aliasFiles);
            if (alias) {
              exists = true;
            }
          }
          if (exists) {
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

  RequireRegister.prototype._verifyConfigPath = function(fileName, alias, aliasPath) {
    var aPath, exists, fullDepPath, pathAsDirExists, pathAsDirectory, _base, _i, _len, _ref, _ref1, _ref2;

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
    if (aliasPath.indexOf('http') === 0) {
      return this.aliasFiles[fileName][alias] = aliasPath;
    }
    fullDepPath = this._resolvePath(fileName, aliasPath);
    _ref = this._fileExists(fullDepPath), exists = _ref[0], fullDepPath = _ref[1];
    if (exists) {
      if (fs.statSync(fullDepPath).isDirectory()) {
        return this.aliasDirectories[fileName][alias] = fullDepPath;
      } else {
        return this.aliasFiles[fileName][alias] = fullDepPath;
      }
    } else {
      pathAsDirectory = fullDepPath.replace(/.js$/, '');
      _ref1 = this._fileExists(pathAsDirectory), pathAsDirExists = _ref1[0], pathAsDirectory = _ref1[1];
      if (pathAsDirExists) {
        if ((_ref2 = (_base = this.aliasDirectories)[fileName]) == null) {
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
    var alias, exists, fullDepPath, pathAsDirReplaced, pathExists, pathWithDirReplaced, plugin, _ref, _ref1, _ref2;

    if (dep === 'require' || dep === 'module' || dep === 'exports') {
      return;
    }
    if (dep.indexOf('http') === 0) {
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
    _ref1 = this._fileExists(fullDepPath), exists = _ref1[0], fullDepPath = _ref1[1];
    if (exists) {
      return this._registerDependency(fileName, fullDepPath);
    } else {
      alias = this._findAlias(dep, this.aliasFiles);
      if (alias) {
        return this._registerDependency(fileName, dep);
      } else {
        pathWithDirReplaced = this._findPathWhenAliasDiectory(dep, plugin);
        if (pathWithDirReplaced != null) {
          _ref2 = this._fileExists(pathWithDirReplaced), pathExists = _ref2[0], pathAsDirReplaced = _ref2[1];
        }
        if (pathWithDirReplaced && pathExists) {
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

  RequireRegister.prototype._fileExists = function(filePath) {
    var extension, newExtensionfilePath, _i, _len, _ref;

    if (fs.existsSync(filePath)) {
      return [true, filePath];
    }
    if (this.config.isVirgin) {
      if (filePath === path.join(this.rootJavaScriptDir, "templates.js")) {
        return [true, filePath];
      }
      _ref = this.config.extensions.javascript;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        extension = _ref[_i];
        newExtensionfilePath = filePath.replace(/\.[^.]+$/, "." + extension);
        if (fs.existsSync(newExtensionfilePath)) {
          return [true, newExtensionfilePath];
        }
      }
    }
    return [false, filePath];
  };

  return RequireRegister;

})();

module.exports = new RequireRegister();
