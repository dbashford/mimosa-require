mimosa-require
===========

This is Mimosa's AMD/RequireJS module.  It covers validation for AMD dependencies and optimization using r.js.  It is installed by default with Mimosa.

For more information regarding Mimosa, see http://mimosa.io

# Usage

Add `'require'` to your list of modules.  That's all!  Mimosa will install the module for you when you start `mimosa watch` or `mimosa build`.

### Different Versions

There are currently two maintained versions of this.  The version in master is `2.*`` and the version in the [next](https://github.com/dbashford/mimosa-require/tree/next) branch is `3.*`

Which is for you? If you need to use the `modules` config, you will want `2.*`.  If you will be optimizing your entire application into a single file, you should use `3.*`.

For more details on the differences, [check out the blog post I made on the topic](http://dbashford.github.io/bumping-require-js-but-not-for-mimosa-yet/index.html).

# Functionality

For both the `build` and `watch` commands, Mimosa provides an `--optimize` flag that will turn on optimization. When the `--optimize` flag is engaged, mimosa-require configures and runs the r.js optimizer with a default configuration gleaned from analyzing the code of your application.

Here's some of what this module does:

* Verify paths when JavaScript successfully compiles. Mimosa will follow relative paths for dependencies, and also use config paths whether they resolve to an actual dependency, `jquery: 'vendor/jquery'``, or they resolve to a module, `moduleX:'a/path/to/module/x'`.
* Detect dependencies embedded within define and require callbacks. i.e. deferred require calls.
* Verify map, shim and package paths, and keep track of those configs for path verification.
* Verify plugin paths.
* Notify when paths are broken. An unresolved path is as crucial as a compiler error: code is broken.
* Catch circular dependencies and notify on the console.
* Catch when a non-vendor piece of compiled JavaScript isn't wrapped in require or define and notify you on the console.
* Run RequireJS' optimizer when the optimize flag is enabled for `mimosa build`, and on every file change for `mimosa watch`.
* Need no config for the optimizer. Mimosa will keep track of dependencies and build a vanilla optimizer configuration.
* Use your modules config to create many r.js outputs for your dynamic requirejs calls.
* For complex r.js configurations, allow modification of pre-built inferred configs rather than needing from-scratch configurations.
* Handle multi-page applications with multiple modules.
* Detect and use common RequireJS configuration used across multiple modules
* Only compile/concatenate those files that need it based on changed code.
* Bundle optimized JavaScript with Almond

### Ways to optimize

#### Single file optimization with Almond

require.js is a huge library and when your application is concatenated into a single file, much of the library isn't necessary. [Almond](https://github.com/jrburke/almond) is a "minimal AMD API implementation for use after optimized builds". It contains just what is necessary to wire together your concatenated application.

