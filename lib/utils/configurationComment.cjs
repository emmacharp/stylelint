// NOTICE: This file is generated by Rollup. To modify it,
// please instead edit the ESM counterpart and rebuild with Rollup (npm run build).
'use strict';

const validateTypes = require('./validateTypes.cjs');

const DISABLE_COMMAND = '-disable';
const DISABLE_LINE_COMMAND = '-disable-line';
const DISABLE_NEXT_LINE_COMMAND = '-disable-next-line';
const ENABLE_COMMAND = '-enable';

const ALL_COMMANDS = new Set([
	DISABLE_COMMAND,
	DISABLE_LINE_COMMAND,
	DISABLE_NEXT_LINE_COMMAND,
	ENABLE_COMMAND,
]);

const DEFAULT_CONFIGURATION_COMMENT = 'stylelint';

/** @typedef {import('postcss').Comment} Comment */

/**
 * Extract a command from a given comment.
 *
 * @param {string} commentText
 * @param {string} [configurationComment]
 * @returns {string}
 */
function extractConfigurationComment(
	commentText,
	configurationComment = DEFAULT_CONFIGURATION_COMMENT,
) {
	const [command] = commentText.split(/\s/, 1);

	validateTypes.assertString(command);

	return command.replace(configurationComment, '');
}

/**
 * Tests if the given comment is a Stylelint command.
 *
 * @param {string} commentText
 * @param {string} [configurationComment]
 * @returns {boolean}
 */
function isConfigurationComment(
	commentText,
	configurationComment = DEFAULT_CONFIGURATION_COMMENT,
) {
	const command = extractConfigurationComment(commentText, configurationComment);

	return command !== undefined && ALL_COMMANDS.has(command);
}

/**
 * Get full stylelint command
 *
 * @param {string} command
 * @param {string} [configurationComment]
 * @returns {string}
 */
function getConfigurationComment(
	command,
	configurationComment = DEFAULT_CONFIGURATION_COMMENT,
) {
	return `${configurationComment}${command}`;
}

exports.DEFAULT_CONFIGURATION_COMMENT = DEFAULT_CONFIGURATION_COMMENT;
exports.DISABLE_COMMAND = DISABLE_COMMAND;
exports.DISABLE_LINE_COMMAND = DISABLE_LINE_COMMAND;
exports.DISABLE_NEXT_LINE_COMMAND = DISABLE_NEXT_LINE_COMMAND;
exports.ENABLE_COMMAND = ENABLE_COMMAND;
exports.extractConfigurationComment = extractConfigurationComment;
exports.getConfigurationComment = getConfigurationComment;
exports.isConfigurationComment = isConfigurationComment;
