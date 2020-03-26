import * as fs from 'fs';
import * as path from 'path';
import * as languageserver from 'vscode-languageserver';
import * as uri from 'vscode-uri';
import * as doc from './lib/doc';
import * as xlsxJson from './lib/xlsx2json';
import * as luasign from './lib/luasign';

import { 
    TextDocument,
    CompletionItemKind,
    Range,
    Position,
} from 'vscode-languageserver-protocol';

import { 
    API,
    Ref,
} from './interface';

const adds = require('autodetect-decoder-stream');


const FUNCTIONS_APIS = require('../../apis/functions');
const INHERITS_APIS = require('../../apis/inherits');

let UNITY_TYPE_MAP = {
    'Button': 'UnityEngine.UI.Button',
    'Image': 'UnityEngine.UI.Image',
    'Text': 'UnityEngine.UI.Text',
    'GameObject': 'UnityEngine.GameObject',
};

let timeoutParseFile: NodeJS.Timeout;

class Assistor {

    private _mapUris: {[prefix: string]: string} = {};
    private _files: string[] = [];
    private _documents: {[uri: string]: TextDocument} = {};


    private _belongModules: {[key: string]: string[]} = {};
    private _aliasMap: {[key: string]: string} = {};
    private _belongMap: {[key: string]: string} = {};
    private _dictLuaApis: {[module: string]: API[]} = {};

    private _refMap: {[prefix: string]: Ref} = {};

    private _settingConfig: any = undefined;

    private _refList: string[] = [];

    private _workspaceFolder = '';

    private _currentActiveFile = '';

    private _varMapType: {[key: string]: string} = {};

    constructor() {
       
    }

    init(params: languageserver.InitializeParams) {

        let workspaceFolders = (params.workspaceFolders || []).map(folder => {
            return uri.default.parse(folder.uri).fsPath;
        });

        this._workspaceFolder = workspaceFolders[0] + '\\';
    }

    public setCurrentActiveFile(filePath: string) {
        let _2 = filePath.indexOf('.lua');
        if (_2 === 0) {
            return;
        }

        let _1 = filePath.lastIndexOf('\\');
        this._currentActiveFile = filePath.slice(_1 + 1, _2);
    }


    public setSettingConfig(config: any) {
        this._settingConfig = config;
    }

    public getSettingConfig() {
        return this._settingConfig;
    }

    public getSettingAliasModule(prefix: string): string[]|undefined {
        if (!this._settingConfig) {
            return undefined;
        }

        if (!this._settingConfig.aliasModules) {
            return undefined;
        }

        return this._settingConfig.aliasModules[prefix];
    }


    public getLuaApis() {
        return this._dictLuaApis;
    }

    private matchGobalApis(matchWord: string): API[] {
        return this.matchApis(this._dictLuaApis['_G'], matchWord);
    }

    private matchLocalApis(matchWord: string): API[] {
        let apis = this._dictLuaApis[this._currentActiveFile];

        let result: API[] = [];

        for (let i = 0; i < apis.length; ++i) {
            let api = apis[i];
            if (api.scope === 'local' && api.sign.indexOf(matchWord) === 0) {
                result.push(api);
            }
       }

        return result;
    }

    private matchApis(srcApis: API[], matchWord: string): API[] {
        let result: API[] = [];

        if (!srcApis) {
            return result;
        }

        for (let i = 0; i < srcApis.length; ++i) {
            let api = srcApis[i];
            if (api.sign.indexOf(matchWord) === 0) {
                result.push(api);
            }
       }

        return result;
    }

    public getAllApis(): API[] {
        return this.getLuaAllApis();
    }

    public getLuaAllApis() {
        let result: API[] = [];
        
        let t_dict: {[k: string]: number} = {};
        for (let prefix in this._dictLuaApis) {
            let apis = this._dictLuaApis[prefix];
            for (let i = 0; i < apis.length; ++i) {
                if (!t_dict[apis[i].sign]) {
                    result.push({
                        'sign': apis[i].sign,
                        'detail': prefix,
                        'kind': CompletionItemKind.Function,
                        'site': apis[i].site,
                        'scope': 'public',
                    });
                    t_dict[apis[i].sign] = 1;
                }
            }
        }

        return result;
    }

