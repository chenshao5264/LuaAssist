
import { 
    CompletionItemKind,
    Range,
} from 'vscode-languageserver-protocol';

export interface API {
    'sign': string;
    'base'?: string;
    'detail'?: string;
    'site'?: string;
    'documentation'?: string;
    'scope'?: string;
    'indexer'?: string;
    'kind'?: CompletionItemKind;
    'range'?: Range;
    'type'?: string;
    'subType'?: string;
    'uri'?: string;
    'data'?: any;
    'children'?: API[];
}

export interface Ref {
    'ref': string;
    'site': string;
}

export interface Call {
    'word': string;
    'sign'?: string;
    'prefix'? :string;
}

export type DICT_API = {[module: string]: API[]};

export interface ModuleInfo {
    'name': string;
}

// // lua interface
// export enum eLuaType {
//     Nil,
//     Number,
//     String,
//     Table,
//     UserData,
// }

// export type LuaType = eLuaType.Nil | eLuaType.Table | eLuaType.Number | eLuaType.String;

// export type LuaString = string;
// export type LuaNumber = number;
// export type LuaNil    = undefined;
// export type LuaTable  = LuaTableKeyString[];

// export type LuaValue = LuaTable | LuaString | LuaNumber | LuaNil;

// export interface LuaChunk {
//     'key'?: string;
//     'bases'?: string[];
//     'indexer'?: string;
//     'value'?: LuaTable | LuaString | LuaNumber | LuaNil;
//     'type'? : eLuaType;
// }

// export interface LuaMemberExpression {
//     'key'?: string;
//     'base'?: string;
//     'indexer'?: string;
// }

// export interface LuaTableConstructorExpression {
//     'tableKeyString'?: LuaTableKeyString[];
// }

// export interface LuaTableKeyString {
//     'key'?: string;
//     'value'?: LuaValue;
// }