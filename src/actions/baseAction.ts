/// <reference path="../datatypes/dataset.ts" />
/// <reference path="../expressions/baseExpression.ts" />

module Facet {
  export interface ActionValue {
    action?: string;
    name?: string;
    expression?: Expression;
    direction?: string;
    limit?: int;
  }

  export interface ActionJS {
    action?: string;
    name?: string;
    expression?: ExpressionJS;
    direction?: string;
    limit?: int;
  }

  export interface ExpressionTransformation {
    (ex: Expression): Expression;
  }

// =====================================================================================
// =====================================================================================

  var checkAction: ImmutableClass<ActionValue, ActionJS>;
  export class Action implements ImmutableInstance<ActionValue, ActionJS> {
    static actionsDependOn(actions: Action[], name: string): boolean {
      for (let action of actions) {
        var freeReferences = action.getFreeReferences();
        if (freeReferences.indexOf(name) !== -1) return true;
        if ((<ApplyAction>action).name === name) return false;
      }
      return false;
    }

    static isAction(candidate: any): boolean {
      return isInstanceOf(candidate, Action);
    }

    static classMap: Lookup<typeof Action> = {};

    static register(act: typeof Action): void {
      var action = (<any>act).name.replace('Action', '').replace(/^\w/, (s: string) => s.toLowerCase());
      Action.classMap[action] = act;
    }

    static fromJS(actionJS: ActionJS): Action {
      if (!hasOwnProperty(actionJS, "action")) {
        throw new Error("action must be defined");
      }
      var action = actionJS.action;
      if (typeof action !== "string") {
        throw new Error("action must be a string");
      }
      var ClassFn = Action.classMap[action];
      if (!ClassFn) {
        throw new Error("unsupported action '" + action + "'");
      }

      return ClassFn.fromJS(actionJS);
    }

    public action: string;
    public expression: Expression;

    constructor(parameters: ActionValue, dummy: Dummy = null) {
      this.action = parameters.action;
      this.expression = parameters.expression;
      if (dummy !== dummyObject) {
        throw new TypeError("can not call `new Action` directly use Action.fromJS instead");
      }
    }

    protected _ensureAction(action: string) {
      if (!this.action) {
        this.action = action;
        return;
      }
      if (this.action !== action) {
        throw new TypeError("incorrect action '" + this.action + "' (needs to be: '" + action + "')");
      }
    }

    public valueOf(): ActionValue {
      var value: ActionValue = {
        action: this.action
      };
      if (this.expression) {
        value.expression = this.expression;
      }
      return value;
    }

    public toJS(): ActionJS {
      var js: ActionJS = {
        action: this.action
      };
      if (this.expression) {
        js.expression = this.expression.toJS();
      }
      return js;
    }

    public toJSON(): ActionJS {
      return this.toJS();
    }

    public equals(other: Action): boolean {
      return Action.isAction(other) &&
        this.action === other.action
    }

    public getSQL(dialect: SQLDialect, minimal: boolean = false): string {
      throw new Error('can not call this directly');
    }

    public expressionCount(): int {
      return this.expression ? this.expression.expressionCount() : 0;
    }

    public simplify(): Action {
      if (!this.expression) return this;
      var value = this.valueOf();
      value.expression = this.expression.simplify();
      return new (Action.classMap[this.action])(value);
    }

    public getFreeReferences(): string[] {
      return this.expression ? this.expression.getFreeReferences() : [];
    }

    public _everyHelper(iter: BooleanExpressionIterator, thisArg: any, indexer: Indexer, depth: int, nestDiff: int): boolean {
      return this.expression ? this.expression._everyHelper(iter, thisArg, indexer, depth, nestDiff) : true;
    }

    /**
     * Performs a substitution by recursively applying the given substitutionFn to the expression
     * if substitutionFn returns an expression than it is replaced and a new actions is returned;
     * if null is returned this action will return
     *
     * @param substitutionFn The function with which to substitute
     * @param thisArg The this for the substitution function
     */
    public substitute(substitutionFn: SubstitutionFn, thisArg?: any): Action {
      return this._substituteHelper(substitutionFn, thisArg, { index: 0 }, 0, 0);
    }

    public _substituteHelper(substitutionFn: SubstitutionFn, thisArg: any, indexer: Indexer, depth: int, nestDiff: int): Action {
      if (!this.expression) return this;
      var subExpression = this.expression._substituteHelper(substitutionFn, thisArg, indexer, depth, nestDiff);
      if (this.expression === subExpression) return this;
      var value = this.valueOf();
      value.expression = subExpression;
      return new (Action.classMap[this.action])(value);
    }

    public applyToExpression(transformation: ExpressionTransformation): Action {
      var expression = this.expression;
      if (!expression) return this;
      var newExpression = transformation(expression);
      if (newExpression === expression) return this;
      var value = this.valueOf();
      value.expression = newExpression;
      return new (Action.classMap[this.action])(value);
    }
  }
  checkAction = Action;
}
