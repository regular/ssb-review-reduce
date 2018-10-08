# ssb-review-reduce

A view into a reduce function for [ssb-revisions](https://github.com/regular/ssb-revisions).
This is more or less a drop-in replacement for flumeview-reduce for scuttlebutt applications that need mutable documents.

See also: [ssb-review-level](https://github.com/regular/ssb-review-level)

## What's different? (in respect to flumeview-reduce)

- In case a message is a revision of a prior message (e.g. it has revisionRoot and revisionBranch properties), your map function is called twice: once for the old value, once for the new value. (your map function typically does not care whether it is called for the old or new value. However, if it does, this information is provided in the third argument: true for new, false for old).

- These two values are then both provided to your reduce function, along with the flumelog sequence numbers of the messages representing the old and new vlues: 

``` js
reduce(acumulator, new_value, new_seq, old_value, old_seq)
```

(your reduce functon typically does not care about the sequence numbers)

- in streaming mode, tuples (arrays of length two) of `[new_value, old_value]` are emitted, where `old_value==null` for original messages.

## Example

``` js
ssb.revisions.use('view', Reduce(
  1, // version
  function reduce(acc, item, seq, old_item, old_seq) {
    return {
      sum: acc.sum + item - (old_item ? old_item : 0),
      squareSum: acc.squareSum + item*item - (old_item ? old_item * old_item : 0)
    }
  },
  function map(kv, seq, is_new) {
    return kv.value.content.value
  },
  null, { sum: 0, squareSum: 0 } // codec, initial state
))

ssb.publish({type: 'number', value: 10}, function(err) {
  ssb.publish({type: 'number', value: 30}, function(err, msg) {
    ssb.publish({
      type: 'number',
      revisionRoot: msg.key,
      revisionBranch: msg.key,
      value: 20
    }, function(err, msg2) {
      revisions.view.get(function (err, value) {
        t.deepEqual(value, { sum: 30, squareSum: 500 }, 'reduces state')
      })
    })
  })
})
```

Another examples is [here](https://github.com/regular/ssb-revisions/blob/master/indexes/stats.js)

The rest of this Readme is adapted from flumeview-reduce.

## ReviewReduce(version, reduce, map?, codec?, initialState?) => Review

construct a view from this reduce function. `version` should be a number,
and must be provided. If you make a breaking change to either `reduce` or `map`
then increment `version` and the view will be rebuilt.

`map` is optional. If map is applied, then each item in the log is passed to `map`
and then if the returned value is not null, it is passed to reduce.

``` js
var _old_value = old_value && map(old_value, old_seq, false)
var _value = map(value, seq, true)
if(_value != null)
  state = reduce(state, _value, seq, _old_value, old_seq)
```

using a `map` function is useful, because it enables efficiently streaming the realtime
changes in the state to a remote client.

then, pass the view to `ssb.revisions.use(name, view)`
and you'll have access to the view methods on `ssb.revisions[name]`

`codec` (optional) - specify the codec to use in the event your log uses the filesystem.
`initialState` (optional) - declare an initial state for your reducer. This will be ignored if a persisted state is found.

## ssb.revisions[name].get(cb)

get the current state of the reduce. This will wait until the view is up to date, if necessary.

## ssb.revisions[name].stream({live: boolean}) => PullSource

Creates a [pull-stream](https://github.com/pull-stream/pull-stream) whose:
- first value is the current state of the view,
- following values are not the view state, but the _values_ (they're had your `map` applied, but the `reducer` hasn't been applied yet).
- each item starting from the second is an array with two entries: [new_value, old_value]. The old value is supplied when an object was updated with a newer revision (see example above), otherwise the 2nd entry is null.

This is a light-weight for a remote client to keep up to date with the view - get a snapshot, and then update it themselves. This way we don't need to send a massive view every time there's a new log entry.

## Stores

`flumeview-reduce` currently includes several _store_ implementations,
this is how the actual data is persisted. the current implementations are

* 'store/fs' - store in a file.
* 'store/local-storage' - `localStorage`, in a browser
* 'store/remote' - a meta store that keeps a local copy of a remote view.

to set a store, you must set up flumeview-reduce via the lower level dependency injection api.

``` js
var createReduce = require('ssb-review-reduce/inject')

var Reduce = createReduce(Store)

//then use Reduce normally

var view = ssb.revisions.use('view', Reduce(version, reduce, map)) //etc

//since remote is most interesting

var Remote = require('ssb-review-reduce/store/remote')
function get (opts, cb) {
  //call the get method on the remote copy of the view
  view.get(opts, cb)
}
var RemoteReduce = createReduce(Remote(get, Store, codec))

var remoteView = _ssb.review.use('view', Reduce(version, reduce, map)) //etc
//make sure you pass the exact same reduce and map functions to the remote view!
```

## License

MIT

