"use strict"

logger = require 'logmimosa'

exports.defaults = ->
  require:
    verify:
      enabled: true
    optimize :
      inferConfig:true
      overrides:{}

exports.placeholder = ->
  """
  \t

    # require:                 # configuration for requirejs options.
      # verify:                # settings for requirejs path verification
        # enabled: true        # Whether or not to perform verification
      # optimize :
        # inferConfig:true     # Mimosa figures out all you'd need for a simple r.js optimizer run.
                               # If you rather Mimosa not do that, set inferConfig to false and
                               # provide your config in the overrides section. See here
                               # https://github.com/dbashford/mimosa#requirejs-optimizer-defaults
                               # to see what the defaults are.
        # overrides:           # Optimization configuration and Mimosa overrides. If you need to
                               # make tweaks uncomment this line and add the r.js config
                               # (http://requirejs.org/docs/optimization.html#options) as new
                               # paramters inside the overrides ojbect. To unset Mimosa's defaults,
                               # set a property to null
  """

exports.validate = (config, validators) ->
  errors = []
  if validators.ifExistsIsObject(errors, "require config", config.require)
    if validators.ifExistsIsObject(errors, "require.verify", config.require.verify)
      validators.ifExistsIsBoolean(errors, "require.verify.enabled", config.require.verify.enabled)


    if validators.ifExistsIsObject(errors, "require.optimize", config.require.optimize)
      validators.ifExistsIsBoolean(errors, "require.optimize.inferConfig", config.require.optimize.inferConfig)
      validators.ifExistsIsObject(errors, "require.optimize.overrides", config.require.optimize.overrides)

  if errors.length is 0
    # need to set some requirejs stuff
    if config.isOptimize and config.isMinify
      logger.info "Optimize and minify both selected, setting r.js optimize property to 'none'"
      config.require.optimize.overrides.optimize = "none"

    # helpful shortcut
    config.requireRegister = config.require.verify.enabled or config.isOptimize

  errors