    private findChildrenApisByPrefix(apis: API[], prefix: string) {
        let result: API[] = [];

        for (let i = 0; i < apis.length; ++i) {
            let api = apis[i];

            if (api.sign === prefix && api.children) {
                apis = api.children;
                for (let j = 0; j < apis.length; ++j) {
                    result.push(apis[j]);        
                }
            }
        }

        return result;
    }

    private mergeApis(apis1: API[], apis2: API[]) {
        for (let i = 0; i < apis2.length; ++i) {
            apis1.push(apis2[i]);
        }

        return apis1;
    }

    private getActiveModuleApis() {
        return this._dictLuaApis[this._currentActiveFile];
    }


    private findChildrenApi(srcApi: API, prefix: string) {
        let tempApi: API|null = null;

        if (!srcApi.children) {
            return tempApi;
        }

        for (let i = 0; i < srcApi.children.length; ++i) {
            if (srcApi.children[i].sign === prefix) {
                tempApi = srcApi.children[i];
                break;
            }
        }

        return tempApi;
    }

    private matchChildrenApis(srcApi: API|null, prefixs: string[]) {
        let apis: API[] = [];

        if (srcApi) {
            for (let i = 1; i < prefixs.length; ++i) {
                if (srcApi) {
                    srcApi = this.findChildrenApi(srcApi, prefixs[i]);
                }
            }

            if (srcApi) {
                if (srcApi.children) {
                    for (let i = 0; i < srcApi.children.length; ++i) {
                        apis.push(srcApi.children[i]);
                    }
                }
            }
        }

        return apis;
    }

    private matchLocalApiByPrefix(prefixs: string[], realPrefixs: string[]) {
        let apis: API[] = [];

        let curApi: API|null = null;
        let moduleApis = this.getActiveModuleApis();

        if (prefixs.length > 0) {
            for (let i = 0; i < moduleApis.length; ++i) {
                if (moduleApis[i].sign === prefixs[0] || moduleApis[i].sign === realPrefixs[0]) {
                    curApi = moduleApis[i];
                    break;
                }
            }
        }

        if (curApi) {
            apis = this.matchChildrenApis(curApi, prefixs);
        }

        return apis;
    }

    private matchGlobalApiByPrefix(prefixs: string[], realPrefixs: string[]) {
        let apis: API[] = [];
       
        let moduleApis = this._dictLuaApis['_G'];
        if (!moduleApis) {
            return apis;
        }

        let curApi: API|null = null;

        if (prefixs.length > 0) {
            for (let i = 0; i < moduleApis.length; ++i) {
                if (moduleApis[i].sign === prefixs[0] || moduleApis[i].sign === realPrefixs[0]) {
                    curApi = moduleApis[i];
                    break;
                }
            }
        }

        if (curApi) {
            apis = this.matchChildrenApis(curApi, prefixs);
        }

        return apis;
    }

    private matchMemberApiByPrefix(prefixs: string[], realPrefixs: string[]) {
        let apis: API[] = [];
       
        let moduleApis = this._dictLuaApis[prefixs[0]];
        if (!moduleApis) {
            return apis;
        }

        let curApi: API|null = null;

        if (prefixs.length > 0) {
            for (let i = 0; i < moduleApis.length; ++i) {
                if (moduleApis[i].sign === prefixs[1] || moduleApis[i].sign === realPrefixs[1]) {
                    curApi = moduleApis[i];
                    break;
                }
            }
        }

        if (curApi) {
            let arr = prefixs.slice(1);
            apis = this.matchChildrenApis(curApi, arr);
        }

        return apis;
    }

