module Facet {
  export class ConcatExpression extends NaryExpression {
    static fromJS(parameters: ExpressionJS): ConcatExpression {
      return new ConcatExpression(NaryExpression.jsToValue(parameters));
    }

    constructor(parameters: ExpressionValue) {
      super(parameters, dummyObject);
      this._ensureOp("concat");
      this._checkTypeOfOperands('STRING');
      this.type = 'STRING';
    }

    public toString(): string {
      return this.operands.map(operand => operand.toString()).join(' ++ ');
    }

    protected _getFnHelper(operandFns: ComputeFn[]): ComputeFn {
      return (d: Datum) => {
        return operandFns.map(operandFn => operandFn(d)).join('');
      }
    }

    protected _getJSExpressionHelper(operandJSExpressions: string[]): string {
      return '(' + operandJSExpressions.join('+') + ')';
    }

    protected _getSQLHelper(operandSQLs: string[], dialect: SQLDialect, minimal: boolean): string {
      return 'CONCAT(' + operandSQLs.join(',')  + ')';
    }

    protected _getUnitValue(): any {
      return '';
    }

    public simplify(): Expression {
      if (this.simple) return this;
      var simpleOperands = this._getSimpleOperands();

      var i = 0;
      while (i < simpleOperands.length - 1) {
        if (simpleOperands[i].isOp('literal') && simpleOperands[i + 1].isOp('literal')) {
          var mergedValue = (<LiteralExpression>simpleOperands[i]).value + (<LiteralExpression>simpleOperands[i + 1]).value;
          simpleOperands.splice(i, 2, new LiteralExpression({
            op: 'literal',
            value: mergedValue
          }));
        } else {
          i++;
        }
      }

      return this._simpleFromOperands(simpleOperands);
    }
  }
  Expression.register(ConcatExpression);
}
