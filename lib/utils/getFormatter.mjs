import { EXIT_CODE_INVALID_CONFIG } from '../constants.mjs';
import formatters from '../formatters/index.mjs';
import getConfigForFile from '../getConfigForFile.mjs';
import getFormatterOptionsText from './getFormatterOptionsText.mjs';

/** @import {Formatter, FormatterType, InternalApi} from 'stylelint' */

/**
 * @param {InternalApi} stylelint
 * @param {Object} [params]
 * @param {FormatterType | Formatter | undefined} [params.formatterType]
 * @returns {Promise<Formatter>}
 */
export default async function getFormatter(stylelint) {
	const cwd = stylelint._options.cwd;
	const configPath = stylelint._options.configFile || cwd;
	let formatter = stylelint._options.formatter;

	if (!formatter) {
		let configForFile;

		try {
			configForFile = await getConfigForFile(stylelint, configPath);
		} catch (err) {
			if (err instanceof Error && 'code' in err && err.code === EXIT_CODE_INVALID_CONFIG) {
				configForFile = undefined;
			} else {
				throw err;
			}
		}

		const resolvedConfig = stylelint._options.config ? stylelint._options : configForFile;

		formatter = resolvedConfig?.config.formatter;
	}

	if (typeof formatter === 'string') {
		const formatterFunction = formatters[formatter];

		if (formatterFunction === undefined) {
			const formattersText = getFormatterOptionsText(', ', '"');

			throw new Error(`You must use a valid formatter option: ${formattersText} or a function`);
		}

		return formatterFunction;
	}

	// Assume a function or a promise of a function.
	if (typeof formatter === 'function' || formatter) {
		return Promise.resolve(formatter);
	}

	formatter ??= stylelint._options._defaultFormatter ?? 'json';

	return formatters[formatter];
}
