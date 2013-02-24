
arraySubclass = if [].__proto__
    # Until ECMAScript supports array subclassing, prototype injection works well.
    (array, prototype) ->
      array.__proto__ = prototype
      return array
  else
    # And if your browser doesn't support __proto__, we'll use direct extension.
    (array, prototype) ->
      array[property] = prototype[property] for property in prototype
      return array


flatten = (ar) -> Array::concat.apply([], ar)

# =============================================================

class Segment
  constructor: ({ @parent, @node, stage, @prop, @splits }) ->
    throw "invalid stage" unless typeof stage?.type is 'string'
    @_stageStack = [stage]
    @scale = {}

  getStage: ->
    return @_stageStack[@_stageStack.length - 1]

  setStage: (stage) ->
    throw "invalid stage" unless typeof stage?.type is 'string'
    @_stageStack[@_stageStack.length - 1] = stage
    return

  pushStage: (stage) ->
    throw "invalid stage" unless typeof stage?.type is 'string'
    @_stageStack.push(stage)
    return

  popStage: ->
    throw "must have at least one stage" if @_stageStack.length < 2
    @_stageStack.pop()
    return


window.facet = facet = {}

# =============================================================
# SPLIT
# A split is a function that takes a row and returns a string-able thing.

facet.split = {
  identity: (attribute) -> {
      bucket: 'identity'
      attribute
    }

  continuous: (attribute, size, offset) -> {
      bucket: 'continuous'
      attribute
      size
      offset
    }

  time: (attribute, duration) ->
    throw new Error("Invalid duration '#{duration}'") unless duration in ['second', 'minute', 'hour', 'day']
    return {
      bucket: 'time'
      attribute
      duration
    }
}

# =============================================================
# APPLY
# An apply is a function that takes an array of rows and returns a number.

facet.apply = {
  count: -> {
    aggregate: 'count'
  }

  sum: (attribute) -> {
    aggregate: 'sum'
    attribute
  }

  average: (attribute) -> {
    aggregate: 'sum'
    attribute
  }

  min: (attribute) -> {
    aggregate: 'min'
    attribute
  }

  max: (attribute) -> {
    aggregate: 'max'
    attribute
  }

  unique: (attribute) -> {
    aggregate: 'unique'
    attribute
  }
}

# =============================================================
# USE
# Extracts the property and other things from a segment

getProp = (segment, propName) ->
  if not segment
    throw new Error("No such prop name '#{propName}'")
  return segment.prop[propName] ? getProp(segment.parent, propName)

facet.use = {
  prop: (propName) -> (segment) ->
    return getProp(segment, propName)

  literal: (value) -> () ->
    return value

  fn: (args..., fn) -> (segment) ->
    throw new TypeError("second argument must be a function") unless typeof fn is 'function'
    return fn.apply(this, args.map((arg) -> arg(segment)))

  scaled: (scaleName, acc) -> (segment) ->
    return segment.scale[scaleName](acc(segment))

  scale: {
    color: (propName) ->
      s = d3.scale.category10()
      return (segment) ->
        v = getProp(segment, propName)
        return s(v)
  }
}

# =============================================================
# LAYOUT
# A function that takes a rectangle and a lists of facets and initializes their node. (Should be generalized to any shape).

divideLength = (length, sizes) ->
  totalSize = 0
  totalSize += size for size in sizes
  lengthPerSize = length / totalSize
  return sizes.map((size) -> size * lengthPerSize)

stripeTile = (dim1, dim2) ->
  makeTransform = (dim, value) ->
    return if dim is 'width' then "translate(#{value},0)" else "translate(0,#{value})"

  return ({ gap, size } = {}) -> (parentSegment, segmentGroup) ->
    gap or= 0
    size or= -> 1
    n = segmentGroup.length
    parentStage = parentSegment.getStage()
    if parentStage.type isnt 'rectangle'
      throw new Error("Must have a rectangular stage (is #{parentStage.type})")
    parentDim1 = parentStage[dim1]
    parentDim2 = parentStage[dim2]
    maxGap = Math.max(0, (parentDim1 - n * 2) / (n - 1)) # Each segment takes up at least 2px
    gap = Math.min(gap, maxGap)
    availableDim1 = parentDim1 - gap * (n - 1)
    dim1s = divideLength(availableDim1, segmentGroup.map(size))

    dimSoFar = 0
    for segment, i in segmentGroup
      curDim1 = dim1s[i]

      segmentStage = { type: 'rectangle' }
      segmentStage[dim1] = curDim1
      segmentStage[dim2] = parentDim2

      segment.setStage(segmentStage)

      segment.node
        .attr('transform', makeTransform(dim1, dimSoFar))
        .attr(dim1, curDim1)
        .attr(dim2, parentDim2)

      dimSoFar += curDim1 + gap

    return

facet.layout = {
  overlap: () -> {}

  horizontal: stripeTile('width', 'height')

  vertical: stripeTile('height', 'width')

  tile: ->
    return
}

# =============================================================
# SCALE
# A function that makes a scale and adds it to the segment.
# Arguments* -> Segment -> void

