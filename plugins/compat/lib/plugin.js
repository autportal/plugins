function warn (type, message, at) {
  console.warn('[warn]', `[${type}]`, message, at)
}

function isPlugin (obj) {
  return obj && Boolean(obj.pkg || typeof obj.register === 'function')
}

function getFnParamNames (fn) {
  const match = fn.toString().match(/\(.*?\)/)
  return match ? match[0].replace(/[()]/gi, '').replace(/\s/gi, '').split(',') : []
}

function wrapPlugin (originalPlugin) {
  const plugin = Object.assign({}, originalPlugin)

  // Support for attributes
  if (plugin.register.attributes && !plugin.pkg) {
    plugin.pkg = plugin.register.attributes.pkg || plugin.register.attributes
    delete plugin.register.attributes
  }

  // Wrap register function
  const originalRegister = originalPlugin.register
  const hasNext = getFnParamNames(originalRegister).length > 2
  const name = plugin.name || (plugin.pkg && plugin.pkg.name) || plugin.register.name

  if (hasNext) {
    console.log(getFnParamNames(originalRegister))
    warn('AsyncPlugins', 'Plugins should return a promise instead of next callback', name)
  }

  plugin.register = function (server, options) {
    return new Promise((resolve, reject) => {
      // Recursively add compat support as each plugin has it's own server realm
      install(server, false)

      const result = originalRegister.call(this, server, options, err => {
        if (err) {
          return reject(err)
        }
        resolve()
      })

      if (!hasNext) {
        return resolve(result)
      }
    })
  }

  return plugin
}

function wrapServerRegister (originalServerRegister) {
  const serverRegister = function (registration, options) {
    if (Array.isArray(registration)) {
      return Promise.all(registration.map(r => serverRegister.call(this, r, options)))
    }

    // Clone to avoid mutating keys of original registration
    registration = Object.assign({}, registration)

    // Support for old { register } syntax
    if (isPlugin(registration.register)) {
      registration.plugin = registration.register
      delete registration.register
    }

    // Wrap plugin
    if (isPlugin(registration)) {
      registration = wrapPlugin(registration)
    } else {
      registration.plugin = wrapPlugin(registration.plugin)
    }

    // Call to original register
    return originalServerRegister.call(this, registration, options)
  }
  return serverRegister
}

function supportRegistrations (server) {
  server.register = wrapServerRegister(server.register)
}

function supportEvents (server) {
  server.decorate('server', 'on', function (event, listener) {
    // https://github.com/hapijs/hapi/issues/3571
    if (event === 'tail') {
      return
    }
    server.events.on(event, listener)
  })
}

function install (server, isRoot) {
  if (isRoot) {
    supportEvents(server)
  }

  supportRegistrations(server)
}

exports.register = function bakCompat (server, config) {
  const rootServer = config._bak.server.hapi
  install(rootServer, true)
}

exports.pkg = require('../package.json')
