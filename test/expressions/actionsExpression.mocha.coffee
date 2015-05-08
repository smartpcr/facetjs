{ expect } = require("chai")

facet = require('../../build/facet')
{ Expression, Dataset, $ } = facet
tests = require './sharedTests'

describe 'ActionsExpression', ->
  describe 'with simple query', ->
    beforeEach ->
      this.expression = {
        op: 'actions'
        operand: '$diamonds'
        actions: [
          { action: 'apply', name: 'five', expression: { op: 'add', operands: [5, 1] } }
        ]
      }

    tests.expressionCountIs(5)
    tests.simplifiedExpressionIs({
      op: 'actions'
      operand: {
        op: 'ref'
        name: 'diamonds'
      }
      actions: [
        { action: 'apply', name: 'five', expression: { op: 'literal', value: 6 } }
      ]
    })
