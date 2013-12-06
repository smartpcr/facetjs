`(typeof window === 'undefined' ? {} : window)['hadoopDriver'] = (function(module, require){"use strict"; var exports = module.exports`

async = require('async')
{Duration} = require('./chronology')
driverUtil = require('./driverUtil')
{FacetFilter, TrueFilter, FacetSplit, FacetApply, FacetCombine, FacetQuery, AndFilter} = require('./query')

# -----------------------------------------------------

arithmeticToHadoopOp = {
  add:      '+'
  subtract: '-'
  multiply: '*'
  divide:   '/'
}

class HadoopQueryBuilder
  constructor: ({@timeAttribute, @datasetToPath}) ->
    throw new Error("must have datasetToPath mapping") unless typeof @datasetToPath is 'object'

  filterToHadoopHelper: (filter) ->
    return switch filter.type
      when 'true', 'false' then filter.type

      when 'is'
        throw new Error("can not filter on specific time") if filter.attribute is @timeAttribute
        "datum['#{filter.attribute}'] === '#{filter.value}'"

      when 'in'
        throw new Error("can not filter on specific time") if filter.attribute is @timeAttribute
        filter.values.map((value) -> "datum['#{filter.attribute}'] === '#{value}'").join('||')

      when 'contains'
        throw new Error("can not filter on specific time") if filter.attribute is @timeAttribute
        "String(datum['#{filter.attribute}']).indexOf('#{filter.value}') !== -1"

      when 'within'
        [r0, r1] = filter.range
        if typeof r0 is 'number' and typeof r1 is 'number'
          "#{r0} <= Number(datum['#{filter.attribute}']) && Number(datum['#{filter.attribute}']) < #{r1}"
        else
          throw new Error("apply within has to have a numeric range")

      when 'not'
        "!(#{@filterToHadoopHelper(filter.filter, context)})"

      when 'and'
        filter.filters.map(((filter) -> "(#{@filterToHadoopHelper(filter)})"), this).join('&&')

      when 'or'
        filter.filters.map(((filter) -> "(#{@filterToHadoopHelper(filter)})"), this).join('||')

      else
        throw new Error("unknown JS filter type '#{filter.type}'")


  timeFilterToHadoop: (filter) ->
    return ["1000-01-01/3000-01-01"] if filter.type is 'true'
    ors = if filter.type is 'or' then filter.filters else [filter]
    timeAttribute = @timeAttribute
    return ors.map ({type, attribute, range}) ->
      throw new Error("can only time filter with a 'within' filter") unless type is 'within'
      throw new Error("attribute has to be a time attribute") unless attribute is timeAttribute
      return driverUtil.datesToInterval(range[0], range[1])


  timelessFilterToHadoop: (filter) ->
    return "function(datum) { return #{@filterToHadoopHelper(filter)}; }"


  addFilters: (filtersByDataset) ->
    @datasets = []
    for datasetName, filter of filtersByDataset
      extract = filter.extractFilterByAttribute(@timeAttribute)
      throw new Error("could not separate time filter") unless extract
      [timelessFilter, timeFilter] = extract

      @datasets.push({
        name: datasetName
        path: @datasetToPath[datasetName]
        intervals: @timeFilterToHadoop(timeFilter)
        filter: @timelessFilterToHadoop(timelessFilter)
      })

    return this


  splitToHadoop: (split, name) ->
    switch split.bucket
      when 'identity'
        return "t.datum['#{split.attribute}']"

      when 'continuous'
        expr = "Number(t.datum['#{split.attribute}'])"
        expr = "(#{expr} + #{split.offset})" if split.offset isnt 0
        expr = "#{expr} / #{split.size}" if split.size isnt 1
        expr = "Math.floor(#{expr})"
        expr = "#{expr} * #{split.size}" if split.size isnt 1
        expr = "#{expr} - #{split.offset}" if split.offset isnt 0
        return expr

      when 'timePeriod'
        throw new Error("not implemented yet")

      when 'tuple'
        return "[(" + split.splits.map(@splitToHadoop, this).join('), (') + ")].join('#$#')"

      else
        throw new Error("bucket '#{split.bucket}' unsupported by driver")


  addSplit: (split) ->
    throw new TypeError("split must be a FacetSplit") unless split instanceof FacetSplit
    split = if split.bucket is 'parallel' then split.splits[0] else split

    @split = {
      name: split.name
      fn: "function(t) { return #{@splitToHadoop(split)}; }"
    }
    return this


  addApplies: (applies) ->
    hadoopProcessorScheme = {
      constant: ({value}) -> "#{value}"
      getter: ({name}) -> "prop['#{name}']"
      arithmetic: (arithmetic, lhs, rhs) ->
        hadoopOp = arithmeticToHadoopOp[arithmetic]
        throw new Error('unknown arithmetic') unless hadoopOp
        return "(#{lhs} #{hadoopOp} #{rhs})"
      finish: (name, getter) -> "prop['#{name}'] = #{getter}"
    }

    jsParts = {
      'count': { zero: '0', update: '$++' }
      'sum': { zero: '0', update: '$ += Number(x)' }
      'min': { zero: 'Infinity', update: '$ = Math.min($, x)' }
      'max': { zero: '-Infinity', update: '$ = Math.max($, x)' }
    }

    if applies.length is 0
      @applies = "function() { return {}; }"
      return

    {
      appliesByDataset
      postProcessors
    } = FacetApply.segregate(applies, null, hadoopProcessorScheme)

    arithmeticToExpresion = (apply) ->
      return "prop['#{apply.name}']" if apply.aggregate
      hadoopOp = arithmeticToHadoopOp[apply.arithmetic]
      throw new Error('unknown arithmetic') unless hadoopOp
      [op1, op2] = apply.operands
      return "(#{arithmeticToExpresion(op1)} #{hadoopOp} #{arithmeticToExpresion(op2)})"

    preLines = []
    initLines = []
    loopLines = []
    afterLines = []
    returnLines = []
    for datasetName, applies of appliesByDataset
      {
        aggregates
        arithmetics
      } = FacetApply.breaker(applies, true)

      loopLines.push("if(dataset === '#{datasetName}') {")

      for apply in aggregates
        if apply.aggregate is 'constant'
          initLines.push("'#{apply.name}': #{apply.value}")
        else if apply.aggregate is 'uniqueCount'
          preLines.push("seen['#{apply.name}'] = {}")
          initLines.push("'#{apply.name}': 0")
          loopLines.push("  x = datum['#{apply.attribute}']")
          loopLines.push("  if(!seen['#{apply.name}'][x]) prop['#{apply.name}'] += (seen['#{apply.name}'][x] = 1)")
        else
          jsPart = jsParts[apply.aggregate]
          throw new Error("unsupported aggregate '#{apply.aggregate}'") unless jsPart
          initLines.push("'#{apply.name}': #{jsPart.zero}")
          loopLines.push("  x = datum['#{apply.attribute}']") if apply.attribute
          loopLines.push('  ' + jsPart.update.replace(/\$/g, "prop['#{apply.name}']"))

      loopLines.push("}")

      for apply in arithmetics
        afterLines.push("prop['#{apply.name}'] = #{arithmeticToExpresion(apply)}")

      afterLines = afterLines.concat(postProcessors)

    @applies = """
      function(iter) {
        var t, x, datum, dataset, seen = {};
        #{preLines.join(';\n  ')}
        var prop = {
          #{initLines.join(',\n    ')}
        }
        while(iter.hasNext()) {
          t = iter.next();
          datum = t.datum; dataset = t.dataset;
          #{loopLines.join(';\n    ')}
        }
        #{afterLines.join(';\n  ')}
        return prop;
      }
      """

    return this

  addCombine: (combine) ->
    throw new TypeError("combine must be a FacetCombine") unless combine instanceof FacetCombine

    switch combine.method
      when 'slice'
        sortProp = combine.sort.prop
        cmp = "a['#{sortProp}'] < b['#{sortProp}'] ? -1 : a['#{sortProp}'] > b['#{sortProp}'] ? 1 : a['#{sortProp}'] >= b['#{sortProp}'] ? 0 : NaN"
        args = if combine.sort.direction is 'ascending' then 'a, b' else 'b, a'
        @combine = {
          comparator: "function(#{args}) { return #{cmp}; }"
        }
        @combine.limit = combine.limit if combine.limit?

      else
        throw new Error("method '#{combine.method}' unsupported by driver")

    return this

  getQuery: ->
    hadoopQuery = {}
    hadoopQuery.datasets = @datasets
    hadoopQuery.split = @split if @split
    hadoopQuery.applies = @applies
    hadoopQuery.combine = @combine if @combine
    return hadoopQuery


