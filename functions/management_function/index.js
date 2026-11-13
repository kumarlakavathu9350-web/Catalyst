const crypto = require('crypto');
const { zcAuth, UserManagement } = require('@zcatalyst/auth');
const { Datastore } = require('@zcatalyst/datastore');

const SESSION_SECRET = process.env.SESSION_SECRET || 'zoho-catalyst-mgmt-app-user-session-v1';

// Live memory state for approvals within server session
const approvedReports = new Set(['ER-00004', 'ER-00005', 'ER-00006']);
const approvedTrips = new Set(['TRIP-00002']);

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
		const prTable = datastore.table('Purchase_request');
		const expenseTable = datastore.table('Expense');

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
		const itemName = arg('Item_name');
		const preferredVendor = arg('Preferred_vendor');
		const requestedBy = arg('Requested_by');
		const amount = arg('Amount');
		const expenseName = arg('Expense_name');
		const category = arg('Category');
		const expenseAmount = arg('Expense_amount') || amount;
		const expenseDate = arg('Expense_date');
		const paidBy = arg('Paid_by');
		const reportNumber = arg('report_number');
		const tripNumber = arg('trip_number');

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
						message: 'This account is not registered. Please sign up or contact your administrator.'
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
		} else if (action === 'approve_report') {
			if (!reportNumber) throw new Error('report_number is required to approve a report.');
			approvedReports.add(reportNumber);
			writeOutput(basicIO, {
				status: 'Success',
				report_number: reportNumber,
				approval_status: 'approved',
				message: `Expense Report "${reportNumber}" has been approved successfully.`
			});
		} else if (action === 'approve_trip') {
			if (!tripNumber) throw new Error('trip_number is required to approve a trip.');
			approvedTrips.add(tripNumber);
			writeOutput(basicIO, {
				status: 'Success',
				trip_number: tripNumber,
				approval_status: 'approved',
				message: `Trip Request "${tripNumber}" has been approved successfully.`
			});
		} else if (action === 'delete' || action === 'delete_emp' || action === 'delete_desig' || action === 'delete_app_user' || action === 'delete_purchase_request' || action === 'delete_pr' || action === 'delete_expense') {
			if (!rowId) throw new Error('row_id is required to delete a record.');
			const tableMap = {
				delete: empTable,
				delete_emp: empTable,
				delete_desig: desigTable,
				delete_app_user: appUserTable,
				delete_purchase_request: prTable,
				delete_pr: prTable,
				delete_expense: expenseTable
			};
			await tableMap[action].deleteRow(rowId);
			writeOutput(basicIO, { status: 'Success' });
		} else if (action === 'add_expense' || (expenseName && category)) {
			if (!expenseName || !category) {
				throw new Error('Expense_name and Category are required.');
			}
			const row = {
				Expense_name: expenseName,
				Category: category,
				Paid_by: paidBy || 'General',
				Expense_date: expenseDate || new Date().toISOString().slice(0, 10)
			};
			if (expenseAmount && !isNaN(Number(expenseAmount))) {
				row.Amount = Number(expenseAmount);
			}
			const data = await expenseTable.insertRow(row);
			writeOutput(basicIO, { status: 'Success', data });
		} else if (action === 'add_purchase_request' || action === 'add_pr' || (itemName && preferredVendor)) {
			if (!itemName || !preferredVendor) {
				throw new Error('Item_name and Preferred_vendor are required.');
			}
			const row = {
				Item_name: itemName,
				Preferred_vendor: preferredVendor,
				Requested_by: requestedBy || 'General',
			};
			if (amount && !isNaN(Number(amount))) {
				row.Amount = Number(amount);
			}
			const data = await prTable.insertRow(row);
			writeOutput(basicIO, { status: 'Success', data });
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
			const [employees, designations, rawAppUsers, purchaseRequests, expenses] = await Promise.all([
				fetchAllRows(empTable),
				fetchAllRows(desigTable),
				fetchAllRows(appUserTable),
				fetchAllRows(prTable),
				fetchAllRows(expenseTable)
			]);
			const appUsers = rawAppUsers.map(sanitizeAppUser);

			const reports = [
				{ report_number: 'ER-00006', report_name: 'Purchase Requests - Submiter', status: approvedReports.has('ER-00006') ? 'approved' : 'draft', total: 461000.0, submitter_name: 'Submiter', date_range: '13 Nov 2026' },
				{ report_number: 'ER-00005', report_name: 'Purchase Requests - kumar lakavthu', status: approvedReports.has('ER-00005') ? 'approved' : 'draft', total: 486380.0, submitter_name: 'kumar lakavthu', date_range: '13 Nov 2026' },
				{ report_number: 'ER-00004', report_name: 'Client Engagement & Technical Summit 2026', status: approvedReports.has('ER-00004') ? 'approved' : 'draft', total: 32269.0, submitter_name: 'kumar lakavthu', date_range: '13 Nov 2026' },
				{ report_number: 'ER-00007', report_name: 'Submiter - Q4 Cloud Operations & Client Deployment', status: approvedReports.has('ER-00007') ? 'approved' : 'draft', total: 0.0, submitter_name: 'Submiter', date_range: '01 Nov - 15 Nov 2026' },
				{ report_number: 'ER-00003', report_name: 'IT & Cloud Infrastructure Operations', status: approvedReports.has('ER-00003') ? 'approved' : 'draft', total: 14699.0, submitter_name: 'kumar lakavthu', date_range: '13 Nov 2026' },
				{ report_number: 'ER-00002', report_name: 'Client Meeting & Office Operations', status: approvedReports.has('ER-00002') ? 'approved' : 'draft', total: 10679.0, submitter_name: 'kumar lakavthu', date_range: '13 Nov 2026' },
				{ report_number: 'ER-00001', report_name: 'Business Travel Expense Report', status: approvedReports.has('ER-00001') ? 'approved' : 'draft', total: 9150.0, submitter_name: 'kumar lakavthu', date_range: '13 Nov 2026' }
			];

			const trips = [
				{ trip_number: 'TRIP-00005', trip_name: 'Hyderabad System Integration & Deployment', traveler_name: 'Submiter', budget_amount: 30000.0, status: approvedTrips.has('TRIP-00005') ? 'approved' : 'draft', purpose: 'Onsite backend system integration & UAT' },
				{ trip_number: 'TRIP-00006', trip_name: 'Chennai Client UAT & Deployment Trip', traveler_name: 'Submiter', budget_amount: 22000.0, status: approvedTrips.has('TRIP-00006') ? 'approved' : 'draft', purpose: 'Client UAT & Onsite Systems Go-Live' },
				{ trip_number: 'TRIP-00002', trip_name: 'Bangalore Client Engagement & Tech Summit', traveler_name: 'kumar lakavthu', budget_amount: 25000.0, status: approvedTrips.has('TRIP-00002') ? 'approved' : 'draft', purpose: 'Onsite client consultation and technical workshop' },
				{ trip_number: 'TRIP-00003', trip_name: 'Mumbai Executive Strategy & Business Review', traveler_name: 'kumar lakavthu', budget_amount: 40000.0, status: approvedTrips.has('TRIP-00003') ? 'approved' : 'draft', purpose: 'Quarterly business roadmap alignment' }
			];

			const advances = [
				{ advance_id: '4208449000000037358', user_name: 'Submiter', amount: 15000.0, account_name: 'Petty Cash', status: 'approved', notes: 'Client Site Deployment & Travel Advance for Submiter' },
				{ advance_id: '4208449000000034335', user_name: 'Submiter', amount: 7500.0, account_name: 'Petty Cash', status: 'approved', notes: 'Field Research & Testing Equipment' }
			];

			const cards = [
				{ card_id: 'CARD-CORP-001', card_name: 'HDFC Corporate Visa Platinum', card_number: '•••• •••• •••• 4892', card_type: 'Corporate', card_holder: 'kumar lakavthu', limit: 500000.0, available_limit: 412500.0, status: 'active', expiry: '11/29' },
				{ card_id: 'CARD-CORP-002', card_name: 'ICICI Corporate Business Mastercard', card_number: '•••• •••• •••• 7120', card_type: 'Corporate', card_holder: 'Submiter', limit: 200000.0, available_limit: 165000.0, status: 'active', expiry: '08/28' },
				{ card_id: 'CARD-PERS-001', card_name: 'Axis Bank Travel & Fuel Card', card_number: '•••• •••• •••• 3041', card_type: 'Personal / Reimbursable', card_holder: 'Submiter', limit: 100000.0, available_limit: 88500.0, status: 'active', expiry: '04/27' },
				{ card_id: 'CARD-PERS-002', card_name: 'SBI Prime Executive Card', card_number: '•••• •••• •••• 9923', card_type: 'Personal / Reimbursable', card_holder: 'kumar lakavthu', limit: 300000.0, available_limit: 275000.0, status: 'active', expiry: '01/30' }
			];

			writeOutput(basicIO, { status: 'Success', employees, designations, appUsers, purchaseRequests, expenses, reports, trips, advances, cards });
		}
	} catch (e) {
		console.error(`Error in management_function: ${e.message || e}`);
		basicIO.setStatus(500);
		writeOutput(basicIO, { status: 'Error', message: e.message || String(e) });
	}

	context.close();
};
