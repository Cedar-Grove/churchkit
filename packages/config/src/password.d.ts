export function hashPassword(password: string): string;
export function verifyPassword(password: string, stored: string): boolean;
export function generatePassword(length?: number): string;
