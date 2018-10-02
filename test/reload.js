var tape = require('tape')
var Reduce = require('../')
var Revisions = require('ssb-revisions')
var u = require('./util')

function sum (a, b) {
  console.log('a', a, 'b', b)
  return (a || 0) + b
}

function toValue(kv) {
  return kv.value.content.value
}

var file = '/tmp/test_ssb-review-reduce/'+Date.now()+'/log.offset'
var db = u.createDB(file)
var revisions = Revisions.init(db)
revisions.use('view', Reduce(1, sum, toValue))

tape('simple', function (t) {
  db.append([1, 2, 3, 4, 5].map(u.toMsg), function (err) {
    t.error(err)
    revisions.view.get(function (err, sum) {
      t.error(err)
      t.deepEqual(sum, 15)
      db.close( function() {t.end()})
    })
  })

})

tape('reload', function (t) {
  db = u.createDB(file)
  revisions = Revisions.init(db)
  revisions.use('view', Reduce(1, sum, toValue))
  revisions.view.get(function (err, sum) {
    t.error(err)
    t.deepEqual(sum, 15)
    t.end()
  })
})

tape('remote', function (t) {
  var view = require('../inject')(
    require('../store/remote')(revisions.view.get, require('../store/fs'))
  )(1, sum, toValue)({filename: file}, 'view2')

  view.since.once(function (seq) {
    t.equal(seq, db.since.value)
    view.get(function (err, v) {
      if(err) throw err
      t.equal(v, 15)
      db.close(function() {t.end()})
    })
  })
})

tape('remote 2', function (t) {
  db = u.createDB(file)
  revisions = Revisions.init(db)
  revisions.use('view', Reduce(1, sum, toValue))
  db.append(u.toMsg(6), function (err) {
    if(err) throw err

    var view = require('../inject')(
      require('../store/remote')(revisions.view.get, require('../store/fs'))
    )(1, sum, toValue)({filename: file}, 'view2')

    view.since.once(function (seq) {
      view.get(function (err, v) {
        if(err) throw err
        t.equal(v, 21)
        db.close(function() {t.end()})
      })
    })
  })
})

//remote, but check that it streams if the load amount is too big
