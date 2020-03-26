import { 
    Range,
    Position,
    TextDocument,
    CompletionItemKind
} from 'vscode-languageserver-protocol';

import * as doc from './doc';
import * as luaparse from 'luaparse';
import * as luajs from './luajs';

import { 
    LuaValue,
} from './luajs';

import { 
    API,
} from '../interface';

export function checkFunctionSign(document: TextDocument, lineIndex: number) {
    let line = doc.getLineText(document, lineIndex);

    if (line.indexOf('function') === -1) {
        return {'valid': false, 'api': undefined};
    }

    let api: API = {
        'sign': '',
    };

    let out = {
        'valid': false,
        'api': api,
    };
    
    let elememts = parseLineElememts(line);

    if (elememts.length === 0) {
        return out;
    }

    if (isMemberFunctionDeclaration(elememts)) {
        out.valid = true;
        api.base = elememts[1].value;
        api.indexer = elememts[2].value;
        api.sign = elememts[3].value;
        api.scope = 'member';
        api.range = Range.create(
            Position.create(lineIndex, elememts[3].range[0]),
            Position.create(lineIndex + 1, 0),
        );
    } else if (isGobalFunctionDeclaration(elememts)) {
        out.valid = true;
        api.sign = elememts[1].value;
        api.scope = 'gobal';
        api.range = Range.create(
            Position.create(lineIndex, elememts[1].range[0]),
            Position.create(lineIndex + 1, 0),
        );
    } else if (isLocalFunctionDeclaration(elememts)) {
        out.valid = true;
        api.sign = elememts[2].value;
        api.scope = 'local';
        api.range = Range.create(
            Position.create(lineIndex, elememts[2].range[0]),
            Position.create(lineIndex + 1, 0),
        );
    } else if (isAssignmentMemberFunctionDeclaration(elememts)) {
        out.valid = true;
        api.base = elememts[0].value;
        api.indexer = elememts[1].value;
        api.sign = elememts[2].value;
        api.scope = 'member';
        api.range = Range.create(
            Position.create(lineIndex, elememts[2].range[0]),
            Position.create(lineIndex + 1, 0),
        );
    } else if (isAssignmentLocalFunctionDeclaration(elememts)) {
        out.valid = true;
        api.sign = elememts[1].value;
        api.scope = 'local';
        api.range = Range.create(
            Position.create(lineIndex, elememts[1].range[0]),
            Position.create(lineIndex + 1, 0),
        );
    }
    api.type = 'function';
    api.kind = getItemKindByType('function');
    api.documentation = getDocumentation(document, lineIndex);
    out.api = api;

    return out;
}

function getDocumentation(document: TextDocument, lineIndex: number): string|undefined {
    let line = doc.getLineText(document, lineIndex - 1);
    if (line.indexOf('--') === -1) {
        return;
    }

    let lines = [];

    let valid = false;
    while (lineIndex >= 0) {
        line = doc.getLineText(document, lineIndex - 1);
        if (line.length === 0) {
            break;
        }

        if (line.indexOf("--") === -1) {
            break;
        }

        lines.push(line);

        // if (line.indexOf("-- /**") === 0) {
        //     valid = true;
        //     break;
        // }
        --lineIndex;
    }

    // if (valid === false) {
    //     return;
    // }
    
    lines = lines.reverse();
    return lines.join("\n");
}

function isAssignmentLocalFunctionDeclaration(elememts: luaparse.Token[]) {
    if (elememts[0] && elememts[0].value === 'local') {
        if (elememts[2] && elememts[2].value === '=') {
            if (elememts[3] && elememts[3].value === 'function') {
                if (elememts[4] && elememts[4].value === '(') {
                    return true;
                }
            }
        }
    }
    return false;
}

function isAssignmentMemberFunctionDeclaration(elememts: luaparse.Token[]) {
    if (elememts[1] && (elememts[1].value === '.' || elememts[1].value === ':')) {
        if (elememts[3] && elememts[3].value === '=') {
            if (elememts[4] && elememts[4].value === 'function') {
                if (elememts[5] && elememts[5].value === '(') {
                    return true;
                }
            }
        }
    }
    return false;
}

function isMemberFunctionDeclaration(elememts: luaparse.Token[]) {
    if (elememts[0] && elememts[0].value === 'function' && elememts[0].range[0] === 0) {
        if (elememts[2] && (elememts[2].value === '.' || elememts[2].value === ':')) {
            if (elememts[4] && elememts[4].value === '(') {
                return true;
            }
        }
    }
    return false;
}

function isGobalFunctionDeclaration(elememts: luaparse.Token[]) {
    if (elememts[0] && elememts[0].value === 'function') {
        if (elememts[2] && elememts[2].value === '(') {
            return true;
        }
    }
    return false;
}

