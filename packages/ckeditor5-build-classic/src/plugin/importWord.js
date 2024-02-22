import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ButtonView from '@ckeditor/ckeditor5-ui/src/button/buttonview';

export default class WordImport extends Plugin {
	static get requires() {
		return [ButtonView];
	}

	init() {
		const editor = this.editor;
		editor.ui.componentFactory.add('wordImport', (locale) => {
			const button = new ButtonView(locale);

			button.set({
				label: 'Importer un fichier word',
				withText: true,
			});

			button.on('execute', () => {
				const input = document.createElement('input');
				input.type = 'file';
				input.accept = '.doc,.docx';
				input.onchange = function () {
					const file = this.files[0];
					const formData = new FormData();
					formData.append('file', file);

					fetch(editor.config.get('wordImport').url, {
						method: 'POST',
						body: formData,
					})
						.then((response) => {
							return response.text();

						})
						.then((html) => {
							editor.setData(html);
						})
						.catch((error) => console.error(error));
				};
				input.click();
			});

			return button;
		});
	}

	static get url() {
		return this._url;
	}

	static set url(value) {
		this._url = value;
	}

	static get pluginName() {
		return 'WordImport';
	}
}