    public getNativeApis(prefixs: string[], realPrefixs: string[], triggerCharacter: string) {
        let apis: API[] = [];

        let unityType = this._varMapType[prefixs[0] + '.' + realPrefixs[1]];

        if (!unityType) {
            return apis;
        }

        let walkApi = function(unityType: string) {
            let jsonApis = FUNCTIONS_APIS[unityType];
            if (!jsonApis) {
                return;
            }
    
            if (triggerCharacter === '.') {
                let varApis = jsonApis.variables;
    
                for (let i = 0; i < varApis.length; ++i) {
                    let varApi = varApis[i];
                    let detail = ['{ '];
                    if (varApi[1]) {
                        detail.push('get');
                        if (varApi[2]) {
                            detail.push(' , ');
                        }
                    } 
                    if (varApi[2]) {
                        detail.push('set');
                    } 
                    detail.push(' }');
    
                    apis.push({
                        'sign': varApi[0],
                        'site': unityType,
                        'scope': "member",
                        'kind': CompletionItemKind.Variable,
                        'indexer': '.',
                        'detail': detail.join(''),
                    });
                }
            } else {
                let funcApis = jsonApis.functions;
    
                for (let i = 0; i < funcApis.length; ++i) {
                    let funcApi = funcApis[i];
                    apis.push({
                        'sign': funcApi,
                        'site': unityType,
                        'scope': "member",
                        'kind': CompletionItemKind.Function,
                        'indexer': '.',
                        'detail': 'Native',
                    });
                }
            }

            if (INHERITS_APIS[unityType]) {
                walkApi(INHERITS_APIS[unityType]);
            }
            
        };

        walkApi(unityType);

        return apis;
    }

    public getLuaApisByPrefix(prefixs: string[], realPrefixs: string[], triggerCharacter: string, matchWord?: string): API[]|undefined {
        prefixs = prefixs.reverse();
        realPrefixs = realPrefixs.reverse();

        let apis: API[] = [];

        // native
        apis = this.getNativeApis(prefixs, realPrefixs, triggerCharacter);
        if (apis.length > 0) {
            return apis;
        }

        // lua
        if (this._refList.indexOf(prefixs.join('.')) > -1) {
            let temp_apis = this._dictLuaApis[prefixs[prefixs.length - 1]];
            if (temp_apis) {
                for (let i = 0; i < temp_apis.length; ++i) {
                    let api = temp_apis[i];
                    if (api.scope === "member") {
                        if (api.indexer === triggerCharacter) {
                            apis.push(api);
                        }
                        
                    }
                    
                }
                return apis;
            }
            
        }

        // 
        if (prefixs.length === 0 && matchWord) {
            apis = this.mergeApis(this.matchLocalApis(matchWord), this.matchGobalApis(matchWord));
            return apis;
        } 

        apis = this.matchLocalApiByPrefix(prefixs, realPrefixs);
        this.mergeApis(apis, this.matchGlobalApiByPrefix(prefixs, realPrefixs));
        if (apis.length > 0) {
            return apis;
        }

        if (prefixs.length === 1) {

            let apis: API[] = [];
            let all_apis = this._dictLuaApis[prefixs[0]];
   
            if (all_apis) {
                for (let i = 0; i < all_apis.length; ++i) {
                    let tmp_api = all_apis[i];
                    if (tmp_api.sign === "M") {
                        if (tmp_api.children) {
                            for (let i = 0; i < tmp_api.children.length; ++i) {
                                apis.push(tmp_api.children[i]);
                            }
                        }
                
                    } else if (all_apis[i].scope === "member") {
                        apis.push(all_apis[i]);
                    }
                }
            }
            
            if (apis.length > 0) {
                return apis;
            }
        }

        apis = this.matchMemberApiByPrefix(prefixs, realPrefixs);
        
        return apis;
    }

    public getLuaApi(prefixs: string[], realPrefixs: string[], sign: string): API|undefined {

        prefixs = prefixs.reverse();

        let apis = this._dictLuaApis[prefixs[0]];
        apis = this.getAlialApis(apis, prefixs[0], realPrefixs[0]);

        if (this._refList.indexOf(prefixs.join('.')) > -1) {
            apis = this._dictLuaApis[prefixs[1]];
        } else {
            if (prefixs.length >= 2) {
                for (let i = 1; i < prefixs.length; ++i) {
                    apis = this.findChildrenApisByPrefix(apis, prefixs[i]);
                }
            }
        }

        if (!apis || apis.length === 0) {
            apis = this.matchGobalApis(sign);
            if (!apis) {
                return undefined;
            }
        }

        let result = undefined;

        for (let i = 0; i < apis.length; ++i) {
            if (apis[i].sign === sign) {
                result = apis[i];
                break;
            }
        }

        if (result) {
            return result;
        }

        const aliasModule = this.getSettingAliasModule(prefixs[0]);
        if (aliasModule) {
            for (let i = 0; i < aliasModule.length; ++i) {
                let aliasApis = this._dictLuaApis[aliasModule[i]] || [];
                for (let i = 0; i < aliasApis.length; ++i) {
                    if (aliasApis[i].sign === sign) {
                        result = aliasApis[i];
                        break;
                    }
                }
            }
        }

        return result;
    }
    