function isLocalFunctionDeclaration(elememts: luaparse.Token[]) {
    if (elememts[0] && elememts[0].value === 'local') {
        if (elememts[1] && elememts[1].value === 'function') {
            if (elememts[3] && elememts[3].value === '(') {
                return true;
            }
        }
    }
    return false;
}


export function checkVariableSign(document: TextDocument, lineIndex: number) {
    let line = doc.getLineText(document, lineIndex);

    let api: API = {
        'sign': '',
    };

    let out = {
        'valid': false,
        'api': api,
    };

    let elememts = parseVariableElememts(line);
    if (isMemberConstantVariableDeclaration(elememts)) {
        out.valid = true;
        api.base = elememts[0].value;
        api.indexer = elememts[1].value;
        api.sign = elememts[2].value;
        api.scope = 'member';
        api.type = 'constant_variable';
        api.kind = getItemKindByType('constant');
        api.range = Range.create(
            Position.create(lineIndex, elememts[2].range[0]),
            Position.create(lineIndex + 1, 0),
        );

        let result = generateChildrenSignIfPossible(document, lineIndex);
        
        if (result && result.apis) {
            api.children = result.apis;
            api.kind = getItemKindByType('enum');
            api.documentation = result.lines.join("\n");
            api.subType = 'table';
        }
    } else if (isMemberVariableDeclaration(elememts)) {
        out.valid = true;
        api.base = elememts[0].value;
        api.indexer = elememts[1].value; 
        api.sign = elememts[2].value;
        api.scope = 'member';
        api.type = 'member_variable';
        api.kind = getItemKindByType('member');
        api.range = Range.create(
            Position.create(lineIndex, elememts[2].range[0]),
            Position.create(lineIndex + 1, 0),
        );
    } else if (isModuleLocalVariableDeclaration(elememts)) {
        out.valid = true;
        api.sign = elememts[1].value;
        api.scope = 'local';
        api.type = 'local_variable';
        api.kind = getItemKindByType('local');
        api.range = Range.create(
            Position.create(lineIndex, elememts[1].range[0]),
            Position.create(lineIndex + 1, 0),
        );

        let result = generateChildrenSignIfPossible(document, lineIndex);
        
        if (result && result.apis) {
            api.children = result.apis;
            api.kind = getItemKindByType('enum');
            api.documentation = result.lines.join("\n");
            api.subType = 'table';
        }
    } else if (isGolbalVariableDeclaration(elememts)) {
        out.valid = true;
        api.sign = elememts[0].value;
        api.scope = 'gobal';
        api.type = 'gobal_variable';
        api.kind = getItemKindByType('gobal');
        api.range = Range.create(
            Position.create(lineIndex, elememts[0].range[0]),
            Position.create(lineIndex + 1, 0),
        );

        let result = generateChildrenSignIfPossible(document, lineIndex);
        
        if (result && result.apis) {
            api.children = result.apis;
            api.kind = getItemKindByType('enum');
            api.documentation = result.lines.join("\n");
            api.subType = 'table';
        }
    }
   
    return out;
}

function isGolbalVariableDeclaration(elememts: luaparse.Token[]) {
    if (elememts[0] && elememts[0].range[0] === 0) {
        if (elememts[1] && elememts[1].value === '=') {
            return true;
        }
    }

    return false;
}

function isMemberConstantVariableDeclaration(elememts: luaparse.Token[]) {
    if (elememts[0] && elememts[0].range[0] === 0) {
        if (elememts[1] && elememts[1].value === '.') {
            if (elememts[3] && elememts[3].value === '=') {
                return true;
            }
        }
    }
    return false;
}

function isMemberVariableDeclaration(elememts: luaparse.Token[]) {
    if (elememts[1] && elememts[1].value === '.') {
        if (elememts[3] && elememts[3].value === '=') {
            if (elememts[0].value === 'self' || elememts[0].value === 'M' || elememts[0].value === '_M') {
                if (elememts[0].range[0] > 0) {
                    return true;
                }
            }
        }
    }
    return false;
}

function isModuleLocalVariableDeclaration(elememts: luaparse.Token[]) {
    if (elememts[0] && elememts[0].range[0] === 0) {
        if (elememts[0].value === 'local') {
            if (elememts[2] && elememts[2].value === '=') {
                return true;
            }
        }
    }
    return false;
}

function isRealNum(val: any){
    // isNaN()函数 把空串 空格 以及NUll 按照0来处理 所以先去除
    if(val === "" || val === null){
        return false;
    }
    if(!isNaN(val)){
        return true;
    }else{
        return false;
    }
} 

