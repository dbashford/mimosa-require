mimosa-require
===========

This is Mimosa's AMD/RequireJS module.  It covers validation for AMD dependencies and optimization using r.js.  It is installed by default with Mimosa.

* For more information regarding Mimosa, see http://mimosa.io

# Usage

Add `'require'` to your list of modules.  That's all!  Mimosa will install the module for you when you start `mimosa watch` or `mimosa build`.

# Functionality

TBD

# Default Config

```javascript
require: {
  exclude:[],
  commonConfig:"common",
  tracking: {
    enabled: true,
    path: ".mimosa/require/tracking.json"
  }
  verify: {
    enabled: true,
    plugins: {
      css:"css",
      hbs:"hbs"
    }
  }
  optimize : {
    modules: null,
    moduleCachingPath: ".mimosa/require/moduleCaching",
    inferConfig:true,
    overrides:{}
  }
}
```

#### `require.exclude` array of string/regex
When matching a file will keep that file from being processed by the mimosa-require module. This can be used to keep files from being considered main modules to be used for processing if require infers incorrectly. String paths must include the file name.

#### `require.commonConfig` string
Location of common RequireJS configuration that is used across multiple pages/modules. See the [RequireJS multi-page application example on GitHub](https://github.com/requirejs/example-multipage/tree/master/www/js) for an example of using common configuration.

#### `require.tracking` object
Settings for mimosa-require tracking. When enabled mimosa-require makes a record of its dependency information on the file system. This provides faster `mimosa watch` startup times as Mimosa does not need to process every JavaScript file to build a dependency tree.

#### `require.tracking.enabled` boolean
When set `true` mimosa-require will keep tracking information cached on the file system. When set to `false` mimosa-require will force Mimosa to recompile/reprocess all its JavaScript.

#### `require.tracking.path` string
The path to the tracking file relative to the root of the project.

#### `require.verify` object
Settings for AMD/RequireJS path verification.

#### `require.verify.enabled` boolean
Whether or not mimosa-require will perform AMD/RequireJS path verification.

#### `require.verify.plugins` object
mimosa-require will verify plugin paths that are listed as dependencies. It does not keep track of plugins otherwise. Plugins are provided by giving the plugin prefix as the key and the extension of the plugin files as a value. "css" and "hbs" are provided as default plugins. If you add more to this list, consider submitting an issue to have it added as a default.

#### `require.optimize` object
Settings for asset optimization via the r.js optimizer.

#### `require.optimize.modules` object
Use this if building a modules-based require.js application. This is a straight pass-through of the typical require.js `modules` config.  See the [MimosaDynamicRequire](https://github.com/dbashford/MimosaDynamicRequire) example project for an example of this.

#### `require.optimize.moduleCachingPath` string
This setting is only valid when running a modules-based project. mimosa-require keeps some files cached for re-running during `mimosa watch`. This path is where the caching takes place.

#### `require.optimize.inferConfig` boolean
mimosa-require infers many r.js optimizer settings. Set `inferConfig` to `false` to make mimosa-require not infer anything. See above for a discussion on what mimosa-require will infer.

#### `require.optimize.overrides` object/function
Used to make tweaks to the r.js configuration for asset optimization. Add r.js config settings as new properties inside the `require.optimize.overrides` object. To just unset a mimosa-require inferred value, set the property to `null`. `require.optimize.overrides` can also be a function. That function is passed the full inferred r.js config for the module being optimized. This provides the opportunity to amplify the inferred config rather than just replace it.
