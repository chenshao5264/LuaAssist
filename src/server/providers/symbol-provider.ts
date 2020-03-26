
import * as path from 'path';

import { 
    DocumentSymbol,
    SymbolKind,
    Range,
    Position
} from 'vscode-languageserver-protocol';

import * as Assistor from '../assistor';
import * as doc from '../lib/doc';

export class SymbolProvider {
    constructor() {

    }

    provideDocumentSymbols(uri: string): DocumentSymbol[] {
        let result = [];

        const basename = path.basename(uri, path.extname(uri));
        let document = Assistor.getInstance().getDocument(basename);

        for(let i = 0; i < document.lineCount; ++i) {
            let line = doc.getLineText(document, i).trim();
            if (line.indexOf('function ') === 0) {
                let pos = line.indexOf('function');
                let method = line.substring(pos + 'function'.length);

                result.push(DocumentSymbol.create(
                    method, '', SymbolKind.Function, 
                    Range.create(
                        Position.create(i, 0),
                        Position.create(i, 0)
                    ),
                    Range.create(
                        Position.create(i, 0),
                        Position.create(i, 0)
                    )
                ));
            }
        }

        return result;
    }
}