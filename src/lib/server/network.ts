const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** The eight 16-bit groups of an IPv6 address, or null if it is not one. */
function groupsOf(address: string): number[] | null {
	let text = address.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
	// A dotted IPv4 tail (::ffff:1.2.3.4) is two groups.
	const tail = text.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
	if (tail) {
		const v4 = IPV4.exec(tail[1])!.slice(1).map(Number);
		if (v4.some((part) => part > 255)) return null;
		text = text.slice(0, -tail[1].length) + ((v4[0] << 8) | v4[1]).toString(16) + ':' + ((v4[2] << 8) | v4[3]).toString(16);
	}
	const halves = text.split('::');
	if (halves.length > 2) return null;
	const parse = (part: string) => (part === '' ? [] : part.split(':'));
	const head = parse(halves[0]);
	const rest = halves.length === 2 ? parse(halves[1]) : [];
	const missing = 8 - head.length - rest.length;
	if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
	const all = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest];
	if (all.length !== 8 || !all.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return null;
	return all.map((group) => parseInt(group, 16));
}

/**
 * The network a client address belongs to, for counting use per network. An IPv4 address stands for
 * itself. An IPv6 address stands for its /64, because a customer is normally given a whole /64 and
 * can switch among its addresses freely, so counting each address would let one person look like many.
 * An IPv4 address written in IPv6 form counts as that IPv4 address. Anything unreadable is kept as is.
 */
export function networkOf(ip: string): string {
	const trimmed = ip.trim();
	if (IPV4.test(trimmed)) return trimmed;
	const groups = groupsOf(trimmed);
	if (!groups) return trimmed;
	const mapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
	if (mapped) return `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
	return groups.slice(0, 4).map((g) => g.toString(16)).join(':') + '::/64';
}
