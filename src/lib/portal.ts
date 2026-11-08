/**
 * Moves an element to the end of <body> while it is shown. A menu that opens beside the sidebar
 * would otherwise be clipped by it: the sidebar scrolls and is moved by a transform, and either one
 * traps `position: fixed` children.
 */
export function portal(node: HTMLElement) {
	document.body.appendChild(node);
	return { destroy: () => node.remove() };
}
