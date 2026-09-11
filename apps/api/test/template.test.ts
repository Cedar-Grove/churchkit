import { describe, it, expect } from 'vitest';
import { renderTemplate, DEFAULT_WELCOME_EMAIL } from '../src/lib/template';

describe('renderTemplate', () => {
	it('substitutes placeholders', () => {
		expect(renderTemplate('Hi {{first_name}}, welcome to {{church_name}}.', {
			first_name: 'Sam',
			church_name: 'Example Church',
		})).toBe('Hi Sam, welcome to Example Church.');
	});

	it('tolerates whitespace and mixed case in the placeholder', () => {
		expect(renderTemplate('{{ FIRST_NAME }}', { first_name: 'Sam' })).toBe('Sam');
	});

	it('escapes values, because a visitor supplies their own name', () => {
		const out = renderTemplate('Hi {{first_name}}', {
			first_name: '<script>alert(1)</script>',
		});
		expect(out).toBe('Hi &lt;script&gt;alert(1)&lt;/script&gt;');
		expect(out).not.toContain('<script>');
	});

	it('does not leave an unknown placeholder visible in a sent email', () => {
		expect(renderTemplate('Hi {{nope}}!', {})).toBe('Hi !');
	});

	it('renders empty for null and undefined rather than "null"', () => {
		expect(renderTemplate('[{{a}}][{{b}}]', { a: null, b: undefined })).toBe('[][]');
	});

	it('does not recursively expand a placeholder found inside a value', () => {
		// A church name containing {{phone}} must not pull in the phone number.
		const out = renderTemplate('{{church_name}}', { church_name: '{{phone}}', phone: '555' });
		expect(out).not.toContain('555');
	});

	it('has a default welcome email naming no church, pastor or denomination', () => {
		const rendered = renderTemplate(DEFAULT_WELCOME_EMAIL, {
			first_name: 'Sam',
			church_name: 'Example Church',
			address: '100 Example Road',
			phone: '(555) 010-0100',
		});
		expect(rendered).toContain('Example Church');
		expect(rendered).not.toMatch(/baptist|methodist|pastor \w/i);
		expect(rendered).not.toContain('{{');
	});
});
