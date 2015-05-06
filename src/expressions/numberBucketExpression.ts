module Facet {
  export class NumberBucketExpression extends UnaryExpression {
    static fromJS(parameters: ExpressionJS): NumberBucketExpression {
      var value = UnaryExpression.jsToValue(parameters);
      value.size = parameters.size;
      value.offset = hasOwnProperty(parameters, 'offset') ? parameters.offset : 0;
      value.lowerLimit = hasOwnProperty(parameters, 'lowerLimit') ? parameters.lowerLimit : null;
      value.upperLimit = hasOwnProperty(parameters, 'upperLimit') ? parameters.upperLimit : null;
      return new NumberBucketExpression(value);
    }

    public size: number;
    public offset: number;
    public lowerLimit: number;
    public upperLimit: number;

    constructor(parameters: ExpressionValue) {
      super(parameters, dummyObject);
      var size = parameters.size;
      this.size = size;

      var offset = parameters.offset;
      this.offset = offset;

      var lowerLimit = parameters.lowerLimit;
      this.lowerLimit = lowerLimit;

      var upperLimit = parameters.upperLimit;
      this.upperLimit = upperLimit;

      if (lowerLimit !== null && upperLimit !== null && upperLimit - lowerLimit < size) {
        throw new Error('lowerLimit and upperLimit must be at least size apart');
      }

      this._ensureOp("numberBucket");
      this.type = "NUMBER_RANGE";
    }

    public valueOf(): ExpressionValue {
      var value = super.valueOf();
      value.size = this.size;
      value.offset = this.offset;
      value.lowerLimit = this.lowerLimit;
      value.upperLimit = this.upperLimit;
      return value;
    }

    public toJS(): ExpressionJS {
      var js = super.toJS();
      js.size = this.size;
      if (this.offset) js.offset = this.offset;
      if (this.lowerLimit !== null) js.lowerLimit = this.lowerLimit;
      if (this.upperLimit !== null) js.upperLimit = this.upperLimit;
      return js;
    }

    public toString(): string {
      return this.operand.toString() + '.numberBucket(' + this.size + (this.offset ? (', ' + this.offset) : '') + ')';
    }

    public equals(other: NumberBucketExpression): boolean {
      return super.equals(other) &&
        this.size === other.size &&
        this.offset === other.offset &&
        this.lowerLimit === other.lowerLimit &&
        this.upperLimit === other.upperLimit;
    }

    protected _getFnHelper(operandFn: ComputeFn): ComputeFn {
      var size = this.size;
      var offset = this.offset;
      var lowerLimit = this.lowerLimit;
      var upperLimit = this.upperLimit;
      return (d: Datum) => {
        var num = operandFn(d);
        if (num === null) return null;
        return NumberRange.numberBucket(num, size, offset); // lowerLimit, upperLimit
      }
    }

    protected _getJSExpressionHelper(operandFnJS: string): string {
      throw new Error("implement me");
    }

    protected _getSQLHelper(operandSQL: string, dialect: SQLDialect, minimal: boolean): string {
      return continuousFloorExpression(operandSQL, "FLOOR", this.size, this.offset); // lowerLimit, upperLimit
    }
  }

  Expression.register(NumberBucketExpression);
}
