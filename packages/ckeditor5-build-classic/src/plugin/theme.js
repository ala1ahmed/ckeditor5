/**
 * Per-instance theming.
 *
 *     ClassicEditor.create( element, {
 *         theme: {
 *             preset: 'dark',                         // 'light' (stock look, default) or 'dark'
 *             colors: { primary: '#4b2da8', background: 'var(--surface-card)' },
 *             radius: '8px',
 *             fontFamily: 'inherit'
 *         }
 *     } );
 *
 * The theme becomes inline CSS custom properties on this editor's UI only, so
 * several editors on one page can look different. Values may be `var(--token)`
 * references: an app that switches light/dark by redefining its tokens then
 * re-themes the editor without re-creating it.
 */

import { Plugin } from '@ckeditor/ckeditor5-core';

// Which theme colour drives each CKEditor variable.
const VARIABLES_BY_ROLE = {
	primary: [
		'--ck-color-focus-border',
		'--ck-color-button-on-color',
		'--ck-color-button-action-background',
		'--ck-color-switch-button-on-background',
		'--ck-color-list-button-on-text',
		'--ck-color-widget-hover-border',
		'--ck-color-link-default'
	],
	primaryHover: [
		'--ck-color-button-action-hover-background',
		'--ck-color-button-action-active-background',
		'--ck-color-switch-button-on-hover-background'
	],
	primarySoft: [
		'--ck-color-button-on-background',
		'--ck-color-button-on-hover-background',
		'--ck-color-button-on-active-background',
		'--ck-color-button-on-disabled-background',
		'--ck-color-button-action-disabled-background',
		'--ck-color-list-button-on-background'
	],
	background: [
		'--ck-color-base-background',
		'--ck-color-dropdown-panel-background',
		'--ck-color-panel-background',
		'--ck-color-list-background',
		'--ck-color-input-background',
		'--ck-color-labeled-field-label-background'
	],
	surface: [
		'--ck-color-toolbar-background',
		'--ck-color-base-foreground',
		'--ck-color-input-disabled-background'
	],
	surfaceHover: [
		'--ck-color-button-default-hover-background',
		'--ck-color-button-default-active-background',
		'--ck-color-list-button-hover-background',
		'--ck-color-split-button-hover-background'
	],
	text: [
		'--ck-color-text',
		'--ck-color-base-text',
		'--ck-color-input-text'
	],
	textMuted: [
		'--ck-color-input-disabled-text'
	],
	border: [
		'--ck-color-base-border',
		'--ck-color-toolbar-border',
		'--ck-color-dropdown-panel-border',
		'--ck-color-panel-border',
		'--ck-color-input-border',
		'--ck-color-input-disabled-border',
		'--ck-color-split-button-hover-border',
		'--ck-color-widget-blurred-border'
	]
};

const PRESETS = {
	// The stock Lark look: only what the caller passes is changed.
	light: { colors: {}, variables: {} },

	// Mirrors the dark palette of Wiiform's design tokens.
	dark: {
		colors: {
			primary: '#7c5ce8',
			primaryHover: '#9b82f0',
			primarySoft: '#36366a',
			background: '#1e293b',
			surface: '#334155',
			surfaceHover: '#475569',
			text: '#f1f5f9',
			textMuted: '#94a3b8',
			border: '#475569'
		},
		variables: {
			'--ck-color-button-default-background': 'transparent',
			'--ck-color-shadow-drop': 'rgba(0, 0, 0, 0.5)',
			'--ck-color-shadow-drop-active': 'rgba(0, 0, 0, 0.7)',
			'--ck-color-shadow-inner': 'rgba(0, 0, 0, 0.3)'
		}
	}
};

export function themeToVariables( theme = {} ) {
	const preset = PRESETS[ theme.preset ] || PRESETS.light;
	const colors = { ...preset.colors, ...( theme.colors || {} ) };
	const variables = { ...preset.variables };

	for ( const [ role, names ] of Object.entries( VARIABLES_BY_ROLE ) ) {
		if ( colors[ role ] ) {
			for ( const name of names ) {
				variables[ name ] = colors[ role ];
			}
		}
	}

	if ( theme.radius ) {
		variables[ '--ck-border-radius' ] = theme.radius;
	}

	if ( theme.fontFamily ) {
		variables[ '--ck-font-face' ] = theme.fontFamily;
	}

	return variables;
}

export default class Theme extends Plugin {
	static get pluginName() {
		return 'Theme';
	}

	init() {
		const theme = this.editor.config.get( 'theme' );

		if ( !theme ) {
			return;
		}

		this.listenTo( this.editor.ui, 'ready', () => this._apply( theme ) );
	}

	_apply( theme ) {
		const ui = this.editor.ui;
		const variables = themeToVariables( theme );

		// Balloons and panels (link, image, table toolbars…) are rendered into a
		// per-editor container under <body>, outside the editor element. Lark
		// 37.1.0 has no public getter for it; the version is pinned exactly, so
		// reading the private field is safe until the next upgrade.
		const elements = [
			ui.element,
			ui.view.toolbar && ui.view.toolbar.element,
			ui.view.body && ui.view.body._bodyCollectionContainer
		].filter( ( element, index, all ) =>
			element && !all.some( ( other, otherIndex ) => otherIndex !== index && other && other !== element && other.contains( element ) )
		);

		for ( const element of elements ) {
			for ( const [ name, value ] of Object.entries( variables ) ) {
				element.style.setProperty( name, value );
			}
		}

		// The editable inherits the page's text colour, which Lark leaves alone:
		// on a dark background the content would stay dark. The editing view owns
		// the editable's attributes, so the style goes through the view.
		if ( variables[ '--ck-color-text' ] ) {
			const view = this.editor.editing.view;

			view.change( writer => writer.setStyle( 'color', variables[ '--ck-color-text' ], view.document.getRoot() ) );
		}
	}
}
