module Facet {
  export class BinaryExpression extends Expression {
    static jsToValue(parameters: ExpressionJS): ExpressionValue {
      var op = parameters.op;
      var value: ExpressionValue = { op };
      if (typeof parameters.lhs !== 'undefined' && parameters.lhs !== null) {
        value.lhs = Expression.fromJSLoose(parameters.lhs);
      } else {
        throw new TypeError("must have a lhs");
      }

      if (typeof parameters.rhs !== 'undefined' && parameters.rhs !== null) {
        value.rhs = Expression.fromJSLoose(parameters.rhs);
      } else {
        throw new TypeError("must have a rhs");
      }

      return value;
    }

    public lhs: Expression;
    public rhs: Expression;

    constructor(parameters: ExpressionValue, dummyObject: Dummy) {
      super(parameters, dummyObject);
      this.lhs = parameters.lhs;
      this.rhs = parameters.rhs;
    }

    public valueOf(): ExpressionValue {
      var value = super.valueOf();
      value.lhs = this.lhs;
      value.rhs = this.rhs;
      return value;
    }

    public toJS(): ExpressionJS {
      var js = super.toJS();
      js.lhs = this.lhs.toJS();
      js.rhs = this.rhs.toJS();
      return js;
    }

    public equals(other: BinaryExpression): boolean {
      return super.equals(other) &&
        this.lhs.equals(other.lhs) &&
        this.rhs.equals(other.rhs);
    }

    public expressionCount(): int {
      return 1 + this.lhs.expressionCount() + this.rhs.expressionCount()
    }

    protected _specialSimplify(simpleLhs: Expression, simpleRhs: Expression): Expression {
      return null;
    }

    public simplify(): Expression {
      if (this.simple) return this;
      var simpleLhs = this.lhs.simplify();
      var simpleRhs = this.rhs.simplify();

      var special = this._specialSimplify(simpleLhs, simpleRhs);
      if (special) return special;

      if (simpleLhs.isOp('literal') && simpleRhs.isOp('literal') && !simpleLhs.hasRemote() && !simpleRhs.hasRemote()) {
        return new LiteralExpression({
          op: 'literal',
          value: this._getFnHelper(simpleLhs.getFn(), simpleRhs.getFn())(null)
        })
      }

      var simpleValue = this.valueOf();
      simpleValue.lhs = simpleLhs;
      simpleValue.rhs = simpleRhs;
      simpleValue.simple = true;
      return new (Expression.classMap[this.op])(simpleValue);
    }

    public checkLefthandedness(): boolean {
      return this.lhs.isOp('ref') && this.rhs.isOp('literal');
    }

    protected _checkMatchingTypes(): void {
      var lhsType = this.lhs.type;
      var rhsType = this.rhs.type;
      if (lhsType && rhsType && lhsType !== rhsType) {
        throw new TypeError(`${this.op} expression must have matching types, (are: ${lhsType}, ${rhsType})`);
      }
    }

    protected _checkNumberOrTime(): void {
      var lhs = this.lhs;
      var rhs = this.rhs;
      if (!((lhs.canHaveType('NUMBER') && rhs.canHaveType('NUMBER'))
         || (lhs.canHaveType('TIME') && rhs.canHaveType('TIME')))) {
        throw new TypeError(`${this.op} expression has a bad type combination ${lhs.type || '?'}, ${rhs.type || '?'}`);
      }
    }

    public _everyHelper(iter: BooleanExpressionIterator, thisArg: any, indexer: Indexer, depth: int, nestDiff: int): boolean {
      var pass = iter.call(thisArg, this, indexer.index, depth, nestDiff);
      if (pass != null) {
        return pass;
      } else {
        indexer.index++;
      }

      return this.lhs._everyHelper(iter, thisArg, indexer, depth + 1, nestDiff)
          && this.rhs._everyHelper(iter, thisArg, indexer, depth + 1, nestDiff);
    }

    public _substituteHelper(substitutionFn: SubstitutionFn, thisArg: any, indexer: Indexer, depth: int, nestDiff: int): Expression {
      var sub = substitutionFn.call(thisArg, this, indexer.index, depth, nestDiff);
      if (sub) {
        indexer.index += this.expressionCount();
        return sub;
      } else {
        indexer.index++;
      }

      var subLhs = this.lhs._substituteHelper(substitutionFn, thisArg, indexer, depth, nestDiff);
      var subRhs = this.rhs._substituteHelper(substitutionFn, thisArg, indexer, depth, nestDiff);
      if (this.lhs === subLhs && this.rhs === subRhs) return this;

      var value = this.valueOf();
      value.lhs = subLhs;
      value.rhs = subRhs;
      delete value.simple;
      return new (Expression.classMap[this.op])(value);
    }

    protected _getFnHelper(lhsFn: ComputeFn, rhsFn: ComputeFn): ComputeFn {
      throw new Error("should never be called directly");
    }

    public getFn(): ComputeFn {
      return this._getFnHelper(this.lhs.getFn(), this.rhs.getFn());
    }

    protected _getJSExpressionHelper(lhsFnJS: string, rhsFnJS: string): string {
      throw new Error("should never be called directly");
    }

    public getJSExpression(datumVar: string): string {
      return this._getJSExpressionHelper(this.lhs.getJSExpression(datumVar), this.rhs.getJSExpression(datumVar))
    }

    protected _getSQLHelper(lhsSQL: string, rhsSQL: string, dialect: SQLDialect, minimal: boolean): string {
      throw new Error('should never be called directly');
    }

    public getSQL(dialect: SQLDialect, minimal: boolean = false): string {
      return this._getSQLHelper(this.lhs.getSQL(dialect, minimal), this.rhs.getSQL(dialect, minimal), dialect, minimal);
    }

    public _fillRefSubstitutions(typeContext: FullType, indexer: Indexer, alterations: Alterations): FullType {
      indexer.index++;
      var lhsFullType = this.lhs._fillRefSubstitutions(typeContext, indexer, alterations);
      var rhsFullType = this.rhs._fillRefSubstitutions(typeContext, indexer, alterations);
      return {
        type: this.type,
        remote: mergeRemotes([lhsFullType.remote, rhsFullType.remote])
      };
    }
  }
}
