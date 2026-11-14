const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');
const { zcAuth, UserManagement } = require('@zcatalyst/auth');
const { Datastore } = require('@zcatalyst/datastore');
const { Mail } = require('@zcatalyst/mail');

const SESSION_SECRET = process.env.SESSION_SECRET || 'zoho-catalyst-mgmt-app-user-session-v1';
const SENDER_EMAIL = 'kumarlakavathu9350@gmail.com';

// Strict Authorization: Verified Organization Members in Zoho Expense (KR Tech Solutions - 60095930892)
const VERIFIED_EXPENSE_EMAILS = new Set([
	'kumarlakavthu@gmail.com',
	'kumar.r@rcidigital.com'
]);

// 2-Way Sync Integration: Zoho Expense OAuth & REST APIs
const ZOHO_EXPENSE_CONFIG = {
	accountsUrl: 'https://accounts.zoho.in/oauth/v2/token',
	apiUrl: 'https://www.zohoapis.in/expense/v1',
	clientId: '1000.S1KTSSPRXHMAYOY20SY3CP93G79ZPB',
	clientSecret: '68b084222d8104a939b142dfe7f63e6d4667cda54b',
	refreshToken: '1000.c1e8858a4f463d7378ff1af83ecd5ed6.a5f53fd9a4dd54187b12defec0ff69fd',
	organizationId: '60095930892'
};

const EXPENSE_CATEGORIES = {
	'Office Supplies': '4208449000000000498',
	'IT and Internet Expenses': '4208449000000000525',
	'Meals and Entertainment': '4208449000000000546',
	'Fuel/Mileage Expenses': '4208449000000034137',
	'Labor': '4208449000000034052',
	'Job Costing': '4208449000000034055',
	'Telephone Expense': '4208449000000000531',
	'Automobile Expense': '4208449000000000540',
	'Lodging': '4208449000000000552'
};

function getCategoryId(categoryName) {
	if (!categoryName) return EXPENSE_CATEGORIES['Office Supplies'];
	for (const [name, id] of Object.entries(EXPENSE_CATEGORIES)) {
		if (name.toLowerCase() === categoryName.toLowerCase()) return id;
	}
	const lower = categoryName.toLowerCase();
	if (lower.includes('it') || lower.includes('internet')) return EXPENSE_CATEGORIES['IT and Internet Expenses'];
	if (lower.includes('meal') || lower.includes('food')) return EXPENSE_CATEGORIES['Meals and Entertainment'];
	if (lower.includes('fuel') || lower.includes('mileage')) return EXPENSE_CATEGORIES['Fuel/Mileage Expenses'];
	if (lower.includes('hotel') || lower.includes('lodg')) return EXPENSE_CATEGORIES['Lodging'];
	return EXPENSE_CATEGORIES['Office Supplies'];
}

let cachedAccessToken = null;
let tokenExpiresAt = 0;

async function getZohoExpenseAccessToken() {
	const now = Date.now();
	if (cachedAccessToken && tokenExpiresAt > now + 60000) {
		return cachedAccessToken;
	}

	const postData = querystring.stringify({
		refresh_token: ZOHO_EXPENSE_CONFIG.refreshToken,
		client_id: ZOHO_EXPENSE_CONFIG.clientId,
		client_secret: ZOHO_EXPENSE_CONFIG.clientSecret,
		grant_type: 'refresh_token'
	});

	const tokenRes = await new Promise((resolve, reject) => {
		const req = https.request(ZOHO_EXPENSE_CONFIG.accountsUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': Buffer.byteLength(postData)
			}
		}, (res) => {
			let data = '';
			res.on('data', chunk => data += chunk);
			res.on('end', () => {
				try {
					resolve(JSON.parse(data));
				} catch (e) {
					reject(new Error(`Failed to parse token response: ${data}`));
				}
			});
		});
		req.on('error', reject);
		req.write(postData);
		req.end();
	});

	if (!tokenRes.access_token) {
		throw new Error(tokenRes.error || tokenRes.message || 'Failed to refresh Zoho Expense token');
	}

	cachedAccessToken = tokenRes.access_token;
	tokenExpiresAt = now + ((tokenRes.expires_in || 3600) * 1000);
	return cachedAccessToken;
}

