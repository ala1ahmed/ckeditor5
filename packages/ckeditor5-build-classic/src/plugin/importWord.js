/**
 * "Importer un fichier Word": uploads a .doc/.docx to `wordImport.url`, which
 * answers with the converted HTML, and replaces the editor content with it.
 *
 *     wordImport: { url: 'https://api.example.com/doc/convert-html' }
 *
 * The plugin is observable: `isBusy` is true while a conversion runs, and it
 * fires `wordImport:start`, `wordImport:end` and `wordImport:error`.
 */

/* globals document, fetch, FormData */

import { Plugin } from '@ckeditor/ckeditor5-core';
import { ButtonView } from '@ckeditor/ckeditor5-ui';

import wordImportIcon from '../icons/word-import.svg';

export default class WordImport extends Plugin {
	static get pluginName() {
		return 'WordImport';
	}

	init() {
		const editor = this.editor;

		this.set( 'isBusy', false );

		editor.ui.componentFactory.add( 'wordImport', locale => {
			const button = new ButtonView( locale );

			button.set( {
				label: 'Importer un fichier Word',
				icon: wordImportIcon,
				tooltip: true
			} );

			button.bind( 'isEnabled' ).to( this, 'isBusy', isBusy => !isBusy );
			button.on( 'execute', () => this._pickFile() );

			return button;
		} );
	}

	importFile( file ) {
		const { url } = this.editor.config.get( 'wordImport' ) || {};
		const formData = new FormData();

		formData.append( 'file', file );

		this.isBusy = true;
		this.fire( 'wordImport:start', { file } );

		return fetch( url, { method: 'POST', body: formData } )
			.then( response => {
				if ( !response.ok ) {
					throw Object.assign( new Error( `Word import failed with status ${ response.status }` ), { status: response.status } );
				}

				return response.text();
			} )
			.then( html => {
				this.editor.setData( html );
				this.isBusy = false;
				this.fire( 'wordImport:end', { file } );
			} )
			.catch( error => {
				this.isBusy = false;
				this.fire( 'wordImport:error', { file, error } );
			} );
	}

	_pickFile() {
		const input = document.createElement( 'input' );

		input.type = 'file';
		input.accept = '.doc,.docx';
		input.addEventListener( 'change', () => {
			if ( input.files[ 0 ] ) {
				this.importFile( input.files[ 0 ] );
			}
		} );
		input.click();
	}
}
