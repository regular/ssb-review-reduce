var path = require('path')
var AtomicFile = require('atomic-file')
var debug = require('debug')('ssb-review-reduce')

function id (e) { return e }

var none = {
  encode: id, decode: id
}

module.exports = function (dir, name, codec) {
  codec = codec || require('flumecodec/json')
  var af = AtomicFile(path.join(dir, 'revisions_'+name+'.json'), '~', none)
  var self
  return self = {
    size: null,
    get: function (cb) {
      af.get(function (err, value) {
        if(err) return cb(err)
        if(value == null) return cb()
        try {
          self.size = value.length
          value = codec.decode(value)
          value.size = self.size
          debug('JSON read: %o %s/%s', value, dir, name)
        } catch(err) {
          return cb(err)
        }
        cb(null, value)
      })
    },
    set: function (value, cb) {
      value = codec.encode(value)
      self.size = value.length
      debug('writing: %o %s/%s', value, dir, name)
      af.set(value, cb)
    },
    destroy: function (cb) {
      value = null
      self.size = 0
      af.destroy(cb)
    }
  }
}