async function createZohoExpenseTrip(tripDetails) {
	const accessToken = await getZohoExpenseAccessToken();

	const zohoPayload = {
		trip_name: tripDetails.tripName || 'Catalyst Trip',
		travel_type: 'domestic',
		departure: tripDetails.departure || '',
		destination_city: tripDetails.destination || '',
		start_date: tripDetails.startDate || new Date().toISOString().slice(0, 10),
		end_date: tripDetails.endDate || new Date().toISOString().slice(0, 10)
	};
	if (tripDetails.budget) {
		zohoPayload.budget = {
			amount: Number(tripDetails.budget) || 0,
			currency_id: '4208449000000000064',
			exchange_rate: 1.0
		};
	}

	const postData = querystring.stringify({
		JSONString: JSON.stringify(zohoPayload)
	});

	const url = `${ZOHO_EXPENSE_CONFIG.apiUrl}/trips?organization_id=${ZOHO_EXPENSE_CONFIG.organizationId}`;

	return new Promise((resolve, reject) => {
		const req = https.request(url, {
			method: 'POST',
			headers: {
				'Authorization': `Zoho-oauthtoken ${accessToken}`,
				'X-com-zoho-expense-organizationid': ZOHO_EXPENSE_CONFIG.organizationId,
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': Buffer.byteLength(postData)
			}
		}, (res) => {
			let data = '';
			res.on('data', chunk => data += chunk);
			res.on('end', () => {
				try {
					const json = JSON.parse(data);
					if (json.code === 0 && json.trip) {
						resolve(json.trip);
					} else {
						reject(new Error(json.message || `Zoho API Error code ${json.code}`));
					}
				} catch (e) {
					reject(new Error(`Failed to parse Zoho response: ${data}`));
				}
			});
		});
		req.on('error', reject);
		req.write(postData);
		req.end();
	});
}

async function syncZohoExpenseTrips(tripTable) {
	try {
		const accessToken = await getZohoExpenseAccessToken();
		const url = `${ZOHO_EXPENSE_CONFIG.apiUrl}/trips?organization_id=${ZOHO_EXPENSE_CONFIG.organizationId}`;
		const tripsList = await new Promise((resolve) => {
			const req = https.request(url, {
				method: 'GET',
				headers: {
					'Authorization': `Zoho-oauthtoken ${accessToken}`,
					'X-com-zoho-expense-organizationid': ZOHO_EXPENSE_CONFIG.organizationId
				}
			}, (res) => {
				let data = '';
				res.on('data', chunk => data += chunk);
				res.on('end', () => {
					try {
						const json = JSON.parse(data);
						resolve(json.trips || []);
					} catch (e) {
						resolve([]);
					}
				});
			});
			req.on('error', () => resolve([]));
			req.end();
		});

		if (Array.isArray(tripsList) && tripsList.length > 0) {
			const existingRows = await fetchAllRows(tripTable);
			for (const t of tripsList) {
				const tripNum = t.trip_number;
				if (!tripNum) continue;
				const matched = existingRows.find(item => {
					const row = item.Trip || item;
					return row.Trip_number && String(row.Trip_number).trim().toLowerCase() === tripNum.toLowerCase();
				});

				const rowData = {
					Trip_number: tripNum,
					Trip_name: t.trip_name || 'Business Trip',
					Departure: t.departure || 'HQ',
					Destination: t.destination_city || 'Client Site',
					Start_date: t.start_date || new Date().toISOString().slice(0, 10),
					End_date: t.end_date || new Date().toISOString().slice(0, 10),
					Submitter: t.submitter_name || t.user_name || 'Submiter',
					Status: t.status || 'draft',
					Budget: Number(parseFloat(t.budget_amount || 0)) || 0
				};

				if (matched) {
					const existingRow = matched.Trip || matched;
					await tripTable.updateRow({
						ROWID: existingRow.ROWID,
						...rowData
					});
				} else {
					await tripTable.insertRow(rowData);
				}
			}
		}
	} catch (e) {
		console.error('syncZohoExpenseTrips error:', e.message);
	}
}

async function createZohoExpense(expenseDetails) {
	const accessToken = await getZohoExpenseAccessToken();

	const categoryId = getCategoryId(expenseDetails.category);
	const zohoPayload = {
		date: expenseDetails.expenseDate || new Date().toISOString().slice(0, 10),
		currency_id: '4208449000000000064',
		amount: Number(expenseDetails.amount) || 0,
		description: expenseDetails.expenseName || 'Expense via Catalyst',
		category_id: categoryId
	};

	const postData = querystring.stringify({
		JSONString: JSON.stringify(zohoPayload)
	});

	const url = `${ZOHO_EXPENSE_CONFIG.apiUrl}/expenses?organization_id=${ZOHO_EXPENSE_CONFIG.organizationId}`;

	return new Promise((resolve, reject) => {
		const req = https.request(url, {
			method: 'POST',
			headers: {
				'Authorization': `Zoho-oauthtoken ${accessToken}`,
				'X-com-zoho-expense-organizationid': ZOHO_EXPENSE_CONFIG.organizationId,
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': Buffer.byteLength(postData)
			}
		}, (res) => {
			let data = '';
			res.on('data', chunk => data += chunk);
			res.on('end', () => {
				try {
					const json = JSON.parse(data);
					if (json.code === 0 && Array.isArray(json.expenses) && json.expenses.length > 0) {
						resolve(json.expenses[0]);
					} else {
						reject(new Error(json.message || `Zoho API Error code ${json.code}`));
					}
				} catch (e) {
					reject(new Error(`Failed to parse Zoho response: ${data}`));
				}
			});
		});
		req.on('error', reject);
		req.write(postData);
		req.end();
	});
}

