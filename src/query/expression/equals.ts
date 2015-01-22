"use strict";

import CommonModule = require("../common");
import specialJoin = CommonModule.specialJoin;
import find = CommonModule.find;
import dummyObject = CommonModule.dummyObject;

import BaseModule = require('./base');
import Expression = BaseModule.Expression;
import ExpressionJS = BaseModule.ExpressionJS;
import ExpressionValue = BaseModule.ExpressionValue;
import BinaryExpression = BaseModule.BinaryExpression;

export class EqualsExpression extends BinaryExpression {
  static fromJS(parameters: ExpressionJS): EqualsExpression {
    return new EqualsExpression(BinaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue = {}) {
    super(parameters, dummyObject);
    this._ensureOp("equals");
  }

  public toString(): string {
    return this.lhs.toString() + ' = ' + this.rhs.toString();
  }

  public simplify(): EqualsExpression {
    return this
  }

  protected _makeFn(lhsFn: Function, rhsFn: Function): Function {
    return (d: any) => lhsFn(d) === rhsFn(d);
  }
}

Expression.classMap["equals"] = EqualsExpression;