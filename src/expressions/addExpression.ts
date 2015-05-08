module Facet {
  export class AddExpression extends NaryExpression {
    static fromJS(parameters: ExpressionJS): AddExpression {
      return new AddExpression(NaryExpression.jsToValue(parameters));
    }

    constructor(parameters: ExpressionValue) {
      super(parameters, dummyObject);
      this._ensureOp("add");
      this._checkTypeOfOperands('NUMBER');
      this.type = 'NUMBER';
    }

    public toString(): string {
      return '(' + this.operands.map(operand => operand.toString()).join(' + ') + ')';
    }

    protected _getFnHelper(operandFns: ComputeFn[]): ComputeFn {
      return (d: Datum) => {
        var res = 0;
        for (let operandFn of operandFns) {
          res += operandFn(d) || 0;
        }
        return res;
      }
    }

    protected _getJSExpressionHelper(operandJSExpressions: string[]): string {
      return '(' + operandJSExpressions.join('+')  + ')';
    }

    public getSQL(dialect: SQLDialect, minimal: boolean): string {
      var operands = this.operands;
      var withSign = operands.map((operand, i) => {
        if (i === 0) return operand.getSQL(dialect, minimal);
        if (operand instanceof NegateExpression) {
          return '-' + operand.operand.getSQL(dialect, minimal);
        } else {
          return '+' + operand.getSQL(dialect, minimal);
        }
      });
      return '(' + withSign.join('') + ')';
    }

    protected _getUnitValue(): any {
      return 0;
    }
  }

  Expression.register(AddExpression);
}
