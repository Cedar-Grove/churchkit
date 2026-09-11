import type { Env } from '../types';
import { json, err } from '../lib/response';
import { pcoFetch, pcoCreate, pcoUpdate } from '../lib/pco';
import { sendEmail, esc, escMultiline } from '../lib/email';
import { findOrCreatePerson, getOrCreateHouseholdId } from '../lib/personMatch';
import { guardFormRequest, normalizeBirthdate } from '../lib/formGuard';
import { createNote } from '../lib/notes';
import {
	renderTemplate,
	getTemplate,
	getChurchDetails,
	DEFAULT_WELCOME_EMAIL,
} from '../lib/template';

/**
 * Direct WorkflowCard creation via our PAT is blocked by PCO (403: "cannot
 * create a WorkflowCard") even with full account/workflow permissions —
 * confirmed to be a platform restriction on API-credential auth, not a
 * config issue (the same action works fine through the PCO UI). Each of
 * these bare-bones PCO Forms has an "on submission, add to workflow"
 * automation attached, so submitting to the form (which our PAT *can* do)
 * triggers the workflow card as a side effect instead.
 */
type WorkflowForm = 'connectCard' | 'prayerRequest' | 'imNew';

/**
 * Each church creates its own bare-bones PCO Forms and supplies their IDs.
 * A form whose ID is unset simply files no workflow card — the submission
 * is still stored, still filed to the person's profile as a note, and still
 * emailed to staff. Nothing about the form breaks.
 */
function workflowFormId(kind: WorkflowForm, env: Env): string | null {
	const id = {
		connectCard: env.PCO_CONNECT_CARD_FORM_ID,
		prayerRequest: env.PCO_PRAYER_REQUEST_FORM_ID,
		imNew: env.PCO_IM_NEW_FORM_ID,
	}[kind];
	return id?.trim() || null;
}

/**
 * The submission carries no answers, only the person — PCO permits no
 * assignable attributes when creating a FormSubmission, and the workflow
 * automation fires on the submission itself regardless.
 *
 * Two shapes have been tried against the live API and neither works: a
 * JSON:API `included` FormSubmissionValue resource is accepted with a 2xx
 * and silently discarded, and `field_data` is refused outright with
 * `422 Forbidden Attribute: field_data cannot be assigned`. Don't add a
 * third without evidence — the visitor's answers reach staff through the
 * note on the person's profile, which the card links to, and through the
 * admin panel.
 */
export async function triggerWorkflowViaForm(
	personId: string,
	kind: WorkflowForm,
	env: Env
): Promise<void> {
	const formId = workflowFormId(kind, env);
	if (!formId) return;
	await pcoFetch(`/people/v2/forms/${formId}/form_submissions`, env, {
		method: 'POST',
		body: JSON.stringify({
			data: {
				type: 'FormSubmission',
				relationships: { person: { data: { type: 'Person', id: personId } } },
			},
		}),
	});
}

/** Accept both camelCase (web) and snake_case (mobile app) field names. */
function normalize(data: any) {
	return {
		...data,
		firstName: data.firstName || data.first_name,
		lastName:  data.lastName  || data.last_name,
		spouseName: data.spouseName || data.spouse_name,
		street: data.street || data.address?.street,
		city: data.city || data.address?.city,
		state: data.state || data.address?.state,
		zip: data.zip || data.address?.zip,
		spiritualStatus: data.spiritualStatus || data.spiritual_journey,
		howHeard: data.howHeard || data.how_found || data.how_did_you_hear,
		prayerRequest: data.prayerRequest || data.prayer_request,
		prayerPrivacy: data.prayerPrivacy || data.prayer_privacy,
		// contact form may send a single `name` field
		...(data.name && !data.firstName && !data.first_name
			? (() => {
					const parts = String(data.name).trim().split(' ');
					return { firstName: parts[0], lastName: parts.slice(1).join(' ') || '' };
			  })()
			: {}),
	};
}

