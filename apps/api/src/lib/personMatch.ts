import type { Env } from '../types';
import { pcoFetch, pcoCreate } from './pco';

export interface PersonMatchInput {
	firstName: string;
	lastName: string;
	email?: string;
	phone?: string;
	street?: string;
	city?: string;
	state?: string;
	zip?: string;
}

export interface PersonMatchResult {
	personId: string;
	isNewPerson: boolean;
	/** Set when a new person was created and attached to an existing household via an address match. */
	householdId?: string;
}

function normalizeEmail(v: string): string {
	return v.trim().toLowerCase();
}

function normalizePhone(v: string): string {
	return v.replace(/\D/g, '');
}

function normalizeStreet(v: string): string {
	return v.trim().toLowerCase();
}

function relatedOfType(resource: any, included: any[], relKey: string): any[] {
	const refs = resource.relationships?.[relKey]?.data || [];
	return refs
		.map((ref: any) => included.find((inc: any) => inc.type === ref.type && inc.id === ref.id))
		.filter(Boolean);
}

/**
 * Matching policy (conservative — avoid merging distinct people):
 * - Search by first + last name.
 * - A name match is only accepted if the submission carries NO other
 *   identifying data (email/phone/address), or every piece of identifying
 *   data it does carry explicitly matches something already on that
 *   person's record. Data that's simply missing on file does not count as
 *   a match — it's treated the same as a conflict, since it can't be
 *   confirmed either way.
 * - If no name match is accepted but the submitted address matches an
 *   existing person's address, a new person is created and added to that
 *   person's household (same address, different name — e.g. a spouse who
 *   wasn't in the system yet).
 * - Otherwise, a brand new person is created.
 */
export async function findOrCreatePerson(input: PersonMatchInput, env: Env): Promise<PersonMatchResult> {
	const email = input.email?.trim();
	const phone = input.phone?.trim();
	const street = input.street?.trim();
	const hasOtherData = !!(email || phone || street);

	const nameSearch = await pcoFetch(
		`/people/v2/people?where[first_name]=${encodeURIComponent(input.firstName)}&where[last_name]=${encodeURIComponent(input.lastName)}&include=emails,phone_numbers,addresses`,
		env
	);
	const included = nameSearch.included || [];

	for (const candidate of (nameSearch.data || [])) {
		if (!hasOtherData) {
			return { personId: candidate.id, isNewPerson: false };
		}

		const emails = relatedOfType(candidate, included, 'emails').map((e: any) => normalizeEmail(e.attributes.address));
		const phones = relatedOfType(candidate, included, 'phone_numbers').map((p: any) => normalizePhone(p.attributes.number));
		const addresses = relatedOfType(candidate, included, 'addresses');

		const emailMatches = !email || emails.includes(normalizeEmail(email));
		const phoneMatches = !phone || phones.includes(normalizePhone(phone));
		const streetMatches = !street || addresses.some((a: any) => normalizeStreet(a.attributes.street_line_1 || '') === normalizeStreet(street));

		if (emailMatches && phoneMatches && streetMatches) {
			return { personId: candidate.id, isNewPerson: false };
		}
	}

	if (street) {
		const addressSearch = await pcoFetch(
			`/people/v2/addresses?where[street_line_1]=${encodeURIComponent(street)}&include=person`,
			env
		);
		const match = addressSearch.data?.[0];
		const matchedPersonId = match?.relationships?.person?.data?.id;
		if (matchedPersonId) {
			const newPerson = await pcoCreate('/people/v2/people', 'Person', {
				first_name: input.firstName,
				last_name: input.lastName,
				status: 'active',
			}, env);
			const householdId = await addToHouseholdOf(matchedPersonId, newPerson.data.id, env);
			return { personId: newPerson.data.id, isNewPerson: true, householdId };
		}
	}

	const newPerson = await pcoCreate('/people/v2/people', 'Person', {
		first_name: input.firstName,
		last_name: input.lastName,
		status: 'active',
	}, env);
	return { personId: newPerson.data.id, isNewPerson: true };
}

async function addToHouseholdOf(existingPersonId: string, newPersonId: string, env: Env): Promise<string | undefined> {
	const households = await pcoFetch(`/people/v2/people/${existingPersonId}/households`, env);
	const householdId = households.data?.[0]?.id;
	if (!householdId) return undefined;
	await pcoCreate(
		`/people/v2/households/${householdId}/household_memberships`,
		'HouseholdMembership',
		{ pending: false },
		env,
		{ person: { data: { type: 'Person', id: newPersonId } } }
	);
	return householdId;
}

/** Fetches the person's existing household, or creates one if they don't have one yet. */
export async function getOrCreateHouseholdId(personId: string, lastName: string, env: Env): Promise<string> {
	const households = await pcoFetch(`/people/v2/people/${personId}/households`, env);
	if (households.data?.length > 0) return households.data[0].id;

	const household = await pcoCreate('/people/v2/households', 'Household', {
		name: `${lastName} Household`,
	}, env, {
		people: { data: [{ type: 'Person', id: personId }] },
		primary_contact: { data: { type: 'Person', id: personId } },
	});
	return household.data.id;
}
