module Facet {
  export interface SetValue {
    setType: string;
    elements: Lookup<any>;
  }

  export interface SetJS {
    setType: string;
    elements: Array<any>;
  }

  function dateString(date: Date): string {
    return date.toISOString();
  }

  function hashFromJS(xs: Array<string>, setType: string): Lookup<any> {
    var keyFn: (v: any) => string = setType === 'TIME' ? dateString : String;
    var hash: Lookup<any> = Object.create(null);
    for (let xv of xs) {
      var x = valueFromJS(xv, setType);
      hash[keyFn(x)] = x;
    }
    return hash;
  }

  function hashToValues(hash: Lookup<any>): Array<any> {
    return Object.keys(hash).sort().map(k => hash[k]);
  }

  function unifyElements(elements: Lookup<Range<any>>): Lookup<Range<any>> {
    var newElements: Lookup<Range<any>> = Object.create(null);
    for (var k in elements) {
      var accumulator = elements[k];
      var newElementsKeys = Object.keys(newElements);
      for (let newElementsKey of newElementsKeys) {
        var newElement = newElements[newElementsKey];
        var unionElement = accumulator.union(newElement);
        if (unionElement) {
          accumulator = unionElement;
          delete newElements[newElementsKey];
        }
      }
      newElements[accumulator.toString()] = accumulator;
    }
    return newElements;
  }

  function intersectElements(elements1: Lookup<Range<any>>, elements2: Lookup<Range<any>>): Lookup<Range<any>> {
    var newElements: Lookup<Range<any>> = Object.create(null);
    for (var k1 in elements1) {
      var element1 = elements1[k1];
      for (var k2 in elements2) {
        var element2 = elements2[k2];
        var intersect = element1.intersect(element2);
        if (intersect) newElements[intersect.toString()] = intersect;
      }
    }
    return newElements;
  }

  var typeUpgrades: Lookup<string> = {
    'NUMBER': 'NUMBER_RANGE',
    'TIME': 'TIME_RANGE'
  };

  var check: ImmutableClass<SetValue, SetJS>;
  export class Set implements ImmutableInstance<SetValue, SetJS> {
    static type = 'SET';
    static EMPTY: Set;

    static isSet(candidate: any): boolean {
      return isInstanceOf(candidate, Set);
    }

    static convertToSet(thing: any): Set {
      var thingType = getValueType(thing);
      if (thingType.indexOf('SET/') === 0) return thing;
      return Set.fromJS({ setType: thingType, elements: [thing] });
    }

    static generalUnion(a: any, b: any): any {
      var aSet = Set.convertToSet(a);
      var bSet = Set.convertToSet(b);
      var aSetType = aSet.setType;
      var bSetType = bSet.setType;

      if (typeUpgrades[aSetType] === bSetType) {
        aSet = aSet.upgradeType();
      } else if (typeUpgrades[bSetType] === aSetType) {
        bSet = bSet.upgradeType();
      } else if (aSetType !== bSetType) {
        return null;
      }

      return aSet.union(bSet).simplify();
    }

    static generalIntersect(a: any, b: any): any {
      var aSet = Set.convertToSet(a);
      var bSet = Set.convertToSet(b);
      var aSetType = aSet.setType;
      var bSetType = bSet.setType;

      if (typeUpgrades[aSetType] === bSetType) {
        aSet = aSet.upgradeType();
      } else if (typeUpgrades[bSetType] === aSetType) {
        bSet = bSet.upgradeType();
      } else if (aSetType !== bSetType) {
        return null;
      }

      return aSet.intersect(bSet).simplify();
    }

    static fromJS(parameters: Array<any>): Set;
    static fromJS(parameters: SetJS): Set;
    static fromJS(parameters: any): Set {
      if (Array.isArray(parameters)) {
        parameters = { elements: parameters };
      }
      if (typeof parameters !== "object") {
        throw new Error("unrecognizable set");
      }
      var setType = parameters.setType;
      var elements = parameters.elements;
      if (!setType) {
        setType = getValueType(elements.length ? elements[0] : null);
      }
      return new Set({
        setType: setType,
        elements: hashFromJS(elements, setType)
      });
    }

    public setType: string;
    public elements: Lookup<any>;

    constructor(parameters: SetValue) {
      var setType = parameters.setType;
      this.setType = setType;

      var elements = parameters.elements;
      if (setType === 'NUMBER_RANGE' || setType === 'TIME_RANGE') {
        elements = unifyElements(elements);
      }
      this.elements = elements;
    }

    public valueOf(): SetValue {
      return {
        setType: this.setType,
        elements: this.elements
      };
    }

    public getElements(): any[] {
      return hashToValues(this.elements);
    }

    public toJS(): SetJS {
      return {
        setType: this.setType,
        elements: this.getElements().map(valueToJS)
      };
    }

