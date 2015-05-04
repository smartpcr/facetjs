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
    it 'works in simple - case', ->
      ex = $('data').sum('-$x')
      ex = ex.distribute()
      expect(ex.toString()).to.equal('$data.sum($x).negate()')

    it 'works in simple + case', ->
      ex = $('data').sum('$x + $y')
      ex = ex.distribute()
      expect(ex.toString()).to.equal('($data.sum($x) + $data.sum($y))')

    it 'works in constant * case', ->
      ex = $('data').sum('$x * 6')
      ex = ex.distribute()
      expect(ex.toString()).to.equal('(6 * $data.sum($x))')

    it 'works in constant * case (multiple operands)', ->
      ex = $('data').sum('$x * 6 * $y')
      ex = ex.distribute()
      expect(ex.toString()).to.equal('(6 * $data.sum(($x * $y)))')

    it 'works in complex case', ->
      ex = $('data').sum('$x + $y - $z * 5 + 6')
      ex = ex.distribute()
      expect(ex.toString()).to.equal('($data.sum($x) + $data.sum($y) + (5 * $data.sum($z)).negate() + (6 * $data.count()))')
