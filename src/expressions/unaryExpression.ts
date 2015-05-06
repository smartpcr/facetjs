module Facet {
  export class UnaryExpression extends Expression {
    static jsToValue(parameters: ExpressionJS): ExpressionValue {
      var value: ExpressionValue = {
        op: parameters.op
      };
      if (parameters.operand) {
        value.operand = Expression.fromJSLoose(parameters.operand);
      } else {
        throw new TypeError("must have a operand");
      }

      return value;
    }

    public operand: Expression;

    constructor(parameters: ExpressionValue, dummyObject: Dummy) {
      super(parameters, dummyObject);
      this.operand = parameters.operand;
    }

    public valueOf(): ExpressionValue {
      var value = super.valueOf();
      value.operand = this.operand;
      return value;
    }

    public toJS(): ExpressionJS {
      var js: ExpressionJS = super.toJS();
      js.operand = this.operand.toJS();
      return js;
    }

    public equals(other: UnaryExpression): boolean {
      return super.equals(other) &&
        this.operand.equals(other.operand)
    }

    public expressionCount(): number {
      return 1 + this.operand.expressionCount();
    }

    protected _specialSimplify(simpleOperand: Expression): Expression {
      return null;
    }

    public simplify(): Expression {
      if (this.simple) return this;
      var simpleOperand = this.operand.simplify();

      var special = this._specialSimplify(simpleOperand);
      if (special) return special;

      if (simpleOperand.isOp('literal') && !simpleOperand.hasRemote()) {
        return new LiteralExpression({
          op: 'literal',
          value: this._getFnHelper(simpleOperand.getFn())(null)
        })
      }

      var simpleValue = this.valueOf();
      simpleValue.operand = simpleOperand;
      simpleValue.simple = true;
      return new (Expression.classMap[this.op])(simpleValue);
    }

    public _everyHelper(iter: BooleanExpressionIterator, thisArg: any, indexer: Indexer, depth: number, nestDiff: number): boolean {
      var pass = iter.call(thisArg, this, indexer.index, depth, nestDiff);
      if (pass != null) {
        return pass;
      } else {
        indexer.index++;
      }

      return this.operand._everyHelper(iter, thisArg, indexer, depth + 1, nestDiff)
          && this._specialEvery(iter, thisArg, indexer, depth, nestDiff);
    }

    protected _specialEvery(iter: BooleanExpressionIterator, thisArg: any, indexer: Indexer, depth: number, nestDiff: number): boolean {
      return true;
    }

    public _substituteHelper(substitutionFn: SubstitutionFn, thisArg: any, indexer: Indexer, depth: number, nestDiff: number): Expression {
      var sub = substitutionFn.call(thisArg, this, indexer.index, depth, nestDiff);
      if (sub) {
        indexer.index += this.expressionCount();
        return sub;
      } else {
        indexer.index++;
      }

      var subOperand = this.operand._substituteHelper(substitutionFn, thisArg, indexer, depth + 1, nestDiff);
      if (this.operand === subOperand) return this;

      var value = this.valueOf();
      value.operand = subOperand;
      delete value.simple;
      return new (Expression.classMap[this.op])(value);
    }

    protected _getFnHelper(operandFn: ComputeFn): ComputeFn {
      throw new Error("should never be called directly");
    }

    public getFn(): ComputeFn {
      return this._getFnHelper(this.operand.getFn());
    }

    protected _getJSExpressionHelper(operandFnJS: string): string {
      throw new Error("should never be called directly");
    }

    public getJSExpression(datumVar: string): string {
      return this._getJSExpressionHelper(this.operand.getJSExpression(datumVar));
    }

    protected _getSQLHelper(operandSQL: string, dialect: SQLDialect, minimal: boolean): string {
      throw new Error('should never be called directly');
    }

    public getSQL(dialect: SQLDialect, minimal: boolean = false): string {
      return this._getSQLHelper(this.operand.getSQL(dialect, minimal), dialect, minimal);
    }

    protected _checkTypeOfOperand(wantedType: string): void {
      if (!this.operand.canHaveType(wantedType)) {
        throw new TypeError(this.op + ' expression must have an operand of type ' + wantedType);
      }
    }

    public _fillRefSubstitutions(typeContext: FullType, indexer: Indexer, alterations: Alterations): FullType {
      indexer.index++;
      var operandFullType = this.operand._fillRefSubstitutions(typeContext, indexer, alterations);
      return {
        type: this.type,
        remote: operandFullType.remote
      };
    }
  }
}
