/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * Smoke tests for the built bundle (build/ckeditor.js), run in headless Chrome.
 *
 *     npm run build && npm test
 *
 * Every page is served from a fake origin (http://smoke.test) through request
 * interception, so the plugins' fetch calls are same-origin and their
 * responses can be scripted per test.
 */

/* eslint-env node */
/* globals window, document */

'use strict';

const assert = require( 'assert' );
const fs = require( 'fs' );
const path = require( 'path' );
const puppeteer = require( 'puppeteer' );

const ORIGIN = 'http://smoke.test';
const BUNDLE = process.env.CKEDITOR_BUNDLE || path.resolve( __dirname, '..', 'build', 'ckeditor.js' );

const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body><div id="editor"></div><script src="${ ORIGIN }/ckeditor.js"></script></body></html>`;

// A fragment in the AI document vocabulary, as the backend returns it once
// prepared for the editor: inline diagrams turned into images, and
// <ol class="steps"> wrapped in <div class="steps"> (v37's GHS can't keep
// classes on the legacy List).
const AI_FRAGMENT = [
	'<h2>Titre</h2>',
	'<p>En bref.</p>',
	'<div class="keypoints"><div class="kp"><h4>Point</h4><p>Explication.</p></div></div>',
	'<div class="callout tip"><p>Conseil.</p></div>',
	'<div class="steps"><ol><li><strong>Étape</strong> — description</li></ol></div>',
	'<figure class="table"><table class="glossary"><thead><tr><th>Terme</th><th>Définition</th></tr></thead>',
	'<tbody><tr><td>A</td><td>B</td></tr></tbody></table></figure>',
	'<figure class="image illus"><img src="data:image/svg+xml;base64,PHN2Zy8+" alt="Schéma"><figcaption>Schéma</figcaption></figure>'
].join( '' );

const DOCUMENT_HTML_SUPPORT = {
	allow: [
		{ name: 'div', classes: [ 'callout', 'tip', 'warn', 'info', 'keypoints', 'kp', 'steps' ] },
		{ name: 'table', classes: [ 'glossary' ] },
		{ name: 'figure', classes: [ 'illus' ] },
		// GHS only keeps attributes on an image's <figure> once <img> is allowed too.
		{ name: 'img' }
	]
};

const checks = [];
const check = ( name, fn ) => checks.push( { name, fn } );

// Scripted responses for the fake API, keyed by path. Reset before each test.
let routes = {};
let requests = [];

async function openPage( browser ) {
	const page = await browser.newPage();
	const errors = [];

	page.on( 'pageerror', error => errors.push( error.message ) );
	page.on( 'console', message => {
		if ( message.type() === 'error' ) {
			errors.push( message.text() );
		}
	} );

	await page.setRequestInterception( true );
	page.on( 'request', request => {
		const url = new URL( request.url() );

		if ( url.origin !== ORIGIN ) {
			return request.abort();
		}

		if ( url.pathname === '/' ) {
			return request.respond( { status: 200, contentType: 'text/html', body: PAGE } );
		}

		if ( url.pathname === '/ckeditor.js' ) {
			return request.respond( { status: 200, contentType: 'application/javascript', body: fs.readFileSync( BUNDLE ) } );
		}

		requests.push( {
			method: request.method(),
			path: url.pathname,
			headers: request.headers(),
			body: request.postData()
		} );

		const route = routes[ url.pathname ];

		return route ? request.respond( route ) : request.respond( { status: 404, body: 'not found' } );
	} );

	await page.goto( `${ ORIGIN }/` );

	return { page, errors };
}

check( 'the bundle exposes both editors', async ( { page } ) => {
	const names = await page.evaluate( () => Object.keys( window.CKEDITOR ).sort() );

	assert.deepStrictEqual( names, [ 'ClassicEditor', 'DecoupledDocumentEditor' ] );
} );

check( 'ClassicEditor starts with the custom plugins and no console errors', async ( { page, errors } ) => {
	const plugins = await page.evaluate( async () => {
		const editor = await window.CKEDITOR.ClassicEditor.create( document.querySelector( '#editor' ) );
		const names = [ 'WordImport', 'HtmlToPdf', 'Theme', 'HCardEditing', 'GeneralHtmlSupport' ];

		return names.filter( name => editor.plugins.has( name ) );
	} );

	assert.deepStrictEqual( plugins, [ 'WordImport', 'HtmlToPdf', 'Theme', 'HCardEditing', 'GeneralHtmlSupport' ] );
	assert.deepStrictEqual( errors, [] );
} );

check( 'the default toolbar keeps Word import as an icon button and leaves out the PDF button', async ( { page } ) => {
	const result = await page.evaluate( async () => {
		const editor = await window.CKEDITOR.ClassicEditor.create( document.querySelector( '#editor' ) );
		const buttons = Array.from( editor.ui.view.toolbar.items ).filter( item => item.label );
		const wordImport = buttons.find( item => item.label === 'Importer un fichier Word' );

		return {
			hasWordImport: Boolean( wordImport ),
			wordImportHasIcon: Boolean( wordImport && wordImport.icon && wordImport.element.querySelector( 'svg' ) ),
			wordImportWithText: wordImport ? wordImport.withText : null,
			hasPdf: buttons.some( item => item.label === 'Exporter en PDF' )
		};
	} );

	assert.deepStrictEqual( result, {
		hasWordImport: true,
		wordImportHasIcon: true,
		wordImportWithText: false,
		hasPdf: false
	} );
} );

check( 'an h-card survives a setData/getData round trip', async ( { page } ) => {
	const data = await page.evaluate( async () => {
		const editor = await window.CKEDITOR.ClassicEditor.create( document.querySelector( '#editor' ) );

		editor.setData( '<p><span class="h-card p-label" data-key="k1" data-entity="client">Acme</span></p>' );

		return editor.getData();
	} );

	assert.strictEqual( data, '<p><span class="h-card p-label" data-key="k1" data-entity="client">Acme</span></p>' );
} );

check( 'the AI document vocabulary survives a round trip with the documents htmlSupport rules', async ( { page } ) => {
	const data = await page.evaluate( async ( fragment, htmlSupport ) => {
		const editor = await window.CKEDITOR.ClassicEditor.create( document.querySelector( '#editor' ), { htmlSupport } );

		editor.setData( fragment );

		return editor.getData();
	}, AI_FRAGMENT, DOCUMENT_HTML_SUPPORT );

	for ( const expected of [
		'<h2>Titre</h2>',
		'<div class="keypoints"><div class="kp"><h4>Point</h4>',
		'<div class="callout tip"><p>Conseil.</p></div>',
		'<div class="steps"><ol><li><strong>Étape</strong> — description</li></ol></div>',
		'<table class="glossary">',
		'<img src="data:image/svg+xml;base64,PHN2Zy8+" alt="Schéma">',
		'<figcaption>Schéma</figcaption>'
	] ) {
		assert.ok( data.includes( expected ), `missing ${ expected } in ${ data }` );
	}

	assert.ok( /<figure class="[^"]*\billus\b[^"]*"/.test( data ), `figure lost its illus class in ${ data }` );
} );

check( 'without a theme the editor keeps the stock look', async ( { page } ) => {
	const style = await page.evaluate( async () => {
		const editor = await window.CKEDITOR.ClassicEditor.create( document.querySelector( '#editor' ) );

		return editor.ui.element.getAttribute( 'style' );
	} );

	assert.strictEqual( style, null );
} );

check( 'a theme is applied to the editor and to its balloon container', async ( { page } ) => {
	const result = await page.evaluate( async () => {
		const editor = await window.CKEDITOR.ClassicEditor.create( document.querySelector( '#editor' ), {
			theme: {
				preset: 'dark',
				colors: { primary: '#ff0000', background: 'var(--app-surface)' },
				radius: '12px',
				fontFamily: 'Georgia'
			}
		} );
		const body = editor.ui.view.body._bodyCollectionContainer;
		const read = ( element, name ) => element.style.getPropertyValue( name ).trim();

		return {
			focus: read( editor.ui.element, '--ck-color-focus-border' ),
			buttonOn: read( editor.ui.element, '--ck-color-button-on-color' ),
			background: read( editor.ui.element, '--ck-color-base-background' ),
			radius: read( editor.ui.element, '--ck-border-radius' ),
			font: read( editor.ui.element, '--ck-font-face' ),
			darkText: read( editor.ui.element, '--ck-color-text' ),
			contentColor: editor.ui.getEditableElement().style.getPropertyValue( 'color' ),
			bodyFocus: read( body, '--ck-color-focus-border' )
		};
	} );

	assert.strictEqual( result.focus, '#ff0000' );
	assert.strictEqual( result.buttonOn, '#ff0000' );
	assert.strictEqual( result.background, 'var(--app-surface)' );
	assert.strictEqual( result.radius, '12px' );
	assert.strictEqual( result.font, 'Georgia' );
	assert.ok( result.darkText, 'the dark preset sets a text colour' );
	// The editable inherits the page's text colour unless the theme sets it.
	assert.strictEqual( result.contentColor, 'rgb(241, 245, 249)' );
	assert.strictEqual( result.bodyFocus, '#ff0000' );
} );

check( 'htmlToPdf posts the editor data and hands a PDF File to onSuccess', async ( { page } ) => {
	routes[ '/pdf' ] = { status: 200, contentType: 'application/pdf', body: '%PDF-1.4 fake' };

	const result = await page.evaluate( () => new Promise( ( resolve, reject ) => {
		setTimeout( () => reject( new Error( 'timed out' ) ), 10000 );
		window.CKEDITOR.ClassicEditor.create( document.querySelector( '#editor' ), {
			toolbar: [ 'bold', 'htmlToPdf' ],
			htmlToPdf: {
				url: '/pdf',
				headers: async () => ( { Authorization: 'Bearer t0k3n' } ),
				data: () => ( { title: 'Mon document', moduleTitle: 'Module 1' } ),
				fileName: () => 'Mon document.pdf',
				onSuccess: async file => resolve( {
					name: file.name,
					type: file.type,
					text: await file.text(),
					busyAfter: window.__editor.plugins.get( 'HtmlToPdf' ).isBusy
				} ),
				onError: error => reject( error )
			}
		} ).then( editor => {
			window.__editor = editor;
			editor.setData( '<p>Bonjour</p>' );

			const button = Array.from( editor.ui.view.toolbar.items ).find( item => item.label === 'Exporter en PDF' );

			if ( !button || !button.element.querySelector( 'svg' ) ) {
				return reject( new Error( 'no PDF icon button in the toolbar' ) );
			}

			editor.execute( 'htmlToPdf' );
		} );
	} ) );

	assert.deepStrictEqual( result, {
		name: 'Mon document.pdf',
		type: 'application/pdf',
		text: '%PDF-1.4 fake',
		busyAfter: false
	} );

	const request = requests.find( entry => entry.path === '/pdf' );

	assert.strictEqual( request.method, 'POST' );
	assert.strictEqual( request.headers.authorization, 'Bearer t0k3n' );
	assert.strictEqual( request.headers[ 'content-type' ], 'application/json' );
	assert.deepStrictEqual( JSON.parse( request.body ), {
		html: '<p>Bonjour</p>',
		title: 'Mon document',
		moduleTitle: 'Module 1'
	} );
} );

check( 'htmlToPdf reports a failed conversion through onError and becomes usable again', async ( { page } ) => {
	routes[ '/pdf' ] = { status: 500, contentType: 'application/json', body: '{"errors":[]}' };

	const result = await page.evaluate( () => new Promise( ( resolve, reject ) => {
		setTimeout( () => reject( new Error( 'timed out' ) ), 10000 );
		window.CKEDITOR.ClassicEditor.create( document.querySelector( '#editor' ), {
			htmlToPdf: {
				url: '/pdf',
				onSuccess: () => resolve( { called: 'onSuccess' } ),
				onError: error => setTimeout( () => resolve( {
					called: 'onError',
					status: error.status,
					enabled: window.__editor.commands.get( 'htmlToPdf' ).isEnabled
				} ) )
			}
		} ).then( editor => {
			window.__editor = editor;
			editor.execute( 'htmlToPdf' );
		} );
	} ) );

	assert.deepStrictEqual( result, { called: 'onError', status: 500, enabled: true } );
} );

check( 'Word import replaces the content with the converted HTML', async ( { page } ) => {
	routes[ '/convert' ] = { status: 200, contentType: 'text/html', body: '<p>Importé</p>' };

	const data = await page.evaluate( async () => {
		const editor = await window.CKEDITOR.ClassicEditor.create( document.querySelector( '#editor' ), {
			wordImport: { url: '/convert' }
		} );

		editor.setData( '<p>Avant</p>' );
		await editor.plugins.get( 'WordImport' ).importFile( new File( [ 'docx' ], 'cours.docx' ) );

		return editor.getData();
	} );

	assert.strictEqual( data, '<p>Importé</p>' );
	assert.ok( requests.some( entry => entry.path === '/convert' && entry.method === 'POST' ) );
} );

check( 'Word import keeps the content and fires an error when the server fails', async ( { page } ) => {
	routes[ '/convert' ] = { status: 500, contentType: 'text/html', body: '<h1>Internal Server Error</h1>' };

	const result = await page.evaluate( async () => {
		const editor = await window.CKEDITOR.ClassicEditor.create( document.querySelector( '#editor' ), {
			wordImport: { url: '/convert' }
		} );
		const plugin = editor.plugins.get( 'WordImport' );
		let errorFired = false;

		plugin.on( 'wordImport:error', () => {
			errorFired = true;
		} );
		editor.setData( '<p>Avant</p>' );
		await plugin.importFile( new File( [ 'docx' ], 'cours.docx' ) );

		return { data: editor.getData(), errorFired, busy: plugin.isBusy };
	} );

	assert.deepStrictEqual( result, { data: '<p>Avant</p>', errorFired: true, busy: false } );
} );

( async () => {
	if ( !fs.existsSync( BUNDLE ) ) {
		console.error( `No bundle at ${ BUNDLE } — run "npm run build" first.` );
		process.exit( 1 );
	}

	const browser = await puppeteer.launch( { headless: true, args: [ '--no-sandbox' ] } );
	let failed = 0;

	for ( const { name, fn } of checks ) {
		routes = {};
		requests = [];

		const { page, errors } = await openPage( browser );

		try {
			await fn( { page, errors } );
			console.log( `  ✓ ${ name }` );
		} catch ( error ) {
			failed++;
			console.log( `  ✗ ${ name }\n    ${ String( error.message ).split( '\n' ).join( '\n    ' ) }` );
		} finally {
			await page.close();
		}
	}

	await browser.close();
	console.log( `\n${ checks.length - failed }/${ checks.length } passed` );
	process.exit( failed ? 1 : 0 );
} )();
