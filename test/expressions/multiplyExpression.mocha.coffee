{ expect } = require("chai")
tests = require './sharedTests'

facet = require('../../build/facet')
{ $ } = facet


tests = require './sharedTests'
describe 'MultiplyExpression', ->
  describe 'with only literal values', ->
    beforeEach ->
      this.expression = { op: 'multiply', operands: [{ op: 'literal', value: 5 }, { op: 'literal', value: -12 }, { op: 'literal', value: 4 }] }

    tests.expressionCountIs(4)
    tests.simplifiedExpressionIs({
      op: 'literal'
      value: -240
    })

  describe 'with one ref value', ->
    beforeEach ->
      this.expression = { op: 'multiply', operands: [{ op: 'ref', name: 'test' }, { op: 'literal', value: -12 }, { op: 'literal', value: 4 }] }

    tests.expressionCountIs(4)
    tests.simplifiedExpressionIs({ op: 'multiply', operands: [{ op: 'ref', name: 'test' }, { op: 'literal', value: -48 }] })

  describe 'with two ref values', ->
    beforeEach ->
      this.expression = { op: 'multiply', operands: [{ op: 'ref', name: 'test' }, { op: 'literal', value: -12 }, { op: 'literal', value: 4 }, { op: 'ref', name: 'test2' }] }

    tests.expressionCountIs(5)
    tests.simplifiedExpressionIs({ op: 'multiply', operands: [{ op: 'ref', name: 'test' }, { op: 'ref', name: 'test2' }, { op: 'literal', value: -48 }] })

  describe 'with no values', ->
    beforeEach ->
      this.expression = { op: 'multiply', operands: [] }

    tests.expressionCountIs(1)
    tests.simplifiedExpressionIs({ op: 'literal', value: 1 })

  describe 'folds out on 0 as an operand', ->
    it "works in simple case", ->
      ex = $('x').multiply(0)
      ex = ex.simplify()
      expect(ex.toString()).to.equal('0')

    it "works in complex case", ->
      ex = $('x').multiply('6 * $y * 0 * $z')
      ex = ex.simplify()
      expect(ex.toString()).to.equal('0')

  describe 'removes 1 as an operand', ->
    it "works in simple case", ->
      ex = $('x').multiply(1)
      ex = ex.simplify()
      expect(ex.toString()).to.equal('$x')

    it "works in complex case", ->
      ex = $('x').multiply('1 * $y * 1 * $z')
      ex = ex.simplify()
      expect(ex.toString()).to.equal('($x * $y * $z)')