    public getAlialApis(apis: API[], prefix: string, realPrefix: string) {
        if (!apis) {
            return [];
        }

        let result: API[] = [];
        
        for (let i = 0; i < apis.length; ++i) {
            if (realPrefix === 'M' || realPrefix === '_M') {
                result.push(apis[i]);
            } else {
                if (!apis[i].scope || apis[i].scope !== 'private') {
                    result.push(apis[i]);
                }
            }
        }
        
        const belongModules = this._belongModules[prefix];
        if (belongModules) {
            for (let k = 0; k < belongModules.length; ++k) {
                let apis = this._dictLuaApis[belongModules[k]] || [];
                for (let i = 0; i < apis.length; ++i) {
                    if (realPrefix === 'M' || realPrefix === '_M') {
                        result.push(apis[i]);
                    } else {
                        result.push(apis[i]);
                    }
                }
            }
        }
        return result;
    }

    public mapPrefix(basename: string, prefix: string): string {
        if (prefix === 'self' || prefix === 'M' || prefix === '_M') {
            prefix = basename;
        }

        let refMap = this._refMap;
        if (refMap[prefix]) {
            prefix = refMap[prefix].ref;
        }

        // if (this._belongMap[basename]) {
        //     prefix = this._belongMap[basename];
        // }

        if (this._aliasMap[prefix]) {
            prefix = this._aliasMap[prefix];
        }

        return prefix;
    } 

    public getUri(prefix: string) {
        return this._mapUris[prefix];
    }

    public getDocument(basename: string) {
        basename = path.basename(basename, path.extname(basename));
        return this._documents[basename];
    }

    public updateDocument(document: TextDocument) {
        const basename = path.basename(document.uri, path.extname(document.uri));
        this._documents[basename] = document;

        clearTimeout(timeoutParseFile);
        timeoutParseFile = setTimeout(() => {
            this.parseFile(document);
        }, 1000);
    }

    private isIgnoreFile(file: string): boolean {
        let parseFiles = this._settingConfig.parseFiles || [];

        for (let i = 0; i < parseFiles.length; i++) {
            const element = parseFiles[i];
            
            if (file.indexOf(element) > -1) {
                return false;
            }
        } 

        if (file.indexOf('.lua') === -1) {
            return true;
        }

        if (file.indexOf('.meta') > 0) {
            return true;
        }

        if (file.indexOf('\\config/') > 0) {
            return true;
        }

        file = path.normalize(file).replace(new RegExp(/\\/g), '/');

        let ignoreFiles = this._settingConfig.ignoreFiles || ["/pb/"];
        
        for (let i = 0; i < ignoreFiles.length; i++) {
            const element = ignoreFiles[i];
            
            
            if (file.indexOf(element) > -1) {
                return true;
            }
        }

        return false;
    }

    public searchFiles(onFile: any) {
        let dirs = this._settingConfig.dirs || [];

        let folders = [];

        for (let i = 0; i < dirs.length; i++) {
            folders.push(this._workspaceFolder + dirs[i]);
        }


        this._files = [];
        let k = 0;

        for (let i = 0; i < folders.length; i++) {
            doc.searchFile(folders[i], (file: string) => {
                if (!this.isIgnoreFile(file)) {
                    console.log(file);
                    this._files.push(path.normalize(file));
                }
            }, () => {
                // console.log('遍历完成');
                ++k;
                if (k === folders.length) {
                    this.parseFiles(onFile);
                }
                
            });
        }
    }

    private async parseFiles(onFile: any) {
        for (let i = 0; i < this._files.length; i++) {
            const file = this._files[i];
            onFile({
                file: file,
                total: this._files.length,
                index: i + 1,
            });

            const doc = await this.document(file);
            this.parseFile(doc);

            const basename = path.basename(file, path.extname(file));
            this._documents[basename] = doc; 

            this._mapUris[basename] = file;
        }

        // console.log(this._dictLuaApis);
    }

