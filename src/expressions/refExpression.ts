module Facet {
  export var possibleTypes: Lookup<number> = {
    'NULL': 1,
    'BOOLEAN': 1,
    'NUMBER': 1,
    'TIME': 1,
    'STRING': 1,
    'NUMBER_RANGE': 1,
    'TIME_RANGE': 1,
    'SET': 1,
    'SET/NULL': 1,
    'SET/BOOLEAN': 1,
    'SET/NUMBER': 1,
    'SET/TIME': 1,
    'SET/STRING': 1,
    'SET/NUMBER_RANGE': 1,
    'SET/TIME_RANGE': 1,
    'DATASET': 1
  };

  var GENERATIONS_REGEXP = /^\^+/;
  var TYPE_REGEXP = /:([A-Z\/]+)$/;

  export class RefExpression extends Expression {
    static SIMPLE_NAME_REGEXP = /^([a-z_]\w*)$/i;

    static fromJS(parameters: ExpressionJS): RefExpression {
      var value: ExpressionValue;
      if (hasOwnProperty(parameters, 'generations')) {
        value = <any>parameters;
      } else {
        value = {
          op: 'ref',
          generations: 0,
          name: parameters.name,
          type: parameters.type
        }
      }
      return new RefExpression(value);
    }

    static parse(str: string): RefExpression {
      var refValue: ExpressionValue = { op: 'ref' };
      var match: RegExpMatchArray;

      match = str.match(GENERATIONS_REGEXP);
      if (match) {
        var generations = match[0].length;
        refValue.generations = generations;
        str = str.substr(generations);
      } else {
        refValue.generations = 0;
      }

      match = str.match(TYPE_REGEXP);
      if (match) {
        refValue.type = match[1];
        str = str.substr(0, str.length - match[0].length);
      }

      if (str[0] === '{' && str[str.length - 1] === '}') {
        str = str.substr(1, str.length - 2);
      }

      refValue.name = str;
      return new RefExpression(refValue);
    }

    public generations: number;
    public name: string;
    public remote: string[];

    constructor(parameters: ExpressionValue) {
      super(parameters, dummyObject);
      this._ensureOp("ref");

      this.name = parameters.name;
      if (typeof this.name !== 'string' || this.name.length === 0) {
        throw new TypeError("must have a nonempty `name`");
      }

      this.generations = parameters.generations;
      if (typeof this.generations !== 'number') {
        throw new TypeError("must have a generations");
      }

      if (parameters.type) {
        if (!hasOwnProperty(possibleTypes, parameters.type)) {
          throw new TypeError("unsupported type '" + parameters.type + "'");
        }
        this.type = parameters.type;
      }

      if (parameters.remote) this.remote = parameters.remote;
      this.simple = true;
    }

    public valueOf(): ExpressionValue {
      var value = super.valueOf();
      value.name = this.name;
      value.generations = this.generations;
      if (this.type) value.type = this.type;
      if (this.remote) value.remote = this.remote;
      return value;
    }

    public toJS(): ExpressionJS {
      var js = super.toJS();
      js.name = this.name;
      if (this.generations) js.generations = this.generations;
      if (this.type) js.type = this.type;
      return js;
    }

    public toString(): string {
      var str = this.name;
      if (!RefExpression.SIMPLE_NAME_REGEXP.test(str)) {
        str = '{' + str + '}';
      }
      if (this.generations) {
        str = repeat('^', this.generations) + str;
      }
      if (this.type) {
        str += ':' + this.type;
      }
      return '$' + str;
    }

    public getFn(): ComputeFn {
      if (this.generations) throw new Error("can not call getFn on unresolved expression");
      var name = this.name;
      return (d: Datum) => {
        if (hasOwnProperty(d, name)) {
          return d[name];
        } else if (d.$def && hasOwnProperty(d.$def, name)) {
          return d.$def[name];
        } else {
          return null;
        }
      }
    }

    public getJSExpression(): string {
      if (this.generations) throw new Error("can not call getJSExpression on unresolved expression");
      return 'd.' + this.name;
    }

    public getSQL(dialect: SQLDialect, minimal: boolean = false): string {
      if (this.generations) throw new Error("can not call getSQL on unresolved expression");
      return '`' + this.name + '`';
    }

    public equals(other: RefExpression): boolean {
      return super.equals(other) &&
        this.name === other.name &&
        this.generations === other.generations;
    }

    public isRemote(): boolean {
      return Boolean(this.remote && this.remote.length);
    }

    public _fillRefSubstitutions(typeContext: FullType, indexer: Indexer, alterations: Alterations): FullType {
      var myIndex = indexer.index;
      indexer.index++;
      var generations = this.generations;

      // Step the parentContext back; once for each generation
      var myTypeContext = typeContext;
      while (generations--) {
        myTypeContext = myTypeContext.parent;
        if (!myTypeContext) throw new Error('went too deep on ' + this.toString());
      }

      // Look for the reference in the parent chain
      var genBack = 0;
      while (myTypeContext && !myTypeContext.datasetType[this.name]) {
        myTypeContext = myTypeContext.parent;
        genBack++;
      }
      if (!myTypeContext) {
        throw new Error('could not resolve ' + this.toString());
      }

      var myFullType = myTypeContext.datasetType[this.name];

      var myType = myFullType.type;
      var myRemote = myFullType.remote;

      if (this.type && this.type !== myType) {
        throw new TypeError("type mismatch in " + this.toString() + " (has: " + this.type + " needs: " + myType + ")");
      }

      // Check if it needs to be replaced
      if (!this.type || genBack > 0 || String(this.remote) !== String(myRemote)) {
        var newGenerations = this.generations + repeat('^', genBack);
        alterations[myIndex] = new RefExpression({
          op: 'ref',
          name: newGenerations + this.name,
          type: myType,
          remote: myRemote
        })
      }

      if (myType === 'DATASET') {
        return {
          parent: typeContext,
          type: 'DATASET',
          datasetType: myFullType.datasetType,
          remote: myFullType.remote
        };
      }

      return myFullType;
    }
  }

  Expression.register(RefExpression);
}
