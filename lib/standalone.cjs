// NOTICE: This file is generated by Rollup. To modify it,
// please instead edit the ESM counterpart and rebuild with Rollup (npm run build).
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const process = require('node:process');
const createDebug = require('debug');
const fastGlob = require('fast-glob');
const globby = require('globby');
const normalizePath = require('normalize-path');
const writeFileAtomic = require('write-file-atomic');
const validateTypes = require('./utils/validateTypes.cjs');
const allFilesIgnoredError = require('./utils/allFilesIgnoredError.cjs');
const noFilesFoundError = require('./utils/noFilesFoundError.cjs');
const createPartialStylelintResult = require('./createPartialStylelintResult.cjs');
const createStylelint = require('./createStylelint.cjs');
const emitDeprecationWarning = require('./utils/emitDeprecationWarning.cjs');
const filterFilePaths = require('./utils/filterFilePaths.cjs');
const getConfigForFile = require('./getConfigForFile.cjs');
const getFileIgnorer = require('./utils/getFileIgnorer.cjs');
const getFormatter = require('./utils/getFormatter.cjs');
const lintSource = require('./lintSource.cjs');
const prepareReturnValue = require('./prepareReturnValue.cjs');

const debug = createDebug('stylelint:standalone');

const ALWAYS_IGNORED_GLOBS = ['**/node_modules/**'];

/** @import {Formatter, FormatterType} from 'stylelint' */

/**
 * @type {import('stylelint').PublicApi['lint']}
 */
