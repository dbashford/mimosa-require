path = require 'path'
fs = require 'fs'

_ = require 'lodash'

track = require './tracker'
parse = require './rjs/parse'

logger =  null

module.exports = class RequireRegister

  depsRegistry: {}
  aliasFiles: {}
  aliasDirectories: {}
  requireFiles: []
  tree: {}
  mappings: {}
  packages: {}
  shims: {}
  originalConfig: {}

  requireStringRegex: /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g
  requireStringRegexForArrayDeps: /[^.]\s*require\s*\(\s*\[\s*((["'][^'"\s]+["'][,\s]*?)+)\]/g
  commentRegExp: /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg
  webPathRegex: /^(\/\/[a-zA-Z]|http)/

  retrieveOriginalMergedConfig: ->
    @originalConfig

  dependencyInfo: (mimosaConfig) =>
    reg = {}
    for f, deps of @depsRegistry
      reg[f] = []
      for dep in deps
        if fs.existsSync dep
          reg[f].push dep
        else
          aliasResolved = @_findAlias dep, @aliasFiles
          if aliasResolved
            if aliasResolved.indexOf('MAPPED') is 0
              mappedPath = @_findMappedDependency(f, aliasResolved)
              if mappedPath
                reg[f].push mappedPath
            else
              reg[f].push aliasResolved
          else
            resolvedDirectory = @_findPathWhenAliasDiectory dep, false
            if resolvedDirectory
              reg[f].push resolvedDirectory

    for shimOrigConfigFile, shimConfigs of @shims
      for name, config of shimConfigs
        deps = if Array.isArray(config) then config else config.deps
        if deps?
          resolvedPath = @_resolvePath(shimOrigConfigFile, name)
          f = if fs.existsSync resolvedPath
            f = resolvedPath
          else
            f = @_findAlias name, @aliasFiles

          if f
            reg[f] = []
            for dep in deps
              depPath = @_resolvePath(shimOrigConfigFile, dep)
              if fs.existsSync depPath
                reg[f].push depPath
              else
                aliasResolved = @_findAlias dep, @aliasFiles
                if aliasResolved
                  reg[f].push aliasResolved

    commonIndex = @requireFiles.indexOf(mimosaConfig.require.commonConfig)
    modRequireFiles = @requireFiles
    if commonIndex isnt -1
      modRequireFiles.splice commonIndex, 1

    {registry:reg, mainFiles:modRequireFiles}

  setConfig: (@config) ->
    logger = config.log

    if @config.require.tracking.enabled
      track.setConfig @config
      previousTrackingInfo = track.readTrackingObject()

      @shims  = _.clone previousTrackingInfo.shims
      @depsRegistry = _.clone previousTrackingInfo.deps
      @aliasFiles = _.clone previousTrackingInfo.aliases
      @mappings = _.clone previousTrackingInfo.mappings
      @originalConfig = _.clone previousTrackingInfo.originalConfig
      @requireFiles = _.clone previousTrackingInfo.requireFiles
      @packages = _.clone previousTrackingInfo.packages

    @verify = @config.require.verify.enabled
    unless @rootJavaScriptDir?
      @rootJavaScriptDir = path.join @config.watch.compiledDir, @config.watch.javascriptDir
      #logger.debug "Root Javascript directory set at [[ #{@rootJavaScriptDir} ]]"

  process: (fileName, source) ->
    fileData = @_parse( fileName, source)

    if fileData.requireFile
      @_require fileName, fileData.deps, fileData.config
    else
      @_handleDeps fileName, fileData.deps

    if not @startupComplete and @config.require.tracking.enabled
      track.fileProcessed fileName

  remove: (fileName) ->
    if @config.require.tracking.enabled
      track.deleteForFile fileName

    delete @depsRegistry[fileName] if @depsRegistry[fileName]?
    @_deleteForFileName(fileName, @aliasFiles)
    @_deleteForFileName(fileName, @aliasDirectories)
    @_verifyAll()

  buildDone: (@startupComplete = true) ->
    return if @startupAlreadyDone
    #logger.debug "***Require registration has learned that startup has completed, verifying require registrations***"
    @startupAlreadyDone = true

    if @config.require.tracking.enabled
      track.validateTrackingInfoPostBuild @_removeFileFromCache

    @_verifyAll()

  treeBases: ->
    Object.keys @tree

  treeBasesForFile: (fileName) ->
    return [fileName] if @requireFiles.indexOf(fileName) >= 0

    bases = []
    for base, deps of @tree
      if deps.indexOf(fileName) >= 0
        bases.push(base)

    #logger.debug "Dependency tree bases for file [[ #{fileName} ]] are: #{bases.join('\n')}"

    bases

  # determine if an alias exists for a given path
  aliasForPath: (filePath) ->
    for main, paths of @aliasFiles
      for alias, dep of paths
        if dep is filePath or dep is path.join @rootJavaScriptDir, "#{filePath}.js"
          return alias

  # turns full path into AMD path with alias
  manipulatePathWithAlias: (filePath) ->
    allAliasObjects = _.values(@aliasFiles).concat(_.values(@aliasDirectories))
    fullObject = {}
    for anAlias in allAliasObjects
      fullObject = _.extend(fullObject, anAlias)
    fullObject = _.invert(fullObject)

    sortedKeys = Object.keys(fullObject).sort((a,b) -> b.length > a.length)
    for key in sortedKeys
      osPath = filePath.split('/').join(path.sep)
      if osPath.indexOf(key) is 0
        return osPath.replace(key, fullObject[key])

    filePath

  ###
  ###

  _parse: (fileName, source) ->
    modName = fileName.replace( @rootJavaScriptDir, '').substring(1)
    modName = modName.replace(path.extname(modName), '')
    result = parse modName, fileName, source, { findNestedDependencies: true }

    isRequireFile = false
    rci = parse.findConfig source
    withoutCommonJS = _.without(result, "COMMONJS")
    if rci.requireCount
      numCommonJS = result.length - withoutCommonJS.length
      if numCommonJS isnt rci.requireCount
        isRequireFile = true

    deps: withoutCommonJS
    config: rci.config
    requireFile: isRequireFile

  _removeFileFromCache: (fileName) =>
    [@shims, @depsRegistry, @aliasFiles, @mappings, @packages].forEach (obj) ->
      if obj[fileName]? or obj[fileName] is null
        delete obj[fileName]

    requireFileIndex = @requireFiles.indexOf fileName
    if requireFileIndex > -1
      @requireFiles.splice requireFileIndex, 1

  _logger: (message, method = 'error') ->
    if @verify
      logger[method](message)
    #else
      #logger.debug message

  _require: (fileName, deps, config) ->
    #logger.debug "Inside require function call for [[ #{fileName} ]], file has depedencies of:\n#{deps}"

    unless fileName in @requireFiles
      @requireFiles.push fileName

    if @config.require.tracking.enabled
      track.requireFiles @requireFiles

    if config
      @_handleConfigPaths(fileName, config.map ? null, config.paths ? null, config.packages ? null)
      @_handleShims(fileName, config.shim ? null)

      if config.deps
        deps = deps.concat config.deps

      @_mergeOriginalConfig config

    @_handleDeps(fileName, deps)

  _mergeOriginalConfig: (config) ->
    ["shim", "paths", "map", "packages", "config"].forEach (name) =>
      if config[name]?
        conf = _.clone config[name]
        if @originalConfig[name]?
          @originalConfig[name] = _.extend @originalConfig[name], conf
        else
          @originalConfig[name] = conf

        if @config.require.tracking.enabled
          track.originalConfig @originalConfig

  _deleteForFileName: (fileName, aliases) ->
    #logger.debug "Deleting aliases for file name [[ #{fileName} ]]"
    #logger.debug "Aliases before delete:\n#{JSON.stringify(aliases, null, 2)}\n"

    delete aliases[fileName] if aliases[fileName]
    for fileName, paths of aliases
      for alias, aliasPath of paths
        delete paths[alias] if aliasPath is fileName

    #logger.debug "Aliases after delete:\n#{JSON.stringify(aliases, null, 2)}\n"

  _verifyAll: ->
    @_verifyConfigForFile(file)  for file in @requireFiles
    @_verifyFileDeps(file, deps) for file, deps of @depsRegistry
    @_verifyShims(file, shims) for file, shims of @shims
    @_buildTree()

  _handleShims: (fileName, shims) ->
    if @config.require.tracking.enabled
      track.shims fileName, shims

    if @startupComplete
      @_verifyShims(fileName, shims)
    else
      @shims[fileName] = shims

  _verifyShims: (fileName, shims) ->
    unless shims?
      return # logger.debug "No shims"

    for name, config of shims
      #logger.debug "Processing shim [[ #{name} ]] with config of [[ #{JSON.stringify(config)} ]]"
      unless fs.existsSync @_resolvePath(fileName, name)
        alias = @_findAlias(name, @aliasFiles)
        unless alias
          @_logger "Shim path [[ #{name} ]] inside file [[ #{fileName} ]] cannot be found."

      deps = if Array.isArray(config) then config else config.deps
      if deps?
        for dep in deps
          #logger.debug "Resolving shim dependency [[ #{dep} ]]"
          unless fs.existsSync @_resolvePath(fileName, dep)
            alias = @_findAlias(dep, @aliasFiles)
            unless alias
              @_logger "Shim [[ #{name} ]] inside file [[ #{fileName} ]] refers to a dependency that cannot be found [[ #{dep} ]]."
      # else
        #logger.debug "No 'deps' found for shim"

  _buildTree: ->
    for f in @requireFiles
      #logger.debug "Building tree for require file [[ #{f} ]]"
      @tree[f] = []
      @_addDepsToTree(f, f, f)
      #logger.debug "Full tree for require file [[ #{f} ]] is:\n#{JSON.stringify(@tree[f], null, f)}"

  _addDepsToTree: (f, dep, origDep) ->
    unless @depsRegistry[dep]?
      return #logger.debug "Dependency registry has no depedencies for [[ #{dep} ]]"

    for aDep in @depsRegistry[dep]
      unless fs.existsSync aDep
        #logger.debug "Cannot find dependency [[ #{aDep} ]] for file [[ #{dep} ]], checking aliases/paths/maps"
        aDep = @_findAlias(aDep, @aliasFiles)

        unless aDep?
          return #logger.debug "Cannot find dependency [[ #{aDep} ]] in aliases, is likely bad path"

        if aDep.indexOf('MAPPED!') >= 0
          aDep = @_findMappedDependency(dep, aDep)
          #logger.debug "Dependency found in mappings [[ #{aDep} ]]"

      #logger.debug "Resolved depencency for file [[ #{dep} ]] to [[ #{aDep} ]]"
      if @tree[f].indexOf(aDep) < 0
        #logger.debug "Adding dependency [[ #{aDep} ]] to the tree"
        @tree[f].push(aDep)
      #else
        #logger.debug "Dependency [[ #{aDep} ]] already in the tree, skipping"

      if aDep isnt origDep
        @_addDepsToTree(f, aDep, dep)
      #else
        #logger.debug "[[ #{aDep} ]] may introduce a circular dependency"

  _handleConfigPaths: (fileName, maps, paths, packages) ->
    packages = @_normalizeConfigPackages(packages)

    if @config.require.tracking.enabled
      track.aliases fileName, paths
      track.mappings fileName, maps
      track.packages fileName, packages

    if @startupComplete
      @_verifyConfigForFile(fileName, maps, paths, packages)
      # remove the dependencies for the config file as
      # they'll get checked after the config paths are checked in
      @depsRegistry[fileName] = []
      @_verifyFileDeps(file, deps) for file, deps of @depsRegistry
    else
      @packages[fileName] = packages
      @aliasFiles[fileName] = paths
      @mappings[fileName] = maps

  _handleDeps: (fileName, deps) ->
    if @config.require.tracking.enabled
      track.deps fileName, deps

    if @startupComplete
      @_verifyFileDeps(fileName, deps)
      @_buildTree()
    else
      @depsRegistry[fileName] = deps

  _verifyConfigForFile: (fileName, maps, paths, packages) ->
    # if nothing passed in, then is verify all
    maps ?= @mappings[fileName]
    packages ?= @packages[fileName]

    paths = if paths
      paths
    else
      paths = {}
      paths = _.extend(paths, @aliasFiles[fileName])       if @aliasFiles[fileName]?
      paths = _.extend(paths, @aliasDirectories[fileName]) if @aliasDirectories[fileName]?
      paths

    @aliasFiles[fileName] = {}
    @aliasDirectories[fileName] = {}
    @_verifyConfigPath(fileName, alias, aliasPath) for alias, aliasPath of paths
    @_verifyConfigMappings(fileName, maps)
    @_verifyConfigPackages(fileName, packages)

  _verifyConfigMappings: (fileName, maps) ->
    #logger.debug "Verifying [[ #{fileName} ]] maps:\n#{JSON.stringify(maps, null, 2)}"

    for module, mappings of maps
      if module isnt '*'
        fullDepPath = @_resolvePath(fileName, module)
        if fs.existsSync fullDepPath
          #logger.debug "Verified path for module [[ #{module} ]] at [[ #{fullDepPath} ]]"
          delete maps[module]
          maps[fullDepPath] = mappings
        else
          @_logger "Mapping inside file [[ #{fileName} ]], refers to module that cannot be found [[ #{module} ]]."
          continue
      #else
        #logger.debug "Not going to verify path for '*'"

    for module, mappings of maps
      for alias, aliasPath of mappings
        fullDepPath = @_resolvePath(fileName, aliasPath)
        if @_isWebPath fullDepPath
          #logger.debug "Web path [[ #{fullDepPath} ]] for alias [[ #{alias} ]]being accepted"
          @aliasFiles[fileName][alias] = "MAPPED!#{alias}"
          continue

        unless fs.existsSync fullDepPath
          fullDepPath = @_findAlias(aliasPath, @aliasFiles)

        if alias
          #logger.debug "Found mapped dependency [[ #{alias} ]] at [[ #{fullDepPath} ]]"
          @aliasFiles[fileName][alias] = "MAPPED!#{alias}"
          maps[module][alias] = fullDepPath
        else
          @_logger "Mapping inside file [[ #{fileName} ]], for module [[ #{module} ]] has path that cannot be found [[ #{aliasPath} ]]."

  _verifyConfigPackages: (fileName, packages) ->
    # logger.debug "Verifying [[ #{fileName} ]] packages:\n#{JSON.stringify(packages)}"

    return unless packages

    for pkg in packages
      pkgFullDirPath = path.join(@rootJavaScriptDir, pkg.location)
      if fs.existsSync pkgFullDirPath
        if fs.statSync(pkgFullDirPath).isDirectory()
          @aliasDirectories[fileName][pkg.name] = pkgFullDirPath
        else
          @_logger "location for package [[ #{pkg.name} ]] was found but is not a directory"
      else
        @_logger "location for package [[ #{pkg.name} ]] could not be found"

      fullDepPath = @_resolvePackagePath(fileName, pkg)
      if fs.existsSync fullDepPath
        @aliasFiles[fileName][pkg.name] = fullDepPath
      else
        @_logger "Mapping inside file [[ #{fileName} ]], for module [[ #{module} ]] has path that cannot be found [[ #{aliasPath} ]]."

  _normalizeConfigPackages:(packages) ->
    unless packages? and Array.isArray(packages)
      #logger.debug "Packages defined in unknown way (expected an array) - skipping packages object of type : [[ #{typeof packages} ]]"
      return null #return null if this is something we can't understand

    packages = _.filter packages, (pkg) ->
      return true if _.isString(pkg) or _.isObject(pkg)
      logger.debug "Package defined in unknown way, skipping pkg object of type : [[ #{typeof pkg} ]]"

    pkgFormat = { name: '', location: '', main: 'main'}
    _.map packages, (pkg) ->
      if _.isString(pkg)
        return _.extend({}, pkgFormat, { name: pkg })
      _.extend({}, pkgFormat, pkg)

  _resolvePackagePath: (fileName, pkg, alias) ->
    #logger.debug "Resolving alias [[ #{alias} ]] for package:\n[[ #{JSON.stringify(pkg, null, 2)} ]]\n in file [[#{fileName}]]"
    relativePath = path.join pkg.location, pkg.main
    @_resolvePath(fileName, relativePath)

  _isWebPath: (filePath) ->
    @webPathRegex.test filePath

  _verifyConfigPath: (fileName, alias, aliasPath) ->
    #logger.debug "Verifying configPath in fileName [[ #{fileName} ]], path alias [[ #{alias} ]], with aliasPath(s) of [[ #{aliasPath} ]]"
    if Array.isArray(aliasPath)
      #logger.debug "Paths are in array"
      for aPath in aliasPath
        @_verifyConfigPath(fileName, alias, aPath)
      return

    unless typeof aliasPath is "string"
      return @_logger "Expected string in paths config and instead got this: [[ #{JSON.stringify(aliasPath)} ]] for file [[ #{fileName} ]]"

    # mapped paths are ok
    if aliasPath.indexOf("MAPPED") is 0
      return #logger.debug "Is mapped path [[ #{aliasPath} ]]"

    # as are web resources, CDN, etc
    if @_isWebPath aliasPath
      #logger.debug "Is web resource path [[ #{aliasPath} ]]"
      return @aliasFiles[fileName][alias] = aliasPath

    fullDepPath = @_resolvePath(fileName, aliasPath)
    if fs.existsSync fullDepPath
      if fs.statSync(fullDepPath).isDirectory()
        #logger.debug "Path found at [[ #{fullDepPath}]], is a directory, adding to list of alias directories"
        @aliasDirectories[fileName][alias] = fullDepPath
      else
        #logger.debug "Path found at [[ #{fullDepPath}]], is a file, adding to list of alias files"
        @aliasFiles[fileName][alias] = fullDepPath
    else
      pathAsDirectory = fullDepPath.replace(/.js$/, '')
      if fs.existsSync pathAsDirectory
        #logger.debug "Path exists as directory, [[ #{pathAsDirectory} ]], adding to list of alias directories"
        @aliasDirectories[fileName] ?= {}
        @aliasDirectories[fileName][alias] = pathAsDirectory
      else
        @_logger "Dependency [[ #{aliasPath} ]] for path alias [[ #{alias} ]], inside file [[ #{fileName} ]], cannot be found."
        #logger.debug "Used this as full dependency path [[ #{fullDepPath} ]]"

  _verifyFileDeps: (fileName, deps) ->
    @depsRegistry[fileName] = []
    return unless deps?
    @_verifyDep(fileName, dep) for dep in deps

  _verifyDep: (fileName, dep) ->
    # require, module = valid dependencies passed by require
    if dep is 'require' or dep is 'module' or dep is 'exports'
      return #logger.debug "Encountered keyword-esque dependency [[ #{dep} ]], ignoring."

    # as are web resources, CDN, etc
    if @_isWebPath dep
      #logger.debug "Is web resource dependency [[ #{dep} ]], no further checking required"
      return @_registerDependency(fileName, dep)

    # handle plugins
    if dep.indexOf('!') >= 0
      [plugin, dep] = dep.split('!')
      #logger.debug "Is plugin dependency, going to verify plugin path [[ #{plugin}]]"
      @_verifyDep(fileName, plugin)

      if dep?.length is 0
        return #logger.debug "Plugin does not also have dependency"

      #logger.debug "Also going to verify plugin dependency [[ #{dep} ]]"
      plugin = true

    # resolve path, if mapped, find already calculated map path
    fullDepPath = if dep.indexOf('MAPPED') is 0
      #logger.debug "Is mapped dependency, looking in mappings..."
      @_findMappedDependency(fileName, dep)
    else
      @_resolvePath(fileName, dep, plugin)

    if fs.existsSync fullDepPath
      for fileAliasList in _.values @aliasFiles
        if _.values(fileAliasList).indexOf(fullDepPath) > -1
          # Path has been aliased so alias must be used
          return logger.error "Dependency [[ #{dep} ]] in [[ #{fileName} ]] has been aliased in the paths config and the alias must be used."

      # file exists, register it
      @_registerDependency(fileName, fullDepPath)
    else
      #logger.debug "Cannot find dependency [[ #{fullDepPath} ]], looking in paths..."
      alias = @_findAlias(dep, @aliasFiles)
      if alias
        # file does not exist, but is aliased, register the alias
        @_registerDependency(fileName, dep)
      else
        #logger.debug "Cannot find dependency as path alias..."
        pathWithDirReplaced = @_findPathWhenAliasDiectory(dep, plugin)
        if pathWithDirReplaced? and fs.existsSync pathWithDirReplaced
          # exact path does not exist, but can be found by following directory alias
          @_registerDependency(fileName, dep)
        else
          @_logger "Dependency [[ #{dep} ]], inside file [[ #{fileName} ]], cannot be found."
          #logger.debug "Used this as full dependency path [[ #{fullDepPath} ]]"
          @_registerDependency(fileName, dep)
          # much sadness, cannot find the dependency

  _findMappedDependency: (fileName, dep) ->
    depName = dep.split('!')[1]

    for mainFile, mappings of @mappings
      return mappings[fileName][depName] if mappings[fileName]?[depName]?

    for mainFile, mappings of @mappings
      return mappings['*'][depName] if mappings['*']?[depName]?

    @_logger "Mimosa has a bug! Ack! Cannot find mapping and it really should have."

  _registerDependency: (fileName, dependency) ->
    #logger.debug "Found dependency [[ #{dependency} ]] for file name [[ #{fileName} ]], registering it!"
    @depsRegistry[fileName].push(dependency)
    if @_isCircular(fileName, dependency)
      @_logger "A circular dependency exists between [[ #{fileName} ]] and [[ #{dependency} ]]", 'warn'

  _isCircular: (dep1, dep2) ->
    oneHasTwo = @depsRegistry[dep1]?.indexOf(dep2) >= 0
    twoHasOne = @depsRegistry[dep2]?.indexOf(dep1) >= 0
    oneHasTwo and twoHasOne

  _findAlias: (dep, aliases) ->
    for fileName, paths of aliases
      if paths[dep]?
        #logger.debug "Found alias [[ #{paths[dep]} ]] in file name [[ #{fileName} ]] for dependency [[ #{dep} ]]"
        return paths[dep]

  _resolvePath: (fileName, dep, plugin = false) ->
    if dep.indexOf(@rootJavaScriptDir) is 0
      return dep

    # handle windows paths by splitting and rejoining
    dep = dep.split('/').join(path.sep)

    fullPath = if dep.charAt(0) is '.'
      path.resolve path.dirname(fileName), dep
    else
      path.join @rootJavaScriptDir, dep

    if fullPath.match(/\.\w+$/) and plugin
      #logger.debug "Encountered plugin file with extension, letting that pass as is [[ #{fullPath} ]]"
      fullPath
    else
      "#{fullPath}.js"

  _findPathWhenAliasDiectory: (dep, plugin) ->
    pathPieces = dep.split('/')
    alias = @_findAlias(pathPieces[0], @aliasDirectories)
    if alias
      #logger.debug "Found alias as directory [[ #{alias} ]]"
      pathPieces[0] = alias
      fullPath = pathPieces.join(path.sep)
      if fullPath.match(/\.\w+$/) and plugin
        fullPath
      else
        "#{path.normalize(fullPath)}.js"
    else
      null

module.exports = new RequireRegister()