export async function handleConnectCard(request: Request, env: Env): Promise<Response> {
	const guard = await guardFormRequest(request, env);
	if (!guard.ok) return guard.response;
	const raw = guard.body;
	const data = normalize(raw);

	if (!data.firstName || !data.lastName || !data.email) {
		return err('First name, last name, and email are required');
	}

	let personId: string | null = null;
	let pcoError: string | null = null;
	/** Tracked apart from pcoError so a refused note still gets recorded. */
	let noteError: string | null = null;

	try {
		const match = await findOrCreatePerson({
			firstName: data.firstName,
			lastName: data.lastName,
			email: data.email,
			phone: data.phone,
			street: data.street,
			city: data.city,
			state: data.state,
			zip: data.zip,
		}, env);
		personId = match.personId;

		// Every one of these is optional enrichment — a single field PCO
		// rejects (a birthdate it can't parse, a phone number it dislikes)
		// must not abort the rest of the submission, so they all settle
		// together rather than running as bare awaits ahead of it.
		const birthdate = normalizeBirthdate(data.birthdate);

		await Promise.allSettled([
			birthdate && pcoUpdate(`/people/v2/people/${personId}`, 'Person', { birthdate }, env),
			data.email && pcoCreate(`/people/v2/people/${personId}/emails`, 'Email', {
				address: data.email, location: 'Home', primary: true,
			}, env),
			data.phone && pcoCreate(`/people/v2/people/${personId}/phone_numbers`, 'PhoneNumber', {
				number: data.phone, location: 'Mobile', primary: true,
			}, env),
			// PCO names this street_line_1; `street` is a Forbidden Attribute and
			// 422s, which is why no connect card has ever saved an address.
			data.street && pcoCreate(`/people/v2/people/${personId}/addresses`, 'Address', {
				street_line_1: data.street,
				city: data.city || '',
				state: data.state || '',
				zip: data.zip || '',
				location: 'Home',
			}, env),
		].filter(Boolean) as Promise<any>[]);

		const householdId = match.householdId || await getOrCreateHouseholdId(personId, data.lastName, env);

		if (data.spouseName?.trim()) {
			const parts = data.spouseName.trim().split(' ');
			const spouse = await pcoCreate('/people/v2/people', 'Person', {
				first_name: parts[0],
				last_name: parts.slice(1).join(' ') || data.lastName,
				status: 'active',
			}, env);
			await pcoCreate(
				`/people/v2/households/${householdId}/household_memberships`,
				'HouseholdMembership',
				{ pending: false },
				env,
				{ person: { data: { type: 'Person', id: spouse.data.id } } }
			);
		}

		for (const child of (data.children || [])) {
			if (!child.name?.trim()) continue;
			const childPerson = await pcoCreate('/people/v2/people', 'Person', {
				first_name: child.name,
				last_name: data.lastName,
				status: 'active',
				child: true,
				...(normalizeBirthdate(child.birthdate) && { birthdate: normalizeBirthdate(child.birthdate)! }),
			}, env);
			await pcoCreate(
				`/people/v2/households/${householdId}/household_memberships`,
				'HouseholdMembership',
				{ pending: false },
				env,
				{ person: { data: { type: 'Person', id: childPerson.data.id } } }
			);
		}

		// The workflow card is worked from on its own, away from the profile,
		// so this carries the whole submission rather than only the parts that
		// have nowhere else to live. On the note that repeats a little of the
		// profile, which is the point of a note: what they told us, when.
		const address = [data.street, data.city, data.state, data.zip].filter(Boolean).join(', ');
		const childNames = (data.children || [])
			.map((c: any) => c.name?.trim())
			.filter(Boolean);

		const noteLines = [
			`Connect Card — ${new Date().toLocaleDateString('en-US')}`,
			`Source: ${data.source || (data.interested_in ? 'Mobile App' : 'Website')}`,
			`How they heard: ${data.howHeard || data.how_did_you_hear || 'Not specified'}`,
			'',
			`Name: ${data.firstName} ${data.lastName}`,
			`Email: ${data.email}`,
			...(data.phone ? [`Phone: ${data.phone}`] : []),
			...(address ? [`Address: ${address}`] : []),
			...(data.birthdate ? [`Birthdate: ${data.birthdate}`] : []),
			...(data.spouseName?.trim() ? [`Spouse: ${data.spouseName.trim()}`] : []),
			...(childNames.length > 0 ? [`Children: ${childNames.join(', ')}`] : []),
		];
		if (data.interested_in) noteLines.push('', `Interested in: ${data.interested_in}`);
		if (data.spiritualStatus?.length > 0) {
			noteLines.push('', 'Spiritual Status:');
			data.spiritualStatus.forEach((s: string) => noteLines.push(`• ${s}`));
		}
		if (data.notes) noteLines.push('', `Notes: ${data.notes}`);
		if (data.prayerRequest) {
			const privacy = ['pastoral', 'private', 'confidential'].includes(data.prayerPrivacy)
				? 'CONFIDENTIAL — Staff only' : 'May be shared';
			noteLines.push('', `Prayer Request (${privacy}):`, data.prayerRequest);
		}

		const noteText = noteLines.join('\n');

		await createNote(personId!, noteText, env, {
			configuredCategoryId: env.PCO_CONNECT_CARD_NOTE_CATEGORY_ID,
			preferredCategoryNames: ['Connect Card', 'Connect Cards'],
		}).catch(e => {
			noteError = e?.message ?? String(e);
			console.error('Note error:', e);
		});

		await triggerWorkflowViaForm(personId!, 'connectCard', env)
			.catch(e => { pcoError = e?.message ?? String(e); console.error('Workflow trigger error:', e); });

	} catch (e: any) {
		pcoError = e?.message ?? String(e);
		console.error('PCO connect card error:', e?.message);
	}

	const recordedError = [pcoError, noteError && `Note: ${noteError}`]
		.filter(Boolean).join(' | ') || null;

	await env.DB.prepare(
		`INSERT INTO form_submissions (form_type, data, pco_person_id, pco_error) VALUES ('connect_card', ?, ?, ?)`
	).bind(JSON.stringify(raw), personId, recordedError).run();

	await Promise.allSettled([
		sendEmail(env, {
			to: env.EMAIL_STAFF_CONNECT_CARD ?? '',
			subject: `New Connect Card — ${data.firstName} ${data.lastName}`,
			html: buildStaffConnectCardEmail(data, personId, noteError),
		}),
		sendEmail(env, {
			from: env.EMAIL_FROM_PASTOR || env.EMAIL_FROM,
			to: data.email,
			subject: `Thanks for connecting with us, ${data.firstName}!`,
			html: await buildVisitorWelcomeEmail(data, env),
		}),
	]);

	return json({ success: true, pco_person_id: personId });
}

