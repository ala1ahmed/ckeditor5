/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module list/tododocumentlist
 */

import TodoDocumentListEditing from './tododocumentlist/tododocumentlistediting.js';
import TodoListUI from './todolist/todolistui.js';
import { Plugin } from 'ckeditor5/src/core.js';

import '../theme/todolist.css';

/**
 * The to-do list feature.
 *
 * This is a "glue" plugin that loads the {@link module:list/tododocumentlist/tododocumentlistediting~TodoDocumentListEditing to-do list
 * editing feature} and the {@link module:list/todolist/todolistui~TodoListUI to-do list UI feature}.
 */
export default class TodoDocumentList extends Plugin {
	/**
	 * @inheritDoc
	 */
	public static get requires() {
		return [ TodoDocumentListEditing, TodoListUI ] as const;
	}

	/**
	 * @inheritDoc
	 */
	public static get pluginName() {
		return 'TodoDocumentList' as const;
	}
}
