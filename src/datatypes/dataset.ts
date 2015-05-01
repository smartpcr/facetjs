module Facet {
  export type Attributes = Lookup<AttributeInfo>;

  export interface DatasetValue {
    source: string;
    attributes?: Attributes;
    key?: string;

    // Native
    data?: Datum[];

    // Remote
    rawAttributes?: Attributes;
    requester?: Requester.FacetRequester<any>;
    mode?: string;
    derivedAttributes?: ApplyAction[];
    filter?: Expression;
    split?: Expression;
    defs?: DefAction[];
    applies?: ApplyAction[];
    sort?: SortAction;
    limit?: LimitAction;
    havingFilter?: Expression;
  }

  export interface DatasetJS {
    source: string;
    attributes?: Lookup<AttributeInfoJS>;
    key?: string;

    // Native
    data?: Datum[];

    // Remote
    rawAttributes?: Lookup<AttributeInfoJS>;
    requester?: Requester.FacetRequester<any>;
    filter?: ExpressionJS;
  }

  export function mergeRemoteDatasets(remoteGroups: RemoteDataset[][]): RemoteDataset[] {
    var seen: Lookup<RemoteDataset> = {};
    remoteGroups.forEach((remoteGroup) => {
      remoteGroup.forEach((remote) => {
        var id = remote.getId();
        if (seen[id]) return;
        seen[id] = remote;
      })
    });
    return Object.keys(seen).sort().map((k) => seen[k]);
  }

// =====================================================================================
// =====================================================================================

  var check: ImmutableClass<DatasetValue, any>;
  export class Dataset implements ImmutableInstance<DatasetValue, any> {
    static type = 'DATASET';

    static jsToValue(parameters: any): DatasetValue {
      var value: DatasetValue = {
        source: parameters.source
      };
      var attributes = parameters.attributes;
      if (attributes) {
        if (typeof attributes !== 'object') {
          throw new TypeError("invalid attributes");
        } else {
          var newAttributes: Lookup<AttributeInfo> = Object.create(null);
          for (var k in attributes) {
            if (!hasOwnProperty(attributes, k)) continue;
            newAttributes[k] = AttributeInfo.fromJS(attributes[k]);
          }
          value.attributes = newAttributes;
        }
      }

      return value;
    }

    static isDataset(candidate: any): boolean {
      return isInstanceOf(candidate, Dataset);
    }

    static classMap: Lookup<typeof Dataset> = {};
    static register(ex: typeof Dataset, id: string = null): void {
      if (!id) id = (<any>ex).name.replace('Dataset', '').replace(/^\w/, (s: string) => s.toLowerCase());
      Dataset.classMap[id] = ex;
    }

    static fromJS(datasetJS: any): Dataset {
      if (Array.isArray(datasetJS)) {
        datasetJS = {
          source: 'native',
          data: datasetJS
        }
      } else if (typeof datasetJS === 'function'){
        datasetJS = {
          source: 'remote',
          driver: datasetJS
        }
      }
      if (!hasOwnProperty(datasetJS, "source")) {
        throw new Error("dataset `source` must be defined");
      }
      var source: string = datasetJS.source;
      if (typeof source !== "string") {
        throw new Error("dataset must be a string");
      }
      var ClassFn = Dataset.classMap[source];
      if (!ClassFn) {
        throw new Error("unsupported dataset '" + source + "'");
      }

      return ClassFn.fromJS(datasetJS);
    }

    public source: string;
    public attributes: Attributes = null;
    public key: string = null;

    constructor(parameters: DatasetValue, dummy: Dummy = null) {
      this.source = parameters.source;
      if (dummy !== dummyObject) {
        throw new TypeError("can not call `new Dataset` directly use Dataset.fromJS instead");
      }
      if (parameters.attributes) {
        this.attributes = parameters.attributes;
      }
      if (parameters.key) {
        this.key = parameters.key;
      }
    }

    protected _ensureSource(source: string) {
      if (!this.source) {
        this.source = source;
        return;
      }
      if (this.source !== source) {
        throw new TypeError("incorrect dataset '" + this.source + "' (needs to be: '" + source + "')");
      }
    }

    public valueOf(): DatasetValue {
      var value: DatasetValue = {
        source: this.source
      };
      if (this.attributes) value.attributes = this.attributes;
      if (this.key) value.key = this.key;
      return value;
    }

    public toJS(): any {
      var js: DatasetJS = {
        source: this.source
      };
      if (this.attributes) js.attributes = this.getAttributesJS();
      if (this.key) js.key = this.key;
      return js;
    }

    public getAttributesJS(): Lookup<AttributeInfoJS> {
      var attributesJS: Lookup<AttributeInfoJS> = {};
      var attributes = this.attributes;
      for (var k in attributes) {
        attributesJS[k] = attributes[k].toJS();
      }
      return attributesJS;
    }

    public toString(): string {
      return "Dataset(" + this.source + ")";
    }

    public toJSON(): any {
      return this.toJS();
    }

    public equals(other: Dataset): boolean {
      return Dataset.isDataset(other) &&
        this.source === other.source;
    }

    public getId(): string {
      return this.source;
    }

    public basis(): boolean {
      return false;
    }

    public getFullType(): FullType {
      var attributes = this.attributes;
      if (!attributes) throw new Error("dataset has not been introspected");
      
      var remote = this.source === 'native' ? null : [this.getId()];

      var myDatasetType: Lookup<FullType> = {};
      for (var attrName in attributes) {
        if (!hasOwnProperty(attributes, attrName)) continue;
        var attrType = attributes[attrName];
        if (attrType.type === 'DATASET') {
          myDatasetType[attrName] = {
            type: 'DATASET',
            datasetType: attrType.datasetType
          };
        } else {
          myDatasetType[attrName] = {
            type: attrType.type
          };
        }
        if (remote) {
          myDatasetType[attrName].remote = remote;
        }
      }
      var myFullType: FullType = {
        type: 'DATASET',
        datasetType: myDatasetType
      };
      if (remote) {
        myFullType.remote = remote;
      }
      return myFullType;
    }

    public hasRemote(): boolean {
      return false;
    }

    public getRemoteDatasets(): RemoteDataset[] {
      throw new Error("can not call this directly");
    }

    public getRemoteDatasetIds(): string[] {
      throw new Error("can not call this directly");
    }
  }
  check = Dataset;
}
