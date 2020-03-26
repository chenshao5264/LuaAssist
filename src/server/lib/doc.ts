

import * as walk from 'walk';
import * as path from 'path';

import { 
    Range,
    Position,
    TextDocument,
    CompletionItemKind
} from 'vscode-languageserver-protocol';

import * as luajs from './luajs';

import * as luaparse from 'luaparse';

import { 
    API,
    ModuleInfo,
} from '../interface';

const TAG_MODULE_PREFIX = '-- @module';
const TAG_BELONG_PREFIX = '-- @belong';
const TAG_TYPE_PREFIX = '-- @type';
const TAG_REFERENCE_PREFIX = '-- @reference';

const REGEXP_FUNCTION = /^function _?M[\.:]/;

const PREFIX_SCOPE_PRIVATE = '-- @private';


export function isEmpty(str: string) {
    if (str.length === 0) {
        return true;
    }
    return false;
}

export function searchFile(path: string, onFile: any, onCompleted: any) {
    var walker  = walk.walk(path);

    walker.on('file', function(roots, stat, next) {
        onFile(roots + '/' + stat.name);
	    next();
	});

	walker.on('end', function() {
        onCompleted();
    });
}


export function getLineText(document: TextDocument, lineIndex: number) {
    return document.getText(Range.create(
        Position.create(lineIndex, 0),
        Position.create(lineIndex + 1, 0),
    )).trimRight();
}

export function isModuleBegan(line: string): boolean {
    let pos = line.indexOf('local M =');
    if (pos > -1) {
        return true;
    }

    pos = line.indexOf('local _M =');
    if (pos > -1) {
        return true;
    }

    pos = line.indexOf(TAG_MODULE_PREFIX);
    if (pos > -1) {
        return true;
    }

    pos = line.indexOf(TAG_BELONG_PREFIX);
    if (pos > -1) {
        return true;
    }

    return false;
}

export function getModuleDefName(document: TextDocument, lineIndex: number) {
    const line = getLineText(document,  lineIndex);

    let pos = line.indexOf('local M =');
    if (pos > -1) {
        return 'M';
    }

    pos = line.indexOf('local _M =');
    if (pos > -1) {
        return '_M';
    }

    pos = line.indexOf(TAG_MODULE_PREFIX);
    if (pos > -1) {
        return line.substring(TAG_MODULE_PREFIX.length + 1);
    }

    pos = line.indexOf(TAG_BELONG_PREFIX);
    if (pos > -1) {
        return line.substring(TAG_BELONG_PREFIX.length + 1);
    }

    return basename(document.uri);
}

export function getModuleInfo(document: TextDocument, lineIndex: number) {
    let result = {
        'name': '',
        'type': '',
    };

    while (true) {
        if (lineIndex < 0) {
            break;
        }

        const line = getLineText(document,  lineIndex);
        if (line.indexOf(TAG_MODULE_PREFIX) > -1) {
            result.name = line.substring(TAG_MODULE_PREFIX.length + 1);
            result.type = 'module';
            break;
        } else if (line.indexOf(TAG_BELONG_PREFIX) > -1) {
            result.name = line.substring(TAG_BELONG_PREFIX.length + 1);
            result.type = 'belong';
            break;
        }
        --lineIndex;        
    }   

    if (isEmpty(result.name)) {
        result.name = basename(document.uri);
    }

    
    return result;
}

export function isGolbalVariableBegan(line: string) {

    if ((line.indexOf(' = M') === -1) && (line.indexOf(' = _M') === -1)) {
        return false;
    }

    if (line[line.length - 1] !== 'M') {
        return false;
    }

    if (line.indexOf('local') > -1) {
        return false;
    }
   
    let elememts = parseElememts(line, 3);

    if (elememts.length < 3) {
        return false;
    }

    if (elememts[0].range[0] !== 0) {
        return false;
    }

    if (elememts[1].value !== '=') {
        return false;
    }

    if (elememts[2].value !== '_M' && elememts[2].value !== 'M') {
        return false;
    }


    return true;
}

