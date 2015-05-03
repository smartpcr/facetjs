module Facet {

  export class ReciprocateExpression extends UnaryExpression {
    static fromJS(parameters: ExpressionJS): ReciprocateExpression {
      return new ReciprocateExpression(UnaryExpression.jsToValue(parameters));
    }

    constructor(parameters: ExpressionValue) {
      super(parameters, dummyObject);
      this._ensureOp("reciprocate");
      this._checkTypeOfOperand('NUMBER');
      this.type = 'NUMBER';
    }

    public toString(): string {
      return this.operand.toString() + '.reciprocate()';
    }

    protected _getFnHelper(operandFn: ComputeFn): ComputeFn {
      return (d: Datum) => 1 / operandFn(d);
    }

    protected _getJSExpressionHelper(operandFnJS: string): string {
      return `(1/${operandFnJS})`;
    }

    protected _getSQLHelper(operandSQL: string, dialect: SQLDialect, minimal: boolean): string {
      return `(1/${operandSQL})`;
    }

    protected _specialSimplify(simpleOperand: Expression): Expression {
      if (simpleOperand instanceof ReciprocateExpression) {
        return simpleOperand.operand;
      }
      return null;
    }
  }

  Expression.register(ReciprocateExpression);
}
