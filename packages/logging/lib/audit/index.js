const AuditPlugin = {
  register (server, config, next) {
    // Audit Helper
    server.decorate('request', 'audit', function audit (args, additional_tags = []) {
      // Normalize target
      if (args.target && args.target._id) {
        // Target model
        if (!args.target_model) {
          args.target_model = args.target.constructor.modelName
        }

        // We only need to store target._id
        args.target = args.target._id
      }

      // Normalize user
      let user
      if (this.auth.credentials && this.auth.credentials.user) {
        user = this.auth.credentials.user._id
      }

      // Emit log event
      this.log(['audit'].concat(additional_tags), Object.assign({user, ip: this.ip}, args))
    })

    next()
  }
}

AuditPlugin.register.attributes = {
  name: 'bak-audit'
}

module.exports = AuditPlugin
