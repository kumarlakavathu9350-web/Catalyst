const crypto = require('crypto');
const { zcAuth, UserManagement } = require('@zcatalyst/auth');
const { Datastore } = require('@zcatalyst/datastore');

const SESSION_SECRET = process.env.SESSION_SECRET || 'zoho-catalyst-mgmt-app-user-session-v1';

function writeOutput(basicIO, payload) {
	const json = JSON.stringify(payload);
	// Local `catalyst serve` Basic I/O emulator truncates each write() call to 1024 chars
	if (process.env.X_ZOHO_CATALYST_IS_LOCAL === 'true') {
		for (let i = 0; i < json.length; i += 1024) {
			basicIO.write(json.slice(i, i + 1024));
		}
		return;
	}
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
	let nextToken;
	do {
		const res = await table.getPagedRows({ nextToken });
		if (Array.isArray(res?.data)) rows.push(...res.data);
		nextToken = res?.more_records ? res?.next_token : undefined;
	} while (nextToken);
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
		const empTable = datastore.table('Emp');
		const desigTable = datastore.table('Designation');
		const appUserTable = datastore.table('App_user');

		const arg = (key) => String(basicIO.getArgument(key) || '').trim();
		const rawArg = (key) => String(basicIO.getArgument(key) ?? '');
		const action = arg('action');
		const mode = arg('mode');
		const name = arg('emp_name');
		const email = arg('emp_email');
		const dName = arg('D_name');
		const empLookup = arg('Employeename');
		const appUserName = arg('Emp_name');
		const appUserEmail = arg('emp_mail');
		const appUserPassword = rawArg('emp_password');
		const sessionToken = arg('session_token');
		const rowId = arg('row_id');

		if (action === 'validate_app_user') {
			const requestedEmail = appUserEmail.toLowerCase();
			const effectiveMode = mode || (appUserPassword ? 'password' : (sessionToken ? 'session' : 'catalyst_auth'));

			let targetEmail = '';
			if (effectiveMode === 'catalyst_auth') {
				let authUser = null;
				try {
					const userApp = await zcAuth.init(context, { appName: 'userCtx', scope: 'user' });
					authUser = await new UserManagement(userApp).getCurrentUser();
				} catch {
					// Fallback only for local emulator when Catalyst user context is missing
				}
				const authEmail = String(authUser?.email_id || '').trim().toLowerCase();
				targetEmail = authEmail || (process.env.X_ZOHO_CATALYST_IS_LOCAL === 'true' ? requestedEmail : '');
			} else {
				targetEmail = requestedEmail;
			}

			if (!targetEmail) {
				writeOutput(basicIO, { status: 'Success', allowed: false, email: '', message: 'Email is required.' });
			} else {
				const matched = await findAppUserByEmail(appUserTable, targetEmail);
				if (!matched) {
					writeOutput(basicIO, {
						status: 'Success',
						allowed: false,
						email: targetEmail,
						message: 'This Login ID is not registered in App_user.'
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
						message: isValid ? '' : 'Invalid password for this App_user account.'
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
		} else if (action === 'delete' || action === 'delete_emp' || action === 'delete_desig' || action === 'delete_app_user') {
			if (!rowId) throw new Error('row_id is required to delete a record.');
			const tableMap = {
				delete: empTable,
				delete_emp: empTable,
				delete_desig: desigTable,
				delete_app_user: appUserTable
			};
			await tableMap[action].deleteRow(rowId);
			writeOutput(basicIO, { status: 'Success' });
		} else if (action === 'add_app_user') {
			if (!appUserName || !appUserEmail || !appUserPassword) {
				throw new Error('Emp_name, emp_mail, and emp_password are required.');
			}
			const normalizedEmail = appUserEmail.toLowerCase();
			const existing = await findAppUserByEmail(appUserTable, normalizedEmail);
			if (existing) throw new Error(`"${normalizedEmail}" already exists in App_user.`);
			const inserted = await appUserTable.insertRow({
				Emp_name: appUserName,
				emp_mail: normalizedEmail,
				emp_password: appUserPassword
			});
			writeOutput(basicIO, { status: 'Success', data: sanitizeAppUser(inserted) });
		} else if (action === 'add_desig' || (dName && empLookup)) {
			if (!dName || !empLookup) throw new Error('D_name and Employeename are required.');
			const data = await desigTable.insertRow({ D_name: dName, Employeename: empLookup });
			writeOutput(basicIO, { status: 'Success', data });
		} else if (action === 'add_emp' || (name && email)) {
			if (!name || !email) throw new Error('emp_name and emp_email are required.');
			const data = await empTable.insertRow({ emp_name: name, emp_email: email });
			writeOutput(basicIO, { status: 'Success', data });
		} else {
			const [employees, designations, rawAppUsers] = await Promise.all([
				fetchAllRows(empTable),
				fetchAllRows(desigTable),
				fetchAllRows(appUserTable)
			]);
			const appUsers = rawAppUsers.map(sanitizeAppUser);
			writeOutput(basicIO, { status: 'Success', employees, designations, appUsers });
		}
	} catch (e) {
		console.error(`Error in management_function: ${e.message || e}`);
		basicIO.setStatus(500);
		writeOutput(basicIO, { status: 'Error', message: e.message || String(e) });
	}

	context.close();
};