export async function handleImNew(request: Request, env: Env): Promise<Response> {
	const guard = await guardFormRequest(request, env);
	if (!guard.ok) return guard.response;
	const raw = guard.body;
	const data = normalize(raw);
	if (!data.firstName || !data.email) return err('First name and email are required');

	let personId: string | null = null;
	let pcoError: string | null = null;
	/** Tracked apart from pcoError so a refused note still gets recorded. */
	let noteError: string | null = null;

	try {
		const match = await findOrCreatePerson({
			firstName: data.firstName,
			lastName: data.lastName || '',
			email: data.email,
			phone: data.phone,
		}, env);
		personId = match.personId;

		await Promise.allSettled([
			data.email && pcoCreate(`/people/v2/people/${personId}/emails`, 'Email', {
				address: data.email, location: 'Home', primary: true,
			}, env),
			data.phone && pcoCreate(`/people/v2/people/${personId}/phone_numbers`, 'PhoneNumber', {
				number: data.phone, location: 'Mobile', primary: true,
			}, env),
		].filter(Boolean) as Promise<any>[]);

		const noteText = [
			`I'm New — ${new Date().toLocaleDateString('en-US')}`,
			`How they heard: ${data.how_did_you_hear || data.howHeard || 'Not specified'}`,
			data.groups ? `Groups interest: ${data.groups}` : '',
			data.kids ? `Kids: ${data.kids}` : '',
			data.notes ? `Notes: ${data.notes}` : '',
		].filter(Boolean).join('\n');

		await createNote(personId!, noteText, env, {
			configuredCategoryId: env.PCO_IM_NEW_NOTE_CATEGORY_ID,
			preferredCategoryNames: ["I'm New", 'Im New'],
		}).catch(e => {
			noteError = e?.message ?? String(e);
			console.error("I'm New note error:", e);
		});

		await triggerWorkflowViaForm(personId!, 'imNew', env)
			.catch(e => { pcoError = e?.message ?? String(e); console.error('Workflow trigger error:', e); });
	} catch (e: any) {
		pcoError = e?.message ?? String(e);
		console.error("PCO I'm New error:", e?.message);
	}

	const recordedError = [pcoError, noteError && `Note: ${noteError}`]
		.filter(Boolean).join(' | ') || null;

	await env.DB.prepare(
		`INSERT INTO form_submissions (form_type, data, pco_person_id, pco_error) VALUES ('im_new', ?, ?, ?)`
	).bind(JSON.stringify(raw), personId, recordedError).run();

	await sendEmail(env, {
		to: env.EMAIL_STAFF_IM_NEW ?? '',
		subject: `New I'm New — ${data.firstName} ${data.lastName || ''}`,
		html: `
			<h2>New "I'm New" Submission</h2>
			<p><strong>Name:</strong> ${esc(data.firstName)} ${esc(data.lastName || '')}</p>
			<p><strong>Email:</strong> ${esc(data.email)}</p>
			${data.phone ? `<p><strong>Phone:</strong> ${esc(data.phone)}</p>` : ''}
			${data.how_did_you_hear || data.howHeard ? `<p><strong>How they heard:</strong> ${esc(data.how_did_you_hear || data.howHeard)}</p>` : ''}
			${data.groups ? `<p><strong>Groups interest:</strong> ${esc(data.groups)}</p>` : ''}
			${data.kids ? `<p><strong>Kids:</strong> ${esc(data.kids)}</p>` : ''}
			${data.notes ? `<p><strong>Notes:</strong> ${escMultiline(data.notes)}</p>` : ''}
			<p style="color:#888;font-size:12px">Source: ${esc(raw.source || 'Website')}</p>
		`,
	});

	return json({ success: true, pco_person_id: personId });
}

