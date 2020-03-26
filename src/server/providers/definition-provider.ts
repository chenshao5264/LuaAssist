
import { 
    TextDocumentPositionParams,
    Location,
} from 'vscode-languageserver-protocol';

import * as Assistor from '../assistor';
import * as doc from '../lib/doc';

export class DefinitionProvider {
    constructor() {

    }

    provideDefinitions(params: TextDocumentPositionParams) {
        // console.log(params);
        const basename = doc.basename(params.textDocument.uri);
        const document = Assistor.getInstance().getDocument(basename);
        
        const line = doc.getLineText(document, params.position.line);

        let word = doc.getWord(line, params.position.character);

        if (word === '') {
            return [];
        }

        const pos = line.indexOf(word);

        let prefixs: string[] = [];
        let realPrefixs = doc.getPrefixs(line, pos - 1);
        for (let i = 0; i < realPrefixs.length; ++i) {
            prefixs[i] = Assistor.getInstance().mapPrefix(doc.basename(params.textDocument.uri), realPrefixs[i]);
        }

        let api = Assistor.getInstance().getLuaApi(prefixs, realPrefixs, word);

        if (!api || !api.range || !api.site) {
            return [];
        }

        let defs = [];

        let uri = api.uri;
        if (!uri) {
            uri = Assistor.getInstance().getDocument(doc.basename(api.site)).uri;
        }

        if (!uri) {
            return [];
        }

        defs.push(
            Location.create(uri, api.range)
        );

        return defs;
    }
}