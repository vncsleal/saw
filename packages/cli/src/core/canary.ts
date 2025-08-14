export async function canaryFetch(url: string, init?: RequestInit): Promise<Response> { return fetch(url, init); }