condensedCommandToHadoop = ({requester, queryBuilder, parentSegment, condensedCommand}, callback) ->
  filtersByDataset = parentSegment._filtersByDataset

  split = condensedCommand.getSplit()
  combine = condensedCommand.getCombine()

  try
    queryBuilder.addFilters(filtersByDataset)
    queryBuilder.addSplit(split) if split
    queryBuilder.addApplies(condensedCommand.applies)
    queryBuilder.addCombine(combine) if combine
  catch e
    callback(e)
    return

  queryToRun = queryBuilder.getQuery()
  if not queryToRun
    callback(null, [{ prop: {}, _filtersByDataset: filtersByDataset }])
    return

  requester {query: queryToRun}, (err, ds) ->
    if err
      callback(err)
      return

    if split
      splitAttribute = split.attribute
      splitProp = split.name

      if split.bucket is 'continuous'
        splitSize = split.size
        for d in ds
          start = d[splitProp]
          d[splitProp] = [start, start + splitSize]
      else if split.bucket is 'timePeriod'
        timezone = split.timezone or 'Etc/UTC'
        splitDuration = new Duration(split.period)
        for d in ds
          rangeStart = new Date(d[splitProp])
          range = [rangeStart, splitDuration.move(rangeStart, timezone, 1)]
          d[splitProp] = range

      splits = ds.map (prop) -> {
        prop
        _filtersByDataset: FacetFilter.andFiltersByDataset(
          filtersByDataset
          split.getFilterByDatasetFor(prop)
        )
      }
    else
      if ds.length is 1
        splits = {
          prop: ds[0]
          _filtersByDataset: filtersByDataset
        }
      else
        callback(null, null)
        return

    callback(null, splits)
    return
  return


