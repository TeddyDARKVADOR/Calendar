# Calendar - VS Code Extension

**Created by [Teddy Becard](https://github.com/TeddyDARKVADOR)**

Calendar is a Visual Studio Code extension that scans your workspace for annotation comments (TODO, FIXME, BUG, HACK, NOTE) and consolidates them into a dedicated sidebar panel. It provides editor decorations, CodeLens navigation, assignee support, and Markdown export.

## Features

- **Sidebar panel** — lists all annotations organized by file, with icons per type and direct navigation to the source line
- **Editor decorations** — highlights annotated lines with a colored background and a gutter icon per annotation type
- **CodeLens** — displays a clickable link above each annotation in the editor, opening it directly in the Calendar panel
- **Assignees** — supports `// TODO(@username): text` syntax to assign annotations to team members
- **Filtering** — search the sidebar by annotation type, keyword, or assignee
- **Multi-type annotations** — TODO, FIXME, BUG, HACK, NOTE, sorted by priority (BUG first, NOTE last)
- **Multi-language support** — `//` for JS/TS/Java/C++/CSS/PHP, `#` for Python/Ruby/Shell/YAML, `<!-- -->` for HTML/XML/Vue
- **Status bar item** — shows the total annotation count at all times
- **Markdown export** — generates a `.calendar.md` file at the workspace root
- **Auto-refresh** — optional automatic re-scan on every file save
- **Fully configurable** — annotation types, excluded folders, output file name, CodeLens toggle

## Supported File Types

| Extensions                         | Comment style used  |
|------------------------------------|---------------------|
| `.js` `.ts` `.jsx` `.tsx`          | `// ANNOTATION:`    |
| `.java` `.cpp` `.c` `.h`           | `// ANNOTATION:`    |
| `.css` `.scss` `.php`              | `// ANNOTATION:`    |
| `.py` `.rb` `.sh` `.yaml` `.yml`   | `# ANNOTATION:`     |
| `.html` `.htm` `.xml` `.vue`       | `<!-- ANNOTATION:` |

## Installation (Development)

```bash
git clone https://github.com/TeddyDARKVADOR/Calendar.git
cd Calendar
npm install
npm run build
```

Open the folder in VS Code and press `F5` to launch the Extension Development Host.

> `extension.js` is the compiled output and is not tracked by git. Always run `npm run build` after cloning or after modifying `extension.ts`.

## Usage

### Sidebar panel

Click the Calendar icon in the Activity Bar (left sidebar). The panel lists all annotations in the workspace grouped by file. Click any item to navigate directly to the annotated line.

The panel toolbar provides four buttons:

- **Filter** `$(search)` — search by type, keyword or assignee
- **Clear filter** `$(search-stop)` — appears when a filter is active
- **Refresh** `$(refresh)` — re-scans without generating the Markdown file
- **Export** `$(export)` — generates the `.calendar.md` file and opens it

### Editor decorations

Each annotated line is highlighted with a color and a gutter icon corresponding to its type:

| Type  | Color      | Gutter icon       |
|-------|------------|-------------------|
| BUG   | Red        | Red circle with X |
| FIXME | Orange     | Orange triangle   |
| TODO  | Blue       | Blue ring         |
| HACK  | Yellow     | Yellow diamond    |
| NOTE  | Gray       | Gray info circle  |

Overview ruler marks (right of the scrollbar) also reflect the annotation positions.

### CodeLens

A clickable `Calendar : TYPE` link appears above each annotated line. Clicking it navigates to that annotation in the source file. Can be disabled via `calendar.showCodeLens`.

### Filtering

Click the search icon in the sidebar toolbar and type any of the following:

- An annotation type: `BUG`, `TODO`, `FIXME`...
- A keyword: `auth`, `database`...
- An assignee: `@teddyb`, `@alice`...

When a filter is active, the tree view shows its term as a subtitle and the clear button appears.

### Command Palette

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

- `Calendar: Generer le fichier de taches` — scan and export to Markdown
- `Calendar: Rafraichir` — scan and update the sidebar only
- `Calendar: Filtrer les annotations` — open the filter input
- `Calendar: Effacer le filtre` — clear the active filter

### Keyboard shortcut

`Ctrl+Alt+C` (Windows/Linux) / `Cmd+Alt+C` (macOS) — triggers the generate command when a workspace folder is open.

### Status bar

The bottom-left status bar shows the current annotation count (e.g., `5 annotations`). Clicking it triggers the generate command.

## How to annotate your code

Add annotation comments in the standard format for your language:

```javascript
// TODO: Implement input validation
// FIXME: Division by zero when input is empty
// BUG: Returns null on the second call
// HACK: Temporary workaround for API rate limit
// NOTE: This function is called on every render

// Assignee syntax:
// TODO(@teddyb): Add authentication middleware
// FIXME(@alice): Handle the edge case on line 47
```

```python
# TODO: Replace with a proper logging library
# FIXME(@bob): Handle missing config file
```

```html
<!-- TODO: Add ARIA labels for accessibility -->
<!-- BUG(@teddyb): Table overflows on mobile -->
```

The annotation keyword is case-insensitive (`todo:`, `Todo:`, and `TODO:` are all detected).

## Annotation priorities

Annotations are sorted within each file in the following order:

| Priority       | Type  | Icon              |
|----------------|-------|-------------------|
| 1 (highest)    | BUG   | Bug               |
| 2              | FIXME | Warning           |
| 3              | TODO  | Circle            |
| 4              | HACK  | Wrench            |
| 5 (lowest)     | NOTE  | Info              |

## Export format

The generated `.calendar.md` file:

```markdown
<!-- Generated by Calendar — Copyright (c) 2026 Teddy Becard — https://github.com/TeddyDARKVADOR/Calendar -->
# Calendrier des taches - 11/05/2026

> Genere le 11/05/2026 14:30:00 par Calendar — Teddy Becard

---

## `src/app.ts`

- [ ] **[BUG]** Ligne 14 : Returns null on the second call
- [ ] **[FIXME]** @alice Ligne 47 : Division by zero when input is empty
- [ ] **[TODO]** @teddyb Ligne 12 : Implement input validation

## `src/utils.py`

- [ ] **[TODO]** Ligne 8 : Replace with a proper logging library
```

## Settings

All settings are available under `Settings > Extensions > Calendar` or directly in `settings.json`.

| Setting                    | Type     | Default                                                          | Description                                          |
|----------------------------|----------|------------------------------------------------------------------|------------------------------------------------------|
| `calendar.outputFile`      | string   | `.calendar.md`                                                   | Name of the generated Markdown file                  |
| `calendar.annotations`     | string[] | `["TODO","FIXME","BUG","HACK","NOTE"]`                           | Annotation types to detect                           |
| `calendar.excludePatterns` | string[] | `["**/node_modules/**","**/.git/**","**/dist/**","**/build/**"]` | Glob patterns to exclude from scan                   |
| `calendar.autoRefresh`     | boolean  | `false`                                                          | Refresh automatically on every file save             |
| `calendar.showCodeLens`    | boolean  | `true`                                                           | Show a CodeLens link above each annotated line        |

Example `settings.json`:

```json
{
  "calendar.annotations": ["TODO", "FIXME", "BUG", "HACK", "NOTE", "REVIEW"],
  "calendar.autoRefresh": true,
  "calendar.showCodeLens": true,
  "calendar.outputFile": "TASKS.md"
}
```

## Requirements

- Visual Studio Code 1.80.0 or higher
- Node.js (for building from source)
- A workspace folder must be open

## Project Structure

```
Calendar/
├── extension.ts              # Extension source (TypeScript)
├── extension.js              # Compiled output (generated — do not edit)
├── package.json              # Extension manifest and contribution points
├── tsconfig.json             # TypeScript compiler configuration
├── LICENSE                   # MIT License — Copyright (c) 2026 Teddy Becard
├── resources/
│   ├── icon.png              # Extension icon (128x128, for Marketplace)
│   ├── calendar.svg          # Activity Bar icon
│   ├── gutter-bug.svg
│   ├── gutter-fixme.svg
│   ├── gutter-todo.svg
│   ├── gutter-hack.svg
│   └── gutter-note.svg
└── README.md
```

## License

MIT License — Copyright (c) 2026 [Teddy Becard](https://github.com/TeddyDARKVADOR)

This software is open source. Forks and distributions must retain the original copyright notice as required by the MIT License terms. See [LICENSE](./LICENSE) for full details.
