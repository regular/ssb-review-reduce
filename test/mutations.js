var tape = require('tape')
var Reduce = require('../')
var pull = require('pull-stream')
var Revisions = require('ssb-revisions')
var u = require('./util')

module.exports = function (createFlume) {
  tape('simple', function (t) {
    var db = createFlume()
    var revisions = Revisions.init(db)

    revisions.use('view', Reduce(
      1,
      function reduce (acc, item, seq, old_item) {
        console.log('reduce ITEM', item)
        return {
          sum: acc.sum + item - (old_item ? old_item : 0),
          squareSum: acc.squareSum + item*item - (old_item ? old_item * old_item : 0)
        }
      },
      function map (kv) {
        console.log('reduce.MAP', kv)
        return kv.value.content.value
      },
      null, { sum: 0, squareSum: 0 } // codec, initial state
    ))

    var keyA = u.rndKey()
    var keyB = u.rndKey()
    var keyB1 = u.rndKey()
    var values = [
      u.msg(keyA, undefined, undefined, { value: 10}),
      u.msg(keyB, undefined, undefined, { value: 30}),
      u.msg(keyB1, keyB, [keyB], { value: 20})
    ]
    
    var asyncDone = false
    var streamDone = false

    pull(
      revisions.view.stream({ live: true }),
      pull.take(4),
      pull.collect((err, values) => {
        t.deepEqual(values, [
          { sum: 0, squareSum: 0 },
          [10, null],
          [30, null],
          [20, 30]
        ], 'streams reduction of view')

        streamDone = true
        if (asyncDone) t.end()
      })
    )

    revisions.view.get(function (err, v) {
      if(err) throw err
      t.deepEqual(v, { sum: 0, squareSum: 0 }, 'initial state')

      // NOTE: if we append all values at once,
      // the intermediate state B (30) will most likely be
      // folded and not appear in the stream.
      pull(
        pull.values(values),
        pull.asyncMap( db.append ),
        pull.asyncMap( function(x, cb) {
          setTimeout(function() {cb(null)}, 100)
        }),
        pull.onEnd(function() {
          revisions.view.get(function (err, value) {
            if(err) throw err
            t.deepEqual(value, { sum: 30, squareSum: 500 }, 'reduces view')

            revisions.view.get({meta: true, values: true}, function (err, value) {
              if(err) throw err
              t.deepEqual(value, {seq: value.seq, value: { sum: 30, squareSum: 500 }, version: 1}, 'meta: true, values: true')
              asyncDone = true
              if (streamDone) t.end()
            })
          })
        })
      )
    })
  })
}

if(!module.parent) {
  module.exports(u.createDB)
}
