const crypto = require('crypto');
const { zcAuth, UserManagement } = require('@zcatalyst/auth');
const { Datastore } = require('@zcatalyst/datastore');

const SESSION_SECRET = process.env.SESSION_SECRET || 'zoho-catalyst-mgmt-app-user-session-v1';

// Strict Authorization: Verified Organization Members in Zoho Expense (KR Tech Solutions - 60095930892)
const VERIFIED_EXPENSE_EMAILS = new Set([
	'kumarlakavthu@gmail.com',
	'kumar.r@rcidigital.com'
]);

function asciiStringify(obj) {
	return JSON.stringify(obj).replace(/[\u007F-\uFFFF]/g, (ch) => {
		return '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4);
	});
}

function writeOutput(basicIO, payload) {
	const json = asciiStringify(payload);
	basicIO.write(json);
}

function signSessionToken(email) {
	return crypto
		.createHmac('sha256', SESSION_SECRET)
		.update(String(email || '').trim().toLowerCase())
		.digest('hex');
}

function sanitizeAppUser(item) {
	const row = item?.App_user || item;
	if (!row || typeof row !== 'object') return null;
	const { emp_password, ...rest } = row;
	return { ...rest, has_password: Boolean(emp_password) };
}

async function fetchAllRows(table) {
	const rows = [];
	try {
		let nextToken;
		do {
			const res = await table.getPagedRows({ nextToken });
			if (Array.isArray(res?.data)) rows.push(...res.data);
			nextToken = res?.more_records ? res?.next_token : undefined;
		} while (nextToken);
	} catch {
		// Table may have been deleted from datastore
	}
	return rows;
}

async function findAppUserByEmail(appUserTable, email) {
	const target = String(email || '').trim().toLowerCase();
	if (!target) return null;
	const rows = await fetchAllRows(appUserTable);
	const match = rows.find((item) => {
		const row = item.App_user || item;
		return String(row.emp_mail || '').trim().toLowerCase() === target;
	});
	return match ? (match.App_user || match) : null;
}

