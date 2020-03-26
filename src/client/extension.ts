// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as path from 'path';
import * as vscode from 'vscode';
import * as languageclient from 'vscode-languageclient';
import { Event } from 'vscode-languageclient';


let client: languageclient.LanguageClient;
let statusBarItem: vscode.StatusBarItem;

function createClient(context: vscode.ExtensionContext) {
    if (client) {
        console.log('client stop');
        client.stop();
    }

    // 服务端配置
	let serverModule = context.asAbsolutePath(
		path.join("out", "server", "server.js")
    );
    
    let debugOptions = { execArgv: ["--nolazy", "--inspect=6010"] };

    
    let serverOptions: languageclient.ServerOptions = {
		run : { module: serverModule, transport: languageclient.TransportKind.ipc },
		debug: { module: serverModule, transport: languageclient.TransportKind.ipc, options: debugOptions }
	};

	// 客户端配置
	let clientOptions: languageclient.LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'lua' }],
        synchronize: {
            configurationSection: 'LuaAssist',
            fileEvents: [vscode.workspace.createFileSystemWatcher('**/*.lua')]
        }
	};

	client = new languageclient.LanguageClient(
		'LuaAssist',
		'Lua Assist Server',
		serverOptions,
		clientOptions
    );
    
    client.onReady().then(() => {
        client.onNotification('notify_parse_completed', (params) => {
            updateStatusBarItem(params);
        });

        client.onNotification('req_get_setting_config', (params) => {
            client.sendNotification('notify_setting_config', vscode.workspace.getConfiguration('luaassist'));
        });

        
        let e = vscode.window.activeTextEditor;
        if (e) {
            client.sendNotification('onDidChangeActiveTextEditor', e.document.fileName);
        }
    });

	// 启动客户端，同时启动语言服务器
    client.start();
}

function updateStatusBarItem(params: any): void {
	if (params.index < params.total) {
        statusBarItem.text = `$(search) parsing(${params.index}/${params.total}): ${params.file} `;
	} else {
        statusBarItem.text = `$(check) lua-assist`;
	}
}

export function activate(context: vscode.ExtensionContext) {
    
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();
    

    createClient(context);

    // let e = vscode.window.activeTextEditor;
    // e?.document.fileName;

    vscode.window.onDidChangeActiveTextEditor((e: vscode.TextEditor|undefined) => {
        if (e) {
            client.sendNotification('onDidChangeActiveTextEditor', e.document.fileName);
        }
    });


	context.subscriptions.push(
        vscode.commands.registerCommand('extension.luaassist20.annotation', function () {
            let e = vscode.window.activeTextEditor;
            if (e) {
                let selection = e.selection;
                
                let a = e.document.lineAt(selection.start.line).text;
                let _1 = a.indexOf("--[[");
                if (_1 === -1) {
                    e.insertSnippet(new vscode.SnippetString("--[["), new vscode.Position(selection.start.line, 0));
                }
                let b = e.document.lineAt(selection.end.line).text;
                let _2 = b.indexOf("]]--");
                if (_2 === -1) {
                    e.insertSnippet(new vscode.SnippetString("]]--"), new vscode.Position(selection.end.line, selection.end.character));
                }
                
                e.edit(editBuilder => {
                    if (_1 > -1) {
                        editBuilder.delete(new vscode.Range(
                            new vscode.Position(selection.start.line, _1),
                            new vscode.Position(selection.start.line, _1 + 4)
                        ));
                    }
                    if (_2 > -1) {
                        editBuilder.delete(new vscode.Range(
                            new vscode.Position(selection.end.line, _2),
                            new vscode.Position(selection.end.line, _2 + 4)
                        ));
                    }
                });
            }
        })
    );
    
}

// this method is called when your extension is deactivated
export function deactivate() {
    if (client) {
        return client.stop();
    }
}