getCousinSegments = (segment, distance) ->
  # Find and all relevant segments, first find the source
  sourceSegment = segment
  i = 0
  while i < distance
    sourceSegment = sourceSegment.parent
    throw new Error("gone to far") unless sourceSegment
    i++

  # Get all of sources children on my level (my cousins)
  cousinSegments = [sourceSegment]
  i = 0
  while i < distance
    cousinSegments = flatten(cousinSegments.map((s) -> s.splits))
    i++

  return cousinSegments

facet.scale = {
  linear: ({domain, range, include}) ->
    if range in ['width', 'height']
      rangeFn = (segment) -> [0, segment.getStage()[range]]
    else if typeof range is 'number'
      rangeFn = -> [0, range]
    else if Array.isArray(range) and range.length is 2
      rangeFn = -> range
    else
      throw new Error("bad range")

    return (segments) ->
      domainMin = Infinity
      domainMax = -Infinity
      rangeFrom = -Infinity
      rangeTo = Infinity

      if include?
        domainMin = Math.min(domainMin, include)
        domainMax = Math.max(domainMax, include)

      for segment in segments
        domainValue = domain(segment)
        domainMin = Math.min(domainMin, domainValue)
        domainMax = Math.max(domainMax, domainValue)

        rangeValue = rangeFn(segment)
        rangeFrom = rangeValue[0]
        rangeTo = Math.min(rangeTo, rangeValue[1])

      if not (isFinite(domainMin) and isFinite(domainMax) and isFinite(rangeFrom) and isFinite(rangeTo))
        throw new Error("we went into infinites")

      return d3.scale.linear()
        .domain([domainMin, domainMax])
        .range([rangeFrom, rangeTo])
}

# =============================================================
# TRANSFORM STAGE
# A function that transforms the stage from one form to another.
# Arguments* -> Segment -> void

boxPosition = (segment, stageWidth, left, width, right) ->
  if left? and width? and right?
    throw new Error("Over-constrained")

  if left?
    return if width? then [left(segment), width(segment)] else [left(segment), stageWidth - left(segment)]
  else if right?
    return if width?
      [stageWidth - right(segment) - width(segment), width(segment)]
    else
      [0, stageWidth - right(segment)]
  else
    return if width? then [0, width(segment)] else [0, stageWidth]

facet.stage = {
  rectToPoint: ({left, right, top, bottom} = {}) ->
    # Make sure we are not over-constrained
    if (left? and right?) or (top? and bottom?)
      throw new Error("Over-constrained")

    fx = if left? then (w) -> left else if right?  then (w) -> w - right  else (w) -> w / 2
    fy = if top?  then (h) -> top  else if bottom? then (h) -> h - bottom else (h) -> h / 2

    return (segment) ->
      stage = segment.getStage()
      throw new Error("Must have a rectangle stage (is #{stage.type})") unless stage.type is 'rectangle'

      segment.pushStage({
        type: 'point'
        x: fx(stage.width)
        y: fy(stage.height)
      })
      return



  # margin: ({left, width, right, top, height, bottom}) -> (segment) ->
  #   stage = segment.getStage()
  #   throw new Error("Must have a rectangle stage (is #{stage.type})") unless stage.type is 'rectangle'

  #   [x, w] = boxPosition(segment, stage.width, left, width, right)
  #   [y, h] = boxPosition(segment, stage.height, top, height, bottom)
}

# =============================================================
# PLOT
# A function that takes a facet and
# Arguments* -> Segment -> void

facet.plot = {
  rect: ({left, width, right, top, height, bottom, stroke, fill, opacity}) -> (segment) ->
    stage = segment.getStage()
    throw new Error("Must have a rectangle stage (is #{stage.type})") unless stage.type is 'rectangle'

    [x, w] = boxPosition(segment, stage.width, left, width, right)
    [y, h] = boxPosition(segment, stage.height, top, height, bottom)

    segment.node.append('rect').datum(segment)
      .attr('x', x)
      .attr('y', y)
      .attr('width', w)
      .attr('height', h)
      .style('fill', fill)
      .style('stroke', stroke)
      .style('opacity', opacity)
    return

  text: ({color, text, size, anchor, baseline, angle}) -> (segment) ->
    stage = segment.getStage()
    throw new Error("Must have a point stage (is #{stage.type})") unless stage.type is 'point'
    node = segment.node.append('text').datum(segment)

    transformStr = "translate(#{stage.x}, #{stage.y})"
    transformStr += " rotate(#{angle(segment)})" if angle?
    node.attr('transform', transformStr)

    if typeof baseline is 'function'
      node.attr('dy', (segment) ->
        bv = baseline.call(this, segment)
        return if bv is 'top' then '.71em' else if bv is 'center' then '.35em' else null
      )

    node
      .style('font-size', size)
      .style('fill', color)
      .style('text-anchor', anchor)
      .text(text)
    return

  circle: ({stroke, fill}) -> (segment) ->
    stage = segment.getStage()
    throw new Error("Must have a point stage (is #{stage.type})") unless stage.type is 'point'
    segment.node.append('text').datum(segment)
      .attr('cx', stage.x)
      .attr('cy', stage.y)
      .attr('dy', '.71em')
      .style('fill', fill)
      .style('stroke', stroke)
      .text(text)
    return
}

