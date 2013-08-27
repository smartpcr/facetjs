`(typeof window === 'undefined' ? {} : window)['nestedCache'] = (function(module, require){"use strict"; var exports = module.exports`

# -----------------------------------------------------
driverUtil = require('./driverUtil')
{ FacetQuery, FacetFilter, AndFilter, FacetSplit, FacetCombine } = require('./query')

find = (list, fn) ->
  for d in list
    if fn(d)
      return d
  return null

difference = (list1, list2) ->
  newList = []
  for l1 in list1
    newList.push(l1) unless l1 in list2
  return newList

# Get the split and combines grouped together
getSplitCombines = (query) ->
  splitCombines = query.getGroups().map(({split, combine}) -> { split, combine })
  splitCombines.shift()
  return splitCombines

# Get a single set of applies, this assumes that the same applies are executer on each split
getApplies = (query) ->
  return query.getGroups()[0].applies

isPropEqual = (prop1, prop2) ->
  type = typeof prop1
  return false if type isnt typeof prop2
  if type is 'string'
    return prop1 is prop2
  else
    return prop1[0] is prop2[0] and prop1[1] is prop2[1]

# Compares that the split combines are the same ignoring the bucket filters
isSplitCombineEqual = (splitCombine1, splitCombine2, compareSegmentFilter = false) ->
  return splitCombine1.split.isEqual(splitCombine2.split, compareSegmentFilter) and
         splitCombine1.combine.isEqual(splitCombine2.combine)

equalApplyLists = (applyList1, applyList2) ->
  return applyList1.length is applyList2.length and applyList1.every((apply1, i) -> apply1.isEqual(applyList2[i]))

# Computes the diff between sup & sub assumes that sup and sub are either atomic or an AND of atomic filters
filterDiff = (sup, sub) ->
  sup = (if not sup then [] else if sup.type is 'and' then sup.filters else [sup])
  sub = (if not sub then [] else if sub.type is 'and' then sub.filters else [sub])
  throw new Error('sup can not be or have OR types') if sup.some(({type}) -> type is 'or')
  throw new Error('sub can not be or have OR types') if sub.some(({type}) -> type is 'or')

  filterInSub = (filter) ->
    for subFilter in sub
      return true if filter.isEqual(subFilter)
    return false

  diff = []
  numFoundInSub = 0
  for supFilter in sup
    if filterInSub(supFilter)
      numFoundInSub++
    else
      diff.push supFilter

  return if numFoundInSub is sub.length then diff else null

# -----------
andFilterToPath = (splitNames, andFilter) ->
  return [andFilter.value] if andFilter.type is 'is'
  if andFilter.type isnt 'and' or andFilter.filters.some(({type}) -> type isnt 'is')
    throw new TypeError("unsupported AND filter")

  return andFilter.filters.slice()
    .sort((f1, f2) -> splitNames.indexOf(f1.prop) - splitNames.indexOf(f2.prop))
    .map(({value}) -> value)

getCanonicalSplitTreePaths = (query) ->
  splits = query.getSplits()
  splitNames = splits.map((d) -> d.name)
  paths = []

  for split in splits
    segmentFilter = split.segmentFilter
    continue unless segmentFilter
    switch segmentFilter.type
      when 'is', 'and'
        orFilters = [segmentFilter]
      when 'or'
        orFilters = segmentFilter.filters
      when 'false'
        orFilters = []
      else
        throw new TypeError("unsupported OR filter")

    for filter in orFilters
      paths.push(andFilterToPath(splitNames, filter))

  return paths

rangeSep = ' }woop_woop{ '
condenseRange = (v) ->
  return if Array.isArray(v) then v.join(rangeSep) else v

expandRange = (v) ->
  return if v.indexOf(rangeSep) isnt -1 then v.split(rangeSep) else v

getPathDiff = (oldQuery, newQuery) ->
  sep = ' >#>#> ' # Sort of hacky as it assumes that 'sep' is never in the data
  oldTreePaths = getCanonicalSplitTreePaths(oldQuery).map((path) -> path.map(condenseRange).join(sep))
  newTreePaths = getCanonicalSplitTreePaths(newQuery).map((path) -> path.map(condenseRange).join(sep))
  return {
    added:   difference(newTreePaths, oldTreePaths).map((path) -> path.split(sep).map(expandRange))
    removed: difference(oldTreePaths, newTreePaths).map((path) -> path.split(sep).map(expandRange))
  }

findInData = (data, path, splitCombines) ->
  for part, i in path
    splitName = splitCombines[i].split.name
    return unless data.splits
    found = find(data.splits, (split) -> isPropEqual(split.prop?[splitName], part))
    return unless found
    data = found
  return data

driverLog = (str) ->
  #console.log "SUPER DRIVER: #{str}"
  return


