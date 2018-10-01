var tape = require('tape')
var Reduce = require('../')
var pull = require('pull-stream')
var Revisions = require('ssb-revisions')
var u = require('./util')

module.exports = function (createFlume) {
  tape('simple', function (t) {
    var db = createFlume()
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

    var values = [10, 20].map(u.toMsg)
    
    var asyncDone = false
    var streamDone = false

    pull(
      revisions.view.stream({ live: true }),
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

    revisions.view.get(function (err, v) {
      if(err) throw err
      t.deepEqual(v, { sum: 0, squareSum: 0 }, 'initial state')

      db.append(values, function (err) {
        revisions.view.get(function (err, value) {
          if(err) throw err
          t.deepEqual(value, { sum: 30, squareSum: 500 }, 'reduces view')

          revisions.view.get({meta: true, values: true}, function (err, value) {
            if(err) throw err
            t.deepEqual(value, {seq: value.seq, value: { sum: 30, squareSum: 500 }, version: 1}, 'meta: true, values: true')

            revisions.view.get({values: false}, function (err, value) {
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
  module.exports(u.createDB)
}
