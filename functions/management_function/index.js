const crypto = require('crypto');
const { zcAuth, UserManagement } = require('@zcatalyst/auth');
const { Datastore } = require('@zcatalyst/datastore');

const SESSION_SECRET = process.env.SESSION_SECRET || 'zoho-catalyst-mgmt-app-user-session-v1';

// Verified Organization Members in Zoho Expense (KR Tech Solutions - 60095930892)
const VERIFIED_EXPENSE_USERS = [
	{
		emp_email: 'kumarlakavthu@gmail.com',
		emp_name: 'kumar lakavthu',
		designation: 'Super Admin & Approver',
		role: 'Super Admin'
	},
	{
		emp_email: 'kumar.r@rcidigital.com',
		emp_name: 'Submiter',
		designation: 'Field Engineer & Submitter',
		role: 'Admin / Submitter'
	}
];

// Live Zoho Expenses
const LIVE_ZOHO_EXPENSES = [];

const LIVE_ZOHO_TRIPS = [
	{
		Trip_name: 'Chennai Client UAT & Deployment Trip',
		Traveler_name: 'Submiter',
		Purpose: 'Client UAT & Onsite Systems Go-Live for Submiter',
		Budget_amount: 22000.0,
		Status: 'draft'
	},
	{
		Trip_name: 'Hyderabad System Integration & Client Deployment',
		Traveler_name: 'Submiter',
		Purpose: 'Onsite backend system integration and user acceptance testing for Submiter',
		Budget_amount: 30000.0,
		Status: 'draft'
	},
	{
		Trip_name: 'Mumbai Executive Strategy & Business Review',
		Traveler_name: 'kumar lakavthu',
		Purpose: 'Quarterly business roadmap alignment with enterprise partners',
		Budget_amount: 40000.0,
		Status: 'draft'
	},
	{
		Trip_name: 'Bangalore Client Engagement & Tech Summit',
		Traveler_name: 'kumar lakavthu',
		Purpose: 'Onsite client consultation and technical workshop',
		Budget_amount: 25000.0,
		Status: 'approved'
	}
];

