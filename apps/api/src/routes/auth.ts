import type { Env } from '../types';
import { json, err } from '../lib/response';
import { pcoFetch } from '../lib/pco';

export async function handlePcoExchange(request: Request, env: Env): Promise<Response> {
	let body: { code?: string; redirect_uri?: string; code_verifier?: string };
	try {
		body = await request.json();
	} catch {
		return err('Invalid request body', 400);
	}

	const { code, redirect_uri, code_verifier } = body;
	if (!code || !redirect_uri) return err('Missing code or redirect_uri', 400);

	if (!env.PCO_CLIENT_ID) {
		console.error('PCO_CLIENT_ID env var missing - check Cloudflare Worker secrets');
		return err('OAuth not configured on server (missing env vars)', 500);
	}

	console.log('PCO exchange attempt - client_id prefix:', env.PCO_CLIENT_ID.slice(0, 8), '| has_verifier:', !!code_verifier);

	const params = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		redirect_uri,
		client_id: env.PCO_CLIENT_ID,
	});
	if (code_verifier) params.set('code_verifier', code_verifier);

	const headers: Record<string, string> = {
		'Content-Type': 'application/x-www-form-urlencoded',
		Accept: 'application/json',
	};

	const res = await fetch('https://api.planningcenteronline.com/oauth/token', {
		method: 'POST',
		headers,
		body: params,
	});

	if (!res.ok) {
		const text = await res.text();
		console.error('PCO token exchange failed:', text);
		// Return PCO's actual error so the app can display it for debugging
		let message = 'Authentication failed';
		try { message = JSON.parse(text)?.error_description ?? JSON.parse(text)?.error ?? text; } catch {}
		return err(message, 401);
	}

	const tokens: any = await res.json();
	return json({ access_token: tokens.access_token, expires_in: tokens.expires_in ?? 7200 });
}