function generateChildrenSignIfPossible(document: TextDocument, lineIndex: number) {
    let chunkInfo = getLuaChunk(document, lineIndex);

    let chunk = chunkInfo.chunk;
    if (chunk === undefined) {
        return;
    }

    if (chunk.type !== 'table') {
        return;
    }

    function findSignPos(sign: string) {
        let pos: number = 0;
        let l = lineIndex;
        while (l < document.lineCount) {
            let line = doc.getLineText(document, l);
            if (line.replace(/\s/g, '').indexOf(sign + '=') > -1) {
                pos = line.indexOf(sign);
                break;
            }
            ++l;
        }

        return {
            l: l,
            pos: pos,
        };
    }

    function generateApis(apis: API[], chunk: LuaValue) {
        if (chunk === undefined) {
            return;
        }
        for (let key in chunk.value) {
            let value = chunk.value[key];
            
            let pos = findSignPos(key);


            if (isRealNum(key)) {
                key = (parseInt(key) + 1) + '';
            }


            let api: API = {
                'sign': key || '',
                'site': doc.basename(document.uri),
                'kind': CompletionItemKind.Constant,
                'indexer': '.',
                'range': Range.create(
                    Position.create(pos.l, pos.pos),
                    Position.create(pos.l + 1, 0),
                ),
                'uri': document.uri,
                'detail': getDocumentation(document, pos.l),
            };

            if (value.type === 'table') {
                api.children = [];
                let valObj = {};
                parseChunkValue(valObj, value.value);
                api.documentation = JSON.stringify(valObj, null, '\t');
                generateApis(api.children, value);
            } else {
                api.documentation = key + ": " + value.value;
            }

            apis.push(api);
        }
    }

    let apis: API[] = [];
    generateApis(apis, chunk);
    
    return {
        'apis': apis,
        'lines': chunkInfo.lines,
    };
}

function parseChunkValue(valObj: any, chunkValue: any) {
    if (typeof chunkValue !== 'object') {
        return;
    }

    for (let key in chunkValue) {
        let value = chunkValue[key];
        if (value.type === 'table') {
            if (!valObj[key]) {
                valObj[key] = {};
            }
            parseChunkValue(valObj[key], value.value);
        } else {
            valObj[key] = value.value;
        }
    }
}

function getLuaChunk(document: TextDocument, lineIndex: number) {
    let chunk = undefined;

    let lines: string[] = [];
    let l = lineIndex;
    while (l < document.lineCount) {
        lines.push(doc.getLineText(document, l));
        ++l;
        try {
            chunk = luajs.parse(lines.join('\n'));
            break;
        } catch (e) {

        }
    }

    return {
        'chunk': chunk,
        'lines': lines,
    };
}

export function checkReferenceTag(document: TextDocument, lineIndex: number) {
    const line = doc.getLineText(document, lineIndex);

    let elememts = parseVariableElememts(line);
    
    return {
        'base': elememts[0] && elememts[0].value || "",
        'sign': elememts[2] && elememts[2].value || "",
    };
}



export function checkArgsTag(document: TextDocument, lineIndex: number) {
    let chunkInfo = getLuaChunk(document, lineIndex - 1);

    let chunk = chunkInfo.chunk;
    if (chunk === undefined) {
        return;
    }

    let value = chunk.value;

    let typeMap: {[key: string]: string} = {};

    let apis: API[] = [];
    for(let key  in value){
        apis.push({
            'sign': "_" + key,
            'site': doc.basename(document.uri),
            'scope': "member",
            'kind': CompletionItemKind.Field,
            'indexer': '.',
            // 'range': Range.create(
            //     Position.create(pos.l, pos.pos),
            //     Position.create(pos.l + 1, 0),
            // ),
            'uri': document.uri,
            'detail': 'Args'
        });


        typeMap["_" + key] = value[key].key;
    }

    // console.log(chunk);

    return {
        'apis': apis,
        'typeMap': typeMap,
    };
}

function parseVariableElememts(line: string) {
    const parse = luaparse.parse(line, {wait: true});

    let elememts = [];
    while(true) {
        try {
            let result = parse.lex();
            if (result.type === 1) {
                break;
            }
            elememts.push(result);

            if (result.value === '=') {
                break;
            }
            if (elememts.length > 4) {
                break;
            }

        } catch (e) {
            break;
        } 
    }

    return elememts;
}

function parseLineElememts(line: string) {
    const parse = luaparse.parse(line, {wait: true});
   
    let elememts = [];
    while(true) {
        try {
            let result = parse.lex();
            if (result.type === 1) {
                break;
            }
            elememts.push(result);
        } catch (e) {
            break;
        } 
    }
    return elememts;
}

function getItemKindByType(type: string|undefined): CompletionItemKind {
    if (type === 'enum') {
        return CompletionItemKind.Class;
    } else if (type === 'constant') {
        return CompletionItemKind.Constant;
    } else if (type === 'member') {
        return CompletionItemKind.Field;
    } else if (type === 'member') {
        return CompletionItemKind.Variable;
    } else if (type === 'function') {
        return CompletionItemKind.Method;
    } else if (type === 'gobal') {
        return CompletionItemKind.Interface;
    }

    return CompletionItemKind.Constant;
}