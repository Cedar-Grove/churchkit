import type { Env } from '../types';
import { json, err } from '../lib/response';
import { ensureDeviceTokensColumns } from '../lib/data';

/**
 * A OneSignal player ID is a UUID. Validating the shape keeps junk out of
 * the table and means an arbitrary string can't be used as a row key.
 */
const PLAYER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readBody(request: Request): Promise<any | null> {
	try {
		const body = await request.json();
		return body && typeof body === 'object' ? body : null;
	} catch {
		return null;
	}
}

/**
 * POST /api/push/register
 * Called by the mobile app (via OneSignal SDK lifecycle hooks) to store the
 * device's OneSignal player_id.
 */
export async function handlePushRegister(request: Request, env: Env): Promise<Response> {
	const body = await readBody(request);
	if (!body) return err('Invalid request body', 400);

	const { player_id, platform, app_version } = body;
	if (typeof player_id !== 'string' || !PLAYER_ID_PATTERN.test(player_id)) {
		return err('A valid player_id is required');
	}

	// pco_person_id is deliberately not accepted from the request body. This
	// endpoint is unauthenticated, so a caller's claim about which person a
	// device belongs to is unverified — honoring it would let anyone attach a
	// device to any member's record, and push targeting reads that column.
	// Rows written before this are left as they are; the column is only
	// writable from an authenticated path that can actually prove the link.
	await ensureDeviceTokensColumns(env);
	await env.DB.prepare(`
		INSERT INTO device_tokens (onesignal_player_id, platform, app_version, created_at, last_seen_at)
		VALUES (?, ?, ?, unixepoch(), unixepoch())
		ON CONFLICT(onesignal_player_id) DO UPDATE SET
		  platform     = excluded.platform,
		  app_version  = excluded.app_version,
		  last_seen_at = unixepoch()
	`).bind(
		player_id,
		platform === 'ios' || platform === 'android' ? platform : null,
		typeof app_version === 'string' ? app_version.slice(0, 40) : null,
	).run();

	return json({ success: true });
}

/**
 * DELETE /api/push/register
 * Called when the user opts out of notifications or the app is uninstalled.
 *
 * Necessarily unauthenticated — an uninstalling device has no credentials to
 * present — and deliberately not bound to the registering IP, since phones
 * change networks constantly and a user who can't unsubscribe is a worse
 * outcome than the narrow abuse this would prevent. Player IDs are random
 * UUIDs rather than anything enumerable, so knowing one already implies
 * access to that device.
 */
export async function handlePushUnregister(request: Request, env: Env): Promise<Response> {
	const body = await readBody(request);
	if (!body) return err('Invalid request body', 400);

	const { player_id } = body;
	if (typeof player_id !== 'string' || !PLAYER_ID_PATTERN.test(player_id)) {
		return err('A valid player_id is required');
	}

	await env.DB.prepare(
		'DELETE FROM device_tokens WHERE onesignal_player_id = ?'
	).bind(player_id).run();

	return json({ success: true });
}
