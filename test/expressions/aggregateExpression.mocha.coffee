{ expect } = require("chai")
tests = require './sharedTests'

facet = require('../../build/facet')
{ $ } = facet

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

  describe '#distribute()', ->
    it 'in simple + case', ->
      ex = $('data').sum('$x + $y')
      ex = ex.distribute()
      expect(ex.toString()).to.equal('($data.sum($x) + $data.sum($y))')

    it 'works in complex case', ->
      ex = $('data').sum('$x + $y - $z * 5 + 6')
      ex = ex.distribute()
      expect(ex.toString()).to.equal('($data.sum($x) + $data.sum($y) + $data.sum(($z * 5)).negate() + (6 * $data.count()))')
