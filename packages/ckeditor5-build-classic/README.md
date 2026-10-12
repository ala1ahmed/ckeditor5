# @alapandaahmed/ckeditor5-build-classic

A CKEditor 5 **v37.1.0** classic build, built from the official `@ckeditor/ckeditor5-*@37.1.0` packages on npm, with a few custom plugins:

| Plugin | Toolbar item | Purpose |
|---|---|---|
| `WordImport` | `wordImport` (in the default toolbar) | Uploads a .doc/.docx and replaces the content with the converted HTML |
| `HtmlToPdf` | `htmlToPdf` (opt-in) | Sends the editor HTML to a backend and returns a PDF `File` |
| `Theme` | — | Per-instance theming through the `theme` config |
| `HCardEditing` | — | Inline `<span class="h-card">` widgets with drag and drop (ClassicEditor only) |
| `GeneralHtmlSupport` | — | Inert until you pass `htmlSupport.allow` |

v37.1.0 is deliberately the last CKEditor release before the "Powered by CKEditor" logo (v38+) and the mandatory `licenseKey` (v44+). Moving past it needs a commercial license to keep the logo out.

## Install

```bash
npm install @alapandaahmed/ckeditor5-build-classic
```

The bundle is UMD and injects its own CSS:

```js
const { ClassicEditor, DecoupledDocumentEditor } = require( '@alapandaahmed/ckeditor5-build-classic' );

ClassicEditor.create( element, config );
```

In a page, the same object is `window.CKEDITOR`. The UI language is French.

## Configuration

### `wordImport`

```js
wordImport: { url: 'https://api.example.com/doc/convert-html' }
```

The file is posted as `multipart/form-data` (field `file`); the response body (HTML) replaces the editor content. On a non-2xx response the content is left untouched.

### `htmlToPdf`

```js
toolbar: [ /* … */ 'htmlToPdf' ],
htmlToPdf: {
	url: 'https://api.example.com/doc/html-to-pdf',
	headers: async () => ( { Authorization: `Bearer ${ await getToken() }` } ),
	data: () => ( { title: 'Mon document' } ),  // merged into the JSON body
	fileName: () => 'Mon document.pdf',
	onSuccess: file => { /* a File of type application/pdf */ },
	onError: error => { /* error.status is set for HTTP failures */ }
}
```

The request is `POST` JSON `{ ...data, html }`. `headers`, `data` and `fileName` may be values or (async) functions, resolved on every export. Without `onSuccess` the PDF is downloaded. The export is also available as a command: `editor.execute( 'htmlToPdf' )`.

### `theme`

```js
theme: {
	preset: 'light',             // 'light' (stock look, default) or 'dark'
	colors: {
		primary, primaryHover, primarySoft,
		background, surface, surfaceHover,
		text, textMuted, border
	},
	radius: '8px',
	fontFamily: 'inherit'
}
```

Every value is optional and may be a `var(--token)` reference, so an app that switches light/dark by redefining its CSS tokens re-themes the editor live. The theme only applies to that editor instance, including its balloons and panels.

### Busy state and events

`WordImport` and `HtmlToPdf` are observable: `editor.plugins.get( 'HtmlToPdf' ).isBusy` is true during a conversion, and they fire `wordImport:start|end|error` and `htmlToPdf:start|end|error`.

## Develop

This package is installed on its own, not through the monorepo workspaces:

```bash
npm install --workspaces=false
npm run build      # build/ckeditor.js + translations
npm test           # headless smoke tests against the built bundle
```

`sample/index.html` loads the built bundle for manual checks.

## Publish

```bash
npm version <new-version>   # rebuilds through the preversion script
npm publish                 # prepublishOnly rebuilds and runs the smoke tests
```

Keep every `@ckeditor/*` dependency on the same exact version, or the editor throws `ckeditor-duplicated-modules`.

## License

GPL-2.0-or-later, as CKEditor 5 itself. See LICENSE.md.