By default, when building a single file output (i.e. not using the `optimize.modules` config) Mimosa will wrap r.js optimized code in Almond.  If you are loading modules/resources dynamically, such as from a CDN, Almond does not support that. See [this Mimosa issue](https://github.com/dbashford/mimosa/issues/141) for help dealing with CDN resources.

mimosa-require comes with its own Almond that it will write into your `watch.compiledDir` for you.

##### Source Maps

When `mimosa watch` is used with `--optimize` (and not also `--minify` which does minification outside of this module), mimosa-require will generate source maps for easy debugging in browser dev tools. `mimosa build` does not generate source maps. All cleans performed by various Mimosa tasks will clean up the generated `.src` and `.map` files. Because generation of source maps is configured via the r.js config, which can already be overridden in the `require` config, no additional config settings have been added to change the default behaviors.

#### Multi-file optimization with the `modules` config

The [MimosaDynamicRequire project](https://github.com/dbashford/MimosaDynamicRequire) is an example of a application that is bundled into several files. The `optimize.modules` config allows you to configure the individual files you want your application bundled into.

##### Source Maps and `modules`

Source maps are disabled by default for r.js builds that involve the modules config. Source maps are only generated when using `mimosa watch`, so when running `watch` with the `optimize` flag and a `modules` config, mimosa-require turns off source maps. Source maps do not cause any issues with the first r.js optimize run, but they do cause trouble with subsequent ones. Source maps can be forced on by adding `generateSourceMaps: true` to the `require.optimize.overrides`. Just know the 2nd+ runs will not output proper files.

### r.js Optimizer Settings

#### Inferred r.js Optimizer Settings

mimosa-require monitors all the JavaScript files that are processed by Mimosa and learns several things from them. First, it determines from them what the dependency tree of your application is. Second, it will attempt to figure out what your `requirejs.config` (paths, shims, maps, etc) is.  From all that it learns, it can put together a basic r.js config.

The following are the settings mimosa-require will infer for all r.js builds:

* `baseUrl`: set by combining the mimosa-config `watch.compiledDir` with the `watch.javascriptDir`
* `mainConfigFile`: set to the file path of the main module unless a common config (`require.commonConfig` setting) is detected. If a common config is found, `mainConfigFile` is set to that.
* `findNestedDependencies`: true
* `wrap`: true
* `logLevel`: set to `3` which is the r.js error logging level
* `optimize`: set to `uglify2` unless both the `--optimize` and `--minify` flags are used, in which case it is set to `none`. When the `--minify` flag is engaged, mimosa-require assumes something else is minifying the JavaScript.

For single file runs without `modules`, the following will also be inferred:

* `out`: optimized files are output into the `watch.compiledDir` + `watch.javascriptDir` in a file that is the main module name + `-built.js`
* `include`: set to the name of the module being compiled
* `insertRequire`: set to the name of the module being compiled
* `name`: set to `almond`

For runs that involve the `optimize.modules` config, the following in inferred:

* `keepBuildDir`: Keeps the build directory between builds.
* `dir`: This is set to the relative path from the root of the project to the root of the javascript directory as defined in the `watch` config. This is where all the outputs from the run will be deposited.

#### Overriding/Amplifying Default Optimizer Settings

Any of the [RequireJS optimizer configuration options](http://requirejs.org/docs/optimization.html#options) can be included in the `require.optimize.overrides` property of the mimosa-config. Settings can be both overridden and removed. To override an inferred r.js setting, put the override in `overrides`. To remove a default setting, set it to `null`.

`require.optimize.overrides` can also be configured as a function. That function is passed the full inferred r.js config for the module being optimized. This provides the opportunity to amplify the inferred config rather than just replace it.

mimosa-require can also be configured to not infer anything and to go entirely with a custom config. Set `require.optimize.inferConfig` to `false` and Mimosa will run r.js with only the settings provided in `require.optimize.overrides`.

Also use `require.optimize.inferConfig:false` if configuration settings are in script tags in an HTML file, or in any other file that does not compile to JavaScript. mimosa-config is only able to infer r.js configuration using JavaScript files. If a config (and require/requirejs method calls) are in script tags on an HTML page, mimosa-require will not find any modules to compile for optimization and therefore will not run optimization, so a custom configuration will need to be provided in `overrides` with `inferConfig` set to `false`.

#### Take control of the optimizer with Mimosa modules

mimosa-require can't know all the intricacies of a project. It can make a lot of educated guesses and put together a really good base r.js config, but there are times when complicated alterations must be made to the r.js config. `overrides` allows static changes to the r.js configuration, but that isn't always ideal. `require.optimize.inferConfig:false` loses all of the smarts Mimosa puts into building a r.js config. Ideally a project can take advantage of the work Mimosa puts into building the r.js config, and dynamically alter it as well.

mimosa-require's building of the inferred r.js config, and the execution of the r.js optimization are pulled apart in two separate steps in Mimosa's workflows. Config building executes during the `beforeOptimize` step, and execution during the `optimize` step. This means a custom module can programmatically and dynamically alter the mimosa-require-prepared r.js configs before r.js execution occurs.

For instance, maybe there are files to include in the r.js execution that are not pulled in as dependencies by r.js -- maybe all `.html` files via the require.js text plugin -- and rather than listing them one by one in the `overrides`, they could be dynamically added so a list need not be maintained. A module could do this, executing during the `beforeOptimize` step, but after the configs have been built. In that module the codebase could be scanned for `.html` files and push them onto the r.js config include array.

Doing this provides both Mimosa's smarts, and the intelligence Mimosa can't provide by way of a custom module. To get started building such a module, check out the long-named example [mimosa-requirebuild-textplugin-include](https://github.com/dbashford/mimosa-requirebuild-textplugin-include) which performs just the task mentioned above.

#### How can I see the inferred config?

If you run mimosa with the `-D` flag on, right before mimosa-require executes r.js, it will write the full r.js config to the console.

You can also implement `overrides` with a function and print out the object that is passed to it.

### Improve your build using `--minify` + `--optimize`

Mentioned above, if you use both the `--minify` and `--optimize` flag, mimosa-require will assume minification is being performed by another module and it will not minify/mangle any JavaScript.

#### Omit files from minification

The r.js optimizer by itself is often good enough to handle minifying, compressing and pulling modules into single files; however, the occasional file does not take kindly to being run through Uglify and will be broken when compressed. The r.js optimizer is all or none. It does not allow omitting a file from compression if it is not compressing correctly.

By turning off r.js' minification, it lets you selectively minify on your own using modules like [mimosa-minify-js](https://github.com/dbashford/mimosa-minify-js/). This will allow you to omit any files from minification prior to r.js running.

#### Speed up the build

If a project has many pages, and therefore many optimized files that need to be written, using both flags at the same time will also speed up the build. If r.js is bundling files that are already minified, then the minified versions are used to build the many optimized files.

If r.js is dealing with un-minified files, then those files have to be minified by the r.js optimizer. The optimizer is going to minify each file every time it is used. So if the unminified jQuery source is in a project's codebase, and it is used on 10 pages and therefore is bundled into 10 optimized files, then r.js will minify it 10 times, which can slow the build. So, if a build is running slow, try adding a minification module to your project and using both flags at once to speed it up.

# Default Config

```javascript
require: {
  exclude:[],
  safeDeps:[],
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
    removeCombined: true,
    overrides:{}
  }
}
```

#### `require.exclude` array of string/regex
When matching a file will keep that file from being processed by the mimosa-require module. This can be used to keep files from being considered main modules to be used for processing if require infers incorrectly. String paths must include the file name.

#### `require.safeDeps` array of strings
Dependencies that when encountered will not trigger validation.  If for some reason there is a dependency that is triggering a validation warning/error that you would like to go away, adding the string used for the dependency to safeDeps will make the warning/error go away.

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

#### `require.optimize.removeCombined` boolean
During `mimosa build` only, `removeCombined` is used to determine whether or not to to remove the assets that have been combined into optimized files.  By default, `removeCombine` is set to `true` (but only during `mimosa build`), which means any assets used to create the optimized files will be cleaned up (removed).  r.js does have its own `removeCombined` setting, but it is suggested to not use that along with a Mimosa application and mimosa-require.  mimosa-require may run r.js multiple times to create multiple outputs, and if the r.js `removeCombined` setting is used, r.js may remove files on a 1st build that 2nd and 3rd r.js build require to work correctly.  mimosa-require's `removeCombined` is only run once after all the r.js executions have completed.

#### `require.optimize.overrides` object/function
Used to make tweaks to the r.js configuration for asset optimization. Add r.js config settings as new properties inside the `require.optimize.overrides` object. To just unset a mimosa-require inferred value, set the property to `null`. `require.optimize.overrides` can also be a function. That function is passed the full inferred r.js config for the module being optimized. This provides the opportunity to amplify the inferred config rather than just replace it.