module Facet {
  export class SubstrExpression extends UnaryExpression {
    static fromJS(parameters: ExpressionJS): SubstrExpression {
      var value = UnaryExpression.jsToValue(parameters);
      value.position = parameters.position;
      value.length = parameters.length;
      return new SubstrExpression(value);
    }

    public position: int;
    public length: int;

    constructor(parameters: ExpressionValue) {
      super(parameters, dummyObject);
      this.position = parameters.position;
      this.length = parameters.length;
      this._ensureOp("substr");
      this._checkTypeOfOperand('STRING');
      this.type = 'STRING';
    }

    public valueOf(): ExpressionValue {
      var value = super.valueOf();
      value.position = this.position;
      value.length = this.length;
      return value;
    }

    public toJS(): ExpressionJS {
      var js = super.toJS();
      js.position = this.position;
      js.length = this.length;
      return js;
    }

    public toString(): string {
      return `${this.operand.toString()}.substr(${this.position},${this.length})`;
    }

    public equals(other: SubstrExpression): boolean {
      return super.equals(other) &&
        this.position === other.position &&
        this.length === other.length;
    }

    protected _getFnHelper(operandFn: ComputeFn): ComputeFn {
      var position = this.position;
      var length = this.length;
      return (d: Datum) => {
        var v = operandFn(d);
        if (v === null) return null;
        return v.substr(position, length);
      }
    }

    protected _getJSExpressionHelper(operandFnJS: string): string {
      throw new Error("implement me");
    }

    protected _getSQLHelper(operandSQL: string, dialect: SQLDialect, minimal: boolean): string {
      return `SUBSTR(${operandSQL},${this.position + 1},${this.length})`;
    }
  }

  Expression.register(SubstrExpression);
}