    public toJSON(): SetJS {
      return this.toJS();
    }

    public toString(): string {
      return 'SET_' + this.setType + '(' + Object.keys(this.elements).length + ')';
    }

    public equals(other: Set): boolean {
      return Set.isSet(other) &&
        this.setType === other.setType &&
        Object.keys(this.elements).sort().join('') === Object.keys(other.elements).sort().join('');
    }

    public empty(): boolean {
      var elements = this.elements;
      for (var k in elements) {
        if (hasOwnProperty(elements, k)) return false;
      }
      return true;
    }

    public simplify(): any {
      var simpleSet = this.downgradeType();
      var simpleSetElements = simpleSet.getElements();
      return simpleSetElements.length === 1 ? simpleSetElements[0] : simpleSet;
    }

    public upgradeType(): Set {
      if (this.setType === 'NUMBER') {
        return Set.fromJS({
          setType: 'NUMBER_RANGE',
          elements: this.getElements().map(NumberRange.fromNumber)
        })
      } else if (this.setType === 'TIME') {
        return Set.fromJS({
          setType: 'TIME_RANGE',
          elements: this.getElements().map(TimeRange.fromTime)
        })
      } else {
        return this;
      }
    }

    public downgradeType(): Set {
      if (this.setType === 'NUMBER_RANGE' || this.setType === 'TIME_RANGE') {
        var elements: Array<Range<any>> = this.getElements();
        var simpleElements: any[] = [];
        for (let element of elements) {
          if (element.degenerate()) {
            simpleElements.push(element.start);
          } else {
            return this;
          }
        }
        return Set.fromJS(simpleElements)
      } else {
        return this;
      }
    }

    public extent(): Range<any> {
      var setType = this.setType;
      if (hasOwnProperty(typeUpgrades, setType)) {
        return this.upgradeType().extent();
      }
      if (setType !== 'NUMBER_RANGE' && setType !== 'TIME_RANGE') return null;
      var elements: Array<Range<any>> = this.getElements();
      var extent: Range<any> = elements[0] || null;
      for (var i = 1; i < elements.length; i++) {
        extent = extent.extend(elements[i]);
      }
      return extent;
    }

    public union(other: Set): Set {
      if (this.empty()) return other;
      if (other.empty()) return this;

      if (this.setType !== other.setType) {
        throw new TypeError("can not union sets of different types");
      }

      var thisValues = this.elements;
      var otherValues = other.elements;
      var newValues: Lookup<any> = {};

      for (var k in thisValues) {
        if (!hasOwnProperty(thisValues, k)) continue;
        newValues[k] = thisValues[k];
      }

      for (var k in otherValues) {
        if (!hasOwnProperty(otherValues, k)) continue;
        newValues[k] = otherValues[k];
      }

      return new Set({
        setType: this.setType,
        elements: newValues
      });
    }

    public intersect(other: Set): Set {
      if (this.empty() || other.empty()) return Set.EMPTY;

      var setType = this.setType;
      if (this.setType !== other.setType) {
        throw new TypeError("can not intersect sets of different types");
      }

      var thisValues = this.elements;
      var otherValues = other.elements;
      var newValues: Lookup<any>;

      if (setType === 'NUMBER_RANGE' || setType === 'TIME_RANGE') {
        newValues = intersectElements(thisValues, otherValues);
      } else {
        newValues = Object.create(null);
        for (var k in thisValues) {
          if (hasOwnProperty(thisValues, k) && hasOwnProperty(otherValues, k)) {
            newValues[k] = thisValues[k];
          }
        }
      }

      return new Set({
        setType: this.setType,
        elements: newValues
      });
    }

    public contains(value: any): boolean {
      return hasOwnProperty(this.elements, String(value));
    }

    public containsWithin(value: any): boolean {
      var elements = this.elements;
      for (var k in elements) {
        if (!hasOwnProperty(elements, k)) continue;
        if ((<NumberRange>elements[k]).contains(value)) return true;
      }
      return false;
    }

    public add(value: any): Set {
      var setType = this.setType;
      var valueType = getValueType(value);
      if (setType === 'NULL') setType = valueType;
      if (setType !== valueType) throw new Error('value type must match');

      var newValues: Lookup<any> = {};
      newValues[String(value)] = value;

      var elements = this.elements;
      for (var k in elements) {
        if (!hasOwnProperty(elements, k)) continue;
        newValues[k] = elements[k];
      }

      return new Set({
        setType: setType,
        elements: newValues
      });
    }

    public label(name: string): Dataset {
      return new NativeDataset({
        source: 'native',
        key: name,
        data: this.getElements().map(v => {
          var datum: Datum = {};
          datum[name] = v;
          return datum
        })
      });
    }

  }
  check = Set;

  Set.EMPTY = Set.fromJS([]);
}
