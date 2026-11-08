/** Text reduced to lowercase letters and digits, so line breaks, quotes and punctuation do not matter. */
export const matchKey = (text: string) =>
	text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