# =============================================================
# SORT

facet.sort = {
  natural: (attribute, direction = 'ascending') -> {
    compare: 'natural'
    attribute
    direction
  }

  caseInsensetive: (attribute, direction = 'ascending') -> {
    compare: 'caseInsensetive'
    attribute
    direction
  }
}


# =============================================================
# main

class FacetJob
  constructor: (@driver) ->
    @ops = []
    @knownProps = {}

  split: (propName, split) ->
    split = _.clone(split)
    split.operation = 'split'
    split.prop = propName
    @ops.push(split)
    @knownProps[propName] = true
    return this

  layout: (layout) ->
    throw new TypeError("Layout must be a function") unless typeof layout is 'function'
    @ops.push({
      operation: 'layout'
      layout
    })
    return this

  apply: (propName, apply) ->
    apply = _.clone(apply)
    apply.operation = 'apply'
    apply.prop = propName
    @ops.push(apply)
    @knownProps[propName] = true
    return this

  scale: (name, distance, scale) ->
    if not scale? and typeof distance is 'function'
      scale = distance
      distance = 1

    @ops.push({
      operation: 'scale'
      name
      distance
      scale
    })
    return this

  combine: ({ filter, sort, limit } = {}) ->
    # ToDo: implement filter
    combine = {
      operation: 'combine'
    }
    if sort
      if not @knownProps[sort.prop]
        throw new Error("can not sort on unknown prop '#{sort.prop}'")
      combine.sort = sort
      combine.sort.compare ?= 'natural'

    if limit?
      combine.limit = limit

    @ops.push(combine)
    return this

  stage: (transform) ->
    throw new TypeError("transform must be a function") unless typeof transform is 'function'
    @ops.push({
      operation: 'stage'
      transform
    })
    return this

  unstage: ->
    @ops.push({
      operation: 'unstage'
    })
    return this


  plot: (plot) ->
    throw new TypeError("plot must be a function") unless typeof plot is 'function'
    @ops.push({
      operation: 'plot'
      plot
    })
    return this

  getQuery: ->
    return @ops.filter(({operation}) -> operation in ['split', 'apply', 'combine'])

  render: (selector, width, height) ->
    parent = d3.select(selector)
    throw new Error("could not find the provided selector") if parent.empty()
    throw new Error("bad size: #{width} x #{height}") unless width and height

    operations = @ops
    @driver @getQuery(), (err, res) ->
      if err
        alert("An error has occurred: " + if typeof err is 'string' then err else err.message)
        return

      svg = parent.append('svg')
        .attr('width', width)
        .attr('height', height)

      segmentGroups = [[new Segment({
        parent: null
        node: svg
        stage: { type: 'rectangle', width, height }
        prop: res.prop
        splits: res.splits
      })]]

      for cmd in operations
        switch cmd.operation
          when 'split'
            segmentGroups = flatten(segmentGroups).map((segment) ->
              return segment.splits = segment.splits.map (sp) ->
                return new Segment({
                  parent: segment
                  node: segment.node.append('g')
                  stage: segment.getStage()
                  prop: sp.prop
                  splits: sp.splits
                })
            )

          when 'apply', 'combine'
            null # Do nothing, there is nothing to do on the renderer for those two :-)

          when 'scale'
            { name, distance, scale } = cmd
            for segmentGroup in segmentGroups
              for segment in segmentGroup
                # We may have already defined this scale on this segment
                continue if segment.scale[name]
                unifiedSegments = getCousinSegments(segment, distance)
                scaleFn = scale(unifiedSegments)
                for unifiedSegment in unifiedSegments
                  unifiedSegment.scale[name] = scaleFn

          when 'layout'
            { layout } = cmd
            for segmentGroup in segmentGroups
              parentSegment = segmentGroup[0].parent
              throw new Error("You must split before calling layout") unless parentSegment
              layout(parentSegment, segmentGroup)

          when 'stage'
            { transform } = cmd
            for segmentGroup in segmentGroups
              for segment in segmentGroup
                transform(segment)

          when 'unstage'
            for segmentGroup in segmentGroups
              for segment in segmentGroup
                segment.popStage()

          when 'plot'
            { plot } = cmd
            for segmentGroup in segmentGroups
              for segment in segmentGroup
                plot(segment)

          else
            throw new Error("Unknown operation '#{cmd.operation}'")

      return

    return this


facet.visualize = (driver) -> new FacetJob(driver)


facet.ajaxPoster = ({url, context, prety}) -> (query, callback) ->
  return $.ajax({
    url
    type: 'POST'
    dataType: 'json'
    contentType: 'application/json'
    data: JSON.stringify({ context, query }, null, if prety then 2 else null)
    success: (res) ->
      callback(null, res)
      return
    error: (xhr) ->
      text = xhr.responseText
      try
        err = JSON.parse(text)
      catch e
        err = { message: text }
      callback(err, null)
      return
  })