tests = require './sharedTests'

describe 'AggregateExpression', ->
  describe 'with reference variables', ->
    beforeEach ->
      this.expression = {
        op: 'aggregate',
        operand: { op: 'ref', name: 'diamonds', type: 'DATASET' },
        fn: 'sum',
        attribute: { op: 'ref', name: 'added' }
      }

    tests.expressionCountIs(3)
    tests.simplifiedExpressionIs({
      op: 'aggregate',
      operand: { op: 'ref', name: 'diamonds', type: 'DATASET' },
      fn: 'sum',
      attribute: { op: 'ref', name: 'added' },
    })

  describe 'as count', ->
    beforeEach ->
      this.expression = {
        op: 'aggregate',
        operand: { op: 'ref', name: 'diamonds', type: 'DATASET' },
        fn: 'count',
      }

    tests.expressionCountIs(2)
    tests.simplifiedExpressionIs({
      op: 'aggregate',
      operand: { op: 'ref', name: 'diamonds', type: 'DATASET' },
      fn: 'count'
    })
