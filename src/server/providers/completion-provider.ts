
import { 
    CompletionItem, 
    CompletionParams,
} from 'vscode-languageserver-protocol';

import { 
    API,
} from '../interface';

import * as path from 'path';

import * as Assistor from '../assistor';
import * as doc from '../lib/doc';

export class CompletionProvider {
    constructor() {

    }

    async provideCompletions(params: CompletionParams): Promise<CompletionItem[]> {
        // console.log(params);

        if (!params.context) {
            return [];
        }

        const document = Assistor.getInstance().getDocument(path.basename(params.textDocument.uri));
        const text = doc.getLineText(document, params.position.line);

        let result: CompletionItem[] = [];

        if (params.context.triggerKind === 1) {
            const word = doc.getWord(text, params.position.character - 1);
            const pos = params.position.character - word.length;

            let prefixs: string[] = [];
            let realPrefixs = doc.getPrefixs(text, pos - 1);
            for (let i = 0; i < realPrefixs.length; ++i) {
                prefixs[i] = Assistor.getInstance().mapPrefix(doc.basename(params.textDocument.uri), realPrefixs[i]);
            }

            if (pos > 0) {
                result = this.generateItemsByTriggerCharacter(text[pos - 1], prefixs, realPrefixs, word);
            } else {
                result = this.generateItemsByTriggerCharacter('', prefixs, realPrefixs, word);
            }
            

            // all
            // if (result.length === 0) {
            //     let allApis = Assistor.getInstance().getAllApis();
            //     result = this.generateItems(allApis);
            // }
        } else {

            if (params.context.triggerCharacter === '.' || params.context.triggerCharacter === ':') {
                let prefixs: string[] = [];
                let realPrefixs = doc.getPrefixs(text, params.position.character - 1);
                for (let i = 0; i < realPrefixs.length; ++i) {
                    prefixs[i] = Assistor.getInstance().mapPrefix(doc.basename(params.textDocument.uri), realPrefixs[i]);
                }
                
                result = this.generateItemsByTriggerCharacter(params.context.triggerCharacter || '', prefixs, realPrefixs);
    

            } else {
               
            }
        }

        

        return result;
    }

    private generateItemsByTriggerCharacter(triggerCharacter: string, prefixs: string[], realPrefixs: string[], matchWord?: string): CompletionItem[] {
        let result: CompletionItem[] = [];

        // console.log(lastPrefix, prefix);

        if (triggerCharacter === '.') {
            if (prefixs.length > 0) {
                const luaApis = Assistor.getInstance().getLuaApisByPrefix(prefixs, realPrefixs, triggerCharacter, matchWord);
                if (luaApis) {
                    result = this.generateItems(luaApis);
                }
            }
        } else if (triggerCharacter === ':') {
            if (prefixs.length > 0) {
                const luaApis = Assistor.getInstance().getLuaApisByPrefix(prefixs, realPrefixs, triggerCharacter, matchWord);
                
                if (luaApis) {
                    result = this.generateItems(luaApis);
                }
            }
        } else {
            const luaApis = Assistor.getInstance().getLuaApisByPrefix(prefixs, realPrefixs, triggerCharacter, matchWord);
            if (luaApis) {
                result = this.generateItems(luaApis);
            }
        }

        return result;
    }


    private generateItems(apis: API[]): CompletionItem[] {
        let result = [];

        for (let i = 0; i < apis.length; ++i) {
            let item = CompletionItem.create(apis[i].sign);
            item.kind = apis[i].kind;
            item.detail = apis[i].detail;
            item.data = apis[i].data;
            let documentation = '';
            if (apis[i].documentation) {
                documentation = apis[i].documentation || '';
            }
            if (apis[i].site) {
                if (documentation.length > 0) {
                    documentation = documentation + '\n\n';
                }
                documentation = documentation + 'from: ' + apis[i].site;
            }
            item.documentation = documentation;
            
            result.push(item);
        }

        return result;
    }

    //
    resolveCompletions(item: CompletionItem) {

        if (item.data) {
          
        }

        return item;
    }
}
