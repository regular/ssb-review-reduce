var crypto = require('crypto')
var Log = require('flumelog-offset')
var Flume = require('flumedb')
var codec = require('flumecodec')
var mkdirp = require('mkdirp')


function rndKey() {
  return '%' +  crypto.randomBytes(32).toString('base64') + '.sha256'
}

var ts = module.exports.ts = (function(start){
  return function() {return start++}
})(Date.now())

function msg(key, revisionRoot, revisionBranch, content) {
  var ret = {
    key,
    value: {
      timestamp: ts(),
      content: content || {}
    }
  }
  if (revisionRoot) ret.value.content.revisionRoot = revisionRoot
  if (revisionBranch) ret.value.content.revisionBranch = revisionBranch
  return ret
}

function toMsg(v) {
  var ret = msg(rndKey())
  ret.value.content.value = v
  return ret
}


function createDB(filename) { 
  if (!filename) {
    var dir = '/tmp/' + Date.now()
    // mkdirp.sync(dir)
    filename = dir + '/temp.db'
  }
  var db = Flume(
    Log(filename, {codec: codec.json})
  )
  db._flumeUse = function(name, cv) {
    db.use(name, cv)
    return db[name]
  }
  return db
}

module.exports.createDB = createDB
module.exports.toMsg = toMsg
module.exports.msg = msg
module.exports.rndKey = rndKey