async function createZohoExpenseReport(reportDetails) {
	const accessToken = await getZohoExpenseAccessToken();

	const zohoPayload = {
		report_name: reportDetails.reportName || 'Expense Report via Catalyst',
		start_date: reportDetails.startDate || new Date().toISOString().slice(0, 10),
		end_date: reportDetails.endDate || new Date().toISOString().slice(0, 10),
		description: reportDetails.description || 'Created via Catalyst 2-Way Sync'
	};

	const postData = querystring.stringify({
		JSONString: JSON.stringify(zohoPayload)
	});

	const url = `${ZOHO_EXPENSE_CONFIG.apiUrl}/expensereports?organization_id=${ZOHO_EXPENSE_CONFIG.organizationId}`;

	return new Promise((resolve, reject) => {
		const req = https.request(url, {
			method: 'POST',
			headers: {
				'Authorization': `Zoho-oauthtoken ${accessToken}`,
				'X-com-zoho-expense-organizationid': ZOHO_EXPENSE_CONFIG.organizationId,
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': Buffer.byteLength(postData)
			}
		}, (res) => {
			let data = '';
			res.on('data', chunk => data += chunk);
			res.on('end', () => {
				try {
					const json = JSON.parse(data);
					if (json.code === 0 && json.expense_report) {
						resolve(json.expense_report);
					} else {
						reject(new Error(json.message || `Zoho API Error code ${json.code}`));
					}
				} catch (e) {
					reject(new Error(`Failed to parse Zoho response: ${data}`));
				}
			});
		});
		req.on('error', reject);
		req.write(postData);
		req.end();
	});
}

async function syncZohoExpenseExpenses(expenseTable) {
	try {
		const accessToken = await getZohoExpenseAccessToken();
		const url = `${ZOHO_EXPENSE_CONFIG.apiUrl}/expenses?organization_id=${ZOHO_EXPENSE_CONFIG.organizationId}&per_page=200`;
		const expensesList = await new Promise((resolve) => {
			const req = https.request(url, {
				method: 'GET',
				headers: {
					'Authorization': `Zoho-oauthtoken ${accessToken}`,
					'X-com-zoho-expense-organizationid': ZOHO_EXPENSE_CONFIG.organizationId
				}
			}, (res) => {
				let data = '';
				res.on('data', chunk => data += chunk);
				res.on('end', () => {
					try {
						const json = JSON.parse(data);
						resolve(json.expenses || []);
					} catch (e) {
						resolve([]);
					}
				});
			});
			req.on('error', () => resolve([]));
			req.end();
		});

		if (Array.isArray(expensesList) && expensesList.length > 0) {
			const existingRows = await fetchAllRows(expenseTable);
			for (const exp of expensesList) {
				const expName = exp.description || exp.reference_number || exp.report_name || 'General Expense';
				const expDate = exp.date || new Date().toISOString().slice(0, 10);
				const expAmt = Number(parseFloat(exp.total || exp.amount || 0)) || 0;
				const expCat = exp.category_name || 'Office Supplies';
				const expPaidBy = exp.user_name || exp.created_by_name || 'KR Tech Solutions';
				const expStatus = exp.status || 'unreported';

				const matched = existingRows.find(item => {
					const row = item.Expense || item;
					const sameName = row.Expense_name && String(row.Expense_name).trim().toLowerCase() === expName.toLowerCase();
					const sameDate = row.Expense_date && String(row.Expense_date).trim() === expDate.trim();
					return sameName && (sameDate || expName.toLowerCase().includes('er-') || expCat === 'Expense Report');
				});

				const rowData = {
					Expense_name: expName,
					Category: expCat,
					Amount: expAmt,
					Expense_date: expDate,
					Paid_by: expPaidBy,
					Status: expStatus
				};

				if (matched) {
					const existingRow = matched.Expense || matched;
					await expenseTable.updateRow({
						ROWID: existingRow.ROWID,
						...rowData
					});
				} else {
					await expenseTable.insertRow(rowData);
				}
			}
		}
	} catch (e) {
		console.error('syncZohoExpenseExpenses error:', e.message);
	}
}

