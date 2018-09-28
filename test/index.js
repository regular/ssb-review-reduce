var Log = require('flumelog-offset')
var Reduce = require('../')
var tape = require('tape')
var Flume = require('flumedb')
var codec = require('flumecodec')
var pull = require('pull-stream')
var Revisions = require('ssb-revisions')
var crypto = require('crypto')
var mkdirp = require('mkdirp')

function rndKey() {
  return '%' +  crypto.randomBytes(32).toString('base64') + '.sha256'
}

var ts = (function(start){
  return function() {return start++}
})(Date.now())

function msg(key, revisionRoot, revisionBranch) {
  var ret = {
    key,
    value: {
      timestamp: ts(),
      content: { }
    }
  }
  if (revisionRoot) ret.value.content.revisionRoot = revisionRoot
  if (revisionBranch) ret.value.content.revisionBranch = revisionBranch
  return ret
}

module.exports = function (createFlume) {
  tape('simple', function (t) {
    var db = createFlume()
    db._flumeUse = function(name, cv) {
      db.use(name, cv)
      return db[name]
    }
    var revisions = Revisions.init(db)
    t.ok(db.revisions, 'db has revisions')

    revisions.use('view', Reduce(
      1,
      function reduce (acc, item, seq) {
        console.log('reduce ITEM', item)
        return {
          sum: acc.sum + item,
          squareSum: acc.squareSum + item*item
        }
      },
      function map (kv) {
        console.log('reduce.MAP', kv)
        return kv.value.content.value
      },
      null, { sum: 0, squareSum: 0 } // codec, initial state
    ))

    function toMsg(v) {
      var ret = msg(rndKey())
      ret.value.content.value = v
      return ret
    }

    var values = [10, 20].map(toMsg)
    
    var asyncDone = false
    var streamDone = false

    pull(
      db.view.stream({ live: true }),
      pull.take(3),
      pull.collect((err, values) => {
        t.deepEqual(values, [
          { sum: 0, squareSum: 0 },
          [10, null],
          [20, null]
        ], 'streams reduction of view')

        streamDone = true
        if (asyncDone && streamDone) t.end()
      })
    )

    db.view.get(function (err, v) {
      if(err) throw err
      t.deepEqual(v, { sum: 0, squareSum: 0 }, 'initial state')

      db.append(values, function (err) {
        db.view.get(function (err, value) {
          if(err) throw err
          t.deepEqual(value, { sum: 30, squareSum: 500 }, 'reduces view')

          db.view.get({meta: true, values: true}, function (err, value) {
            if(err) throw err
            t.deepEqual(value, {seq: value.seq, value: { sum: 30, squareSum: 500 }, version: 1}, 'meta: true, values: true')

            db.view.get({values: false}, function (err, value) {
              if(err) throw err
              t.deepEqual(value, {seq: value.seq, version: 1, size: null}, 'values: false')

              asyncDone = true
              if (asyncDone && streamDone) t.end()
            })
          })
        })
      })
    })
  })
}

if(!module.parent) {
  module.exports(function () { 
    var dir = '/tmp/' + Date.now()
    mkdirp.sync(dir)
    return Flume(
      Log(dir + '/temp.db', {codec: codec.json})
    )
  })
}
