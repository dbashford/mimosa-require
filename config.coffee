logger = require 'mimosa-logger'

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

    # require:                              # configuration for requirejs options.
      # verify:                             # settings for requirejs path verification
        # enabled: true                     # Whether or not to perform verification
      # optimize :
        # inferConfig:true                  # Mimosa figures out all you'd need for a simple r.js optimizer run. If you rather Mimosa
                                            # not do that, set inferConfig to false and provide your config in the overrides section.
                                            # See here https://github.com/dbashford/mimosa#requirejs-optimizer-defaults to see what
                                            # the defaults are.
        # overrides:                        # Optimization configuration and Mimosa overrides. If you need to make tweaks uncomment
                                            # this line and add the r.js config (http://requirejs.org/docs/optimization.html#options)
                                            # as newparamters inside the overrides ojbect. To unset Mimosa's defaults, set a property
                                            # to null
  """

exports.validate = (config) ->
  errors = []
  if config.require?
    if typeof config.require is "object" and not Array.isArray(config.require)
      if config.require.verify?
        if typeof config.require.verify is "object" and not Array.isArray(config.require.verify)
          if config.require.verify.enabled?
            unless typeof config.require.verify.enabled is "boolean"
              errors.push "require.verify.enabled must be a boolean."
        else
          errors.push "require.verify must be an object."
      if config.require.optimize?
        if typeof config.require.optimize is "object" and not Array.isArray(config.require.optimize)
          if config.require.optimize.inferConfig?
            unless typeof config.require.optimize.inferConfig is "boolean"
              errors.push "require.optimize.inferConfig must be a boolean."

          if config.require.optimize.overrides?
            unless typeof config.require.optimize.overrides is "object" and not Array.isArray(config.require.optimize.overrides)
              errors.push "require.optimize.overrides must be a object."
        else
          errors.push "require.optimize must be an object."
    else
      errors.push "require configuration must be an object."

  if errors.length is 0
    # need to set some requirejs stuff
    if config.isOptimize and config.isMinify
      logger.info "Optimize and minify both selected, setting r.js optimize property to 'none'"
      config.require.optimize.overrides.optimize = "none"

    # helpful shortcut
    config.requireRegister = config.require.verify.enabled or config.isOptimize

  errors