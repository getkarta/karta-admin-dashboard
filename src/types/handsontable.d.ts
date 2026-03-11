declare module 'handsontable' {
  export interface GridSettings {
    data: any[];
    colHeaders?: string[];
    columns?: any[];
    licenseKey?: string;
    [key: string]: any;
  }

  export interface CellTypes {
    registerCellType(name: string, cellType: any): void;
    Numeric: any;
  }

  export default class Handsontable {
    constructor(container: HTMLElement, options: GridSettings);
    static registerPlugin(plugin: any): void;
    static cellTypes: CellTypes;
  }
} 