    private appendApiToDictLua(moduleName: string, api: API) {
        if (!this._dictLuaApis[moduleName]) {
            this._dictLuaApis[moduleName] = [];
        }

        let isExist = false;
        for (let i = 0 ; i < this._dictLuaApis[moduleName].length; ++i) {
            let tApi = this._dictLuaApis[moduleName][i];
            if (tApi.sign === api.sign && tApi.site === api.site) {
                isExist = true;
            }
        }

        if (isExist === false) {
            this._dictLuaApis[moduleName].push(api);
        }
    }   

    private dealFunctionSign(fileName: string, document: TextDocument, lineIndex: number, localVariables: string[]) {

        let sign =  luasign.checkFunctionSign(document, lineIndex);
        if (sign.valid === false) {
            return false;
        }

        let api = sign.api;
        if (api === undefined) {
            return false;
        }

        api.site = fileName;
        api.detail = doc.getLineText(document, lineIndex);
        if (api.documentation) {
            api.documentation = api.documentation;
        }

        if (api.base) {
            if (api.base === 'M') {
                this.appendApiToDictLua(fileName, api);
            } else {
                this.appendApiToDictLua(api.base, api);
            }
        } else {
            if (api.scope === 'local') {
                this.appendApiToDictLua(fileName, api);
            } else {    // 'gobal'
                this.appendApiToDictLua('_G', api);
            }
        }


        return true;
    }

    private dealVariableSign(fileName: string, document: TextDocument, lineIndex: number, localVariables: string[]) {
        let sign = luasign.checkVariableSign(document, lineIndex);
        if (sign.valid === false) {
            return false;
        }

        let api = sign.api;
        if (api === undefined) {
            return false;
        } 

        api.site = fileName;
        api.detail = doc.getLineText(document, lineIndex);
        
        if (api.scope === 'local') {
            this.appendApiToDictLua(fileName, api);
        } else if (api.scope === 'gobal') {
            this.appendApiToDictLua('_G', api);
        } else if (api.scope === 'member') {
            if (api.base === 'M' || api.base === 'self') {
                this.appendApiToDictLua(fileName, api);
            } else {
                if (api.base) {
                    if (this._aliasMap[api.base] === fileName) {
                        this.appendApiToDictLua(fileName, api);
                    } else {
                        this.appendApiToDictLua(api.base, api);
                    }
                }
            }
        }

        return true;
    }

    private dealBelongTag(fileName: string, document: TextDocument, lineIndex: number) {
        const line = doc.getLineText(document, lineIndex);
        let pos = line.indexOf("-- @belong");
        if (pos === -1) {
            return false;
        }

        let belong = line.substring(pos + '-- @belong'.length).trim();

        // if (!this._belongMap[belong]) {
        //     this._belongMap[belong] = [];
        // }
        // if (this._belongMap[belong].indexOf(fileName) === -1) {
        //     this._belongMap[belong].push(fileName);
        // }

        this._belongMap[fileName] = belong;

        

        return true;
    }


    private dealUnityTypeTag(fileName: string, document: TextDocument, lineIndex: number) {
        const line = doc.getLineText(document, lineIndex);
        let pos = line.indexOf("-- @unity.type");
        if (pos === -1) {
            return false;
        }

        let reference = line.substring(pos + '-- @unity.type'.length).trim();

        const signInfo = luasign.checkReferenceTag(document, lineIndex + 1);

        let base = signInfo.base;
        if (base.length === 0) {
            return false;
        }

        this._varMapType[fileName + '.' + signInfo.sign] = reference;

        return true;
    } 

    private dealTypeTag(fileName: string, document: TextDocument, lineIndex: number) {
        const line = doc.getLineText(document, lineIndex);
        let pos = line.indexOf("-- @type");
        if (pos === -1) {
            return false;
        }

        let reference = line.substring(pos + '-- @type'.length).trim();

        const signInfo = luasign.checkReferenceTag(document, lineIndex + 1);

        let base = signInfo.base;
        if (base.length === 0) {
            return false;
        }

        // this._varMapType[fileName + '.' + signInfo.sign] = reference;


        if (base === 'self' || base === 'M' || fileName === this._aliasMap[base]) {
            base = fileName;
        }

        if (this._refList.indexOf(base + '.' + reference) === -1) {
            this._refList.push(base + '.' + reference);
        }

        this._refMap[signInfo.sign] = {
            'ref': reference,
            'site': fileName,
        };

        return true;
    }   

