

import * as languageserver from 'vscode-languageserver';
import { 
    CompletionItem, 
    ReferenceParams,
    TextDocumentChangeEvent,
    CompletionParams,
    DocumentSymbolParams,
    TextDocumentPositionParams,
} from 'vscode-languageserver-protocol';

import { CompletionProvider } from './providers/completion-provider';
import { SymbolProvider } from './providers/symbol-provider';
import { HoverProvider } from './providers/hover-provider';
import { DefinitionProvider } from './providers/definition-provider';

import * as Assistor from './assistor';

import * as fs from 'fs';


const completionProvider = new CompletionProvider();
const symbolProvider = new SymbolProvider();
const hoverProvider = new HoverProvider();
const definitionProvider = new DefinitionProvider();

const documents = new languageserver.TextDocuments();


let connection = languageserver.createConnection(languageserver.ProposedFeatures.all);
Assistor.crate(connection);

connection.onInitialize((params: languageserver.InitializeParams) => {
    // connection.console.info('Start Init Server');
    // console.log('onInitialize', params);
    
    Assistor.getInstance().init(params);
    
	return {
		capabilities: {
			completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.', ':']
            },
            documentSymbolProvider: true,
            // hoverProvider: true,
            definitionProvider: true,
            // referencesProvider: true,
		}
	};
});

connection.onInitialized((params: languageserver.InitializedParams) => {
    connection.console.info('Init Server Successful!');
    connection.sendNotification('req_get_setting_config');
});


documents.onDidChangeContent((change: TextDocumentChangeEvent) => {
    // console.log('onDidChangeContent', change);
    // console.log(change.document.uri);

    Assistor.getInstance().updateDocument(change.document);
});


connection.onRequest("client_req", () => {
    connection.window.showInformationMessage('client_req');
    return "server resp";
});

connection.onNotification("notify_setting_config", (params) => { 
    Assistor.getInstance().setSettingConfig(params);

    Assistor.getInstance().searchFiles((params: any) => {
        connection.sendNotification('notify_parse_completed', params);
    });
});


connection.onCompletion((params: CompletionParams): Promise<CompletionItem[]> => {
    return completionProvider.provideCompletions(params);
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem  => {
    // console.log('onCompletionResolve', item);
    return completionProvider.resolveCompletions(item);
});

connection.onDocumentSymbol((params: DocumentSymbolParams) => {
    return symbolProvider.provideDocumentSymbols(params.textDocument.uri);
});

// connection.onHover((params: TextDocumentPositionParams) => {
//    return hoverProvider.provideHover(params);
// });

// connection.onReferences((params: ReferenceParams) => {
//     return definitionProvider.provideDefinitions(params);
// });

connection.onDefinition((params: TextDocumentPositionParams) => {
    return definitionProvider.provideDefinitions(params);
});


connection.onNotification('onDidChangeActiveTextEditor', (fileName) => {
    Assistor.getInstance().setCurrentActiveFile(fileName);
});

documents.listen(connection);

connection.listen();