module.exports = ({transport, onData}) ->
  queryChain = []
  running = false
  myQuery = null
  myData = null

  myOnData = (data, state) ->
    onData(data, state)
    if state is 'final'
      running = false
      makeStep()
    return

  # Makes the query and saves the query and the result as the last results
  makeFullQuery = (newQuery, keep) ->
    myOnData(null, 'intermediate') unless keep
    transport {query: newQuery}, (err, newData) ->
      if err
        myOnData(null, 'final')
        return

      myQuery = newQuery
      myData = newData
      driverUtil.parentify(myData)
      myOnData(myData, 'final')
      return

  makeStep = ->
    return if running or queryChain.length is 0
    running = true
    newQuery = queryChain.shift()

    if not myQuery
      driverLog 'I am empty, give up'
      makeFullQuery(newQuery)
      return

    # Make sure the apples match
    myApplies = getApplies(myQuery)
    newApplies = getApplies(newQuery)
    if not equalApplyLists(newApplies, myApplies)
      driverLog 'applies do not match, give up'
      makeFullQuery(newQuery)
      return

    myFilter = myQuery.getFilter()
    newFilter = newQuery.getFilter()
    diff = filterDiff(newFilter, myFilter)
    if not diff
      driverLog 'new filters are not a superset, give up'
      makeFullQuery(newQuery)
      return

    # Check splits
    mySplitCombines = getSplitCombines(myQuery)
    newSplitCombines = getSplitCombines(newQuery)

    # Some splits were removed from the beginning and added as filters.
    if diff.length and mySplitCombines.length > newSplitCombines.length
      # Assume that the new split combines represent the tail of the old splits
      splitCombineOffset = mySplitCombines.length - newSplitCombines.length

      # Check that the splits align up
      if not newSplitCombines.every((newSplitCombine, i) -> isSplitCombineEqual(newSplitCombine, mySplitCombines[i + splitCombineOffset]))
        myOnData(null, 'intermediate')
        driverLog 'splits are different, give up'
        makeFullQuery(newQuery)
        return

      splitIdx = 0
      myDataRef = myData
      while splitIdx < splitCombineOffset
        mySplit = mySplitCombines[splitIdx].split
        splitFilter = find(diff, (d) -> d.type is 'is' and d.attribute is mySplit.attribute)
        if not splitFilter
          driverLog 'filter change does not make sense, give up'
          makeFullQuery(newQuery)
          return

        # ToDo: revisit 'is' with time filters
        myDataRef = find(myDataRef.splits, (split) -> split.prop[mySplit.name] is splitFilter.value)
        if not myDataRef
          driverLog 'filter change does not work out, give up'
          makeFullQuery(newQuery)
          return

        splitIdx++

      myQuery = newQuery
      myData = myDataRef
      myData.parent = null
      driverLog 'win, subtree filter :-)'
      myOnData(myData, 'final')

    else if diff.length is 0 and mySplitCombines.length < newSplitCombines.length
      # Check that the split-combines align up
      i = 0
      while i < mySplitCombines.length
        mySplitCombine = mySplitCombines[i]
        newSplitCombine = newSplitCombines[i]
        if not isSplitCombineEqual(mySplitCombine, newSplitCombine, true)
          driverLog 'initial splits are different, give up'
          makeFullQuery(newQuery)
          return
        i++

      while i < newSplitCombines.length
        splitBucketFilter = newSplitCombines[i].split.segmentFilter
        if splitBucketFilter?.type isnt 'false'
          driverLog 'final split(s) not empty, give up (but keep the current data)'
          makeFullQuery(newQuery, true)
          return
        i++

      myQuery = newQuery
      driverLog 'win, added empty split :-)'
      myOnData(myData, 'final')

    else if mySplitCombines.length is newSplitCombines.length and diff.length is 0
      # Check that the split-combines align up
      if not mySplitCombines.every((mySplitCombine, i) -> isSplitCombineEqual(mySplitCombine, newSplitCombines[i]))
        myOnData(null, 'intermediate')
        driverLog 'initial splits are different, give up'
        makeFullQuery(newQuery)
        return

      { added, removed } = getPathDiff(myQuery, newQuery)
      #console.log 'added', added
      #console.log 'removed', removed

      for removePath in removed
        collapseBucket = findInData(myData, removePath, newSplitCombines)
        delete collapseBucket.splits if collapseBucket

      myQuery = newQuery

      if added.length
        throw new Error("must be 1 for now") if added.length isnt 1
        addedPath = added[0]

        attachSplit = findInData(myData, addedPath, newSplitCombines)
        throw new Error("Something went wrong") unless attachSplit

        newQueryValue = newQuery.valueOf()
        splitName = newSplitCombines[addedPath.length].split.name
        splitSpec = find(newQueryValue, ({name}) -> name is splitName)
        newQueryTail = newQueryValue.slice(newQueryValue.indexOf(splitSpec))
        delete newQueryTail[0].segmentFilter

        newFilterSpec = new AndFilter([newFilter].concat(
          addedPath.map((addedPart, i) -> newSplitCombines[i].split.getFilterFor(addedPart))
        )).valueOf()
        newFilterSpec.operation = 'filter'
        addQuery = [
          newFilterSpec
        ].concat(newQueryTail)

        attachSplit.loading = true
        myOnData(myData, 'intermediate')

        transport {query: new FacetQuery(addQuery)}, (err, partialData) ->
          delete attachSplit.loading

          if err
            myOnData(myData, 'final')
            driverLog 'failed to load query'
            return

          attachSplit.splits = partialData.splits
          driverUtil.parentify(myData)
          myOnData(myData, 'final')
          driverLog 'Finally a win (with addition)'
          return
      else
        myOnData(myData, 'final')
        driverLog 'Finally a win'

    else
      driverLog 'the query is too different, give up'
      makeFullQuery(newQuery)
      return

    return

  return ({query}) ->
    throw new Error("must have query") unless query
    queryChain.push(query)
    makeStep()
    return


# -----------------------------------------------------
# Handle commonJS crap
`return module.exports; }).call(this,
  (typeof module === 'undefined' ? {exports: {}} : module),
  (typeof require === 'undefined' ? function (modulePath, altPath) {
    if (altPath) return window[altPath];
    var moduleParts = modulePath.split('/');
    return window[moduleParts[moduleParts.length - 1]];
  } : require)
)`