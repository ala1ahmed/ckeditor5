/**
 * "Exporter en PDF": sends the editor's HTML to a conversion endpoint and gets
 * a PDF back. The editor only builds the request; the server renders the PDF.
 *
 *     htmlToPdf: {
 *         url: 'https://api.example.com/doc/html-to-pdf',
 *         headers: async () => ( { Authorization: `Bearer ${ await getToken() }` } ),
 *         data: () => ( { title: 'Mon document' } ),   // merged into the JSON body
 *         fileName: () => 'Mon document.pdf',
 *         onSuccess: file => {},   // without it, the PDF is downloaded
 *         onError: error => {}
 *     }
 *
 * `headers`, `data` and `fileName` may be values or (async) functions; they
 * are resolved on every export, so a token read there is always current.
 *
 * Toolbar item and command: `htmlToPdf`. The plugin is observable: `isBusy` is
 * true while a conversion runs, and it fires `htmlToPdf:start`, `htmlToPdf:end`
 * and `htmlToPdf:error`.
 */

/* globals document, fetch, File, URL, setTimeout, console */

import { Command, Plugin } from '@ckeditor/ckeditor5-core';
import { ButtonView } from '@ckeditor/ckeditor5-ui';

import htmlToPdfIcon from '../icons/html-to-pdf.svg';

class HtmlToPdfCommand extends Command {
	constructor( editor, plugin ) {
		super( editor );

		// Exporting reads the content; it stays available in read-only mode.
		this.affectsData = false;
		this._plugin = plugin;
		this.listenTo( plugin, 'change:isBusy', () => this.refresh() );
	}

	refresh() {
		this.isEnabled = !this._plugin.isBusy;
	}

	execute() {
		return this._plugin.convert();
	}
}

export default class HtmlToPdf extends Plugin {
	static get pluginName() {
		return 'HtmlToPdf';
	}

	init() {
		const editor = this.editor;

		this.set( 'isBusy', false );

		const command = new HtmlToPdfCommand( editor, this );

		editor.commands.add( 'htmlToPdf', command );

		editor.ui.componentFactory.add( 'htmlToPdf', locale => {
			const button = new ButtonView( locale );

			button.set( {
				label: 'Exporter en PDF',
				icon: htmlToPdfIcon,
				tooltip: true
			} );

			button.bind( 'isEnabled' ).to( command );
			button.on( 'execute', () => editor.execute( 'htmlToPdf' ) );

			return button;
		} );
	}

	async convert() {
		if ( this.isBusy ) {
			return null;
		}

		const config = this.editor.config.get( 'htmlToPdf' ) || {};
		let file;

		this.isBusy = true;
		this.fire( 'htmlToPdf:start' );

		try {
			if ( !config.url ) {
				throw new Error( 'htmlToPdf.url is not configured.' );
			}

			const response = await fetch( config.url, {
				method: 'POST',
				headers: { ...( await resolve( config.headers ) ), 'Content-Type': 'application/json' },
				body: JSON.stringify( { ...( await resolve( config.data ) ), html: this.editor.getData() } )
			} );

			if ( !response.ok ) {
				throw Object.assign( new Error( `PDF conversion failed with status ${ response.status }` ), { status: response.status } );
			}

			const blob = await response.blob();

			file = new File( [ blob ], ( await resolve( config.fileName ) ) || 'document.pdf', { type: 'application/pdf' } );
		} catch ( error ) {
			this.isBusy = false;
			this.fire( 'htmlToPdf:error', { error } );

			if ( config.onError ) {
				config.onError( error );
			} else {
				console.error( error );
			}

			return null;
		}

		this.isBusy = false;
		this.fire( 'htmlToPdf:end', { file } );

		if ( config.onSuccess ) {
			config.onSuccess( file );
		} else {
			download( file );
		}

		return file;
	}
}

async function resolve( value ) {
	return typeof value === 'function' ? value() : value;
}

function download( file ) {
	const url = URL.createObjectURL( file );
	const link = document.createElement( 'a' );

	link.href = url;
	link.download = file.name;
	document.body.appendChild( link );
	link.click();
	link.remove();
	setTimeout( () => URL.revokeObjectURL( url ), 0 );
}