export async function handleContact(request: Request, env: Env): Promise<Response> {
	const guard = await guardFormRequest(request, env);
	if (!guard.ok) return guard.response;
	const raw = guard.body;
	const data = normalize(raw);
	if (!data.firstName || !data.email || !data.message) {
		return err('Name, email, and message are required');
	}

	await env.DB.prepare(
		`INSERT INTO form_submissions (form_type, data) VALUES ('contact', ?)`
	).bind(JSON.stringify(raw)).run();

	await sendEmail(env, {
		to: env.EMAIL_STAFF_CONTACT ?? '',
		subject: `Contact Form — ${data.firstName} ${data.lastName || ''}`,
		html: `
			<h2>Contact Form</h2>
			<p><strong>Name:</strong> ${esc(data.firstName)} ${esc(data.lastName || '')}</p>
			<p><strong>Email:</strong> ${esc(data.email)}</p>
			<p><strong>Subject:</strong> ${esc(raw.subject) || '—'}</p>
			<p><strong>Message:</strong><br>${escMultiline(data.message)}</p>
			<p style="color:#888;font-size:12px">Source: ${esc(raw.source || 'Website')}</p>
		`,
	});

	return json({ success: true });
}

export async function handlePrayerRequest(request: Request, env: Env): Promise<Response> {
	const guard = await guardFormRequest(request, env);
	if (!guard.ok) return guard.response;
	const raw = guard.body;
	const data = normalize(raw);
	const requestText = (raw.request || '').trim();
	if (!data.firstName || !requestText) {
		return err('First name and request are required');
	}
	const replyRequested = !!raw.reply_requested;
	const prayerList = !!raw.prayer_list;
	const email = (data.email || '').trim();
	const phone = (data.phone || '').trim();

	let personId: string | null = null;
	let pcoError: string | null = null;
	/** Tracked apart from pcoError so a refused note still gets recorded. */
	let noteError: string | null = null;

	try {
		const match = await findOrCreatePerson({
			firstName: data.firstName,
			lastName: data.lastName || '',
			email,
			phone,
		}, env);
		personId = match.personId;

		await Promise.allSettled([
			email && pcoCreate(`/people/v2/people/${personId}/emails`, 'Email', {
				address: email, location: 'Home', primary: true,
			}, env),
			phone && pcoCreate(`/people/v2/people/${personId}/phone_numbers`, 'PhoneNumber', {
				number: phone, location: 'Mobile', primary: true,
			}, env),
		].filter(Boolean) as Promise<any>[]);

		const noteText = [
			`Prayer Request — ${new Date().toLocaleDateString('en-US')}`,
			`Reply requested: ${replyRequested ? 'Yes' : 'No'}`,
			`Add to prayer list: ${prayerList ? 'Yes' : 'No'}`,
			'',
			requestText,
		].join('\n');

		await createNote(personId!, noteText, env, {
			configuredCategoryId: env.PCO_PRAYER_REQUEST_NOTE_CATEGORY_ID,
			preferredCategoryNames: ['Prayer Requests', 'Prayer Request'],
		}).catch(e => {
			noteError = e?.message ?? String(e);
			console.error('Prayer request note error:', e);
		});

		await triggerWorkflowViaForm(personId!, 'prayerRequest', env)
			.catch(e => { pcoError = e?.message ?? String(e); throw e; });
	} catch (e: any) {
		if (!pcoError) pcoError = e?.message ?? String(e);
		console.error('PCO prayer request error:', e?.message);
	}

	const recordedError = [pcoError, noteError && `Note: ${noteError}`]
		.filter(Boolean).join(' | ') || null;

	await env.DB.prepare(
		`INSERT INTO form_submissions (form_type, data, pco_person_id, pco_error) VALUES ('prayer_request', ?, ?, ?)`
	).bind(JSON.stringify(raw), personId, recordedError).run();

	await sendEmail(env, {
		to: env.EMAIL_STAFF_CONTACT ?? '',
		subject: `Prayer Request — ${data.firstName} ${data.lastName || ''}`.trim(),
		html: `
			<h2>New Prayer Request</h2>
			<p><strong>Name:</strong> ${esc(data.firstName)} ${esc(data.lastName || '')}</p>
			${email ? `<p><strong>Email:</strong> ${esc(email)}</p>` : ''}
			${phone ? `<p><strong>Phone:</strong> ${esc(phone)}</p>` : ''}
			<p><strong>Request:</strong><br>${escMultiline(requestText)}</p>
			<p><strong>Reply requested:</strong> ${replyRequested ? 'Yes' : 'No'}</p>
			<p><strong>Add to prayer list:</strong> ${prayerList ? 'Yes' : 'No'}</p>
			${personId
				? `<p>✅ Added to Planning Center — <a href="https://people.planningcenteronline.com/people/${personId}">View record</a></p>`
				: `<p>⚠️ PCO sync may have failed — please add manually.</p>`
			}
		`,
	});

	return json({ success: true, pco_person_id: personId });
}