export function isModuleVariableBegan(line: string, moduleName: string) {
    const parse = luaparse.parse(line, {wait: true});
   
    let elememts = parseElememts(line, 4);


    if (elememts.length < 4) {
        return false;
    }

    if (['self', 'M', '_M', moduleName].indexOf(elememts[0].value) > -1 && elememts[1].value === '.' && elememts[3].value === '=') {
        return true;
    }

    return false;
}

export function isConstantVariableBegan(line: string, moduleName: string) {
    if (line.indexOf('M') !== 0 && line.indexOf('_M') !== 0 && line.indexOf(moduleName) !== 0) {
        return false;
    }
    
    return isModuleVariableBegan(line, moduleName);
}

export function isMemberVariableBegan(line: string, moduleName: string) {
    if (line.indexOf('self._playerCard            = PlayerCard.new()') > -1) {
        let a= 1;
    }
    if (line.trimLeft().indexOf('self.') !== 0 && line.trimLeft().indexOf('M.') !== 0 && line.trimLeft().indexOf('_M.') !== 0 && line.trimLeft().indexOf(moduleName + '.') !== 0) {
        return false;
    }

    if (line[0] !== ' ') {
        return false;
    }

    return isModuleVariableBegan(line, moduleName);
}


export function isFunctionBegan(line: string, moduleName: string) {
    if (line.trimLeft().indexOf('function M') !== 0 && line.trimLeft().indexOf('function _M') !== 0 && line.trimLeft().indexOf('function ' + moduleName) !== 0) {
        return false;
    }
   
    let elememts = parseElememts(line, '(');

    if (elememts.length < 5) {
        return false;
    }

    if (elememts[2].value !== '.' && elememts[2].value !== ':') {
        return false;
    }

    if (elememts[3].value === 'ctor') {
        return false;
    }

    if (elememts[4].value !== '(') {
        return false;
    }

    return true;
}

export function generateApi(document: TextDocument, lineIndex: number): API {
    let line = getLineText(document, lineIndex);

    let indexer = '.';
    let pos = line.indexOf('.');
    if (pos === -1) {
        pos = line.indexOf(':');
        if (pos > -1) {
            indexer = ':';
        }
    }
    let sign = getWord(line, pos + 1);
    let base = getWord(line, pos - 1);
    let info = getSignInfo(document, lineIndex);

    let result: API = {
        'sign': sign,
        'base': base,
        'indexer': indexer,
        'scope': info.scope,
        'documentation': info.documentation,
        'site': basename(document.uri),
    };

    result.range = Range.create(
        Position.create(lineIndex, line.indexOf(sign)),
        Position.create(lineIndex + 1, 0),
    );

    return result;
}

export function getLuaTableChunkInfo(sign: string, document: TextDocument, lineIndex: number) {
    let line = getLineText(document, lineIndex);

    let regout = line.replace(/\s/g, '').match(/\.[a-zA-Z_0-9]+=/);

    if (!regout) {
        return undefined;
    }
    if (!regout.index) {
        return undefined;
    }

    let lines = [
        line.substring(regout.index + 1),
    ];

    let chunkInfo = undefined;
    let l = lineIndex;
    while (l < document.lineCount) {
        try {
            chunkInfo = luajs.parse(lines.join('\n'));
            break;
        } catch (e) {

        }
        ++l;
        lines.push(getLineText(document, l));
    }

    if (!chunkInfo) {
        return undefined;
    }

    if (typeof chunkInfo !== 'object') {
        return undefined;
    }

    function generate_apis(result: API[], chunkInfo: any, site: string) {
        for (let key in chunkInfo) {
            let value = chunkInfo[key];
    
            let pos: number = 0;
            let l = lineIndex;
            while (l < document.lineCount) {
                let line = getLineText(document, l);
                if (line.replace(/\s/g, '').indexOf(key + '=') > -1) {
                    pos = line.indexOf(key);
                    break;
                }
                ++l;
            }
    
            let detail = '';
            if (typeof value === 'object') {
                detail = key + ' = ' + value;
            } else {
                detail = key + ' = ' + value;
            }

            let api: API = {
                'sign': key || '',
                'detail': detail,
                'site': site,
                'kind': CompletionItemKind.Constant,
                'indexer': '.',
                'range': Range.create(
                    Position.create(l, pos),
                    Position.create(l + 1, 0),
                ),
                'uri': document.uri,
            };

            if (typeof value === 'object') {
                api.children = [];
                api.documentation = JSON.stringify(value, null, '\t');
                generate_apis(api.children, value, site + '.' + key);
            }

            result.push(api);
        }
    }

    let result: API[] = [];
    generate_apis(result, chunkInfo, basename(document.uri) + '.' + sign);

    if (result.length === 0) {
        return undefined;
    }
     
    return {
        'result': result,
    };
}

