var tape = require('tape')
var pull = require('pull-stream')
var Reduce = require('../')
var Revisions = require('ssb-revisions')
var u = require('./util')

var file = '/tmp/test_ssb-review-reduce/'+Date.now()+'/log.offset'

var output = {}
function log (name) {
  output[name] = []
  return function (value) {
    output[name].push(value)
    console.log(name, value)
  }
}

module.exports = function (createFlume) {
  tape('simple', function (t) {
    var revisions

    function toContent(kv) {
      console.log('MAPPING', kv.value.content)
      return kv.value.content
    }
    
    function create() {
      var db = createFlume()
      revisions = Revisions.init(db)
      revisions.use('view',
        Reduce("1", function (acc, item) {
          return (acc || 0) + 1
        }, toContent, null, 0)
      )
      return db
    }

    var db = create()

    pull(
      revisions.view.stream({live: true}),
      pull.drain(log(1), function () {
      })
    )

    var i = 0
    var int = setInterval(function () {
      db.append(u.toMsg(10*(i++)), function (err) {
        if(i < 4) return
        clearInterval(int)
        console.log('Closing DB .. (1)')
        db.close(function () {
          console.log('DB is closed (1)')
          var _db = create()
          pull(
            revisions.view.stream({live: true}),
            pull.drain(log(2), function () {
            })
          )
          _db.append(u.toMsg('x'), function () {
            console.log('Closing DB .. (2)')
            _db.close(function () {
              console.log('DB is closed (2)')
              t.deepEqual(output, {
                1: [0,  [{value: 0}, null], 
                        [{value: 10}, null], 
                        [{value: 20}, null], 
                        [{value: 30}, null]],
                2: [4, [{value:'x'}, null]]
              })
              t.end()
            })
          })
        })
      })
    },40)
  })
}

if(!module.parent)
  module.exports(function () {
    return u.createDB(file)
  })

