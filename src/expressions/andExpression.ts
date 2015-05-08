module Facet {
  export class AndExpression extends NaryExpression {
    static fromJS(parameters: ExpressionJS): AndExpression {
      return new AndExpression(NaryExpression.jsToValue(parameters));
    }

    static mergeTimePart(andExpression: AndExpression): InExpression {
      var operands = andExpression.operands;
      if (operands.length !== 2) return null;
      var concreteExpression: Expression;
      var partExpression: Expression;
      var op0TimePart = operands[0].containsOp('timePart');
      var op1TimePart = operands[1].containsOp('timePart');
      if (op0TimePart === op1TimePart) return null;
      if (op0TimePart) {
        concreteExpression = operands[1];
        partExpression = operands[0];
      } else {
        concreteExpression = operands[0];
        partExpression = operands[1];
      }

      var lhs: Expression;
      var concreteRangeSet: Set;
      if (concreteExpression instanceof InExpression && concreteExpression.checkLefthandedness()) {
        lhs = concreteExpression.lhs;
        concreteRangeSet = Set.convertToSet((<LiteralExpression>concreteExpression.rhs).value);
      } else {
        return null;
      }

      if (partExpression instanceof InExpression || partExpression instanceof IsExpression) {
        var partLhs = partExpression.lhs;
        var partRhs = partExpression.rhs;
        if (partLhs instanceof TimePartExpression && partRhs instanceof LiteralExpression) {
          return <InExpression>lhs.in({
            op: 'literal',
            value: concreteRangeSet.intersect(partLhs.materializeWithinRange(
              <TimeRange>concreteRangeSet.extent(),
              Set.convertToSet(partRhs.value).getElements()
            ))
          });
        } else {
          return null;
        }
      } else {
        return null;
      }
    }

    constructor(parameters: ExpressionValue) {
      super(parameters, dummyObject);
      this._ensureOp("and");
      this._checkTypeOfOperands('BOOLEAN');
      this.type = 'BOOLEAN';
    }

    public toString(): string {
      return '(' + this.operands.map(operand => operand.toString()).join(' and ') + ')';
    }

    protected _getFnHelper(operandFns: ComputeFn[]): ComputeFn {
      return (d: Datum) => {
        var res = true;
        for (let operandFn of operandFns) {
          res = res && operandFn(d);
        }
        return res;
      }
    }

    protected _getJSExpressionHelper(operandJSExpressions: string[]): string {
      return '(' + operandJSExpressions.join('&&')  + ')';
    }

    protected _getSQLHelper(operandSQLs: string[], dialect: SQLDialect, minimal: boolean): string {
      return '(' + operandSQLs.join(' AND ')  + ')';
    }

    protected _getZeroValue(): any {
      return false;
    }

    protected _getUnitValue(): any {
      return true;
    }

    public simplify(): Expression {
      if (this.simple) return this;
      var simpleOperands = this._getSimpleOperands();

      var groupedOperands: Lookup<Expression[]> = {};
      for (let simpleOperand of simpleOperands) {
        var referenceGroup = simpleOperand.getFreeReferences().toString();

        if (hasOwnProperty(groupedOperands, referenceGroup)) {
          groupedOperands[referenceGroup].push(simpleOperand);
        } else {
          groupedOperands[referenceGroup] = [simpleOperand];
        }
      }

      var sortedReferenceGroups = Object.keys(groupedOperands).sort();
      var finalOperands: Expression[] = [];
      for (let sortedReferenceGroup of sortedReferenceGroups) {
        var mergedExpressions = multiMerge(groupedOperands[sortedReferenceGroup], (a, b) => {
          return a ? a.mergeAnd(b) : null;
        });
        if (mergedExpressions.length === 1) {
          finalOperands.push(mergedExpressions[0]);
        } else {
          finalOperands.push(new AndExpression({
            op: 'and',
            operands: mergedExpressions
          }));
        }
      }

      return this._simpleFromOperands(finalOperands);
    }

    public separateViaAnd(refName: string): Separation {
      if (typeof refName !== 'string') throw new Error('must have refName');
      //if (!this.simple) return this.simplify().separateViaAnd(refName);

      var includedExpressions: Expression[] = [];
      var excludedExpressions: Expression[] = [];
      var operands = this.operands;
      for (let operand of operands) {
        var sep = operand.separateViaAnd(refName);
        if (sep === null) return null;
        includedExpressions.push(sep.included);
        excludedExpressions.push(sep.excluded);
      }

      return {
        included: new AndExpression({ op: 'and', operands: includedExpressions }).simplify(),
        excluded: new AndExpression({ op: 'and', operands: excludedExpressions }).simplify()
      };
    }
  }

  Expression.register(AndExpression);
}
