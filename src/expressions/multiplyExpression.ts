module Facet {
  export class MultiplyExpression extends NaryExpression {
    static fromJS(parameters: ExpressionJS): MultiplyExpression {
      return new MultiplyExpression(NaryExpression.jsToValue(parameters));
    }

    constructor(parameters: ExpressionValue) {
      super(parameters, dummyObject);
      this._ensureOp("multiply");
      this._checkTypeOfOperands('NUMBER');
      this.type = 'NUMBER';
    }

    public toString(): string {
      return '(' + this.operands.map((operand) => operand.toString()).join(' * ') + ')';
    }

    protected _getFnHelper(operandFns: ComputeFn[]): ComputeFn {
      return (d: Datum) => {
        var res = 1;
        for (let operandFn of operandFns) {
          res *= operandFn(d) || 0;
        }
        return res;
      }
    }

    protected _getJSExpressionHelper(operandJSExpressions: string[]): string {
      return '(' + operandJSExpressions.join('*')  + ')';
    }

    public getSQL(dialect: SQLDialect, minimal: boolean): string {
      var operands = this.operands;
      var withSign = operands.map((operand, i) => {
        if (i === 0) return operand.getSQL(dialect, minimal);
        if (operand instanceof ReciprocateExpression) {
          return '/' + operand.operand.getSQL(dialect, minimal);
        } else {
          return '*' + operand.getSQL(dialect, minimal);
        }
      });
      return '(' + withSign.join('') + ')';
    }

    protected _getZeroValue(): any {
      return 0;
    }

    protected _getUnitValue(): any {
      return 1;
    }
  }

  Expression.register(MultiplyExpression);
}
