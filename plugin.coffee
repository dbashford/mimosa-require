"use strict"

requireRegister = require './lib/register'
optimizer = require './lib/optimize'

exports.registration = (config, register) ->

  return unless config.require.verify.enabled or config.isOptimize
  e = config.extensions
  register ['add','update','buildFile'],      'betweenCompileWrite',   _requireRegister, [e.javascript...]
  register ['add','update','buildExtension'], 'betweenCompileWrite',   _requireRegister, [e.template...]
  register ['remove'],                        'afterDelete',    _requireDelete,   [e.javascript...]
  register ['buildDone'],                     'beforeOptimize', _buildDone

  if config.isOptimize
    register ['add','update','remove'], 'afterWrite', _requireOptimizeFile, [e.javascript..., e.template...]
    register ['buildDone'],             'optimize',   _requireOptimize

  requireRegister.setConfig(config)

exports.aliasForPath = (libPath) ->
  requireRegister.aliasForPath(libPath)

_requireDelete = (config, options, next) ->
  return next() unless options.files?.length > 0
  requireRegister.remove(options.files[0].inputFileName)
  next()

_requireRegister = (config, options, next) ->
  return next() unless options.files?.length > 0
  return next() if options.isVendor
  options.files.forEach (file) ->
    if file.outputFileName and file.outputFileText
      if config.isVirgin
        requireRegister.process(file.inputFileName, file.outputFileText)
      else
        requireRegister.process(file.outputFileName, file.outputFileText)

  next()

_requireOptimizeFile = (config, options, next) ->
  return next() unless options.files?.length > 0

  filesDone = 0
  done = ->
    next() if options.files.length is ++filesDone

  options.files.forEach (file) ->
    if file.outputFileName and file.outputFileText
      optimizer.optimize config, file.outputFileName, done

_requireOptimize = (config, options, next) ->
  optimizer.optimize(config, null, next)

_buildDone = (config, options, next) ->
  requireRegister.buildDone()
  next()
