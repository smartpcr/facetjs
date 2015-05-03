module Facet {
  export class NegateExpression extends UnaryExpression {
    static fromJS(parameters: ExpressionJS): NegateExpression {
      return new NegateExpression(UnaryExpression.jsToValue(parameters));
    }

    constructor(parameters: ExpressionValue) {
      super(parameters, dummyObject);
      this._ensureOp("negate");
      this._checkTypeOfOperand('NUMBER');
      this.type = 'NUMBER';
    }

    public toString(): string {
      return this.operand.toString() + '.negate()';
    }

    protected _getFnHelper(operandFn: ComputeFn): ComputeFn {
      return (d: Datum) => -operandFn(d);
    }

    protected _getJSExpressionHelper(operandFnJS: string): string {
      return `-(${operandFnJS})`;
    }

    protected _getSQLHelper(operandSQL: string, dialect: SQLDialect, minimal: boolean): string {
      return `-(${operandSQL})`;
    }

    protected _specialSimplify(simpleOperand: Expression): Expression {
      if (simpleOperand instanceof NegateExpression) {
        return simpleOperand.operand;
      }
      return null;
    }
  }

  Expression.register(NegateExpression);

}