// ─── Email templates ───────────────────────────────────────

function buildStaffConnectCardEmail(data: any, personId: string | null, noteError: string | null): string {
	return `
		<h2>New Connect Card — ${esc(data.firstName)} ${esc(data.lastName)}</h2>
		<table cellpadding="6" style="font-family:sans-serif;font-size:14px">
			<tr><td><strong>Email</strong></td><td>${esc(data.email)}</td></tr>
			<tr><td><strong>Phone</strong></td><td>${esc(data.phone) || '—'}</td></tr>
			<tr><td><strong>Address</strong></td><td>${data.street ? `${esc(data.street)}, ${esc(data.city)} ${esc(data.state)} ${esc(data.zip)}` : '—'}</td></tr>
			${data.spouseName ? `<tr><td><strong>Spouse</strong></td><td>${esc(data.spouseName)}</td></tr>` : ''}
			${(data.children || []).length > 0 ? `<tr><td><strong>Children</strong></td><td>${data.children.map((c: any) => esc(c.name)).join(', ')}</td></tr>` : ''}
			${data.interested_in ? `<tr><td><strong>Interested In</strong></td><td>${esc(data.interested_in)}</td></tr>` : ''}
		</table>
		${data.spiritualStatus?.length > 0 ? `
			<h3>Spiritual Status</h3>
			<ul>${data.spiritualStatus.map((s: string) => `<li>${esc(s)}</li>`).join('')}</ul>
		` : ''}
		${data.howHeard || data.how_did_you_hear ? `<p><strong>How they heard:</strong> ${esc(data.howHeard || data.how_did_you_hear)}</p>` : ''}
		${data.notes ? `<p><strong>Notes:</strong> ${escMultiline(data.notes)}</p>` : ''}
		${data.prayerRequest ? `
			<hr>
			<p><strong>Prayer Request (${['pastoral', 'private', 'confidential'].includes(data.prayerPrivacy) ? 'CONFIDENTIAL — Staff only' : 'May be shared'}):</strong><br>${escMultiline(data.prayerRequest)}</p>
		` : ''}
		<hr>
		${personId
			? `<p>✅ Added to Planning Center — <a href="https://people.planningcenteronline.com/people/${personId}">View record</a></p>`
			: `<p>⚠️ PCO sync may have failed — please add manually.</p>`
		}
		${noteError
			? `<p>⚠️ The note above could not be saved to their PCO profile — everything they submitted is in this email.</p>`
			: ''
		}
	`;
}

/**
 * The visitor-facing welcome email. Body comes from the
 * `welcome_email_html` setting, so a church writes its own in the admin
 * panel; the default is deliberately plain and denomination-neutral rather
 * than any particular church's letter.
 */
async function buildVisitorWelcomeEmail(data: any, env: Env): Promise<string> {
	const [template, church] = await Promise.all([
		getTemplate(env, 'welcome_email_html', DEFAULT_WELCOME_EMAIL),
		getChurchDetails(env),
	]);
	return renderTemplate(template, { ...church, first_name: data.firstName });
}