export function getFunctionChunkInfo(moduleName: string, document: TextDocument, lineIndex: number) {
    let lines = [];

    let chunkInfo = undefined;
    let l = lineIndex;
    while (l < document.lineCount) {
        try {
            lines.push(getLineText(document, l));
            ++l;
            chunkInfo = luajs.parse(lines.join('\n'));
            break;
        } catch (e) {

        }
    }

    if (!chunkInfo) {
        return undefined;
    }

    let endLineIndex = l - 1;

    return {
        'endLineIndex': endLineIndex, 
    };
}

export function getItemKindByType(type: string|undefined): CompletionItemKind {
    if (type === 'enum') {
        return CompletionItemKind.Class;
    } else if (type === 'constant') {
        return CompletionItemKind.Constant;
    } else if (type === 'member') {
        return CompletionItemKind.Field;
    } else if (type === 'member') {
        return CompletionItemKind.Variable;
    } else if (type === 'function') {
        return CompletionItemKind.Function;
    } else if (type === 'gobal') {
        return CompletionItemKind.Interface;
    }

    return CompletionItemKind.Constant;
}

export function getSignInfo(document: TextDocument, lineIndex: number) {
    let result = {
        'scope': 'public',
        'documentation': '',
    };

    let documentation = [];
    --lineIndex;

    let line = getLineText(document, lineIndex).trim();
    while (true) {
        if (line.indexOf('--') === -1) {
            break;
        }

        if (line.indexOf(PREFIX_SCOPE_PRIVATE) > -1) {
            result.scope = 'private';
        } 

        documentation.unshift(line);
        --lineIndex;
        if (lineIndex < 0) {
            break;
        }

        line = getLineText(document, lineIndex).trim();
    }

    result.documentation = documentation.join('\n');

    return result;
}

export function isReferenceBegan(line: string) {
    if (line.trimLeft().indexOf(TAG_REFERENCE_PREFIX) === 0) {
        return true;
    }

    return false;
}

export function parseElememts(line: string, stop: string|number) {
    const parse = luaparse.parse(line, {wait: true});
   
    let elememts = [];
    while(true) {
        let result;
        try {
            result = parse.lex();
        } catch (e) {
            break;
        }
        if (result.type === 1) {
            break;
        }
        elememts.push(result);
        if (typeof stop === 'string') {
            if (result.value === stop) {
                break;
            }
        } else {
            if (elememts.length === stop) {
                break;
            }
        }
        
    }
    return elememts;
}

export function checkExternFunction(line: string) {

    if (line.indexOf('function') === -1) {
        return;
    }

    let elememts = parseElememts(line, '(');

    if (elememts.length === 5) {
        if (elememts[0].value === 'function' && isWord(elememts[1].value) && elememts[2].value === '.' && isWord(elememts[3].value)) {
            return {
                'base': elememts[1].value,
                'sign': elememts[3].value,
                'indexer': elememts[2].value,
            };
        }
    } else if (elememts.length === 6) {
        if (isWord(elememts[0].value) && elememts[1].value === '.' && isWord(elememts[2].value) && elememts[3].value === '=' && elememts[4].value === 'function') {
            return {
                'base': elememts[0].value,
                'sign': elememts[2].value,
                'indexer': elememts[1].value,
            };
        }
    }
}

export function checkExternVariable(line: string) {
    let elememts = parseElememts(line, 4);

    if (elememts.length < 4) {
        return;
    }

    if (elememts[1].value === '.' && elememts[3].value === '=') {
        return {
            'base': elememts[0].value,
            'sign': elememts[2].value,
            'indexer': elememts[1].value,
        };
    }
}

