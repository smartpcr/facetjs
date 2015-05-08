module Facet {
  export class NaryExpression extends Expression {
    static jsToValue(parameters: ExpressionJS): ExpressionValue {
      var op = parameters.op;
      var value: ExpressionValue = { op };
      if (Array.isArray(parameters.operands)) {
        value.operands = parameters.operands.map(operand => Expression.fromJSLoose(operand));
      } else {
        throw new TypeError("must have a operands");
      }

      return value;
    }

    public operands: Expression[];

    constructor(parameters: ExpressionValue, dummyObject: Dummy) {
      super(parameters, dummyObject);
      this.operands = parameters.operands;
    }

    public valueOf(): ExpressionValue {
      var value = super.valueOf();
      value.operands = this.operands;
      return value;
    }

    public toJS(): ExpressionJS {
      var js = super.toJS();
      js.operands = this.operands.map(operand => operand.toJS());
      return js;
    }

    public equals(other: NaryExpression): boolean {
      return super.equals(other) && higherArraysEqual(this.operands, other.operands);
    }

    public expressionCount(): int {
      var expressionCount = 1;
      var operands = this.operands;
      for (let operand of operands) {
        expressionCount += operand.expressionCount();
      }
      return expressionCount;
    }

    protected _getZeroValue(): any {
      return null;
    }

    protected _getUnitValue(): any {
      return null;
    }

    protected _getSimpleOperands(): Expression[] {
      var op = this.op;
      var operands = this.operands;
      var unitValue = this._getUnitValue();
      var zeroValue = this._getZeroValue();

      var simpleOperands: Expression[] = [];
      for (let operand of operands) {
        let simpleOperand = operand.simplify();

        if (simpleOperand instanceof LiteralExpression) {
          if (unitValue !== null && simpleOperand.value === unitValue) continue;
          if (zeroValue !== null && simpleOperand.value === zeroValue) return [simpleOperand];
        }

        if (simpleOperand.isOp(op)) {
          simpleOperands = simpleOperands.concat((<NaryExpression>simpleOperand).operands);
        } else {
          simpleOperands.push(simpleOperand);
        }
      }

      return simpleOperands;
    }

    protected _specialSimplify(simpleOperands: Expression[]): Expression {
      return null;
    }

    protected _simpleFromOperands(operands: Expression[]): Expression {
      if (operands.length === 1) return operands[0];

      if (operands.length === 0) {
        var unitValue = this._getUnitValue();
        if (unitValue !== null) {
          return new LiteralExpression({ op: 'literal', value: unitValue });
        }
      }

      var simpleValue = this.valueOf();
      simpleValue.operands = operands;
      simpleValue.simple = true;
      return new (Expression.classMap[this.op])(simpleValue);
    }

    public simplify(): Expression {
      if (this.simple) return this;
      var simpleOperands: Expression[] = this._getSimpleOperands();

      var special = this._specialSimplify(simpleOperands);
      if (special) return special;

      var literalOperands = simpleOperands.filter(operand => operand.isOp('literal')); // ToDo: add hasRemote and better call
      var nonLiteralOperands = simpleOperands.filter(operand => !operand.isOp('literal'));
      var literalExpression = new LiteralExpression({
        op: 'literal',
        value: this._getFnHelper(literalOperands.map(operand => operand.getFn()))(null)
      });

      if (nonLiteralOperands.length) {
        if (literalOperands.length) nonLiteralOperands.push(literalExpression);
        return this._simpleFromOperands(nonLiteralOperands);
      } else {
        return literalExpression
      }
    }

    public _everyHelper(iter: BooleanExpressionIterator, thisArg: any, indexer: Indexer, depth: int, nestDiff: int): boolean {
      var pass = iter.call(thisArg, this, indexer.index, depth, nestDiff);
      if (pass != null) {
        return pass;
      } else {
        indexer.index++;
      }

      return this.operands.every(operand => operand._everyHelper(iter, thisArg, indexer, depth + 1, nestDiff));
    }

    public _substituteHelper(substitutionFn: SubstitutionFn, thisArg: any, indexer: Indexer, depth: int, nestDiff: int): Expression {
      var sub = substitutionFn.call(thisArg, this, indexer.index, depth, nestDiff);
      if (sub) {
        indexer.index += this.expressionCount();
        return sub;
      } else {
        indexer.index++;
      }

      var subOperands = this.operands.map(operand => operand._substituteHelper(substitutionFn, thisArg, indexer, depth + 1, nestDiff));
      if (this.operands.every((op, i) => op === subOperands[i])) return this;

      var value = this.valueOf();
      value.operands = subOperands;
      delete value.simple;
      return new (Expression.classMap[this.op])(value);
    }

    protected _getFnHelper(operandFns: ComputeFn[]): ComputeFn {
      throw new Error("should never be called directly");
    }

    public getFn(): ComputeFn {
      return this._getFnHelper(this.operands.map(operand => operand.getFn()));
    }

    protected _getJSExpressionHelper(operandJSExpressions: string[]): string {
      throw new Error("should never be called directly");
    }

    public getJSExpression(datumVar: string): string {
      return this._getJSExpressionHelper(this.operands.map(operand => operand.getJSExpression(datumVar)));
    }

    protected _getSQLHelper(operandSQLs: string[], dialect: SQLDialect, minimal: boolean): string {
      throw new Error('should never be called directly');
    }

    public getSQL(dialect: SQLDialect, minimal: boolean = false): string {
      return this._getSQLHelper(this.operands.map(operand => operand.getSQL(dialect, minimal)), dialect, minimal);
    }

    protected _checkTypeOfOperands(wantedType: string): void {
      var operands = this.operands;
      for (var i = 0; i < operands.length; i++) {
        if (!operands[i].canHaveType(wantedType)) {
          throw new TypeError(this.op + ' must have an operand of type ' + wantedType + ' at position ' + i);
        }
      }
    }

    public _fillRefSubstitutions(typeContext: FullType, indexer: Indexer, alterations: Alterations): FullType {
      indexer.index++;
      var remotes = this.operands.map(operand => operand._fillRefSubstitutions(typeContext, indexer, alterations).remote);
      return {
        type: this.type,
        remote: mergeRemotes(remotes)
      };
    }
  }
}