async function standalone({
	allowEmptyInput,
	cache,
	cacheLocation,
	cacheStrategy,
	code,
	codeFilename,
	config,
	configBasedir,
	configFile,
	customSyntax,
	cwd = process.cwd(),
	disableDefaultIgnores,
	files,
	fix,
	formatter,
	globbyOptions,
	ignoreDisables,
	ignorePath,
	ignorePattern,
	maxWarnings,
	quiet,
	quietDeprecationWarnings = false,
	reportDescriptionlessDisables,
	reportInvalidScopeDisables,
	reportNeedlessDisables,
}) {
	const startTime = Date.now();

	const hasOneValidInput = (files && !validateTypes.isString(code)) || (!files && validateTypes.isString(code));

	if (!hasOneValidInput) {
		return Promise.reject(
			new Error('You must pass stylelint a `files` glob or a `code` string, though not both'),
		);
	}

	// The ignorer will be used to filter file paths after the glob is checked,
	// before any files are actually read

	/** @type {import('ignore').Ignore} */
	let ignorer;

	try {
		ignorer = getFileIgnorer({ cwd, ignorePath, ignorePattern });
	} catch (error) {
		return Promise.reject(error);
	}

	const stylelint = createStylelint({
		cacheLocation,
		cacheStrategy,
		config,
		configFile,
		configBasedir,
		cwd,
		formatter,
		ignoreDisables,
		ignorePath,
		reportNeedlessDisables,
		reportInvalidScopeDisables,
		reportDescriptionlessDisables,
		customSyntax,
		fix,
		quiet,
		quietDeprecationWarnings,
	});

	/** @type {Formatter} */
	let formatterFunction;

	try {
		/** @see https://github.com/stylelint/stylelint/issues/7447 */
		if (!quietDeprecationWarnings && formatter === 'github') {
			emitDeprecationWarning(
				'"github" formatter is deprecated.',
				'GITHUB_FORMATTER',
				'Please use "stylelint-actions-formatters" instead.',
			);
		}

		formatterFunction = await getFormatter(stylelint, { formatterType: 'json' });
	} catch (error) {
		return Promise.reject(error);
	}

	if (!files) {
		validateTypes.assertString(code);

		const absoluteCodeFilename =
			codeFilename !== undefined && !path.isAbsolute(codeFilename)
				? path.join(cwd, codeFilename)
				: codeFilename;

		formatterFunction = await getFormatter(stylelint, { filePath: absoluteCodeFilename });

		// if file is ignored, return nothing
		if (
			absoluteCodeFilename &&
			!filterFilePaths(ignorer, [path.relative(cwd, absoluteCodeFilename)]).length
		) {
			return prepareReturnValue({
				results: [],
				maxWarnings,
				quietDeprecationWarnings,
				formatter: formatterFunction,
				cwd,
			});
		}

		let stylelintResult;

		try {
			const postcssResult = await lintSource(stylelint, {
				code,
				codeFilename: absoluteCodeFilename,
			});

			stylelintResult = createPartialStylelintResult(postcssResult);
		} catch (error) {
			stylelintResult = handleError(error);
		}

		formatterFunction = await getFormatter(stylelint, { filePath: absoluteCodeFilename });
		await postProcessStylelintResult(stylelint, stylelintResult, absoluteCodeFilename);

		const postcssResult = stylelintResult._postcssResult;
		const returnValue = prepareReturnValue({
			results: [stylelintResult],
			maxWarnings,
			quietDeprecationWarnings,
			formatter: formatterFunction,
			cwd,
		});

		const autofix = fix ?? config?.fix ?? false;

		if (autofix && postcssResult && !postcssResult.stylelint.ignored) {
			returnValue.code = postcssResult.opts
				? // If we're fixing, the output should be the fixed code
				  postcssResult.root.toString(postcssResult.opts.syntax)
				: // If the writing of the fix is disabled, the input code is returned as-is
				  code;
			returnValue._output = returnValue.code; // TODO: Deprecated. Remove in the next major version.
		}

		return returnValue;
	}

	let fileList = [files].flat().map((entry) => {
		const globCWD = (globbyOptions && globbyOptions.cwd) || cwd;
		const absolutePath = !path.isAbsolute(entry) ? path.join(globCWD, entry) : path.normalize(entry);

		if (fs.existsSync(absolutePath)) {
			// This path points to a file. Return an escaped path to avoid globbing
			return fastGlob.escapePath(normalizePath(entry));
		}

		return entry;
	});

	if (!disableDefaultIgnores) {
		fileList = fileList.concat(ALWAYS_IGNORED_GLOBS.map((glob) => `!${glob}`));
	}

	// do not cache if config is explicitly overridden by option
	const useCache = cache ?? config?.cache ?? false;

	if (!useCache) {
		stylelint._fileCache.destroy();
	}

	const effectiveGlobbyOptions = {
		cwd,
		...(globbyOptions || {}),
		absolute: true,
	};

	const globCWD = effectiveGlobbyOptions.cwd;

	let filePaths = await globby(fileList, effectiveGlobbyOptions);
	// Record the length of filePaths before ignore operation
	// Prevent prompting "No files matching the pattern 'xx' were found." when .stylelintignore ignore all input files
	const filePathsLengthBeforeIgnore = filePaths.length;

	// The ignorer filter needs to check paths relative to cwd
	filePaths = filterFilePaths(
		ignorer,
		filePaths.map((p) => path.relative(globCWD, p)),
	);

	let stylelintResults;

	if (filePaths.length) {
		let absoluteFilePaths = filePaths.map((filePath) => {
			const absoluteFilepath = !path.isAbsolute(filePath)
				? path.join(globCWD, filePath)
				: path.normalize(filePath);

			return absoluteFilepath;
		});

		const getStylelintResults = absoluteFilePaths.map(async (absoluteFilepath) => {
			debug(`Processing ${absoluteFilepath}`);

			try {
				const postcssResult = await lintSource(stylelint, {
					filePath: absoluteFilepath,
					cache: useCache,
				});

				if (
					(postcssResult.stylelint.stylelintError || postcssResult.stylelint.stylelintWarning) &&
					useCache
				) {
					debug(`${absoluteFilepath} contains linting errors and will not be cached.`);
					stylelint._fileCache.removeEntry(absoluteFilepath);
				}

				/**
				 * If we're fixing, save the file with changed code
				 */
				if (postcssResult.root && postcssResult.opts && !postcssResult.stylelint.ignored && fix) {
					const fixedCss = postcssResult.root.toString(postcssResult.opts.syntax);

					if (
						postcssResult.root &&
						postcssResult.root.source &&
						postcssResult.root.source.input.css !== fixedCss
					) {
						await writeFileAtomic(absoluteFilepath, fixedCss);
					}
				}

				const stylelintResult = createPartialStylelintResult(postcssResult);

				formatterFunction = await getFormatter(stylelint, { filePath: absoluteFilepath });
				await postProcessStylelintResult(stylelint, stylelintResult, absoluteFilepath);

				return stylelintResult;
			} catch (error) {
				// On any error, we should not cache the lint result
				stylelint._fileCache.removeEntry(absoluteFilepath);

				const stylelintResult = handleError(error);

				formatterFunction = await getFormatter(stylelint, { filePath: absoluteFilepath });
				await postProcessStylelintResult(stylelint, stylelintResult, absoluteFilepath);

				return stylelintResult;
			}
		});

		stylelintResults = await Promise.all(getStylelintResults);
	} else if (allowEmptyInput || config?.allowEmptyInput || (await canAllowEmptyInput(stylelint))) {
		stylelintResults = await Promise.all([]);
	} else if (filePathsLengthBeforeIgnore) {
		// All input files ignored
		stylelintResults = await Promise.reject(new allFilesIgnoredError());
	} else {
		stylelintResults = await Promise.reject(new noFilesFoundError(fileList));
	}

	if (useCache) {
		stylelint._fileCache.reconcile();
	}

	const result = prepareReturnValue({
		results: stylelintResults,
		maxWarnings,
		quietDeprecationWarnings,
		formatter: formatterFunction,
		cwd,
	});

	debug(`Linting complete in ${Date.now() - startTime}ms`);

	return result;
}

/**
 * @import {CssSyntaxError} from 'stylelint'
 *
 * @param {unknown} error
 * @return {import('stylelint').LintResult}
 */
function handleError(error) {
	if (error instanceof Error && error.name === 'CssSyntaxError') {
		return createPartialStylelintResult(undefined, /** @type {CssSyntaxError} */ (error));
	}

	throw error;
}

/**
 * @param {import('stylelint').InternalApi} stylelint
 * @returns {Promise<boolean>}
 */
async function canAllowEmptyInput(stylelint) {
	const config = await getConfigForFile(stylelint);

	return Boolean(config?.config?.allowEmptyInput);
}

/**
 * @param {import('stylelint').InternalApi} stylelint
 * @param {import('stylelint').LintResult} stylelintResult
 * @param {string} [filePath]
 * @return {Promise<void>}
 */
async function postProcessStylelintResult(stylelint, stylelintResult, filePath) {
	const configForFile = await getConfigForFile(stylelint, filePath, filePath);

	const config = configForFile === null ? {} : configForFile.config;

	if (!config._processorFunctions) {
		return;
	}

	for (let postprocess of config._processorFunctions.values()) {
		postprocess?.(stylelintResult, stylelintResult._postcssResult?.root);
	}
}

module.exports = standalone;
