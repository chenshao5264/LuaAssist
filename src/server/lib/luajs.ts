import * as luaparse from 'luaparse';

export interface LuaValue {
    'value'?: any;
    'type'?: string;

    
    'key'?: string;
    'base'?: string;

    'keytype'?: string;

    // function
    'parameters'?: string[];
    'indexer'?: string;
    'isLocal'?: boolean;
}


export function parse(luastring: string) {
    var ast = luaparse.parse(luastring);
    
    // console.log(JSON.stringify(ast) + '\n');

    return parseStatement(ast.body[0]);
}

function parseStatement(statement: luaparse.Statement) {
    let result: LuaValue = {};

    if (statement.type === 'AssignmentStatement') {
        result = parseExpression(statement.init[0]);

        if (statement.variables[0] && statement.variables[0].type === 'MemberExpression') {
            let value = parseMemberExpression(statement.variables[0]);
            result.key = value.key;
            result.indexer = value.indexer;
            result.base = value.base;
        }
    } else if (statement.type === 'LocalStatement') {

        result = parseExpression(statement.init[0]);

        if (statement.variables[0]) {
            let value = parseExpression(statement.variables[0]);
            result.key = value.value;
        }

    } else if (statement.type === 'FunctionDeclaration') {
        result = parseExpression(statement);
    }

    // console.log(JSON.stringify(result));
    // console.log(result);

    return result;
}

function parseExpression(expression: luaparse.Expression): LuaValue {
    let result: LuaValue = {};

    if (expression.type === 'NumericLiteral') {
        result.value = expression.value;
        result.type = 'number';
    } else if (expression.type === 'StringLiteral') {
        result.value = expression.value;
        result.type = 'string';
    } else if (expression.type === 'Identifier') {
        result.value = expression.name;
        result.type = 'baisc';
    } else if (expression.type === 'UnaryExpression') {
        result.value = parseExpression(expression.argument);
        if (expression.operator === '-') {
            result.value = -result.value;
        }
        result.type = 'number';
    } else if (expression.type === 'TableConstructorExpression') {
        result.value = parseTableConstructorExpression(expression);
        result.type = 'table';
    } else if (expression.type === 'CallExpression') {
        result.value = parseCallExpression(expression);
        result.type = 'function';
    } else if (expression.type === 'MemberExpression') {
        result = parseMemberExpression(expression);
    } else if (expression.type === 'FunctionDeclaration') {
        result = parseFunctionDeclaration(expression);
        result.type = 'function';
    }

    return result;
}

function parseFunctionDeclaration(expression: luaparse.Expression) {
    if (expression.type !== 'FunctionDeclaration') {
        return {};
    }

    let result: LuaValue = {};

    let identifier = expression.identifier;
    if (identifier) {
        if (identifier.type === 'MemberExpression') {
            result.value = parseMemberExpression(identifier);
        } else if (identifier.type === 'Identifier') {
            result.value = parseExpression(identifier);
        }
    }

    let parameters = expression.parameters;
    result.parameters = [];
    for (let i = 0; i < parameters.length; ++i) {
        let param = parameters[i];
        result.parameters.push(parseExpression(param).value);
    }

    result.isLocal = expression.isLocal;
    

    return result;

}

function parseMemberExpression(expression: luaparse.Expression) {
    if (expression.type !== 'MemberExpression') {
        return {};
    }


    let base = parseExpression(expression.base);
    let identifier = parseExpression(expression.identifier);

    let result: LuaValue = {};
    result.key = identifier.value;
    result.base = base.value;
    result.indexer = expression.indexer;

    return result;
}

function parseCallExpression(expression: luaparse.Expression) {
    if (expression.type !== 'CallExpression') {
        return '';
    }

    let value = [];
    if (expression.base.type === 'MemberExpression') {
        value.push(parseExpression(expression.base.base));
        value.push(expression.base.indexer);
        value.push(parseExpression(expression.base.identifier));
        value.push('(');

        for (let i = 0; i < expression.arguments.length; ++i) {
            value.push(parseExpression(expression.arguments[i]));
            if (i < expression.arguments.length - 1) {
                value.push(',');
            }
        }

        value.push(')');

        return value.join('');
    }
}

function parseTableConstructorExpression(expression: luaparse.Expression) {
    if (expression.type !== 'TableConstructorExpression') {
        return {};
    }

    let result: any;

    let fileds = expression.fields;
    for (let i = 0; i < fileds.length; ++i) {
        let t =  parseTableFields(fileds[i]);

        if (t.type === 'array') {
            if (!result) {
                result = [];
            }
            result.push(t.value);
        } else {
            if (!result) {
                result = {};
            }
            if (t.key) {
                result[t.key] = t.value;
            }
        }
    }

    return result;
}

function parseTableFields(expression: luaparse.TableKey | luaparse.TableKeyString | luaparse.TableValue) {
    let value: LuaValue = {};
    let type, key, keytype;
    if (expression.type === 'TableKeyString') {
        type = 'dict';
        value = parseExpression(expression.value);
        key = expression.key.name;
    } else if (expression.type === 'TableValue') {
        type = 'array';
        value = parseExpression(expression.value);
    } else if (expression.type === 'TableKey') {
        type = 'dict';
        let keyVal = parseExpression(expression.key);
        key = keyVal.value;
        keytype = keyVal.type;
        value = parseExpression(expression.value);
    }

    return {
        'value': value,
        'type': type,
        'key': key,
    };
}