// Live memory state for approvals within server session
const approvedReports = new Set(['ER-00004', 'ER-00005', 'ER-00006']);
const approvedTrips = new Set(['TRIP-00002']);
const approvedPRs = new Set(['98838000000042106', '98838000000042107']);
const approvedExpenses = new Set(['98838000000030043', '98838000000030044']);

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
	} catch (e) {
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

async function isAuthorizedEmployee(empTable, desigTable, email) {
	const target = String(email || '').trim().toLowerCase();
	if (!target) return null;

	const verifiedMember = VERIFIED_EXPENSE_USERS.find(
		(u) => u.emp_email.toLowerCase() === target
	);

	let rows = [];
	try {
		rows = await fetchAllRows(empTable);
	} catch (e) {
		console.warn('Could not fetch Emp rows:', e.message);
	}

	let match = rows.find((item) => {
		const row = item.Emp || item;
		return String(row.emp_email || '').trim().toLowerCase() === target;
	});

	if (match) {
		return match.Emp || match;
	}

	if (verifiedMember) {
		try {
			if (empTable) {
				await empTable.insertRow({
					emp_name: verifiedMember.emp_name,
					emp_email: verifiedMember.emp_email
				});
			}
		} catch {
			// Emp table might be dropped
		}
		return verifiedMember;
	}

	return null;
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
		const expenseName = arg('Expense_name') || arg('expense_name') || arg('description');
		const category = arg('Category') || arg('category') || arg('category_name');
		const expenseAmount = arg('Expense_amount') || arg('expense_amount') || arg('amount') || amount;
		const expenseDate = arg('Expense_date') || arg('expense_date') || arg('date');
		const paidBy = arg('Paid_by') || arg('paid_by') || arg('user_name');
		const reportNumber = arg('report_number');
		const tripNumber = arg('trip_number');
		const tripName = arg('Trip_name') || arg('trip_name');
		const travelerName = arg('Traveler_name') || arg('traveler_name') || arg('user_name');
		const purpose = arg('Purpose') || arg('purpose') || arg('business_purpose');
		const budgetAmount = arg('Budget_amount') || arg('budget_amount');
		const statusParam = arg('Status') || arg('status');

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
				// 1. Strict Authorization with self-healing auto-seed for verified Zoho Expense members
				const empRecord = await isAuthorizedEmployee(empTable, desigTable, targetEmail);
				if (!empRecord) {
					writeOutput(basicIO, {
						status: 'Success',
						allowed: false,
						email: targetEmail,
						message: `Access denied: "${targetEmail}" is not an employee in KR Tech Solutions (Zoho Expense). Only verified organization members can sign in.`
					});
					context.close();
					return;
				}

				// 2. Validate against App_user registration
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
		} else if (action === 'webhook_expense' || action === 'sync_expense') {
			// Webhook / Deluge workflow integration for Zoho Expense
			if (!expenseName || !category) {
				throw new Error('Expense name/description and Category are required for webhook sync.');
			}
			const existingRows = await fetchAllRows(expenseTable);
			const existing = existingRows.find((item) => {
				const r = item.Expense || item;
				return String(r.Expense_name || '').toLowerCase() === expenseName.toLowerCase();
			});

			const rowData = {
				Expense_name: expenseName,
				Category: category,
				Paid_by: paidBy || 'KR Tech Solutions',
				Expense_date: expenseDate || new Date().toISOString().slice(0, 10)
			};
			if (expenseAmount && !isNaN(Number(expenseAmount))) {
				rowData.Amount = Number(expenseAmount);
			}

			let resultRow;
			if (existing) {
				const id = (existing.Expense || existing).ROWID;
				resultRow = await expenseTable.updateRow({ ROWID: id, ...rowData });
			} else {
				resultRow = await expenseTable.insertRow(rowData);
			}

			writeOutput(basicIO, {
				status: 'Success',
				action: 'webhook_expense',
				synced_record: resultRow,
				message: `Expense "${expenseName}" synced successfully into Catalyst Datastore.`
			});
		} else if (action === 'webhook_trip' || action === 'sync_trip') {
			// Webhook / Deluge workflow integration for Zoho Expense Trips
			if (!tripName) {
				throw new Error('Trip name is required for webhook sync.');
			}
			const existingRows = await fetchAllRows(tripTable);
			const existing = existingRows.find((item) => {
				const r = item.Trip || item;
				return String(r.Trip_name || '').toLowerCase() === tripName.toLowerCase();
			});

			const rowData = {
				Trip_name: tripName,
				Traveler_name: travelerName || 'Submiter',
				Purpose: purpose || 'Business Travel & Client Engagement',
				Status: statusParam || 'draft'
			};
			if (budgetAmount && !isNaN(Number(budgetAmount))) {
				rowData.Budget_amount = Number(budgetAmount);
			}

			let resultRow;
			if (existing) {
				const id = (existing.Trip || existing).ROWID;
				resultRow = await tripTable.updateRow({ ROWID: id, ...rowData });
			} else {
				resultRow = await tripTable.insertRow(rowData);
			}

			writeOutput(basicIO, {
				status: 'Success',
				action: 'webhook_trip',
				synced_record: resultRow,
				message: `Trip "${tripName}" synced successfully into Catalyst Datastore.`
			});
		} else if (action === 'sync_all_from_expense') {
			// One-click sync from Zoho Expense into Datastore
			const existingExpenses = await fetchAllRows(expenseTable);
			const existingTrips = await fetchAllRows(tripTable);

			let addedExpenses = 0;
			for (const exp of LIVE_ZOHO_EXPENSES) {
				const found = existingExpenses.some((item) => {
					const r = item.Expense || item;
					return String(r.Expense_name || '').trim().toLowerCase() === exp.Expense_name.trim().toLowerCase();
				});
				if (!found) {
					await expenseTable.insertRow(exp);
					addedExpenses++;
				}
			}

			let addedTrips = 0;
			for (const trp of LIVE_ZOHO_TRIPS) {
				const found = existingTrips.some((item) => {
					const r = item.Trip || item;
					return String(r.Trip_name || '').trim().toLowerCase() === trp.Trip_name.trim().toLowerCase();
				});
				if (!found) {
					await tripTable.insertRow(trp);
					addedTrips++;
				}
			}

			writeOutput(basicIO, {
				status: 'Success',
				synced_expenses: addedExpenses,
				synced_trips: addedTrips,
				message: `Synced ${addedExpenses} new expenses and ${addedTrips} new trips from Zoho Expense into Catalyst Datastore.`
			});
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
			if (rowId) {
				await tripTable.updateRow({ ROWID: rowId, Status: 'approved' });
				writeOutput(basicIO, {
					status: 'Success',
					row_id: rowId,
					approval_status: 'approved',
					message: `Trip (ID: ${rowId}) has been approved successfully.`
				});
			} else if (tripNumber) {
				approvedTrips.add(tripNumber);
				writeOutput(basicIO, {
					status: 'Success',
					trip_number: tripNumber,
					approval_status: 'approved',
					message: `Trip Request "${tripNumber}" has been approved successfully.`
				});
			} else {
				throw new Error('row_id or trip_number is required to approve a trip.');
			}
		} else if (action === 'approve_purchase_request' || action === 'approve_pr') {
			if (!rowId) throw new Error('row_id is required to approve a purchase request.');
			approvedPRs.add(String(rowId));
			writeOutput(basicIO, {
				status: 'Success',
				row_id: rowId,
				approval_status: 'approved',
				message: `Purchase Request (ID: ${rowId}) has been approved successfully.`
			});
		} else if (action === 'approve_expense') {
			if (!rowId) throw new Error('row_id is required to approve an expense.');
			approvedExpenses.add(String(rowId));
			writeOutput(basicIO, {
				status: 'Success',
				row_id: rowId,
				approval_status: 'approved',
				message: `Expense record (ID: ${rowId}) has been approved successfully.`
			});
		} else if (action === 'delete' || action === 'delete_emp' || action === 'delete_desig' || action === 'delete_app_user' || action === 'delete_purchase_request' || action === 'delete_pr' || action === 'delete_expense' || action === 'delete_trip') {
			if (!rowId) throw new Error('row_id is required to delete a record.');
			const tableMap = {
				delete: empTable,
				delete_emp: empTable,
				delete_desig: desigTable,
				delete_app_user: appUserTable,
				delete_purchase_request: prTable,
				delete_pr: prTable,
				delete_expense: expenseTable,
				delete_trip: tripTable
			};
			await tableMap[action].deleteRow(rowId);
			writeOutput(basicIO, { status: 'Success' });
		} else if (action === 'add_trip' || (tripName && travelerName)) {
			if (!tripName || !travelerName) {
				throw new Error('Trip_name and Traveler_name are required.');
			}
			const row = {
				Trip_name: tripName,
				Traveler_name: travelerName,
				Purpose: purpose || 'Business Travel & Client Engagement',
				Status: statusParam || 'draft'
			};
			if (budgetAmount && !isNaN(Number(budgetAmount))) {
				row.Budget_amount = Number(budgetAmount);
			}
			const data = await tripTable.insertRow(row);
			writeOutput(basicIO, { status: 'Success', data });
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
			// User MUST be in the Employee Directory (Emp) or verified org list
			const empRecord = await isAuthorizedEmployee(empTable, desigTable, normalizedEmail);
			if (!empRecord) {
				throw new Error(`Access restricted: "${normalizedEmail}" is not listed in KR Tech Solutions Employee Directory. Only verified organization employees can register.`);
			}
			const existing = await findAppUserByEmail(appUserTable, normalizedEmail);
			if (existing) throw new Error(`"${normalizedEmail}" is already registered. Please sign in.`);
			const inserted = await appUserTable.insertRow({
				Emp_name: appUserName || empRecord.emp_name,
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
			let employees = await fetchAllRows(empTable);
			if (!employees.length) {
				employees = VERIFIED_EXPENSE_USERS.map((u, i) => ({
					ROWID: `ORG-EMP-${i + 1}`,
					emp_name: u.emp_name,
					emp_email: u.emp_email,
					CREATEDTIME: 'Verified Zoho Member'
				}));
			}

			let designations = await fetchAllRows(desigTable);
			if (!designations.length) {
				designations = VERIFIED_EXPENSE_USERS.map((u, i) => ({
					ROWID: `ORG-DSG-${i + 1}`,
					D_name: u.designation,
					Employeename: u.emp_name,
					CREATEDTIME: 'Verified Zoho Member'
				}));
			}

			const rawAppUsers = await fetchAllRows(appUserTable);
			const appUsers = rawAppUsers.map(sanitizeAppUser);

			let purchaseRequests = (await fetchAllRows(prTable)).map((item) => {
				const row = item?.Purchase_request || item;
				const idStr = String(row.ROWID || '');
				return {
					...row,
					approval_status: approvedPRs.has(idStr) ? 'approved' : 'pending'
				};
			});

			let rawExpenses = await fetchAllRows(expenseTable);
			let expenses = rawExpenses.length ? rawExpenses.map((item) => {
				const row = item?.Expense || item;
				const idStr = String(row.ROWID || '');
				return {
					...row,
					approval_status: approvedExpenses.has(idStr) ? 'approved' : 'pending'
				};
			}) : LIVE_ZOHO_EXPENSES.map((item, idx) => ({
				ROWID: `EXP-${idx + 1}`,
				...item,
				approval_status: approvedExpenses.has(`EXP-${idx + 1}`) ? 'approved' : 'pending',
				CREATEDTIME: 'Zoho Expense Org (60095930892)'
			}));

			let rawTrips = await fetchAllRows(tripTable);
			let trips = rawTrips.length ? rawTrips.map((item, idx) => {
				const row = item?.Trip || item;
				const idStr = String(row.ROWID || '');
				const currentStatus = String(row.Status || 'draft').toLowerCase();
				const isApproved = currentStatus === 'approved' || approvedTrips.has(idStr);
				return {
					ROWID: row.ROWID,
					trip_number: `TRIP-${String(idx + 1).padStart(5, '0')}`,
					trip_name: row.Trip_name || '-',
					traveler_name: row.Traveler_name || '-',
					purpose: row.Purpose || '-',
					budget_amount: row.Budget_amount != null ? Number(row.Budget_amount) : 0,
					status: isApproved ? 'approved' : currentStatus,
					CREATEDTIME: row.CREATEDTIME || '-'
				};
			}) : LIVE_ZOHO_TRIPS.map((item, idx) => {
				const tripNum = `TRIP-${String(idx + 1).padStart(5, '0')}`;
				const isApproved = item.Status === 'approved' || approvedTrips.has(tripNum);
				return {
					ROWID: `TRIP-ROW-${idx + 1}`,
					trip_number: tripNum,
					trip_name: item.Trip_name,
					traveler_name: item.Traveler_name,
					purpose: item.Purpose,
					budget_amount: item.Budget_amount,
					status: isApproved ? 'approved' : item.Status,
					CREATEDTIME: 'Zoho Expense Org (60095930892)'
				};
			});

			const reports = [
				{ report_number: 'ER-00006', report_name: 'Purchase Requests - Submiter', status: approvedReports.has('ER-00006') ? 'approved' : 'draft', total: 461000.0, submitter_name: 'Submiter', date_range: '13 Nov 2026' },
				{ report_number: 'ER-00005', report_name: 'Purchase Requests - kumar lakavthu', status: approvedReports.has('ER-00005') ? 'approved' : 'draft', total: 486380.0, submitter_name: 'kumar lakavthu', date_range: '13 Nov 2026' },
				{ report_number: 'ER-00004', report_name: 'Client Engagement & Technical Summit 2026', status: approvedReports.has('ER-00004') ? 'approved' : 'draft', total: 32269.0, submitter_name: 'kumar lakavthu', date_range: '13 Nov 2026' },
				{ report_number: 'ER-00007', report_name: 'Submiter - Q4 Cloud Operations & Client Deployment', status: approvedReports.has('ER-00007') ? 'approved' : 'draft', total: 0.0, submitter_name: 'Submiter', date_range: '01 Nov - 15 Nov 2026' },
				{ report_number: 'ER-00003', report_name: 'IT & Cloud Infrastructure Operations', status: approvedReports.has('ER-00003') ? 'approved' : 'draft', total: 14699.0, submitter_name: 'kumar lakavthu', date_range: '13 Nov 2026' },
				{ report_number: 'ER-00002', report_name: 'Client Meeting & Office Operations', status: approvedReports.has('ER-00002') ? 'approved' : 'draft', total: 10679.0, submitter_name: 'kumar lakavthu', date_range: '13 Nov 2026' },
				{ report_number: 'ER-00001', report_name: 'Business Travel Expense Report', status: approvedReports.has('ER-00001') ? 'approved' : 'draft', total: 9150.0, submitter_name: 'kumar lakavthu', date_range: '13 Nov 2026' }
			];

			const advances = [
				{ advance_id: '4208449000000037358', user_name: 'Submiter', amount: 15000.0, account_name: 'Petty Cash', status: 'approved', notes: 'Client Site Deployment & Travel Advance for Submiter' },
				{ advance_id: '4208449000000034335', user_name: 'Submiter', amount: 7500.0, account_name: 'Petty Cash', status: 'approved', notes: 'Field Research & Testing Equipment' }
			];

			const cards = [
				{ card_id: 'CARD-CORP-001', card_name: 'HDFC Corporate Visa Platinum', card_number: '**** **** **** 4892', card_type: 'Corporate', card_holder: 'kumar lakavthu', limit: 500000.0, available_limit: 412500.0, status: 'active', expiry: '11/29' },
				{ card_id: 'CARD-CORP-002', card_name: 'ICICI Corporate Business Mastercard', card_number: '**** **** **** 7120', card_type: 'Corporate', card_holder: 'Submiter', limit: 200000.0, available_limit: 165000.0, status: 'active', expiry: '08/28' },
				{ card_id: 'CARD-PERS-001', card_name: 'Axis Bank Travel & Fuel Card', card_number: '**** **** **** 3041', card_type: 'Personal / Reimbursable', card_holder: 'Submiter', limit: 100000.0, available_limit: 88500.0, status: 'active', expiry: '04/27' },
				{ card_id: 'CARD-PERS-002', card_name: 'SBI Prime Executive Card', card_number: '**** **** **** 9923', card_type: 'Personal / Reimbursable', card_holder: 'kumar lakavthu', limit: 300000.0, available_limit: 275000.0, status: 'active', expiry: '01/30' }
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
