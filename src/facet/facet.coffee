getScaleAndSegmentsForTraining = (training, segment, scaleName) ->
  sourceSegment = segment
  hops = 0
  while true
    scale = sourceSegment.scale[scaleName]
    break if scale
    sourceSegment = sourceSegment.parent
    hops++
    throw new Error("can not find scale '#{scaleName}'") unless sourceSegment

  return null unless scale.hasOwnProperty(training)

  # Get all of sources children on my level (my cousins)
  unifiedSegments = [sourceSegment]
  while hops > 0
    unifiedSegments = flatten(unifiedSegments.map((s) -> s.splits))
    hops--

  return {
    scale
    unifiedSegments
  }


getConnectorAndSegemnts = (segment, connectorName) ->
  sourceSegment = segment
  hops = 0
  while true
    connector = sourceSegment.connector[connectorName]
    break if connector
    sourceSegment = sourceSegment.parent
    hops++
    throw new Error("can not find connector '#{connectorName}'") unless sourceSegment

  # Get all of sources children on my level (my cousins)
  unifiedSegments = [sourceSegment]
  while hops > 0
    unifiedSegments = flatten(unifiedSegments.map((s) -> s.splits))
    hops--

  return {
    connector
    unifiedSegments
  }


class FacetJob
  constructor: (@selector, @width, @height, @driver) ->
    @ops = []
    @knownProps = {}
    @hasTransformed = false

  _ensureCommandOrder: (self, follow, allow = []) ->
    i = @ops.length - 1
    while i >= 0
      op = @ops[i]
      return if op.operation in follow
      if op.operation not in allow
        throw new Error("#{self} can not follow #{op.operation} (has to follow #{follow.join(', ')})")
      i--
    if null not in follow
      throw new Error("#{self} can not be an initial command (has to follow #{follow.join(', ')})")
    return

  filter: (filter) ->
    @_ensureCommandOrder('filter'
      [null]
      ['transform']
    )
    filter = _.clone(filter)
    filter.operation = 'filter'
    @ops.push(filter)
    return this

  split: (name, split) ->
    @_ensureCommandOrder('split'
      [null, 'filter', 'split', 'apply', 'combine']
      ['layout', 'scale', 'domain', 'range', 'transform', 'untransform', 'plot', 'connector', 'connect']
    )
    split = _.clone(split)
    split.operation = 'split'
    split.name = name
    @ops.push(split)
    @hasTransformed = false
    @knownProps[name] = true
    return this

  apply: (name, apply) ->
    @_ensureCommandOrder('apply'
      [null, 'split', 'apply']
    )
    apply = _.clone(apply)
    apply.operation = 'apply'
    apply.name = name
    @ops.push(apply)
    @knownProps[name] = true
    return this

  combine: ({method, sort, limit}) ->
    @_ensureCommandOrder('combine'
      ['split', 'apply']
    )
    combineCmd = {
      operation: 'combine'
      method
    }
    if sort
      if not @knownProps[sort.prop]
        throw new Error("can not sort on unknown prop '#{sort.prop}'")
      combineCmd.sort = sort
      combineCmd.sort.compare ?= 'natural'

    if limit?
      combineCmd.limit = limit

    @ops.push(combineCmd)
    return this

  layout: (layout) ->
    @_ensureCommandOrder('layout'
      ['split', 'apply', 'combine']
      ['domain']
    )
    throw new TypeError("layout must be a function") unless typeof layout is 'function'
    @ops.push({
      operation: 'layout'
      layout
    })
    return this

  scale: (name, scale) ->
    throw new TypeError("not a valid scale") unless typeof scale is 'function'
    @ops.push({
      operation: 'scale'
      name
      scale
    })
    return this

  domain: (name, domain) ->
    @ops.push({
      operation: 'domain'
      name
      domain
    })
    return this

  range: (name, range) ->
    @ops.push({
      operation: 'range'
      name
      range
    })
    return this

  transform: (transform) ->
    throw new TypeError("transform must be a function") unless typeof transform is 'function'
    @ops.push({
      operation: 'transform'
      transform
    })
    @hasTransformed = true
    return this

  untransform: ->
    @ops.push({
      operation: 'untransform'
    })
    return this

  plot: (plot) ->
    throw new TypeError("plot must be a function") unless typeof plot is 'function'
    @ops.push({
      operation: 'plot'
      plot
    })
    return this

  connector: (name, connector) ->
    throw new TypeError("not a valid connector") unless typeof connector is 'function'
    @ops.push({
      operation: 'connector'
      name
      connector
    })
    return this

  connect: (name) ->
    @ops.push({
      operation: 'connect'
      name
    })
    return this

  getQuery: ->
    querySpec = @ops.filter(({operation}) -> operation in ['filter', 'split', 'apply', 'combine'])
    return new FacetQuery(querySpec)

  render: (debug, done) ->
    if arguments.length is 1 and typeof debug is 'function'
      done = debug
      debug = false

    parent = d3.select(@selector)
    width = @width
    height = @height
    throw new Error("could not find the provided selector") if parent.empty()

    svg = parent.append('svg').attr {
      class: 'facet loading'
      width
      height
    }

    operations = @ops

    @driver { query: @getQuery() }, (err, res) ->
      svg.classed('loading', false)
      if err
        svg.classed('error', true)
        errorMerrage = "An error has occurred: " + if typeof err is 'string' then err else err.message
        if typeof alert is 'function' then alert(errorMerrage) else console.log(errorMerrage)
        return

      segmentGroups = [[rootSegment = new Segment({
        parent: null
        stage: {
          node: svg
          type: 'rectangle'
          width
          height
        }
        prop: res.prop
        splits: res.splits
      })]]

      for cmd in operations
        switch cmd.operation
          when 'split'
            segmentGroups = flatten(segmentGroups).map((segment) ->
              return segment.splits = segment.splits.map ({ prop, splits }) ->
                stage = _.clone(segment.getStage())
                stage.node = stage.node.append('g')
                for key, value of prop
                  if Array.isArray(value)
                    prop[key] = Interval.fromArray(value)
                return new Segment({
                  parent: segment
                  stage: stage
                  prop
                  splits
                })
            )

          when 'filter', 'apply', 'combine'
            null # Do nothing, there is nothing to do on the renderer for those :-)

          when 'scale'
            { name, scale } = cmd
            for segmentGroup in segmentGroups
              for segment in segmentGroup
                myScale = scale()
                throw new TypeError("not a valid scale") unless typeof myScale.domain is 'function'
                segment.scale[name] = myScale

          when 'domain'
            { name, domain } = cmd
            for segmentGroup in segmentGroups
              for segment in segmentGroup
                ret = getScaleAndSegmentsForTraining('domain', segment, name)
                continue unless ret
                { scale, unifiedSegments } = ret
                throw new Error("Scale '#{name}' domain can't be trained") unless scale.domain
                scale.domain(unifiedSegments, domain)

          when 'range'
            { name, range } = cmd
            for segmentGroup in segmentGroups
              for segment in segmentGroup
                ret = getScaleAndSegmentsForTraining('range', segment, name)
                continue unless ret
                { scale, unifiedSegments } = ret
                throw new Error("Scale '#{name}' range can't be trained") unless scale.range
                scale.range(unifiedSegments, range)

          when 'layout'
            { layout } = cmd
            for segmentGroup in segmentGroups
              parentSegment = segmentGroup[0].parent
              throw new Error("must split before calling layout") unless parentSegment
              pseudoStages = layout(parentSegment, segmentGroup)
              for segment, i in segmentGroup
                pseudoStage = pseudoStages[i]
                pseudoStage.stage.node = segment.getStage().node
                  .attr('transform', "translate(#{pseudoStage.x},#{pseudoStage.y})")
                segment.setStage(pseudoStage.stage)

          when 'transform'
            { transform } = cmd
            for segmentGroup in segmentGroups
              for segment in segmentGroup
                pseudoStage = transform(segment)
                transformStr = "translate(#{pseudoStage.x},#{pseudoStage.y})"
                transformStr += " rotate(#{pseudoStage.a})" if pseudoStage.a
                pseudoStage.stage.node = segment.getStage().node.append('g').attr('transform', transformStr)
                segment.pushStage(pseudoStage.stage)


          when 'untransform'
            for segmentGroup in segmentGroups
              for segment in segmentGroup
                segment.popStage()

          when 'plot'
            { plot } = cmd
            for segmentGroup in segmentGroups
              for segment in segmentGroup
                plot(segment)

          when 'connector'
            { name, connector } = cmd
            for segmentGroup in segmentGroups
              for segment in segmentGroup
                segment.connector[name] = connector(segment)

          when 'connect'
            { name } = cmd
            for segmentGroup in segmentGroups
              for segment in segmentGroup
                ret = getConnectorAndSegemnts(segment, name)
                continue unless ret
                { connector, unifiedSegments } = ret
                throw new Error("Connector '#{name}' can't be connected") unless connector
                connector(unifiedSegments)

          else
            throw new Error("Unknown operation '#{cmd.operation}'")

      if typeof done is 'function'
        done.call(rootSegment, rootSegment)

      if debug
        for segmentGroup in segmentGroups
          for segment in segmentGroup
            segment.exposeStage()

      return

    return this