export async function handleMeProfile(request: Request): Promise<Response> {
	const token = request.headers.get('Authorization')?.replace('Bearer ', '');
	if (!token) return err('Unauthorized', 401);

	const res = await fetch(
		'https://api.planningcenteronline.com/people/v2/me?include=emails,phone_numbers',
		{ headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
	);

	if (res.status === 401) return err('Unauthorized', 401);
	if (!res.ok) return err('Failed to fetch profile', 502);

	const data: any = await res.json();
	const person = data.data;
	const included: any[] = data.included ?? [];

	const email =
		included.find(i => i.type === 'Email' && i.attributes.primary)?.attributes.address ??
		included.find(i => i.type === 'Email')?.attributes.address ??
		null;
	const phone =
		included.find(i => i.type === 'PhoneNumber' && i.attributes.primary)?.attributes.number ??
		included.find(i => i.type === 'PhoneNumber')?.attributes.number ??
		null;

	return json({
		id: person.id,
		name: person.attributes.name,
		first_name: person.attributes.first_name,
		last_name: person.attributes.last_name,
		avatar_url: person.attributes.avatar ?? null,
		email,
		phone,
		membership: person.attributes.membership ?? null,
	});
}

export async function handleMeHousehold(request: Request): Promise<Response> {
	const token = request.headers.get('Authorization')?.replace('Bearer ', '');
	if (!token) return err('Unauthorized', 401);

	// Fetch person with household + addresses in one call
	const meRes = await fetch(
		'https://api.planningcenteronline.com/people/v2/me?include=households,addresses',
		{ headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
	);
	if (meRes.status === 401) return err('Unauthorized', 401);
	if (!meRes.ok) return err('Failed to fetch profile', 502);

	const meData: any = await meRes.json();
	const included: any[] = meData.included ?? [];

	const householdRef = meData.data?.relationships?.households?.data?.[0];
	if (!householdRef) return json({ household: null });

	const householdId = householdRef.id;
	const hh = included.find((i: any) => i.type === 'Household' && i.id === householdId);

	// Address lives on the person, not the household
	const addresses: any[] = included.filter((i: any) => i.type === 'Address');
	const address = addresses.find((a: any) => a.attributes.primary) ?? addresses[0] ?? null;

	// Fetch household members and memberships in parallel
	const [membersRes, membershipsRes] = await Promise.all([
		fetch(`https://api.planningcenteronline.com/people/v2/households/${householdId}/people`,
			{ headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }),
		fetch(`https://api.planningcenteronline.com/people/v2/households/${householdId}/household_memberships`,
			{ headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }),
	]);

	// Build person_id → membership_id map
	const membershipMap = new Map<string, string>();
	if (membershipsRes.ok) {
		const msData: any = await membershipsRes.json();
		for (const ms of msData.data ?? []) {
			const pid = ms.relationships?.person?.data?.id;
			if (pid) membershipMap.set(pid, ms.id);
		}
	}

	const members: any[] = [];
	if (membersRes.ok) {
		const membersData: any = await membersRes.json();
		for (const p of membersData.data ?? []) {
			members.push({
				id: p.id,
				membership_id: membershipMap.get(p.id) ?? null,
				name: p.attributes.name,
				first_name: p.attributes.first_name,
				last_name: p.attributes.last_name,
				avatar_url: p.attributes.avatar ?? null,
				child: p.attributes.child ?? false,
				birthdate: p.attributes.birthdate ?? null,
				medical_notes: p.attributes.medical_notes ?? null,
			});
		}
	}

	return json({
		household: {
			id: hh?.id ?? householdId,
			name: hh?.attributes?.name ?? null,
			member_count: hh?.attributes?.member_count ?? members.length,
			address_id: address?.id ?? null,
			street: address?.attributes?.street_line_1 ?? null,
			city: address?.attributes?.city ?? null,
			state: address?.attributes?.state ?? null,
			zip: address?.attributes?.zip ?? null,
			members,
		},
	});
}

export async function handleUpdateHousehold(request: Request): Promise<Response> {
	const token = request.headers.get('Authorization')?.replace('Bearer ', '');
	if (!token) return err('Unauthorized', 401);

	let body: { address_id?: string; street?: string; city?: string; state?: string; zip?: string };
	try { body = await request.json(); } catch { return err('Invalid request body', 400); }

	const { address_id, street, city, state, zip } = body;

	const pcoHeaders = { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' };
	const attributes = { street_line_1: street, city, state, zip };

	let res: Response;
	if (address_id) {
		// Update existing address
		res = await fetch(
			`https://api.planningcenteronline.com/people/v2/me/addresses/${address_id}`,
			{ method: 'PATCH', headers: pcoHeaders, body: JSON.stringify({ data: { type: 'Address', id: address_id, attributes } }) }
		);
	} else {
		// Create new address
		res = await fetch(
			'https://api.planningcenteronline.com/people/v2/me/addresses',
			{ method: 'POST', headers: pcoHeaders, body: JSON.stringify({ data: { type: 'Address', attributes: { ...attributes, location: 'Home', primary: true } } }) }
		);
	}

	if (res.status === 401) return err('Unauthorized', 401);
	if (!res.ok) {
		const text = await res.text();
		console.error('PCO address update failed:', text);
		return err('Failed to update address', 502);
	}

	const data: any = await res.json();
	const a = data.data;
	return json({
		address_id: a.id,
		street: a.attributes.street_line_1 ?? null,
		city: a.attributes.city ?? null,
		state: a.attributes.state ?? null,
		zip: a.attributes.zip ?? null,
	});
}

export async function handleUpdateHouseholdMember(request: Request, personId: string): Promise<Response> {
	const token = request.headers.get('Authorization')?.replace('Bearer ', '');
	if (!token) return err('Unauthorized', 401);

	let body: { first_name?: string; last_name?: string; birthdate?: string; medical_notes?: string };
	try { body = await request.json(); } catch { return err('Invalid request body', 400); }

	const res = await fetch(
		`https://api.planningcenteronline.com/people/v2/people/${personId}`,
		{
			method: 'PATCH',
			headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
			body: JSON.stringify({ data: { type: 'Person', id: personId, attributes: body } }),
		}
	);

	if (res.status === 401) return err('Unauthorized', 401);
	if (!res.ok) {
		const text = await res.text();
		console.error('PCO person update failed:', text);
		return err('Failed to update member', 502);
	}

	const data: any = await res.json();
	const p = data.data;
	return json({
		id: p.id,
		first_name: p.attributes.first_name,
		last_name: p.attributes.last_name,
		name: p.attributes.name,
		birthdate: p.attributes.birthdate ?? null,
		medical_notes: p.attributes.medical_notes ?? null,
	});
}

export async function handleAddHouseholdChild(request: Request): Promise<Response> {
	const token = request.headers.get('Authorization')?.replace('Bearer ', '');
	if (!token) return err('Unauthorized', 401);

	let body: { household_id: string; first_name: string; last_name: string; birthdate?: string };
	try { body = await request.json(); } catch { return err('Invalid request body', 400); }

	const { household_id, first_name, last_name, birthdate } = body;
	if (!household_id || !first_name || !last_name) return err('Missing required fields', 400);

	const pcoHeaders = { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' };

	// Create the child person
	const createRes = await fetch('https://api.planningcenteronline.com/people/v2/people', {
		method: 'POST',
		headers: pcoHeaders,
		body: JSON.stringify({
			data: {
				type: 'Person',
				attributes: { first_name, last_name, child: true, ...(birthdate ? { birthdate } : {}) },
			},
		}),
	});

	if (!createRes.ok) {
		const text = await createRes.text();
		console.error('PCO create child failed:', text);
		return err('Failed to create child', 502);
	}

	const created: any = await createRes.json();
	const personId = created.data.id;

	// Add to household
	const addRes = await fetch(
		`https://api.planningcenteronline.com/people/v2/households/${household_id}/household_memberships`,
		{
			method: 'POST',
			headers: pcoHeaders,
			body: JSON.stringify({ data: { type: 'HouseholdMembership', attributes: {}, relationships: { person: { data: { type: 'Person', id: personId } } } } }),
		}
	);

	if (!addRes.ok) {
		const text = await addRes.text();
		console.error('PCO add to household failed:', text);
		return err('Failed to add child to household', 502);
	}

	const ms: any = await addRes.json();
	const p = created.data;
	return json({
		id: p.id,
		membership_id: ms.data.id,
		first_name: p.attributes.first_name,
		last_name: p.attributes.last_name,
		name: p.attributes.name,
		avatar_url: p.attributes.avatar ?? null,
		child: true,
		birthdate: p.attributes.birthdate ?? null,
	});
}

export async function handleRemoveHouseholdMember(request: Request, membershipId: string): Promise<Response> {
	const token = request.headers.get('Authorization')?.replace('Bearer ', '');
	if (!token) return err('Unauthorized', 401);

	const url = new URL(request.url);
	const householdId = url.searchParams.get('household_id');
	if (!householdId) return err('Missing household_id', 400);

	const res = await fetch(
		`https://api.planningcenteronline.com/people/v2/households/${householdId}/household_memberships/${membershipId}`,
		{ method: 'DELETE', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
	);

	if (res.status === 401) return err('Unauthorized', 401);
	if (!res.ok && res.status !== 204) {
		const text = await res.text();
		console.error('PCO remove member failed:', text);
		return err('Failed to remove member', 502);
	}

	return json({ success: true });
}

export async function handleUpdateProfile(request: Request): Promise<Response> {
	const token = request.headers.get('Authorization')?.replace('Bearer ', '');
	if (!token) return err('Unauthorized', 401);

	let body: { first_name?: string; last_name?: string };
	try { body = await request.json(); } catch { return err('Invalid request body', 400); }

	const res = await fetch('https://api.planningcenteronline.com/people/v2/me', {
		method: 'PATCH',
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
		body: JSON.stringify({ data: { type: 'Person', attributes: body } }),
	});

	if (res.status === 401) return err('Unauthorized', 401);
	if (!res.ok) {
		const text = await res.text();
		console.error('PCO profile update failed:', text);
		return err('Failed to update profile', 502);
	}

	const data: any = await res.json();
	const p = data.data;
	return json({
		id: p.id,
		name: p.attributes.name,
		first_name: p.attributes.first_name,
		last_name: p.attributes.last_name,
	});
}

export async function handleMeCheckIns(request: Request): Promise<Response> {
	const token = request.headers.get('Authorization')?.replace('Bearer ', '');
	if (!token) return err('Unauthorized', 401);

	// Get person ID first
	const meRes = await fetch('https://api.planningcenteronline.com/people/v2/me', {
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
	});
	if (meRes.status === 401) return err('Unauthorized', 401);
	if (!meRes.ok) return err('Failed to fetch profile', 502);
	const meData: any = await meRes.json();
	const personId = meData.data?.id;
	if (!personId) return err('Could not determine person ID', 502);

	const res = await fetch(
		`https://api.planningcenteronline.com/check-ins/v2/people/${personId}/check_ins?order=-created_at&per_page=25&include=event`,
		{ headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
	);

	if (res.status === 401) return err('Check-ins scope not authorized — please sign out and sign in again', 401);
	if (!res.ok) return err('Failed to fetch check-ins', 502);

	const data: any = await res.json();
	const eventMap = new Map(
		(data.included ?? [])
			.filter((i: any) => i.type === 'Event')
			.map((e: any) => [e.id, e])
	);

	const checkIns = (data.data ?? []).map((c: any) => ({
		id: c.id,
		checked_in_at: c.attributes.created_at,
		security_code: c.attributes.security_code ?? null,
		first_name: c.attributes.first_name,
		last_name: c.attributes.last_name,
		kind: c.attributes.kind ?? null,
		event_id: c.relationships?.event?.data?.id ?? null,
		event_name: (eventMap.get(c.relationships?.event?.data?.id) as any)?.attributes?.name ?? null,
	}));

	return json({ data: checkIns });
}

export async function handleMeSchedules(request: Request): Promise<Response> {
	const token = request.headers.get('Authorization')?.replace('Bearer ', '');
	if (!token) return err('Unauthorized', 401);

	// Get person ID first — Services API needs an explicit person scope
	const meRes = await fetch('https://api.planningcenteronline.com/people/v2/me', {
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
	});
	if (meRes.status === 401) return err('Unauthorized', 401);
	if (!meRes.ok) return err('Failed to fetch profile', 502);
	const meData: any = await meRes.json();
	const personId = meData.data?.id;
	if (!personId) return err('Could not determine person ID', 502);

	const res = await fetch(
		`https://api.planningcenteronline.com/services/v2/people/${personId}/schedules?filter=future&per_page=5&order=sort_date`,
		{ headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
	);

	if (res.status === 401 || res.status === 403) {
		return err('Services scope not authorized — please sign out and sign in again', 401);
	}
	if (!res.ok) return err('Failed to fetch schedules', 502);

	const data: any = await res.json();

	const schedules = (data.data ?? []).map((s: any) => ({
		id: s.id,
		sort_date: s.attributes.sort_date ?? null,
		dates: s.attributes.dates ?? null,
		service_type_name: s.attributes.service_type_name ?? null,
		team_name: s.attributes.team_name ?? null,
		team_position_name: s.attributes.team_position_name ?? null,
		status: s.attributes.status ?? null,
		position_display_times: s.attributes.position_display_times ?? null,
	}));

	return json({ data: schedules });
}

export async function handleMeGiving(request: Request): Promise<Response> {
	const token = request.headers.get('Authorization')?.replace('Bearer ', '');
	if (!token) return err('Unauthorized', 401);

	const res = await fetch(
		'https://api.planningcenteronline.com/giving/v2/donations?per_page=25&order=-received_at&include=fund',
		{ headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
	);

	if (res.status === 401) return err('Unauthorized', 401);
	if (!res.ok) return err('Failed to fetch giving', 502);

	const data: any = await res.json();
	const fundMap = new Map(
		(data.included ?? [])
			.filter((i: any) => i.type === 'Fund')
			.map((f: any) => [f.id, f])
	);

	const donations = (data.data ?? []).map((d: any) => ({
		id: d.id,
		amount_cents: d.attributes.amount_cents,
		received_at: d.attributes.received_at,
		payment_method: d.attributes.payment_method ?? null,
		fund: (fundMap.get(d.relationships?.fund?.data?.id) as any)?.attributes?.name ?? 'General',
	}));

	return json({ data: donations });
}

// ── Check-in precheck ─────────────────────────────────────────────────────────
// Uses PAT. PCO Check-Ins v2 hierarchy:
//   events (top-level, filter=current) → events/{id}/event_periods (sub-resource)
// Location assignment is automatic in PCO based on person age/grade.
export async function handleCheckInPrecheck(env: Env): Promise<Response> {
	let eventsData: any;
	try {
		eventsData = await pcoFetch('/check-ins/v2/events?filter=current&per_page=25', env);
	} catch (e: any) {
		console.error('Check-in precheck: events fetch failed:', e?.message);
		return err('Failed to fetch check-in events', 502);
	}

	const currentEvents: any[] = eventsData.data ?? [];
	if (!currentEvents.length) {
		return json({ available: false, event_periods: [] });
	}

	const now = new Date();
	const eventPeriods: any[] = [];

	for (const event of currentEvents) {
		let periodsData: any;
		try {
			periodsData = await pcoFetch(
				`/check-ins/v2/events/${event.id}/event_periods?order=-starts_at&per_page=5`,
				env
			);
		} catch {
			continue;
		}

		for (const ep of periodsData.data ?? []) {
			const startsAt = ep.attributes.starts_at ? new Date(ep.attributes.starts_at) : null;
			const stopsAt = ep.attributes.stops_at ? new Date(ep.attributes.stops_at) : null;

			let isOpen: boolean;
			if (startsAt && stopsAt) {
				isOpen = now >= startsAt && now <= stopsAt;
			} else if (startsAt) {
				// Allow from 1 hour before start until 3 hours after
				isOpen = now >= new Date(startsAt.getTime() - 60 * 60 * 1000) &&
					now <= new Date(startsAt.getTime() + 3 * 60 * 60 * 1000);
			} else {
				isOpen = true; // trust PCO filter=current
			}

			if (isOpen) {
				eventPeriods.push({
					id: ep.id,
					event_id: event.id,
					event_name: event.attributes?.name ?? null,
					starts_at: ep.attributes.starts_at ?? null,
					ends_at: ep.attributes.stops_at ?? null,
				});
			}
		}
	}

	return json({ available: eventPeriods.length > 0, event_periods: eventPeriods });
}

// ── Submit check-in ───────────────────────────────────────────────────────────
// Verifies the OAuth token, checks household membership for non-self attendees,
// then POSTs each check-in. PCO auto-assigns location based on person age/grade.
export async function handleSubmitCheckIn(request: Request, env: Env): Promise<Response> {
	const token = request.headers.get('Authorization')?.replace('Bearer ', '');
	if (!token) return err('Unauthorized', 401);

	let body: { event_period_id: string; person_ids: string[] };
	try { body = await request.json(); } catch { return err('Invalid request body', 400); }
	if (!body.event_period_id) return err('event_period_id required', 400);
	if (!body.person_ids?.length) return err('person_ids required', 400);

	// Identify the caller via their OAuth token
	const meRes = await fetch('https://api.planningcenteronline.com/people/v2/me', {
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
	});
	if (meRes.status === 401) return err('Unauthorized', 401);
	if (!meRes.ok) return err('Could not verify identity', 502);
	const meData: any = await meRes.json();
	const myPersonId = meData.data?.id;
	if (!myPersonId) return err('Could not determine person ID', 502);

	// Verify any non-self attendees are in the caller's household. This must
	// fail closed: a caller with no household simply has nobody they're
	// allowed to check in but themselves, so skipping the check when no
	// household comes back would let any signed-in user check in any person
	// ID in the entire organization.
	const otherIds = body.person_ids.filter(id => id !== myPersonId);
	if (otherIds.length > 0) {
		let memberIds: Set<string>;
		try {
			const hhData = await pcoFetch(`/people/v2/people/${myPersonId}?include=households`, env);
			const householdId = (hhData.included ?? []).find((i: any) => i.type === 'Household')?.id;
			if (!householdId) {
				return err('You can only check in members of your own household', 403);
			}
			const membersData = await pcoFetch(`/people/v2/households/${householdId}/people`, env);
			memberIds = new Set<string>((membersData.data ?? []).map((m: any) => m.id as string));
			memberIds.add(myPersonId);
		} catch {
			return err('Could not verify household membership', 502);
		}
		for (const pid of otherIds) {
			if (!memberIds.has(pid)) return err(`Person ${pid} is not in your household`, 403);
		}
	}

	const results: any[] = [];
	const errors: any[] = [];

	for (const personId of body.person_ids) {
		try {
			const ciData = await pcoFetch('/check-ins/v2/check_ins', env, {
				method: 'POST',
				body: JSON.stringify({
					data: {
						type: 'CheckIn',
						attributes: { kind: 'Regular' },
						relationships: {
							person: { data: { type: 'Person', id: personId } },
							event_period: { data: { type: 'EventPeriod', id: body.event_period_id } },
						},
					},
				}),
			});
			results.push({
				id: ciData.data?.id,
				first_name: ciData.data?.attributes?.first_name,
				last_name: ciData.data?.attributes?.last_name,
				security_code: ciData.data?.attributes?.security_code ?? null,
			});
		} catch (e: any) {
			errors.push({ person_id: personId, error: e?.message ?? 'Check-in failed' });
		}
	}

	if (results.length === 0) return err(errors[0]?.error ?? 'Check-in failed', 502);
	return json({ data: results, errors });
}
