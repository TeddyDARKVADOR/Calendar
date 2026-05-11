/**
 * Calendar - VS Code Extension
 * Copyright (c) 2026 Teddy Becard
 * Licensed under the MIT License.
 * https://github.com/TeddyDARKVADOR/Calendar
 */

import * as vscode from 'vscode';
import * as path from 'path';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface TodoItem {
    file: vscode.Uri;
    line: number;
    type: string;
    assignee?: string;
    text: string;
}

interface TodoFile {
    uri: vscode.Uri;
    relativePath: string;
    items: TodoItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = {
    BUG: 0,
    FIXME: 1,
    TODO: 2,
    HACK: 3,
    NOTE: 4,
};

const DECORATION_COLORS: Record<string, { bg: string; ruler: string }> = {
    BUG:   { bg: 'rgba(229, 62, 62, 0.12)',   ruler: 'rgba(229, 62, 62, 0.8)' },
    FIXME: { bg: 'rgba(221, 107, 32, 0.12)',  ruler: 'rgba(221, 107, 32, 0.8)' },
    TODO:  { bg: 'rgba(49, 130, 206, 0.10)',  ruler: 'rgba(49, 130, 206, 0.6)' },
    HACK:  { bg: 'rgba(214, 158, 46, 0.10)',  ruler: 'rgba(214, 158, 46, 0.6)' },
    NOTE:  { bg: 'rgba(113, 128, 150, 0.08)', ruler: 'rgba(113, 128, 150, 0.5)' },
};

const HASH_COMMENT_EXTS = new Set(['.py', '.rb', '.sh', '.bash', '.zsh', '.yaml', '.yml', '.r', '.coffee']);
const HTML_COMMENT_EXTS = new Set(['.html', '.htm', '.xml', '.vue']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCommentPattern(filePath: string, annotations: string[]): RegExp {
    const ext = path.extname(filePath).toLowerCase();
    const group = annotations.map(a => a.toUpperCase()).join('|');

    if (HASH_COMMENT_EXTS.has(ext)) {
        return new RegExp(`#\\s*(${group})(?:\\s*\\(@([^)]+)\\))?:\\s*(.+)`, 'i');
    }
    if (HTML_COMMENT_EXTS.has(ext)) {
        return new RegExp(`<!--\\s*(${group})(?:\\s*\\(@([^)]+)\\))?:\\s*(.+?)(?:\\s*-->)?$`, 'i');
    }
    return new RegExp(`\\/\\/\\s*(${group})(?:\\s*\\(@([^)]+)\\))?:\\s*(.+)`, 'i');
}

async function scanWorkspace(): Promise<TodoFile[]> {
    const config = vscode.workspace.getConfiguration('calendar');
    const annotations: string[] = config.get('annotations') ?? ['TODO', 'FIXME', 'BUG', 'HACK', 'NOTE'];
    const excludePatterns: string[] = config.get('excludePatterns') ?? [
        '**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**',
    ];

    const files = await vscode.workspace.findFiles(
        '**/*.{js,ts,jsx,tsx,html,htm,py,java,cpp,c,h,css,scss,php,rb,sh,yaml,yml,vue}',
        `{${excludePatterns.join(',')}}`
    );

    const result: TodoFile[] = [];

    for (const file of files) {
        const doc = await vscode.workspace.openTextDocument(file);
        const lines = doc.getText().split('\n');
        const pattern = getCommentPattern(file.fsPath, annotations);
        const items: TodoItem[] = [];

        lines.forEach((line, index) => {
            const match = pattern.exec(line);
            if (match) {
                items.push({
                    file,
                    line: index,
                    type: match[1].toUpperCase(),
                    assignee: match[2]?.trim() ?? undefined,
                    text: match[3].trim(),
                });
            }
        });

        if (items.length > 0) {
            items.sort((a, b) => (PRIORITY_ORDER[a.type] ?? 99) - (PRIORITY_ORDER[b.type] ?? 99));
            result.push({
                uri: file,
                relativePath: vscode.workspace.asRelativePath(file),
                items,
            });
        }
    }

    return result.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

// ─── Decoration Manager ───────────────────────────────────────────────────────

class DecorationManager {
    private readonly types: Record<string, vscode.TextEditorDecorationType> = {};
    private data: TodoFile[] = [];

    constructor(context: vscode.ExtensionContext) {
        for (const [type, colors] of Object.entries(DECORATION_COLORS)) {
            this.types[type] = vscode.window.createTextEditorDecorationType({
                isWholeLine: true,
                backgroundColor: colors.bg,
                overviewRulerColor: colors.ruler,
                overviewRulerLane: vscode.OverviewRulerLane.Right,
                gutterIconPath: context.asAbsolutePath(`resources/gutter-${type.toLowerCase()}.svg`),
                gutterIconSize: 'contain',
            });
        }
    }

    update(data: TodoFile[]): void {
        this.data = data;
        for (const editor of vscode.window.visibleTextEditors) {
            this.applyToEditor(editor);
        }
    }

    applyToEditor(editor: vscode.TextEditor): void {
        const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
        const fileEntry = this.data.find(f => f.relativePath === relativePath);

        for (const type of Object.values(this.types)) {
            editor.setDecorations(type, []);
        }

        if (!fileEntry) return;

        const rangesByType: Record<string, vscode.Range[]> = {};
        for (const item of fileEntry.items) {
            if (!rangesByType[item.type]) rangesByType[item.type] = [];
            rangesByType[item.type].push(new vscode.Range(item.line, 0, item.line, Number.MAX_VALUE));
        }

        for (const [type, ranges] of Object.entries(rangesByType)) {
            if (this.types[type]) {
                editor.setDecorations(this.types[type], ranges);
            }
        }
    }

    dispose(): void {
        for (const type of Object.values(this.types)) {
            type.dispose();
        }
    }
}

// ─── CodeLens Provider ────────────────────────────────────────────────────────

class CalendarCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    private data: TodoFile[] = [];

    refresh(data: TodoFile[]): void {
        this.data = data;
        this._onDidChangeCodeLenses.fire();
    }

    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        if (!vscode.workspace.getConfiguration('calendar').get('showCodeLens', true)) {
            return [];
        }

        const relativePath = vscode.workspace.asRelativePath(document.uri);
        const fileEntry = this.data.find(f => f.relativePath === relativePath);
        if (!fileEntry) return [];

        return fileEntry.items.map(item => {
            const range = new vscode.Range(item.line, 0, item.line, 0);
            const assigneePart = item.assignee ? ` — @${item.assignee}` : '';
            return new vscode.CodeLens(range, {
                title: `$(checklist) Calendar : ${item.type}${assigneePart}`,
                command: 'calendar.openTodo',
                arguments: [item.file, item.line],
            });
        });
    }
}

// ─── TreeView ─────────────────────────────────────────────────────────────────

class TodoTreeItem extends vscode.TreeItem {
    constructor(public readonly todo: TodoItem) {
        super(todo.text, vscode.TreeItemCollapsibleState.None);
        const assigneePart = todo.assignee ? ` @${todo.assignee}` : '';
        this.description = `[${todo.type}]${assigneePart} L.${todo.line + 1}`;
        this.tooltip = new vscode.MarkdownString(
            `**${todo.type}**${todo.assignee ? ` — @${todo.assignee}` : ''}  \nLigne ${todo.line + 1}  \n${todo.text}`
        );
        this.command = {
            command: 'calendar.openTodo',
            title: 'Ouvrir dans le fichier',
            arguments: [todo.file, todo.line],
        };
        const iconMap: Record<string, string> = {
            BUG: 'bug',
            FIXME: 'warning',
            TODO: 'circle-outline',
            HACK: 'wrench',
            NOTE: 'info',
        };
        this.iconPath = new vscode.ThemeIcon(iconMap[todo.type] ?? 'circle-outline');
        this.contextValue = 'todoItem';
    }
}

class TodoFileItem extends vscode.TreeItem {
    constructor(public readonly todoFile: TodoFile) {
        super(todoFile.relativePath, vscode.TreeItemCollapsibleState.Expanded);
        const count = todoFile.items.length;
        this.description = `${count} element${count > 1 ? 's' : ''}`;
        this.iconPath = new vscode.ThemeIcon('file');
        this.contextValue = 'todoFile';
    }
}

type TreeNode = TodoFileItem | TodoTreeItem;

class CalendarTreeProvider implements vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private data: TodoFile[] = [];
    private filter = '';

