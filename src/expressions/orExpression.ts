module Facet {
  export class OrExpression extends NaryExpression {
    static fromJS(parameters: ExpressionJS): OrExpression {
      return new OrExpression(NaryExpression.jsToValue(parameters));
    }

    constructor(parameters: ExpressionValue) {
      super(parameters, dummyObject);
      this._ensureOp("or");
      this._checkTypeOfOperands('BOOLEAN');
      this.type = 'BOOLEAN';
    }

    public toString(): string {
      return '(' + this.operands.map((operand) => operand.toString()).join(' or ') + ')';
    }

    protected _getFnHelper(operandFns: ComputeFn[]): ComputeFn {
      return (d: Datum) => {
        var res = false;
        for (var i = 0; i < operandFns.length; i++) {
          res = res || operandFns[i](d);
        }
        return res;
      }
    }

    protected _getJSExpressionHelper(operandJSExpressions: string[]): string {
      return '(' + operandJSExpressions.join('||')  + ')';
    }

    protected _getSQLHelper(operandSQLs: string[], dialect: SQLDialect, minimal: boolean): string {
      return '(' + operandSQLs.join(' OR ')  + ')';
    }

    protected _getZeroValue(): any {
      return true;
    }

    protected _getUnitValue(): any {
      return false;
    }

    public simplify(): Expression {
      if (this.simple) return this;

      var simplifiedOperands = this._getSimpleOperands();

      var groupedOperands: Lookup<Expression[]> = {};
      for (var j = 0; j < simplifiedOperands.length; j++) {
        var thisOperand = simplifiedOperands[j];
        var referenceGroup = thisOperand.getFreeReferences().toString();

        if (groupedOperands[referenceGroup]) {
          groupedOperands[referenceGroup].push(thisOperand);
        } else {
          groupedOperands[referenceGroup] = [thisOperand];
        }
      }

      var sortedReferenceGroups = Object.keys(groupedOperands).sort();
      var finalOperands: Expression[] = [];
      for (var k = 0; k < sortedReferenceGroups.length; k++) {
        var mergedExpressions = multiMerge(groupedOperands[sortedReferenceGroups[k]], (a, b) => {
          return a ? a.mergeOr(b) : null;
        });
        if (mergedExpressions.length === 1) {
          finalOperands.push(mergedExpressions[0]);
        } else {
          finalOperands.push(new OrExpression({
            op: 'or',
            operands: mergedExpressions
          }));
        }
      }

      return this._simpleFromOperands(finalOperands);
    }
  }

  Expression.register(OrExpression);
}
