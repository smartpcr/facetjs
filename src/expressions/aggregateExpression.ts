module Facet {
  var fnToSQL: Lookup<string> = {
    count: 'COUNT(',
    sum: 'SUM(',
    average: 'AVG(',
    min: 'MIN(',
    max: 'MAX(',
    countDistinct: 'COUNT(DISTINCT '
  };

  export class AggregateExpression extends UnaryExpression {
    static fromJS(parameters: ExpressionJS): AggregateExpression {
      var value = UnaryExpression.jsToValue(parameters);
      value.fn = parameters.fn;
      if (parameters.attribute) {
        value.attribute = Expression.fromJSLoose(parameters.attribute);
      }
      if (hasOwnProperty(parameters, 'value')) {
        value.value = parameters.value;
      }
      return new AggregateExpression(value);
    }

    public fn: string;
    public attribute: Expression;
    public value: number;

    constructor(parameters: ExpressionValue) {
      super(parameters, dummyObject);
      var fn = parameters.fn;
      this.fn = fn;
      this._ensureOp("aggregate");
      this._checkTypeOfOperand('DATASET');

      if (fn === 'count') {
        if (parameters.attribute) throw new Error(`count aggregate can not have an 'attribute'`);
        this.type = 'NUMBER';
      } else {
        if (!parameters.attribute) throw new Error(`${fn} aggregate must have an 'attribute'`);
        this.attribute = parameters.attribute;
        var attrType = this.attribute.type;
        if (fn === 'group') {
          this.type = attrType ? ('SET/' + attrType) : null;
        } else if (fn === 'min' || fn === 'max') {
          this.type = attrType;
        } else {
          if (fn === 'quantile') {
            if (isNaN(parameters.value)) throw new Error("quantile aggregate must have a 'value'");
            this.value = parameters.value;
          }
          this.type = 'NUMBER';
        }
      }
    }

    public valueOf(): ExpressionValue {
      var value = super.valueOf();
      value.fn = this.fn;
      if (this.attribute) {
        value.attribute = this.attribute;
      }
      if (!isNaN(this.value)) {
        value.value = this.value;
      }
      return value;
    }

    public toJS(): ExpressionJS {
      var js = super.toJS();
      if (this.fn) {
        js.fn = this.fn;
      }
      if (this.attribute) {
        js.attribute = this.attribute.toJS();
      }
      if (!isNaN(this.value)) {
        js.value = this.value;
      }
      return js;
    }

    public toString(): string {
      return this.operand.toString() + '.' + this.fn + '(' + (this.attribute ? this.attribute.toString() : '') + ')';
    }

    public equals(other: AggregateExpression): boolean {
      return super.equals(other) &&
        this.fn === other.fn &&
        Boolean(this.attribute) === Boolean(other.attribute) &&
        (!this.attribute || this.attribute.equals(other.attribute)) &&
        this.value === other.value;
    }

    protected _getFnHelper(operandFn: ComputeFn): ComputeFn {
      var fn = this.fn;
      var attribute = this.attribute;
      var attributeFn = attribute ? attribute.getFn() : null;
      return (d: Datum) => {
        var dataset = operandFn(d);
        if (!dataset) return null;
        return dataset[fn](attributeFn, attribute);
      }
    }

    protected _getJSExpressionHelper(operandFnJS: string): string {
      throw new Error("implement me");
    }

    protected _getSQLHelper(operandSQL: string, dialect: SQLDialect, minimal: boolean): string {
      var operand = this.operand;
      if (operand instanceof RefExpression) {
        var attributeSQL = this.attribute ? this.attribute.getSQL(dialect, minimal) : '1';
        return fnToSQL[this.fn] + attributeSQL + ')';
      }
      throw new Error("can not getSQL with complex operand");
    }

    protected _specialEvery(iter: BooleanExpressionIterator, thisArg: any, indexer: Indexer, depth: int, nestDiff: int): boolean {
      return this.attribute ? this.attribute._everyHelper(iter, thisArg, indexer, depth + 1, nestDiff + 1) : true;
    }

    public _substituteHelper(substitutionFn: SubstitutionFn, thisArg: any, indexer: Indexer, depth: int, nestDiff: int): Expression {
      var sub = substitutionFn.call(thisArg, this, indexer.index, depth, nestDiff);
      if (sub) {
        indexer.index += this.expressionCount();
        return sub;
      } else {
        indexer.index++;
      }

      var subOperand = this.operand._substituteHelper(substitutionFn, thisArg, indexer, depth + 1, nestDiff);
      var subAttribute: Expression = null;
      if (this.attribute) {
        subAttribute = this.attribute._substituteHelper(substitutionFn, thisArg, indexer, depth + 1, nestDiff + 1);
      }
      if (this.operand === subOperand && this.attribute === subAttribute) return this;

      var value = this.valueOf();
      value.operand = subOperand;
      value.attribute = subAttribute;
      delete value.simple;
      return new AggregateExpression(value);
    }

    public expressionCount(): int {
      return 1 + this.operand.expressionCount() + (this.attribute ? this.attribute.expressionCount() : 0);
    }

    public simplify(): Expression {
      if (this.simple) return this;
      var simpleOperand = this.operand.simplify();

      if (simpleOperand instanceof LiteralExpression && !simpleOperand.isRemote()) { // ToDo: also make sure that attribute does not have ^s
        return new LiteralExpression({
          op: 'literal',
          value: this._getFnHelper(simpleOperand.getFn())(null)
        })
      }

      var simpleValue = this.valueOf();
      simpleValue.operand = simpleOperand;
      if (this.attribute) {
        simpleValue.attribute = this.attribute.simplify();
      }
      simpleValue.simple = true;
      return new AggregateExpression(simpleValue)
    }

    public _fillRefSubstitutions(typeContext: FullType, indexer: Indexer, alterations: Alterations): FullType {
      indexer.index++;
      var datasetContext = this.operand._fillRefSubstitutions(typeContext, indexer, alterations);
      var attributeType = 'NUMBER'; // In case of count
      if (this.attribute) {
        attributeType = this.attribute._fillRefSubstitutions(datasetContext, indexer, alterations).type;
      }
      return {
        type: this.fn === 'group' ? ('SET/' + attributeType) : this.type,
        remote: datasetContext.remote
      };
    }

    public decomposeAverage(): Expression {
      if (this.fn !== 'average') return this;

      var sumValue = this.valueOf();
      sumValue.fn = 'sum';
      return new AggregateExpression(sumValue).divide(this.operand.count());
    }

    public distributeAggregates(): Expression {
      var fn = this.fn;
      if (fn !== 'sum') return this; // ToDo: support min and max once those expressions are available

      var attribute = this.attribute;
      var operand = this.operand;
      if (attribute instanceof LiteralExpression) {
        var countAgg = new AggregateExpression({
          op: 'aggregate',
          fn: 'count',
          operand: operand
        });

        if (attribute.value === 1) {
          return countAgg;
        } else {
          return attribute.multiply(countAgg);
        }

      } else if (attribute instanceof AddExpression) {
        return new AddExpression({
          op: 'add',
          operands: attribute.operands.map(attributeOperand => operand.sum(attributeOperand).distributeAggregates())
        });

      } else if (attribute instanceof NegateExpression) {
        return operand.sum(attribute.operand).distributeAggregates().negate();

      } else if (attribute instanceof MultiplyExpression) {
        var attributeOperands = attribute.operands;
        var literalSubExpression: Expression;
        var restOfOperands: Expression[] = [];
        for (let attributeOperand of attributeOperands) {
          if (!literalSubExpression && attributeOperand.isOp('literal')) {
            literalSubExpression = attributeOperand;
          } else {
            restOfOperands.push(attributeOperand);
          }
        }
        if (!literalSubExpression) return this;
        return literalSubExpression.multiply(operand.sum(
          new MultiplyExpression({ op: 'multiply', operands: restOfOperands }).simplify()
        ));

      } else {
        return this; // Nothing to do.
      }
    }
  }

  Expression.register(AggregateExpression);
}