    refresh(data: TodoFile[]): void {
        this.data = data;
        this._onDidChangeTreeData.fire(undefined);
    }

    setFilter(value: string): void {
        this.filter = value.toLowerCase().trim();
        vscode.commands.executeCommand('setContext', 'calendar.filterActive', this.filter !== '');
        this._onDidChangeTreeData.fire(undefined);
    }

    getFilter(): string {
        return this.filter;
    }

    private matches(item: TodoItem): boolean {
        if (!this.filter) return true;
        return (
            item.type.toLowerCase().includes(this.filter) ||
            item.text.toLowerCase().includes(this.filter) ||
            (item.assignee?.toLowerCase().includes(this.filter) ?? false)
        );
    }

    getTreeItem(element: TreeNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeNode): TreeNode[] {
        if (!element) {
            return this.data
                .filter(f => f.items.some(i => this.matches(i)))
                .map(f => new TodoFileItem(f));
        }
        if (element instanceof TodoFileItem) {
            return element.todoFile.items
                .filter(i => this.matches(i))
                .map(item => new TodoTreeItem(item));
        }
        return [];
    }
}

// ─── Activate ─────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
    const treeProvider = new CalendarTreeProvider();
    const codeLensProvider = new CalendarCodeLensProvider();
    const decorationManager = new DecorationManager(context);

    const treeView = vscode.window.createTreeView('calendarView', {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
    });

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'calendar.generate';
    statusBarItem.tooltip = 'Calendar par Teddy Becard — cliquez pour exporter les taches';

    async function runScan(): Promise<TodoFile[]> {
        if (!vscode.workspace.workspaceFolders) return [];
        const todoFiles = await scanWorkspace();
        const total = todoFiles.reduce((sum, f) => sum + f.items.length, 0);
        treeProvider.refresh(todoFiles);
        codeLensProvider.refresh(todoFiles);
        decorationManager.update(todoFiles);
        statusBarItem.text = `$(checklist) ${total} annotation${total !== 1 ? 's' : ''}`;
        statusBarItem.show();
        return todoFiles;
    }

    const generateCmd = vscode.commands.registerCommand('calendar.generate', async () => {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage('Veuillez ouvrir un dossier pour utiliser Calendar.');
            return;
        }

        const todoFiles = await runScan();

        if (todoFiles.length === 0) {
            vscode.window.showInformationMessage('Aucune annotation trouvee dans le workspace.');
            return;
        }

        const config = vscode.workspace.getConfiguration('calendar');
        const outputFile: string = config.get('outputFile') ?? '.calendar.md';
        const rootUri = vscode.workspace.workspaceFolders[0].uri;
        const date = new Date();

        let output = `<!-- Generated by Calendar — Copyright (c) 2026 Teddy Becard — https://github.com/TeddyDARKVADOR/Calendar -->\n`;
        output += `# Calendrier des taches - ${date.toLocaleDateString('fr-FR')}\n\n`;
        output += `> Genere le ${date.toLocaleString('fr-FR')} par [Calendar](https://github.com/TeddyDARKVADOR/Calendar) — Teddy Becard\n\n---\n\n`;

        for (const file of todoFiles) {
            output += `## \`${file.relativePath}\`\n\n`;
            for (const item of file.items) {
                const assigneePart = item.assignee ? ` @${item.assignee}` : '';
                output += `- [ ] **[${item.type}]**${assigneePart} Ligne ${item.line + 1} : ${item.text}\n`;
            }
            output += '\n';
        }

        const uri = vscode.Uri.joinPath(rootUri, outputFile);
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(output));
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage('Calendrier mis a jour.');
    });

    const refreshCmd = vscode.commands.registerCommand('calendar.refresh', async () => {
        await runScan();
    });

    const openTodoCmd = vscode.commands.registerCommand('calendar.openTodo', async (fileUri: vscode.Uri, line: number) => {
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(doc);
        const pos = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    });

    const filterCmd = vscode.commands.registerCommand('calendar.filter', async () => {
        const input = await vscode.window.showInputBox({
            prompt: 'Filtrer par type, mot-cle ou assigne',
            placeHolder: 'ex: BUG   /   TODO   /   @teddyb   /   auth',
            value: treeProvider.getFilter(),
        });
        if (input !== undefined) {
            treeProvider.setFilter(input);
            treeView.description = input ? `"${input}"` : undefined;
        }
    });

    const clearFilterCmd = vscode.commands.registerCommand('calendar.clearFilter', () => {
        treeProvider.setFilter('');
        treeView.description = undefined;
    });

    const codeLensDisposable = vscode.languages.registerCodeLensProvider(
        [
            { scheme: 'file', language: 'javascript' },
            { scheme: 'file', language: 'typescript' },
            { scheme: 'file', language: 'javascriptreact' },
            { scheme: 'file', language: 'typescriptreact' },
            { scheme: 'file', language: 'python' },
            { scheme: 'file', language: 'java' },
            { scheme: 'file', language: 'cpp' },
            { scheme: 'file', language: 'c' },
            { scheme: 'file', language: 'css' },
            { scheme: 'file', language: 'scss' },
            { scheme: 'file', language: 'php' },
            { scheme: 'file', language: 'ruby' },
            { scheme: 'file', language: 'shellscript' },
            { scheme: 'file', language: 'yaml' },
            { scheme: 'file', language: 'html' },
            { scheme: 'file', language: 'vue' },
        ],
        codeLensProvider
    );

    vscode.window.onDidChangeVisibleTextEditors(editors => {
        editors.forEach(e => decorationManager.applyToEditor(e));
    }, undefined, context.subscriptions);

    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('calendar.showCodeLens')) {
            codeLensProvider.refresh([]); // force refresh to apply/clear lenses
            runScan();
        }
        if (e.affectsConfiguration('calendar.autoRefresh')) {
            setupAutoRefresh();
        }
    }, undefined, context.subscriptions);

    let fileWatcher: vscode.FileSystemWatcher | undefined;

    function setupAutoRefresh(): void {
        fileWatcher?.dispose();
        fileWatcher = undefined;
        const autoRefresh: boolean = vscode.workspace.getConfiguration('calendar').get('autoRefresh') ?? false;
        if (autoRefresh) {
            fileWatcher = vscode.workspace.createFileSystemWatcher(
                '**/*.{js,ts,jsx,tsx,html,htm,py,java,cpp,c,h,css,scss,php,rb,sh,yaml,yml,vue}'
            );
            const handler = () => runScan();
            fileWatcher.onDidChange(handler);
            fileWatcher.onDidCreate(handler);
            fileWatcher.onDidDelete(handler);
        }
    }

    setupAutoRefresh();
    runScan();

    context.subscriptions.push(
        generateCmd,
        refreshCmd,
        openTodoCmd,
        filterCmd,
        clearFilterCmd,
        codeLensDisposable,
        statusBarItem,
        treeView,
        { dispose: () => fileWatcher?.dispose() },
        { dispose: () => decorationManager.dispose() },
    );
}

export function deactivate() {}