module.exports = async (context, basicIO) => {
	try {
		const adminApp = await zcAuth.init(context, { appName: 'adminCtx', scope: 'admin' });
		const datastore = new Datastore(adminApp);
		const appUserTable = datastore.table('App_user');

		// Other tables (queried safely; returns [] if deleted)
		const empTable = datastore.table('Emp');
		const desigTable = datastore.table('Designation');
		const prTable = datastore.table('Purchase_request');
		const expenseTable = datastore.table('Expense');
		const tripTable = datastore.table('Trip');

		const allArgs = typeof basicIO.getAllArguments === 'function' ? basicIO.getAllArguments() : {};

		const arg = (key) => {
			const primary = basicIO.getArgument(key);
			if (primary !== undefined && primary !== null && primary !== '') {
				return String(primary).trim();
			}
			if (allArgs && typeof allArgs === 'object') {
				if (allArgs[key] !== undefined && allArgs[key] !== null) {
					return String(allArgs[key]).trim();
				}
				const lower = key.toLowerCase();
				for (const [k, v] of Object.entries(allArgs)) {
					if (k.toLowerCase() === lower && v !== undefined && v !== null) {
						return String(v).trim();
					}
				}
			}
			return '';
		};

		const rawArg = (key) => {
			const primary = basicIO.getArgument(key);
			if (primary !== undefined && primary !== null) return String(primary);
			if (allArgs && typeof allArgs === 'object') {
				if (allArgs[key] !== undefined && allArgs[key] !== null) return String(allArgs[key]);
				const lower = key.toLowerCase();
				for (const [k, v] of Object.entries(allArgs)) {
					if (k.toLowerCase() === lower && v !== undefined && v !== null) {
						return String(v);
					}
				}
			}
			return '';
		};

		const action = arg('action');
		const mode = arg('mode');
		const appUserName = arg('Emp_name') || arg('emp_name');
		const appUserEmail = arg('emp_mail') || arg('emp_email');
		const appUserPassword = rawArg('emp_password');
		const sessionToken = arg('session_token');
		const rowId = arg('row_id');

		if (action === 'validate_app_user') {
			const requestedEmail = String(appUserEmail || '').trim().toLowerCase();
			const effectiveMode = mode || (appUserPassword ? 'password' : (sessionToken ? 'session' : 'catalyst_auth'));

			let targetEmail = requestedEmail;
			if (effectiveMode === 'catalyst_auth') {
				let authUser = null;
				try {
					const userApp = await zcAuth.init(context, { appName: 'userCtx', scope: 'user' });
					authUser = await new UserManagement(userApp).getCurrentUser();
				} catch {}
				const authEmail = String(authUser?.email_id || '').trim().toLowerCase();
				targetEmail = authEmail || (process.env.X_ZOHO_CATALYST_IS_LOCAL === 'true' ? requestedEmail : '');
			}

			if (!targetEmail) {
				writeOutput(basicIO, { status: 'Success', allowed: false, email: '', message: 'Email is required.' });
			} else {
				if (!VERIFIED_EXPENSE_EMAILS.has(targetEmail)) {
					writeOutput(basicIO, {
						status: 'Success',
						allowed: false,
						email: targetEmail,
						message: `Access denied: "${targetEmail}" is not an employee in KR Tech Solutions (Zoho Expense). Only verified organization members can sign in.`
					});
					context.close();
					return;
				}

				const matched = await findAppUserByEmail(appUserTable, targetEmail);
				if (!matched) {
					writeOutput(basicIO, {
						status: 'Success',
						allowed: false,
						email: targetEmail,
						message: 'This account is not registered yet. Please create your account on the Sign Up tab.'
					});
				} else if (effectiveMode === 'password') {
					const storedPassword = String(matched.emp_password ?? '');
					const isValid = Boolean(appUserPassword) && storedPassword === appUserPassword;
					writeOutput(basicIO, {
						status: 'Success',
						allowed: isValid,
						email: targetEmail,
						user: isValid ? sanitizeAppUser(matched) : null,
						session_token: isValid ? signSessionToken(targetEmail) : '',
						message: isValid ? '' : 'Invalid password for this account.'
					});
				} else if (effectiveMode === 'session') {
					const expected = signSessionToken(targetEmail);
					const isValid = Boolean(sessionToken) && sessionToken === expected;
					writeOutput(basicIO, {
						status: 'Success',
						allowed: isValid,
						email: targetEmail,
						user: isValid ? sanitizeAppUser(matched) : null,
						message: isValid ? '' : 'Session expired. Please sign in again.'
					});
				} else {
					writeOutput(basicIO, {
						status: 'Success',
						allowed: true,
						email: targetEmail,
						user: sanitizeAppUser(matched)
					});
				}
			}
		} else if (action === 'add_app_user') {
			if (!appUserName || !appUserEmail || !appUserPassword) {
				throw new Error('Emp_name, emp_mail, and emp_password are required.');
			}
			const normalizedEmail = appUserEmail.toLowerCase();
			if (!VERIFIED_EXPENSE_EMAILS.has(normalizedEmail)) {
				throw new Error(`Access restricted: "${normalizedEmail}" is not listed in KR Tech Solutions (Zoho Expense). Only verified organization employees can register.`);
			}
			const existing = await findAppUserByEmail(appUserTable, normalizedEmail);
			if (existing) throw new Error(`"${normalizedEmail}" is already registered. Please sign in.`);
			const inserted = await appUserTable.insertRow({
				Emp_name: appUserName,
				emp_mail: normalizedEmail,
				emp_password: appUserPassword
			});
			writeOutput(basicIO, { status: 'Success', data: sanitizeAppUser(inserted) });
		} else if (action === 'delete_app_user' || action === 'delete') {
			if (!rowId) throw new Error('row_id is required to delete a record.');
			await appUserTable.deleteRow(rowId);
			writeOutput(basicIO, { status: 'Success' });
		} else {
			// ZERO STATIC / MOCK DATA
			// Only read actual data from Datastore
			const rawAppUsers = await fetchAllRows(appUserTable);
			const appUsers = rawAppUsers.map(sanitizeAppUser);

			const employees = await fetchAllRows(empTable);
			const designations = await fetchAllRows(desigTable);
			const purchaseRequests = await fetchAllRows(prTable);
			const expenses = await fetchAllRows(expenseTable);
			const trips = await fetchAllRows(tripTable);

			// Real empty arrays: NO static/mock reports, advances, or cards
			const reports = [];
			const advances = [];
			const cards = [];

			writeOutput(basicIO, {
				status: 'Success',
				employees,
				designations,
				appUsers,
				purchaseRequests,
				expenses,
				reports,
				trips,
				advances,
				cards
			});
		}
	} catch (e) {
		console.error(`Error in management_function: ${e.message || e}`);
		basicIO.setStatus(500);
		writeOutput(basicIO, { status: 'Error', message: e.message || String(e) });
	}

	context.close();
};
