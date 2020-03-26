
import { 
    TextDocumentPositionParams,
    MarkupKind,
    TextDocument
} from 'vscode-languageserver-protocol';

import * as Assistor from '../assistor';
import * as doc from '../lib/doc';

export class HoverProvider {
    constructor() {

    }

    provideHover(params: TextDocumentPositionParams) {
        const basename = doc.basename(params.textDocument.uri);
        const document = Assistor.getInstance().getDocument(basename);

        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: this.getHoverContext(document, params.position.line),
            }
        };
    }

    getHoverContext(document: TextDocument, lineIndex: number): string {
        let line = doc.getLineText(document, lineIndex);
        if (!doc.isFunctionBegan(line, doc.basename(document.uri))) {
            return '';
        }

        let hovers = [];

        let i = lineIndex - 1;
        line = doc.getLineText(document, i);
        while(true) {
            if (i < 0) {
                break;
            }
            if (line.indexOf('--') === -1) {
                break;
            }
            --i;
            line = doc.getLineText(document, i);
        }

        hovers.push('```');
        hovers.push(doc.getLineText(document, lineIndex));
        hovers.push('```');
        hovers.push('---');
   
        for (let k = i; k < lineIndex; ++k) {
            let line = doc.getLineText(document, k);
            hovers.push(line);
        }

        return hovers.join('\n');
    }
}