    private dealAliasTag(fileName: string, document: TextDocument, lineIndex: number) {
        const line = doc.getLineText(document, lineIndex);
        let pos = line.indexOf("-- @alias");
        if (pos === -1) {
            return false;
        }

        let moduleName = line.substring(pos + '-- @alias'.length).trim();

        this._aliasMap[moduleName] = fileName;

        return true;
    }

    private dealArgsVariableSign(fileName: string, document: TextDocument, lineIndex: number) {
        const line = doc.getLineText(document, lineIndex);
        let pos = line.indexOf("M.args = ");
        if (pos === -1) {
            return false;
        }

        const signInfo = luasign.checkArgsTag(document, lineIndex + 1);
        if (!signInfo) {
            return true;
        }

        let apis = signInfo.apis;
        for (let i = 0; i < apis.length; ++i) {
            this.appendApiToDictLua(fileName, apis[i]);
        }

        let typeMap = signInfo.typeMap;
        for(let key in typeMap) {
            let t = fileName + '.' + key;
            if (typeMap[key] === 'Button') {
                this._varMapType[t] = UNITY_TYPE_MAP.Button;
            } else if (typeMap[key] === 'Image') {
                this._varMapType[t] = UNITY_TYPE_MAP.Image;
            } else if (typeMap[key] === 'Text') {
                this._varMapType[t] = UNITY_TYPE_MAP.Text;
            } else {
                this._varMapType[t] = UNITY_TYPE_MAP.GameObject;
            }
        }

        

        return true;
    }


    private parseFile(document: TextDocument) {
        if (this.isIgnoreFile(path.basename(document.uri))) {
            return;
        }

        let fileName = doc.basename(document.uri);

        this._dictLuaApis[fileName] = [];

        let localVariables: string[] = [];

        let lineIndex = 0;
        while (lineIndex < document.lineCount) {
            const line = doc.getLineText(document, lineIndex);
            
            // console.log(line)

            // if (line.indexOf('-- @unity.type UnityEngine.GameObject') > -1) {
            //     let a = 1;
            // }

            if (line.length === 0) {
                ++lineIndex;
                continue;
            }

            let dealed = false;
            dealed = this.dealFunctionSign(fileName, document, lineIndex, localVariables);
            if (dealed) {
                ++lineIndex;
                continue;
            }

            dealed = this.dealArgsVariableSign(fileName, document, lineIndex);
            if (dealed) {
                ++lineIndex;
                continue;
            }
            

            dealed = this.dealVariableSign(fileName, document, lineIndex, localVariables);
            if (dealed) {
                ++lineIndex;
                continue;
            }

            dealed = this.dealBelongTag(fileName, document, lineIndex);
            if (dealed) {
                ++lineIndex;
                continue;
            }

            dealed = this.dealTypeTag(fileName, document, lineIndex);
            if (dealed) {
                ++lineIndex;
                continue;
            }

            dealed = this.dealUnityTypeTag(fileName, document, lineIndex);
            if (dealed) {
                ++lineIndex;
                continue;
            }

            dealed = this.dealAliasTag(fileName, document, lineIndex);
            if (dealed) {
                ++lineIndex;
                continue;
            }

            ++lineIndex;
        }
    }

    private async document(fileUri: string): Promise<TextDocument> {
        return new Promise<TextDocument>(resolve => {
            let stream = fs.createReadStream(fileUri).pipe(new adds());
            stream.collect((error: any, content: string) => {
                resolve(TextDocument.create(uri.default.file(fileUri).toString(), "lua", 0, content));
            });
        });
    }

    findExports(document: TextDocument) {
        let lineIndex = 0;
        let flag = false;
        while (lineIndex < document.lineCount) {
            const line = doc.getLineText(document, lineIndex);
            if (line.indexOf('local exports = {}') === 0) {
                flag = true;
            }

            ++lineIndex;
        }
    }
}

let _instAssistor: Assistor;

export function crate(connection: languageserver.Connection) {
    if (!_instAssistor) {
        _instAssistor = new Assistor();
    }
}

/**
 * @return {Assistor}
 */
export function getInstance() {
    return _instAssistor;
}