export function getReferenceInfo(document: TextDocument, lineIndex: number) {
    let line = getLineText(document, lineIndex).trim();
    let pos = line.indexOf(TAG_REFERENCE_PREFIX);

    let moduleName = line.substr(pos + TAG_REFERENCE_PREFIX.length).trim();

    line = getLineText(document, lineIndex + 1).trim();
    pos = line.indexOf('=');

    let variable = line.substr(0, pos).trim();

    let k = line.length;
    while(true) {
        if (k < 0) {
            break;
        }

        if (variable[k] === ' ' || variable[k] === '.') {
            break;
        }

        --k;
    }

    let prefix = variable.substr(k + 1);
    let base = variable.substr(0, k);

    return {
        'name': moduleName,
        'prefix': prefix,
        'base': base,
    };
}

export function basename(uri: string) {
    return path.basename(uri, path.extname(uri));
}

export function isWordCharacter(character: string) {
    if (!character) {
        return false;
    }
    if (character === '') {
        return false;
    }
    const asciiValue = character.charCodeAt(0);
    if (asciiValue === 95) { // _
        return true;
    } else if (asciiValue >= 65 && asciiValue <= 90) { // A-Z
        return true;
    } else if (asciiValue >= 97 && asciiValue <= 122) { // a-z
        return true;
    } else if (asciiValue >= 48 && asciiValue <= 57) { // 1-9
        return true;
    }

    return false;
}

export function isWord(word: string) {
    for (let i = 0; i < word.length; ++i) {
        if (!isWordCharacter(word[i])) {
            return false;
        }
    }

    return true;
}

export function isNumber(character: string) {
    if (!character) {
        return false;
    }
    if (character === '') {
        return false;
    }
    const asciiValue = character.charCodeAt(0);

    if (asciiValue >= 48 && asciiValue <= 57) { // 1-9
        return true;
    }

    return false;
}

export function getWord(line: string, character: number) {
    if (line.length === 0) {
        return '';
    }

    let result = [];

    // left
    let i = character - 1;
    while (true) {
        if (!isWordCharacter(line[i])) {
            ++i;
            break;
        }
        --i;
    }
    
    // right
    let j = character;
    while (true) {
        if (!isWordCharacter(line[j])) {
            break;
        }
        ++j;
    }

    return line.substring(i, j);
}

// character '.', ':'的位置.
export function getPrefix(line: string, character: number) {
    let i = character - 1;
    while (true) {
        if (!isWordCharacter(line[i])) {
            ++i;
            break;
        }
        --i;
    }
    
    return line.substring(i, character);
}

export function getPrefixs(line: string, character: number) {
    let words = [];
    let word = [];
    let i = character;
    while (true) {
        if (!isWordCharacter(line[i])) {
            if (word.length > 0) {
                words.push(word.reverse().join(""));
                word = [];
            }

            if (line[i] !== '.' && line[i] !== ':' && line[i] !== '[' && line[i] !== ']') {
                break;
            }
        } else {
            word.push(line[i]);
        }

        if (i < 0) {
            break;
        }


        --i;
    }

    if (word.length > 0) {
        words.push(word.reverse().join(""));
    }
    return words;
}


export function getXlsxPrefix(line: string, character: number) {
    let numbers: number[] = [];
    let brackets: string[] = [];
    let characters: string[] = [];
    let i = character - 1;

    let startFlag = false;
    while (true) {
        if (isNumber(line[i])) {
            numbers.push(parseInt(line[i]));
        } else if (line[i] === '[') {
            startFlag = true;
            brackets.push(line[i]);
        } else if (line[i] === ']') {
            brackets.push(line[i]);
        } else if (isWordCharacter(line[i])) {
            if (startFlag) {
                characters.push(line[i]);
            }
        } else {
            break;
        }
        --i;
    }

    return {
        _xlsxPrefix: characters.reverse().join(''),
        _numberStr: numbers.reverse().join(''),
        _brackets: brackets.reverse().join(''),
    };
}