async function sendNotificationEmail(adminApp, { to, subject, htmlContent, textContent }) {
	try {
		const mail = new Mail(adminApp);
		let recipients = [];
		if (Array.isArray(to)) {
			recipients = to.filter(Boolean);
		} else if (typeof to === 'string' && to.trim()) {
			recipients = [to.trim()];
		}
		if (recipients.length === 0) {
			recipients = ['kumar.r@rcidigital.com'];
		}

		const mailPayload = {
			from_email: SENDER_EMAIL,
			to_email: recipients,
			subject: subject,
			content: htmlContent || textContent || 'Notification from KR Tech Solutions',
			html_mode: Boolean(htmlContent)
		};

		const result = await mail.sendMail(mailPayload);
		console.log('Catalyst email sent successfully:', result);
		return { success: true, result };
	} catch (err) {
		console.error('Failed to send Catalyst email:', err.message || err);
		return { success: false, error: err.message || String(err) };
	}
}

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
				targetEmail = authEmail || requestedEmail;
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

			// Email Notification: User Account Created & Verified
			await sendNotificationEmail(adminApp, {
				to: normalizedEmail,
				subject: 'Welcome to KR Tech Solutions - Expense & Travel Portal',
				htmlContent: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
						<div style="background: #2563eb; color: #ffffff; padding: 20px; text-align: center;">
							<h2 style="margin: 0;">Welcome to KR Tech Solutions</h2>
							<p style="margin: 5px 0 0; opacity: 0.9;">Catalyst &amp; Zoho Expense Integrated Portal</p>
						</div>
						<div style="padding: 24px; color: #334155;">
							<p>Hello <strong>${appUserName}</strong>,</p>
							<p>Your account has been registered and verified successfully in KR Tech Solutions.</p>
							<div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 14px; margin: 18px 0;">
								<p style="margin: 0;"><strong>Registered Email:</strong> ${normalizedEmail}</p>
								<p style="margin: 6px 0 0;"><strong>Status:</strong> Verified Active Member</p>
							</div>
							<p>You can now sign in to manage expenses and travel requests with full real-time Zoho Expense 2-way sync.</p>
						</div>
					</div>
				`
			});

			writeOutput(basicIO, { status: 'Success', data: sanitizeAppUser(inserted) });
		} else if (action === 'delete_app_user' || action === 'delete') {
			if (!rowId) throw new Error('row_id is required to delete a record.');
			await appUserTable.deleteRow(rowId);
			writeOutput(basicIO, { status: 'Success' });
		} else if (action === 'add_expense') {
			const expName = arg('Expense_name') || arg('expense_name') || arg('description') || 'General Expense';
			const expCat = arg('Category') || arg('category') || 'Office Supplies';
			const rawAmt = arg('Amount') || arg('amount') || 0;
			const expAmt = Number(parseFloat(rawAmt)) || 0;
			const expDate = arg('Expense_date') || arg('expense_date') || arg('date') || new Date().toISOString().slice(0, 10);
			const expPaidBy = arg('Paid_by') || arg('paid_by') || 'Submiter';
			const expStatus = arg('Status') || arg('status') || 'unreported';

			let zohoExp = null;
			try {
				zohoExp = await createZohoExpense({
					expenseName: expName,
					category: expCat,
					amount: expAmt,
					expenseDate: expDate,
					paidBy: expPaidBy,
					status: expStatus
				});
			} catch (zohoErr) {
				console.error('Zoho Expense API create expense error:', zohoErr.message);
				throw new Error(`Failed to record expense in Zoho Expense: ${zohoErr.message}`);
			}

			// Idempotent upsert in Datastore
			const existingExpenses = await fetchAllRows(expenseTable);
			const matchedExpense = existingExpenses.find((item) => {
				const row = item.Expense || item;
				const sameName = row.Expense_name && String(row.Expense_name).trim().toLowerCase() === expName.toLowerCase();
				const sameDate = row.Expense_date && String(row.Expense_date).trim() === expDate.trim();
				return sameName && sameDate;
			});

			let inserted;
			if (matchedExpense) {
				const existingRow = matchedExpense.Expense || matchedExpense;
				inserted = await expenseTable.updateRow({
					ROWID: existingRow.ROWID,
					Expense_name: expName,
					Category: expCat,
					Amount: expAmt,
					Expense_date: expDate,
					Paid_by: expPaidBy,
					Status: expStatus
				});
			} else {
				inserted = await expenseTable.insertRow({
					Expense_name: expName,
					Category: expCat,
					Amount: expAmt,
					Expense_date: expDate,
					Paid_by: expPaidBy,
					Status: expStatus
				});
			}

			// Email Notification: Expense Recorded
			const notifyRecipient = expPaidBy.includes('@') ? expPaidBy : 'kumar.r@rcidigital.com';
			await sendNotificationEmail(adminApp, {
				to: [notifyRecipient, 'kumarlakavthu@gmail.com'],
				subject: `💳 Expense Recorded: ${expName} (₹${expAmt})`,
				htmlContent: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
						<div style="background: #10b981; color: #ffffff; padding: 20px; text-align: center;">
							<h2 style="margin: 0;">Expense Recorded Successfully</h2>
							<p style="margin: 5px 0 0; opacity: 0.9;">Synced with Zoho Expense &amp; Catalyst</p>
						</div>
						<div style="padding: 24px; color: #334155;">
							<p>A new expense has been recorded in KR Tech Solutions:</p>
							<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Description:</td><td style="font-weight: bold; text-align: right;">${expName}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Category:</td><td style="text-align: right;">${expCat}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Amount:</td><td style="font-weight: bold; color: #059669; text-align: right;">₹${expAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Date:</td><td style="text-align: right;">${expDate}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Paid By:</td><td style="text-align: right;">${expPaidBy}</td></tr>
								<tr><td style="padding: 8px 0; color: #64748b;">Status:</td><td style="text-align: right; text-transform: capitalize;">${expStatus}</td></tr>
							</table>
						</div>
					</div>
				`
			});

			writeOutput(basicIO, {
				status: 'Success',
				action: 'add_expense',
				data: inserted,
				zoho_expense: zohoExp
			});
		} else if (action === 'add_report') {
			const reportName = arg('Report_name') || arg('report_name') || 'Expense Report';
			const startDate = arg('Start_date') || arg('start_date') || new Date().toISOString().slice(0, 10);
			const endDate = arg('End_date') || arg('end_date') || new Date().toISOString().slice(0, 10);
			const desc = arg('Description') || arg('description') || 'Created via Catalyst 2-Way Sync';

			let zohoReport = null;
			try {
				zohoReport = await createZohoExpenseReport({
					reportName,
					startDate,
					endDate,
					description: desc
				});
			} catch (zohoErr) {
				console.error('Zoho Expense API create report error:', zohoErr.message);
				throw new Error(`Failed to create report in Zoho Expense: ${zohoErr.message}`);
			}

			writeOutput(basicIO, {
				status: 'Success',
				action: 'add_report',
				data: zohoReport
			});
		} else if (
			action === 'webhook_expense' ||
			action === 'sync_expense' ||
			Boolean(allArgs?.expense_report || allArgs?.expense || allArgs?.Expense)
		) {
			let payload = allArgs || {};
			if (typeof allArgs === 'string') {
				try { payload = JSON.parse(allArgs); } catch {}
			} else if (typeof allArgs?.body === 'string') {
				try { payload = JSON.parse(allArgs.body); } catch {}
			} else if (typeof allArgs?.data === 'string') {
				try { payload = JSON.parse(allArgs.data); } catch {}
			}

			const exp = payload.expense_report || payload.expense || payload.Expense || payload.report || payload.Report || payload.data || payload;

			const expName = String(
				exp.Expense_name ||
				exp.expense_name ||
				exp.report_name ||
				exp.report_number ||
				exp.description ||
				exp.item_name ||
				exp.merchant_name ||
				arg('Expense_name') ||
				arg('expense_name') ||
				arg('report_name') ||
				arg('description') ||
				'General Expense'
			).trim();

			const expCat = String(
				exp.Category ||
				exp.category ||
				exp.category_name ||
				arg('Category') ||
				arg('category') ||
				(payload.expense_report ? 'Expense Report' : 'Office Supplies')
			).trim();

			const rawAmt = exp.Amount ?? exp.amount ?? exp.total ?? exp.bcy_total ?? exp.total_amount ?? arg('Amount') ?? arg('amount') ?? arg('total') ?? 0;
			const expAmt = Number(parseFloat(rawAmt)) || 0;

			const expDate = String(
				exp.Expense_date ||
				exp.expense_date ||
				exp.date ||
				exp.submitted_date ||
				exp.created_time ||
				arg('Expense_date') ||
				arg('expense_date') ||
				arg('date') ||
				new Date().toISOString().slice(0, 10)
			).trim().slice(0, 50);

			const expPaidBy = String(
				exp.Paid_by ||
				exp.paid_by ||
				exp.user_name ||
				exp.submitter_name ||
				exp.created_by_name ||
				exp.user_email ||
				payload.user?.email ||
				payload.user?.name ||
				arg('Paid_by') ||
				arg('paid_by') ||
				arg('user_name') ||
				'KR Tech Solutions'
			).trim().slice(0, 255);

			const expStatus = String(
				exp.Status ||
				exp.status ||
				arg('Status') ||
				arg('status') ||
				'unreported'
			).trim().slice(0, 50);

			// Idempotent upsert: check if expense already exists with same name & date
			const existingExpenses = await fetchAllRows(expenseTable);
			const matchedExpense = existingExpenses.find((item) => {
				const row = item.Expense || item;
				const sameName = row.Expense_name && String(row.Expense_name).trim().toLowerCase() === expName.toLowerCase();
				const sameDate = row.Expense_date && String(row.Expense_date).trim() === expDate.trim();
				return sameName && (sameDate || expName.toLowerCase().includes('er-') || expCat === 'Expense Report');
			});

			let inserted;
			if (matchedExpense) {
				const existingRow = matchedExpense.Expense || matchedExpense;
				inserted = await expenseTable.updateRow({
					ROWID: existingRow.ROWID,
					Expense_name: expName,
					Category: expCat,
					Amount: expAmt,
					Expense_date: expDate,
					Paid_by: expPaidBy,
					Status: expStatus
				});
			} else {
				inserted = await expenseTable.insertRow({
					Expense_name: expName,
					Category: expCat,
					Amount: expAmt,
					Expense_date: expDate,
					Paid_by: expPaidBy,
					Status: expStatus
				});
			}

			writeOutput(basicIO, {
				status: 'Success',
				action: 'webhook_expense',
				data: inserted
			});
		} else if (action === 'delete_expense') {
			if (!rowId) throw new Error('row_id is required to delete an expense.');
			await expenseTable.deleteRow(rowId);
			writeOutput(basicIO, { status: 'Success' });
		} else if (action === 'approve_expense') {
			if (!rowId) throw new Error('row_id is required to approve an expense.');
			const updated = await expenseTable.updateRow({
				ROWID: rowId,
				Status: 'approved'
			});

			// Email Notification: Expense Approved
			await sendNotificationEmail(adminApp, {
				to: ['kumar.r@rcidigital.com', 'kumarlakavthu@gmail.com'],
				subject: '✅ Expense Approved - KR Tech Solutions',
				htmlContent: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
						<div style="background: #15803d; color: #ffffff; padding: 20px; text-align: center;">
							<h2 style="margin: 0;">Expense Approved</h2>
						</div>
						<div style="padding: 24px; color: #334155;">
							<p>The expense with Record ID <strong>${rowId}</strong> has been successfully approved by the manager.</p>
							<div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px; margin: 18px 0;">
								<p style="margin: 0; color: #15803d; font-weight: bold;">Status: Approved &amp; Cleared for Processing</p>
							</div>
						</div>
					</div>
				`
			});

			writeOutput(basicIO, { status: 'Success', data: updated });
		} else if (action === 'add_trip') {
			const tripName = arg('Trip_name') || arg('trip_name') || 'Corporate Business Trip';
			const departure = arg('Departure') || arg('departure') || 'Headquarters';
			const destination = arg('Destination') || arg('destination') || arg('destination_city') || 'Client Site';
			const startDate = arg('Start_date') || arg('start_date') || new Date().toISOString().slice(0, 10);
			const endDate = arg('End_date') || arg('end_date') || new Date().toISOString().slice(0, 10);
			const submitter = arg('Submitter') || arg('submitter') || 'Submiter';
			const budget = Number(parseFloat(arg('Budget') || arg('budget') || 0)) || 0;

			let zohoTrip = null;
			let tripNumber = `TRIP-${Date.now().toString().slice(-5)}`;
			let status = 'draft';

			try {
				zohoTrip = await createZohoExpenseTrip({
					tripName,
					departure,
					destination,
					startDate,
					endDate,
					budget
				});
				if (zohoTrip) {
					tripNumber = zohoTrip.trip_number || tripNumber;
					status = zohoTrip.status || 'draft';
				}
			} catch (zohoErr) {
				console.error('Zoho Expense API create trip error:', zohoErr.message);
				throw new Error(`Failed to create trip in Zoho Expense: ${zohoErr.message}`);
			}

			// Idempotent upsert in Catalyst Datastore
			const existingTrips = await fetchAllRows(tripTable);
			const matchedTrip = existingTrips.find((item) => {
				const row = item.Trip || item;
				return row.Trip_number && String(row.Trip_number).trim().toLowerCase() === tripNumber.toLowerCase();
			});

			let insertedTrip;
			if (matchedTrip) {
				const existingRow = matchedTrip.Trip || matchedTrip;
				insertedTrip = await tripTable.updateRow({
					ROWID: existingRow.ROWID,
					Trip_number: tripNumber,
					Trip_name: tripName,
					Departure: departure,
					Destination: destination,
					Start_date: startDate,
					End_date: endDate,
					Submitter: submitter,
					Status: status,
					Budget: budget
				});
			} else {
				insertedTrip = await tripTable.insertRow({
					Trip_number: tripNumber,
					Trip_name: tripName,
					Departure: departure,
					Destination: destination,
					Start_date: startDate,
					End_date: endDate,
					Submitter: submitter,
					Status: status,
					Budget: budget
				});
			}

			// Email Notification: Trip Request Created
			await sendNotificationEmail(adminApp, {
				to: ['kumar.r@rcidigital.com', 'kumarlakavthu@gmail.com'],
				subject: `✈️ Trip Request Created: ${tripNumber} - ${tripName}`,
				htmlContent: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
						<div style="background: #0284c7; color: #ffffff; padding: 20px; text-align: center;">
							<h2 style="margin: 0;">New Trip Request Created</h2>
							<p style="margin: 5px 0 0; opacity: 0.9;">Zoho Expense &amp; Catalyst 2-Way Sync</p>
						</div>
						<div style="padding: 24px; color: #334155;">
							<p>A new business travel request has been generated and synced with Zoho Expense:</p>
							<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Trip Number:</td><td style="font-weight: bold; text-align: right;">${tripNumber}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Trip Name:</td><td style="font-weight: bold; text-align: right;">${tripName}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Route:</td><td style="text-align: right;">${departure} ➔ ${destination}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Dates:</td><td style="text-align: right;">${startDate} to ${endDate}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Submitter:</td><td style="text-align: right;">${submitter}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Budget:</td><td style="color: #0284c7; font-weight: bold; text-align: right;">₹${budget.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
								<tr><td style="padding: 8px 0; color: #64748b;">Status:</td><td style="text-align: right; text-transform: capitalize;">${status}</td></tr>
							</table>
						</div>
					</div>
				`
			});

			writeOutput(basicIO, {
				status: 'Success',
				action: 'add_trip',
				data: insertedTrip,
				zoho_trip: zohoTrip
			});
		} else if (action === 'send_test_email') {
			const toEmail = arg('to_email') || arg('to') || 'kumarlakavathu9350@gmail.com';
			const mailRes = await sendNotificationEmail(adminApp, {
				to: toEmail,
				subject: '🔔 Test Notification from KR Tech Solutions (Catalyst Mail)',
				htmlContent: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
						<div style="background: #2563eb; color: #ffffff; padding: 20px; text-align: center;">
							<h2 style="margin: 0;">Catalyst Mail Configured Successfully!</h2>
						</div>
						<div style="padding: 24px; color: #334155;">
							<p>Hello,</p>
							<p>This is a test email sent from <strong>Catalyst Mail</strong> using sender address <code>${SENDER_EMAIL}</code>.</p>
							<p>Email notifications are configured and active for:</p>
							<ul>
								<li>✈️ New Trip Creation (Synced with Zoho Expense)</li>
								<li>💳 New Expense Recording</li>
								<li>✅ Expense Approvals</li>
								<li>👤 User Registrations &amp; Verification</li>
							</ul>
							<p style="color: #10b981; font-weight: bold;">Status: All email triggers verified and operational.</p>
						</div>
					</div>
				`
			});
			writeOutput(basicIO, {
				status: mailRes.success ? 'Success' : 'Error',
				message: mailRes.success ? `Test email successfully sent to ${toEmail}` : `Failed to send email: ${mailRes.error}`,
				mail_response: mailRes
			});
		} else if (
			action === 'webhook_trip' ||
			Boolean(allArgs?.trip || allArgs?.Trip)
		) {
			let payload = allArgs || {};
			if (typeof allArgs === 'string') {
				try { payload = JSON.parse(allArgs); } catch {}
			} else if (typeof allArgs?.body === 'string') {
				try { payload = JSON.parse(allArgs.body); } catch {}
			}
			const t = payload.trip || payload.Trip || payload.data || payload;

			const tripNumber = String(
				t.Trip_number ||
				t.trip_number ||
				arg('Trip_number') ||
				arg('trip_number') ||
				`TRIP-${Date.now().toString().slice(-5)}`
			).trim();

			const tripName = String(
				t.Trip_name ||
				t.trip_name ||
				arg('Trip_name') ||
				arg('trip_name') ||
				'Corporate Business Trip'
			).trim();

			const departure = String(
				t.Departure ||
				t.departure ||
				arg('Departure') ||
				arg('departure') ||
				'Headquarters'
			).trim();

			const destination = String(
				t.Destination ||
				t.destination ||
				t.destination_city ||
				arg('Destination') ||
				arg('destination') ||
				'Client Site'
			).trim();

			const startDate = String(
				t.Start_date ||
				t.start_date ||
				arg('Start_date') ||
				arg('start_date') ||
				new Date().toISOString().slice(0, 10)
			).trim();

			const endDate = String(
				t.End_date ||
				t.end_date ||
				arg('End_date') ||
				arg('end_date') ||
				new Date().toISOString().slice(0, 10)
			).trim();

			const submitter = String(
				t.Submitter ||
				t.submitter ||
				t.submitter_name ||
				t.user_name ||
				arg('Submitter') ||
				arg('submitter') ||
				'Submiter'
			).trim();

			const status = String(
				t.Status ||
				t.status ||
				arg('Status') ||
				arg('status') ||
				'approved'
			).trim();

			const budget = Number(parseFloat(t.Budget ?? t.budget ?? t.budget_amount ?? arg('Budget') ?? 0)) || 0;

			// Idempotent upsert: check if trip with this Trip_number already exists
			const existingTrips = await fetchAllRows(tripTable);
			const matchedTrip = existingTrips.find((item) => {
				const row = item.Trip || item;
				return row.Trip_number && String(row.Trip_number).trim().toLowerCase() === tripNumber.toLowerCase();
			});

			let insertedTrip;
			if (matchedTrip) {
				const existingRow = matchedTrip.Trip || matchedTrip;
				insertedTrip = await tripTable.updateRow({
					ROWID: existingRow.ROWID,
					Trip_number: tripNumber,
					Trip_name: tripName,
					Departure: departure,
					Destination: destination,
					Start_date: startDate,
					End_date: endDate,
					Submitter: submitter,
					Status: status,
					Budget: budget
				});
			} else {
				insertedTrip = await tripTable.insertRow({
					Trip_number: tripNumber,
					Trip_name: tripName,
					Departure: departure,
					Destination: destination,
					Start_date: startDate,
					End_date: endDate,
					Submitter: submitter,
					Status: status,
					Budget: budget
				});
			}

			writeOutput(basicIO, {
				status: 'Success',
				action: 'webhook_trip',
				data: insertedTrip
			});
		} else if (action === 'delete_trip') {
			if (!rowId) throw new Error('row_id is required to delete a trip.');
			await tripTable.deleteRow(rowId);
			writeOutput(basicIO, { status: 'Success' });
		} else if (action === 'approve_trip') {
			if (!rowId) throw new Error('row_id is required to approve a trip.');
			const updated = await tripTable.updateRow({
				ROWID: rowId,
				Status: 'approved'
			});
			writeOutput(basicIO, { status: 'Success', data: updated });
		} else if (action === 'sync_all_from_expense') {
			await syncZohoExpenseTrips(tripTable);
			await syncZohoExpenseExpenses(expenseTable);
			const currentExpenses = await fetchAllRows(expenseTable);
			const currentTrips = await fetchAllRows(tripTable);
			writeOutput(basicIO, {
				status: 'Success',
				synced_expenses: currentExpenses.length,
				synced_trips: currentTrips.length,
				message: `Synced ${currentExpenses.length} expenses and ${currentTrips.length} trips with Zoho Expense.`
			});
		} else {
			// Pull real expenses and trips if expense table is currently empty
			let expenses = await fetchAllRows(expenseTable);
			if (expenses.length <= 1) {
				await syncZohoExpenseExpenses(expenseTable);
				expenses = await fetchAllRows(expenseTable);
			}

			const rawAppUsers = await fetchAllRows(appUserTable);
			const appUsers = rawAppUsers.map(sanitizeAppUser);

			const employees = await fetchAllRows(empTable);
			const designations = await fetchAllRows(desigTable);
			const purchaseRequests = await fetchAllRows(prTable);
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