facet.define = (selector, width, height, driver) ->
  throw new Error("bad size: #{width} x #{height}") unless width and height
  return new FacetJob(selector, width, height, driver)


# Country     City             Football Team   Rev
#                                              10000
# - UK                                          3000
#             - London                           300
#                              + Arsenal          30
#                              + Chelsea          20
#             + Manchester                       200
# - Russia                                      2000
#             + Moscow                           300
#             + St. Petersburg                   250
# + Israel                                      1200
# + US and A                                    1000

facet.table = ({parent, query, data, pre, onClick, onHover}) ->
  pre or= true

  flattenHelper = (root, result, parentSegment) ->
    root.parent = parentSegment
    if pre
      result.push(root)

    splits = root.splits or []
    for split in splits
      flattenHelper(split, result, root)

    if not pre
      result.push(root)

    return

  res = []
  flattenHelper(data, res, null)

  # ----------------
  h = res.filter(({splits}) -> splits)
  heightlight = h[Math.floor(Math.random() * h.length)]
  isHeighlighted = (segment) ->
    while segment
      return true if segment is heightlight
      segment = segment.parent
    return false
  # ----------------

  splits = []
  applies = []
  seen = {}
  for cmd in query
    if cmd.operation is 'split'
      if not seen[cmd.name]
        splits.push({ prop: cmd.name, type: 'split' })
        seen[cmd.name] = 1

    if cmd.operation is 'apply'
      if not seen[cmd.name]
        applies.push({ prop: cmd.name, type: 'apply' })
        seen[cmd.name] = 1

  props = splits.concat(applies)

  table = parent.append('table')
    .attr('class', 'facet')

  headColumnsSelection = table.append('thead')
    .append('tr')
    .selectAll('th')
    .data(props)

  headColumnsSelection.enter().append('th')
  headColumnsSelection.exit().remove()

  headColumnsSelection
    .attr('class', ({type, prop}) -> type)
    .text(({prop}) -> prop)


  bodyRowsSelection = table.append('tbody')
    .selectAll('tr')
    .data(res)

  bodyRowsSelection.enter().append('tr')
  bodyRowsSelection.exit().remove()

  bodyRowsSelection
    .attr('class', (segment) ->
      classes = [if segment.splits then 'split' else 'leaf']
      classes.push('no-parent') if not segment.parent
      classes.push('heightlight') if isHeighlighted(segment)
      return classes.join(' ')
    )

  bodyColumnsSelection = bodyRowsSelection
    .selectAll('td')
    .data((segment) -> props.map(({prop, type}) -> { type, prop, segment }))

  bodyColumnsSelection.enter().append('td')
  bodyColumnsSelection.exit().remove()

  bodyColumnsSelection
    .attr('class', ({type, prop, segment}) ->
      return type + ' ' + if segment.prop.hasOwnProperty(prop) then 'full' else 'blank'
    )
    .text(({prop, segment}) -> segment.prop[prop])

  return

