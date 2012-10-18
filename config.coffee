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

exports.validate = ->