module.exports = ({requester, timeAttribute, path, filter}) ->
  throw new Error("must have a requester") unless typeof requester is 'function'
  throw new Error("must have path") unless typeof path is 'string'
  timeAttribute or= 'time'
  filter ?= new TrueFilter()
  throw new TypeError("filter should be a FacetFilter") unless filter instanceof FacetFilter

  return (request, callback) ->
    try
      throw new Error("request not supplied") unless request
      {context, query} = request
      throw new Error("query not supplied") unless query
      throw new TypeError("query must be a FacetQuery") unless query instanceof FacetQuery
    catch e
      callback(e)
      return

    commonFilter = new AndFilter([filter, query.getFilter()]).simplify()
    datasetToPath = {}
    filtersByDataset = {}
    for dataset in query.getDatasets()
      datasetToPath[dataset.name] = path or dataset.source
      filtersByDataset[dataset.name] = new AndFilter([commonFilter, dataset.getFilter()]).simplify()

    init = true
    rootSegment = {
      parent: null
      _filtersByDataset: filtersByDataset
    }
    segments = [rootSegment]

    condensedGroups = query.getCondensedCommands()

    querySQL = (condensedCommand, callback) ->
      # do the query in parallel
      QUERY_LIMIT = 10

      if condensedCommand.split?.segmentFilter
        segmentFilterFn = condensedCommand.split.segmentFilter.getFilterFn()
        driverUtil.inPlaceFilter(segments, segmentFilterFn)

      queryFns = async.mapLimit(
        segments
        QUERY_LIMIT
        (parentSegment, callback) ->
          condensedCommandToHadoop({
            requester
            queryBuilder: new HadoopQueryBuilder({timeAttribute, datasetToPath})
            parentSegment
            condensedCommand
          }, (err, splits) ->
            if err
              callback(err)
              return

            if splits is null
              callback(null, null)
              return

            # Make the results into segments and build the tree
            parentSegment.splits = splits

            for split in splits
              split.parent = parentSegment

            callback(null, splits)
            return
          )
        (err, results) ->
          if err
            callback(err)
            return

          if results.some((result) -> result is null)
            rootSegment = null
          else
            segments = driverUtil.flatten(results)
            if init
              rootSegment = segments[0]
              init = false

          callback()
          return
      )
      return

    cmdIndex = 0
    async.whilst(
      -> cmdIndex < condensedGroups.length and rootSegment
      (callback) ->
        condencedGroup = condensedGroups[cmdIndex]
        cmdIndex++
        querySQL(condencedGroup, callback)
        return
      (err) ->
        if err
          callback(err)
          return

        callback(null, driverUtil.cleanSegments(rootSegment or {}))
        return
    )


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
