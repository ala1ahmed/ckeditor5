/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* globals document */

import { Plugin } from '@ckeditor/ckeditor5-core';
import { UpcastWriter } from '@ckeditor/ckeditor5-engine';
import {
	Widget,
	toWidget,
	viewToModelPositionOutsideModelElement
} from '@ckeditor/ckeditor5-widget';

export class HCardEditing extends Plugin {
	static get pluginName() {
		return 'HCardEditing';
	}

	static get requires() {
		return [ Widget ];
	}

	init() {
		this._defineSchema();
		this._defineConverters();
		this._defineClipboardInputOutput();

		// View-to-model position mapping is needed because an h-card element in the model is represented by a single element,
		// but in the view it is a more complex structure.
		this.editor.editing.mapper.on(
			'viewToModelPosition',
			viewToModelPositionOutsideModelElement(
				this.editor.model,
				viewElement => viewElement.hasClass( 'h-card' )
			)
		);
	}

	_defineSchema() {
		this.editor.model.schema.register( 'h-card', {
			allowWhere: '$text',
			isInline: true,
			isObject: true,
			allowAttributes: [ 'entity', 'label', 'key' ]
		} );
	}

	_defineConverters() {
		const conversion = this.editor.conversion;

		// Data-to-model conversion.
		conversion.for( 'upcast' ).elementToElement( {
			view: {
				name: 'span',
				classes: [ 'h-card' ]
			},
			model: ( viewElement, { writer } ) => {
				return writer.createElement(
					'h-card',
					getCardDataFromViewElement( viewElement )
				);
			}
		} );

		// Model-to-data conversion.
		conversion.for( 'dataDowncast' ).elementToElement( {
			model: 'h-card',
			view: ( modelItem, { writer: viewWriter } ) =>
				createCardView( modelItem, viewWriter )
		} );

		// Model-to-view conversion.
		conversion.for( 'editingDowncast' ).elementToElement( {
			model: 'h-card',
			view: ( modelItem, { writer: viewWriter } ) =>
				toWidget( createCardView( modelItem, viewWriter ), viewWriter )
		} );

		// Helper method for both downcast converters.
		function createCardView( modelItem, viewWriter ) {
			const entity = modelItem.getAttribute( 'entity' );
			const label = modelItem.getAttribute( 'label' );
			const key = modelItem.getAttribute( 'key' );
			const cardView = viewWriter.createContainerElement( 'span', {
				class: 'h-card p-label',
				'data-key': key,
				'data-entity': entity
			} );
			viewWriter.insert(
				viewWriter.createPositionAt( cardView, 0 ),
				viewWriter.createText( label )
			);
			return cardView;
		}
	}

	// Integration with the clipboard pipeline.
	_defineClipboardInputOutput() {
		const view = this.editor.editing.view;
		const viewDocument = view.document;

		// Processing pasted or dropped content.
		this.listenTo( viewDocument, 'clipboardInput', ( evt, data ) => {
			// The clipboard content was already processed by the listener on the higher priority
			// (for example while pasting into the code block).
			if ( data.content ) {
				return;
			}

			const sentData = data.dataTransfer.getData( 'data' );
			if ( !sentData ) {
				return;
			}

			// Use JSON data encoded in the DataTransfer.
			const cleanData = JSON.parse( sentData );
			// Translate the h-card data to a view fragment.
			const writer = new UpcastWriter( viewDocument );
			const fragment = writer.createDocumentFragment();

			writer.appendChild(
				writer.createElement(
					'span',
					{
						class: 'h-card p-label',
						'data-key': cleanData.key,
						'data-entity': cleanData.entity
					},
					cleanData.label
				),
				fragment
			);

			// Provide the content to the clipboard pipeline for further processing.
			data.content = fragment;
		} );

		// Processing copied, pasted or dragged content.
		this.listenTo( document, 'clipboardOutput', ( evt, data ) => {
			if ( data.content.childCount != 1 ) {
				return;
			}

			const viewElement = data.content.getChild( 0 );

			if (
				viewElement.is( 'element', 'span' ) &&
				viewElement.hasClass( 'h-card' )
			) {
				data.dataTransfer.setData(
					'data',
					JSON.stringify( getCardDataFromViewElement( viewElement ) )
				);
			}
		} );
	}
}

//
// H-Card helper functions.
//

function getCardDataFromViewElement( viewElement ) {
	return {
		key: viewElement.getAttribute( 'data-key' ),
		label: getText( viewElement ),
		entity: viewElement.getAttribute( 'data-entity' )
	};
}

function getText( viewElement ) {
	return Array.from( viewElement.getChildren() )
		.map( node => ( node.is( '$text' ) ? node.data : '' ) )
		.join( '' );
}
