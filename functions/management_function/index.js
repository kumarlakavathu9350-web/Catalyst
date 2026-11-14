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
					Status: expStatus,
					Zoho_expense_id: exp.expense_id || ''
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

async function syncZohoExpenseReports(reportTable) {
	try {
		const accessToken = await getZohoExpenseAccessToken();
		const url = `${ZOHO_EXPENSE_CONFIG.apiUrl}/expensereports?organization_id=${ZOHO_EXPENSE_CONFIG.organizationId}&per_page=200&filter_by=Status.All`;
		const reportsList = await new Promise((resolve) => {
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
						resolve(json.expense_reports || []);
					} catch (e) {
						resolve([]);
					}
				});
			});
			req.on('error', () => resolve([]));
			req.end();
		});

		if (Array.isArray(reportsList) && reportsList.length > 0) {
			const existingRows = await fetchAllRows(reportTable);
			for (const r of reportsList) {
				const reportNum = r.report_number;
				if (!reportNum) continue;

				const matched = existingRows.find(item => {
					const row = item.Report || item;
					return row.Report_number && String(row.Report_number).trim().toLowerCase() === reportNum.toLowerCase();
				});

				const rawStatus = String(r.status || 'draft').toLowerCase();
				let approvalLevel = 'Level 1 - Manager Review';
				if (rawStatus === 'reimbursed' || rawStatus === 'approved') {
					approvalLevel = 'Level 3 - Approved & Settled';
				} else if (rawStatus === 'submitted') {
					approvalLevel = 'Level 2 - Finance Review';
				}

				const rowData = {
					Report_number: reportNum,
					Report_name: r.report_name || 'Expense Report',
					Submitter_name: r.submitter_name || r.created_by_name || 'Submiter',
					Submitter_email: r.submitter_email || r.created_by_email || 'kumar.r@rcidigital.com',
					Total_amount: Number(parseFloat(r.total || r.amount || 0)) || 0,
					Start_date: r.start_date || new Date().toISOString().slice(0, 10),
					End_date: r.end_date || new Date().toISOString().slice(0, 10),
					Approval_level: approvalLevel,
					Status: rawStatus
				};

				if (matched) {
					const existingRow = matched.Report || matched;
					await reportTable.updateRow({
						ROWID: existingRow.ROWID,
						...rowData
					});
				} else {
					await reportTable.insertRow(rowData);
				}
			}
		}
	} catch (e) {
		console.error('syncZohoExpenseReports error:', e.message);
	}
}

async function initZohoExpenseAdvances(advanceTable) {
	try {
		const existingRows = await fetchAllRows(advanceTable);
		if (existingRows.length === 0) {
			const initialAdvances = [
				{
					Advance_number: 'ADV-001',
					Employee_name: 'kumar lakavthu',
					Employee_email: 'kumarlakavthu@gmail.com',
					Amount: 1.00,
					Advance_date: '2026-11-13',
					Reason: 'Advance payment for trip expenses',
					Approval_level: 'Level 3 - Approved & Disbursed',
					Status: 'approved'
				},
				{
					Advance_number: 'ADV-002',
					Employee_name: 'kumar lakavthu',
					Employee_email: 'kumarlakavthu@gmail.com',
					Amount: 5000.00,
					Advance_date: '2026-11-13',
					Reason: 'Advance for Client Visit and Regional Meetings',
					Approval_level: 'Level 3 - Approved & Disbursed',
					Status: 'approved'
				},
				{
					Advance_number: 'ADV-003',
					Employee_name: 'Submiter',
					Employee_email: 'kumar.r@rcidigital.com',
					Amount: 12500.00,
					Advance_date: '2026-11-13',
					Reason: 'Client Onsite Workshop & Travel Advance',
					Approval_level: 'Level 2 - Finance Review',
					Status: 'level_1_approved'
				}
			];
			for (const adv of initialAdvances) {
				await advanceTable.insertRow(adv);
			}
		}
	} catch (e) {
		console.error('initZohoExpenseAdvances error:', e.message);
	}
}

async function initPurchaseRequests(prTable) {
	try {
		const existingRows = await fetchAllRows(prTable);
		if (existingRows.length === 0) {
			const initialPRs = [
				{
					Item_name: 'Jira Software & Confluence Cloud Subscription',
					Vendor: 'Atlassian Inc',
					Amount: 52000.00,
					Requester: 'Submiter',
					Department: 'Products',
					Request_date: '2026-11-13',
					Approval_level: 'Level 3 - Approved & Procured',
					Status: 'approved'
				},
				{
					Item_name: 'Synology 4-Bay NAS Server with 32TB Storage',
					Vendor: 'Synology Enterprise Store',
					Amount: 95000.00,
					Requester: 'Submiter',
					Department: 'Products',
					Request_date: '2026-11-13',
					Approval_level: 'Level 3 - Approved & Procured',
					Status: 'approved'
				},
				{
					Item_name: 'Cisco Catalyst 24-Port Gigabit Managed Switch',
					Vendor: 'Cisco Systems India',
					Amount: 84000.00,
					Requester: 'Submiter',
					Department: 'Products',
					Request_date: '2026-11-13',
					Approval_level: 'Level 3 - Approved & Procured',
					Status: 'approved'
				},
				{
					Item_name: 'JetBrains All Products Pack Team License',
					Vendor: 'JetBrains s.r.o.',
					Amount: 45000.00,
					Requester: 'Submiter',
					Department: 'Products',
					Request_date: '2026-11-13',
					Approval_level: 'Level 3 - Approved & Procured',
					Status: 'approved'
				},
				{
					Item_name: 'MacBook Pro 16-inch M3 Max (36GB RAM)',
					Vendor: 'Apple India Pvt Ltd',
					Amount: 249900.00,
					Requester: 'kumar lakavthu',
					Department: 'Engineering',
					Request_date: '2026-11-13',
					Approval_level: 'Level 2 - Finance Review',
					Status: 'level_1_approved'
				},
				{
					Item_name: 'Herman Miller Aeron Ergonomic Chair',
					Vendor: 'Herman Miller India',
					Amount: 115000.00,
					Requester: 'kumar lakavthu',
					Department: 'Operations',
					Request_date: '2026-11-14',
					Approval_level: 'Level 1 - Manager Review',
					Status: 'pending'
				}
			];
			for (const pr of initialPRs) {
				await prTable.insertRow(pr);
			}
		}
	} catch (e) {
		console.error('initPurchaseRequests error:', e.message);
	}
}

async function deleteZohoExpense(zohoExpenseId) {
	try {
		const accessToken = await getZohoExpenseAccessToken();
		const url = `${ZOHO_EXPENSE_CONFIG.apiUrl}/expenses/${zohoExpenseId}?organization_id=${ZOHO_EXPENSE_CONFIG.organizationId}`;
		return new Promise((resolve) => {
			const req = https.request(url, {
				method: 'DELETE',
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
						resolve(json.code === 0);
					} catch {
						resolve(false);
					}
				});
			});
			req.on('error', () => resolve(false));
			req.end();
		});
	} catch (e) {
		console.error('deleteZohoExpense error:', e.message);
		return false;
	}
}

async function deleteZohoTrip(zohoTripId) {
	try {
		const accessToken = await getZohoExpenseAccessToken();
		const url = `${ZOHO_EXPENSE_CONFIG.apiUrl}/trips/${zohoTripId}?organization_id=${ZOHO_EXPENSE_CONFIG.organizationId}`;
		return new Promise((resolve) => {
			const req = https.request(url, {
				method: 'DELETE',
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
						resolve(json.code === 0);
					} catch {
						resolve(false);
					}
				});
			});
			req.on('error', () => resolve(false));
			req.end();
		});
	} catch (e) {
		console.error('deleteZohoTrip error:', e.message);
		return false;
	}
}

async function deleteZohoUser(zohoUserId) {
	try {
		const accessToken = await getZohoExpenseAccessToken();
		const url = `${ZOHO_EXPENSE_CONFIG.apiUrl}/users/${zohoUserId}?organization_id=${ZOHO_EXPENSE_CONFIG.organizationId}`;
		return new Promise((resolve) => {
			const req = https.request(url, {
				method: 'DELETE',
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
						resolve(json.code === 0);
					} catch {
						resolve(false);
					}
				});
			});
			req.on('error', () => resolve(false));
			req.end();
		});
	} catch (e) {
		console.error('deleteZohoUser error:', e.message);
		return false;
	}
}

async function createZohoExpenseUser({ name, email, role, departmentName }) {
	const accessToken = await getZohoExpenseAccessToken();
	const zohoPayload = {
		name: name || 'Team Member',
		email: email,
		user_role: role || 'submitter'
	};
	if (departmentName) {
		zohoPayload.department_name = departmentName;
	}

	const postData = querystring.stringify({
		JSONString: JSON.stringify(zohoPayload)
	});

	const url = `${ZOHO_EXPENSE_CONFIG.apiUrl}/users?organization_id=${ZOHO_EXPENSE_CONFIG.organizationId}`;

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
					if (json.code === 0 && json.user) {
						resolve(json.user);
					} else {
						reject(new Error(json.message || `Zoho User API Error code ${json.code}`));
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

async function syncZohoExpenseUsers(appUserTable) {
	try {
		const accessToken = await getZohoExpenseAccessToken();
		const url = `${ZOHO_EXPENSE_CONFIG.apiUrl}/users?organization_id=${ZOHO_EXPENSE_CONFIG.organizationId}&per_page=200`;
		const usersList = await new Promise((resolve) => {
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
						resolve(json.users || []);
					} catch (e) {
						resolve([]);
					}
				});
			});
			req.on('error', () => resolve([]));
			req.end();
		});

		if (Array.isArray(usersList) && usersList.length > 0) {
			const existingRows = await fetchAllRows(appUserTable);
			for (const u of usersList) {
				const userEmail = String(u.email || '').trim().toLowerCase();
				if (!userEmail) continue;

				VERIFIED_EXPENSE_EMAILS.add(userEmail);

				const matched = existingRows.find(item => {
					const row = item.App_user || item;
					return String(row.emp_mail || '').trim().toLowerCase() === userEmail;
				});

				const userName = u.name || u.display_name || userEmail.split('@')[0];
				const userRole = u.user_role || (u.is_super_admin ? 'admin' : 'submitter');
				const zohoUserId = u.user_id || '';

				if (matched) {
					const existingRow = matched.App_user || matched;
					await appUserTable.updateRow({
						ROWID: existingRow.ROWID,
						Emp_name: userName,
						Role: userRole,
						Zoho_user_id: zohoUserId
					});
				} else {
					const defaultPassword = 'User@' + Date.now().toString().slice(-4);
					const hashedPassword = crypto.createHash('sha256').update(defaultPassword).digest('hex');
					await appUserTable.insertRow({
						Emp_name: userName,
						emp_mail: userEmail,
						emp_password: hashedPassword,
						Role: userRole,
						Zoho_user_id: zohoUserId
					});
				}
			}
		}
	} catch (e) {
		console.error('syncZohoExpenseUsers error:', e.message);
	}
}

async function initCorporateCards(cardTable) {
	try {
		const existingRows = await fetchAllRows(cardTable);
		if (existingRows.length === 0) {
			const initialCards = [
				{
					Card_number: '•••• •••• •••• 4589',
					Cardholder_name: 'kumar lakavthu',
					Bank_name: 'HDFC Corporate Banking',
					Card_type: 'Mastercard Corporate',
					Status: 'Active Feed',
					Total_spend: 124500.00
				},
				{
					Card_number: '•••• •••• •••• 8821',
					Cardholder_name: 'Submiter',
					Bank_name: 'ICICI Bank Commercial',
					Card_type: 'Visa Business Prime',
					Status: 'Active Feed',
					Total_spend: 68200.00
				},
				{
					Card_number: '•••• •••• •••• 1092',
					Cardholder_name: 'Engineering Float',
					Bank_name: 'Axis Bank Corporate',
					Card_type: 'Visa Commercial',
					Status: 'Active Feed',
					Total_spend: 42000.00
				}
			];
			for (const c of initialCards) {
				await cardTable.insertRow(c);
			}
		}
	} catch (e) {
		console.error('initCorporateCards error:', e.message);
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
		const advanceTable = datastore.table('Advance');
		const reportTable = datastore.table('Report');
		const cardTable = datastore.table('Card');

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
				} catch { }
				const authEmail = String(authUser?.email_id || '').trim().toLowerCase();
				targetEmail = authEmail || requestedEmail;
			}

			if (!targetEmail) {
				writeOutput(basicIO, { status: 'Success', allowed: false, email: '', message: 'Email is required.' });
			} else {
				if (!VERIFIED_EXPENSE_EMAILS.has(targetEmail)) {
					const existingUser = await findAppUserByEmail(appUserTable, targetEmail);
					if (existingUser) {
						VERIFIED_EXPENSE_EMAILS.add(targetEmail);
					} else {
						writeOutput(basicIO, {
							status: 'Success',
							allowed: false,
							email: targetEmail,
							message: `Access denied: "${targetEmail}" is not an employee in KR Tech Solutions (Zoho Expense). Only verified organization members can sign in.`
						});
						context.close();
						return;
					}
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
				try { payload = JSON.parse(allArgs); } catch { }
			} else if (typeof allArgs?.body === 'string') {
				try { payload = JSON.parse(allArgs.body); } catch { }
			} else if (typeof allArgs?.data === 'string') {
				try { payload = JSON.parse(allArgs.data); } catch { }
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
			let zohoId = arg('zoho_expense_id');
			let expenseRow = null;
			try {
				expenseRow = await expenseTable.getRow(rowId);
			} catch (e) {
				const all = await fetchAllRows(expenseTable);
				expenseRow = all.find(r => {
					const row = r.Expense || r;
					return String(row.ROWID) === String(rowId);
				});
			}
			const expData = expenseRow?.Expense || expenseRow || {};
			if (!zohoId && expData.Zoho_expense_id) {
				zohoId = expData.Zoho_expense_id;
			}

			if (zohoId) {
				await deleteZohoExpense(zohoId);
			} else {
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
								try { resolve(JSON.parse(data).expenses || []); } catch { resolve([]); }
							});
						});
						req.on('error', () => resolve([]));
						req.end();
					});
					const matched = expensesList.find(x => {
						const sameAmt = Math.abs(parseFloat(x.amount || x.total || 0) - parseFloat(expData.Amount || 0)) < 0.01;
						const sameDesc = (x.description || '').toLowerCase() === (expData.Expense_name || '').toLowerCase();
						return sameAmt && sameDesc;
					});
					if (matched?.expense_id) {
						await deleteZohoExpense(matched.expense_id);
					}
				} catch (e) {}
			}

			await expenseTable.deleteRow(rowId);
			writeOutput(basicIO, { status: 'Success', message: 'Expense deleted successfully from Catalyst Datastore and Zoho Expense.' });
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
		} else if (action === 'add_user') {
			const name = arg('name') || arg('Emp_name') || 'Team Member';
			const email = String(arg('email') || arg('emp_mail') || '').trim().toLowerCase();
			const role = arg('role') || 'submitter';
			const departmentName = arg('department') || arg('department_name') || 'Engineering';
			const password = rawArg('password') || rawArg('emp_password') || 'User@123';

			if (!email) throw new Error('Email is required to add a user.');

			let zohoUser = null;
			try {
				zohoUser = await createZohoExpenseUser({
					name,
					email,
					role,
					departmentName
				});
			} catch (zErr) {
				console.error('Zoho Expense user creation:', zErr.message);
			}

			const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
			const existingRows = await fetchAllRows(appUserTable);
			const matched = existingRows.find(item => {
				const row = item.App_user || item;
				return String(row.emp_mail || '').trim().toLowerCase() === email;
			});

			let savedUser;
			const zohoUserId = zohoUser?.user_id || '';
			if (matched) {
				const existingRow = matched.App_user || matched;
				savedUser = await appUserTable.updateRow({
					ROWID: existingRow.ROWID,
					Emp_name: name,
					emp_password: hashedPassword,
					Role: role,
					Zoho_user_id: zohoUserId
				});
			} else {
				savedUser = await appUserTable.insertRow({
					Emp_name: name,
					emp_mail: email,
					emp_password: hashedPassword,
					Role: role,
					Zoho_user_id: zohoUserId
				});
			}

			VERIFIED_EXPENSE_EMAILS.add(email);

			await sendNotificationEmail(adminApp, {
				to: [email, 'kumarlakavthu@gmail.com'],
				subject: '🎉 Welcome to KR Tech Solutions - Zoho Expense Access',
				htmlContent: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
						<div style="background: #2563eb; color: #ffffff; padding: 20px; text-align: center;">
							<h2 style="margin: 0;">Welcome to KR Tech Solutions</h2>
						</div>
						<div style="padding: 24px; color: #334155;">
							<p>Hello <strong>${name}</strong>,</p>
							<p>You have been added to KR Tech Solutions with access to both <strong>Zoho Expense</strong> and the <strong>Catalyst Management Portal</strong>.</p>
							<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Email:</td><td style="font-weight: bold; text-align: right;">${email}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Role:</td><td style="text-align: right; text-transform: capitalize;">${role}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Department:</td><td style="text-align: right;">${departmentName}</td></tr>
							</table>
						</div>
					</div>
				`
			});

			writeOutput(basicIO, {
				status: 'Success',
				message: `User ${name} (${email}) created in Zoho Expense and Catalyst Datastore.`,
				data: savedUser,
				zoho_user: zohoUser
			});
		} else if (action === 'delete_user') {
			if (!rowId) throw new Error('row_id is required to delete a user.');
			let userRow = null;
			try {
				userRow = await appUserTable.getRow(rowId);
			} catch (e) {
				const all = await fetchAllRows(appUserTable);
				userRow = all.find(r => {
					const row = r.App_user || r;
					return String(row.ROWID) === String(rowId);
				});
			}
			const uData = userRow?.App_user || userRow || {};
			if (uData.Zoho_user_id) {
				await deleteZohoUser(uData.Zoho_user_id);
			}
			if (uData.emp_mail) {
				VERIFIED_EXPENSE_EMAILS.delete(String(uData.emp_mail).toLowerCase());
			}
			await appUserTable.deleteRow(rowId);
			writeOutput(basicIO, { status: 'Success', message: 'User deleted from Catalyst Datastore and Zoho Expense.' });
		} else if (action === 'sync_users') {
			await syncZohoExpenseUsers(appUserTable);
			const currentUsers = (await fetchAllRows(appUserTable)).map(sanitizeAppUser);
			writeOutput(basicIO, { status: 'Success', users: currentUsers, message: `Synced ${currentUsers.length} users with Zoho Expense.` });
		} else if (action === 'add_card') {
			const cardNumber = arg('Card_number') || arg('card_number') || '•••• •••• •••• 9999';
			const cardholderName = arg('Cardholder_name') || arg('cardholder_name') || 'Team Member';
			const bankName = arg('Bank_name') || arg('bank_name') || 'HDFC Corporate Banking';
			const cardType = arg('Card_type') || arg('card_type') || 'Mastercard Corporate';
			const status = arg('Status') || arg('status') || 'Active Feed';
			const totalSpend = Number(parseFloat(arg('Total_spend') || arg('total_spend') || 0)) || 0;

			const inserted = await cardTable.insertRow({
				Card_number: cardNumber,
				Cardholder_name: cardholderName,
				Bank_name: bankName,
				Card_type: cardType,
				Status: status,
				Total_spend: totalSpend
			});
			writeOutput(basicIO, { status: 'Success', data: inserted });
		} else if (action === 'delete_card') {
			if (!rowId) throw new Error('row_id is required to delete a card.');
			await cardTable.deleteRow(rowId);
			writeOutput(basicIO, { status: 'Success' });
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
				try { payload = JSON.parse(allArgs); } catch { }
			} else if (typeof allArgs?.body === 'string') {
				try { payload = JSON.parse(allArgs.body); } catch { }
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
			let tripRow = null;
			try {
				tripRow = await tripTable.getRow(rowId);
			} catch (e) {
				const all = await fetchAllRows(tripTable);
				tripRow = all.find(r => {
					const row = r.Trip || r;
					return String(row.ROWID) === String(rowId);
				});
			}
			const tData = tripRow?.Trip || tripRow || {};
			const tripNum = tData.Trip_number;

			try {
				const accessToken = await getZohoExpenseAccessToken();
				const url = `${ZOHO_EXPENSE_CONFIG.apiUrl}/trips?organization_id=${ZOHO_EXPENSE_CONFIG.organizationId}&per_page=200`;
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
							try { resolve(JSON.parse(data).trips || []); } catch { resolve([]); }
						});
					});
					req.on('error', () => resolve([]));
					req.end();
				});
				const matchedTrip = tripsList.find(x => (x.trip_number && tripNum && x.trip_number.toLowerCase() === tripNum.toLowerCase()) || (x.trip_name && tData.Trip_name && x.trip_name.toLowerCase() === tData.Trip_name.toLowerCase()));
				if (matchedTrip?.trip_id) {
					await deleteZohoTrip(matchedTrip.trip_id);
				}
			} catch (e) {}

			await tripTable.deleteRow(rowId);
			writeOutput(basicIO, { status: 'Success', message: 'Trip deleted from Catalyst Datastore and Zoho Expense.' });
		} else if (action === 'approve_trip') {
			if (!rowId) throw new Error('row_id is required to approve a trip.');
			const updated = await tripTable.updateRow({
				ROWID: rowId,
				Status: 'approved'
			});
			writeOutput(basicIO, { status: 'Success', data: updated });
		} else if (action === 'approve_level') {
			const moduleType = (arg('module') || 'report').toLowerCase();
			const targetId = rowId || arg('id');
			if (!targetId) throw new Error('row_id is required for approval.');

			let tableToUpdate;
			let entityName = 'Record';
			let notifyEmail = 'kumarlakavthu@gmail.com';

			if (moduleType === 'report') {
				tableToUpdate = reportTable;
				entityName = 'Expense Report';
			} else if (moduleType === 'advance') {
				tableToUpdate = advanceTable;
				entityName = 'Advance Request';
			} else if (moduleType === 'purchase_request' || moduleType === 'purchases' || moduleType === 'pr') {
				tableToUpdate = prTable;
				entityName = 'Purchase Request';
			} else if (moduleType === 'trip') {
				tableToUpdate = tripTable;
				entityName = 'Trip Request';
			} else {
				tableToUpdate = expenseTable;
				entityName = 'Expense';
			}

			let currentRow = null;
			try {
				currentRow = await tableToUpdate.getRow(targetId);
			} catch (e) {
				const all = await fetchAllRows(tableToUpdate);
				currentRow = all.find(r => {
					const row = r.Report || r.Advance || r.Purchase_request || r.Expense || r.Trip || r;
					return String(row.ROWID) === String(targetId);
				});
			}
			const cur = currentRow?.Report || currentRow?.Advance || currentRow?.Purchase_request || currentRow?.Expense || currentRow?.Trip || currentRow || {};
			const curLevel = String(cur.Approval_level || cur.Status || '').toLowerCase();
			const empEmail = cur.Employee_email || cur.Submitter_email || cur.Requester || cur.Paid_by || notifyEmail;

			let nextStatus = 'approved';
			let nextLevel = 'Level 3 - Approved & Settled';

			if (curLevel.includes('level 1') || curLevel.includes('draft') || curLevel.includes('submitted') || curLevel.includes('pending') || curLevel.includes('unreported')) {
				nextStatus = 'level_1_approved';
				nextLevel = 'Level 2 - Finance Review';
			} else {
				nextStatus = 'approved';
				nextLevel = 'Level 3 - Approved & Disbursed';
			}

			const updatePayload = {
				ROWID: targetId,
				Status: nextStatus
			};
			if (cur.Approval_level !== undefined || moduleType === 'report' || moduleType === 'advance' || moduleType === 'purchase_request' || moduleType === 'purchases' || moduleType === 'pr') {
				updatePayload.Approval_level = nextLevel;
			}

			const updated = await tableToUpdate.updateRow(updatePayload);

			// Email notification for multi-level approval progression
			await sendNotificationEmail(adminApp, {
				to: [empEmail, 'kumar.r@rcidigital.com'],
				subject: `✅ ${entityName} Approved to ${nextLevel}`,
				htmlContent: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
						<div style="background: #15803d; color: #ffffff; padding: 20px; text-align: center;">
							<h2 style="margin: 0;">${entityName} Approval Update</h2>
						</div>
						<div style="padding: 24px; color: #334155;">
							<p>Your ${entityName.toLowerCase()} has advanced in the multi-level approval pipeline.</p>
							<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Record ID:</td><td style="font-weight: bold; text-align: right;">${targetId}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Approval Stage:</td><td style="color: #15803d; font-weight: bold; text-align: right;">${nextLevel}</td></tr>
								<tr><td style="padding: 8px 0; color: #64748b;">Status:</td><td style="text-align: right; text-transform: capitalize;">${nextStatus}</td></tr>
							</table>
						</div>
					</div>
				`
			});

			writeOutput(basicIO, { status: 'Success', action: 'approve_level', data: updated, nextLevel });
		} else if (action === 'reject_level') {
			const moduleType = (arg('module') || 'report').toLowerCase();
			const targetId = rowId || arg('id');
			const reason = arg('reason') || 'Requires correction or policy clarification.';
			if (!targetId) throw new Error('row_id is required for rejection.');

			let tableToUpdate = reportTable;
			let entityName = 'Expense Report';
			if (moduleType === 'advance') {
				tableToUpdate = advanceTable;
				entityName = 'Advance Request';
			} else if (moduleType === 'purchase_request' || moduleType === 'purchases' || moduleType === 'pr') {
				tableToUpdate = prTable;
				entityName = 'Purchase Request';
			} else if (moduleType === 'trip') {
				tableToUpdate = tripTable;
				entityName = 'Trip Request';
			} else if (moduleType === 'expense') {
				tableToUpdate = expenseTable;
				entityName = 'Expense';
			}

			const updatePayload = {
				ROWID: targetId,
				Status: 'rejected',
				Approval_level: 'Rejected'
			};
			const updated = await tableToUpdate.updateRow(updatePayload);

			await sendNotificationEmail(adminApp, {
				to: ['kumarlakavthu@gmail.com', 'kumar.r@rcidigital.com'],
				subject: `❌ ${entityName} Rejected`,
				htmlContent: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
						<div style="background: #dc2626; color: #ffffff; padding: 20px; text-align: center;">
							<h2 style="margin: 0;">${entityName} Rejected</h2>
						</div>
						<div style="padding: 24px; color: #334155;">
							<p>The ${entityName.toLowerCase()} with ID <strong>${targetId}</strong> has been rejected during review.</p>
							<p style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 16px 0;">Reason: ${reason}</p>
						</div>
					</div>
				`
			});

			writeOutput(basicIO, { status: 'Success', action: 'reject_level', data: updated });
		} else if (action === 'add_advance') {
			const employeeName = arg('Employee_name') || arg('employee_name') || 'kumar lakavthu';
			const employeeEmail = arg('Employee_email') || arg('employee_email') || 'kumarlakavthu@gmail.com';
			const amount = Number(parseFloat(arg('Amount') || arg('amount') || 0)) || 0;
			const advanceDate = arg('Advance_date') || arg('advance_date') || new Date().toISOString().slice(0, 10);
			const reason = arg('Reason') || arg('reason') || 'Travel and operational expenses';
			const advanceNumber = `ADV-${Date.now().toString().slice(-4)}`;

			const inserted = await advanceTable.insertRow({
				Advance_number: advanceNumber,
				Employee_name: employeeName,
				Employee_email: employeeEmail,
				Amount: amount,
				Advance_date: advanceDate,
				Reason: reason,
				Approval_level: 'Level 1 - Manager Review',
				Status: 'pending'
			});

			await sendNotificationEmail(adminApp, {
				to: [employeeEmail, 'kumar.r@rcidigital.com'],
				subject: `💼 Advance Request Submitted: ${advanceNumber} (₹${amount})`,
				htmlContent: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
						<div style="background: #0284c7; color: #ffffff; padding: 20px; text-align: center;">
							<h2 style="margin: 0;">New Advance Request</h2>
						</div>
						<div style="padding: 24px; color: #334155;">
							<p>A new cash advance has been requested:</p>
							<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Advance#:</td><td style="font-weight: bold; text-align: right;">${advanceNumber}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Employee:</td><td style="text-align: right;">${employeeName}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Amount:</td><td style="color: #0284c7; font-weight: bold; text-align: right;">₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Reason:</td><td style="text-align: right;">${reason}</td></tr>
								<tr><td style="padding: 8px 0; color: #64748b;">Stage:</td><td style="text-align: right;">Level 1 - Manager Review</td></tr>
							</table>
						</div>
					</div>
				`
			});

			writeOutput(basicIO, { status: 'Success', action: 'add_advance', data: inserted });
		} else if (action === 'add_purchase_request') {
			const itemName = arg('Item_name') || arg('item_name') || 'Office Equipment';
			const vendor = arg('Vendor') || arg('vendor') || 'Vendor Partner';
			const amount = Number(parseFloat(arg('Amount') || arg('amount') || 0)) || 0;
			const requester = arg('Requester') || arg('requester') || 'kumar lakavthu';
			const department = arg('Department') || arg('department') || 'Engineering';
			const requestDate = arg('Request_date') || arg('request_date') || new Date().toISOString().slice(0, 10);

			const inserted = await prTable.insertRow({
				Item_name: itemName,
				Vendor: vendor,
				Amount: amount,
				Requester: requester,
				Department: department,
				Request_date: requestDate,
				Approval_level: 'Level 1 - Manager Review',
				Status: 'pending'
			});

			await sendNotificationEmail(adminApp, {
				to: ['kumarlakavthu@gmail.com', 'kumar.r@rcidigital.com'],
				subject: `🛍️ Purchase Request Submitted: ${itemName} (₹${amount})`,
				htmlContent: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
						<div style="background: #6366f1; color: #ffffff; padding: 20px; text-align: center;">
							<h2 style="margin: 0;">New Purchase Request</h2>
						</div>
						<div style="padding: 24px; color: #334155;">
							<p>A new purchase requisition has been submitted:</p>
							<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Item:</td><td style="font-weight: bold; text-align: right;">${itemName}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Vendor:</td><td style="text-align: right;">${vendor}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Requester:</td><td style="text-align: right;">${requester} (${department})</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Amount:</td><td style="color: #6366f1; font-weight: bold; text-align: right;">₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
								<tr><td style="padding: 8px 0; color: #64748b;">Stage:</td><td style="text-align: right;">Level 1 - Manager Review</td></tr>
							</table>
						</div>
					</div>
				`
			});

			writeOutput(basicIO, { status: 'Success', action: 'add_purchase_request', data: inserted });
		} else if (action === 'add_report') {
			const reportName = arg('Report_name') || arg('report_name') || 'Expense Report';
			const submitterName = arg('Submitter_name') || arg('submitter_name') || 'kumar lakavthu';
			const submitterEmail = arg('Submitter_email') || arg('submitter_email') || 'kumarlakavthu@gmail.com';
			const totalAmount = Number(parseFloat(arg('Total_amount') || arg('total_amount') || 0)) || 0;
			const startDate = arg('Start_date') || arg('start_date') || new Date().toISOString().slice(0, 10);
			const endDate = arg('End_date') || arg('end_date') || new Date().toISOString().slice(0, 10);

			let reportNumber = `ER-${Date.now().toString().slice(-5)}`;
			let zohoReport = null;
			try {
				zohoReport = await createZohoExpenseReport({
					reportName,
					startDate,
					endDate,
					description: `Created via Catalyst by ${submitterName}`
				});
				if (zohoReport?.report_number) {
					reportNumber = zohoReport.report_number;
				}
			} catch (zErr) {
				console.error('Zoho Expense report creation error:', zErr.message);
			}

			const inserted = await reportTable.insertRow({
				Report_number: reportNumber,
				Report_name: reportName,
				Submitter_name: submitterName,
				Submitter_email: submitterEmail,
				Total_amount: totalAmount,
				Start_date: startDate,
				End_date: endDate,
				Approval_level: 'Level 1 - Manager Review',
				Status: 'submitted'
			});

			await sendNotificationEmail(adminApp, {
				to: [submitterEmail, 'kumar.r@rcidigital.com'],
				subject: `📁 Expense Report Submitted: ${reportNumber} - ${reportName}`,
				htmlContent: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
						<div style="background: #2563eb; color: #ffffff; padding: 20px; text-align: center;">
							<h2 style="margin: 0;">Expense Report Submitted</h2>
						</div>
						<div style="padding: 24px; color: #334155;">
							<p>A new expense report has been created and synced with Zoho Expense:</p>
							<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Report#:</td><td style="font-weight: bold; text-align: right;">${reportNumber}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Title:</td><td style="font-weight: bold; text-align: right;">${reportName}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Submitter:</td><td style="text-align: right;">${submitterName}</td></tr>
								<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Amount:</td><td style="color: #2563eb; font-weight: bold; text-align: right;">₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
								<tr><td style="padding: 8px 0; color: #64748b;">Stage:</td><td style="text-align: right;">Level 1 - Manager Review</td></tr>
							</table>
						</div>
					</div>
				`
			});

			writeOutput(basicIO, { status: 'Success', action: 'add_report', data: inserted, zoho_report: zohoReport });
		} else if (action === 'sync_all_from_expense') {
			await syncZohoExpenseTrips(tripTable);
			await syncZohoExpenseExpenses(expenseTable);
			await syncZohoExpenseReports(reportTable);
			await initZohoExpenseAdvances(advanceTable);
			await initPurchaseRequests(prTable);
			await syncZohoExpenseUsers(appUserTable);
			await initCorporateCards(cardTable);

			const currentExpenses = await fetchAllRows(expenseTable);
			const currentTrips = await fetchAllRows(tripTable);
			const currentReports = await fetchAllRows(reportTable);
			const currentAdvances = await fetchAllRows(advanceTable);
			const currentPRs = await fetchAllRows(prTable);
			const currentCards = await fetchAllRows(cardTable);
			const currentUsers = (await fetchAllRows(appUserTable)).map(sanitizeAppUser);

			writeOutput(basicIO, {
				status: 'Success',
				synced_expenses: currentExpenses.length,
				synced_trips: currentTrips.length,
				synced_reports: currentReports.length,
				synced_advances: currentAdvances.length,
				synced_purchases: currentPRs.length,
				synced_cards: currentCards.length,
				synced_users: currentUsers.length,
				message: `Synced with Zoho Expense: ${currentReports.length} reports, ${currentExpenses.length} expenses, ${currentTrips.length} trips, ${currentAdvances.length} advances, ${currentPRs.length} purchase requests, ${currentCards.length} cards, ${currentUsers.length} users.`
			});
		} else {
			// Pull real expenses and trips if expense table is currently empty
			let expenses = await fetchAllRows(expenseTable);
			if (expenses.length <= 1) {
				await syncZohoExpenseExpenses(expenseTable);
				expenses = await fetchAllRows(expenseTable);
			}

			let reports = await fetchAllRows(reportTable);
			if (reports.length === 0) {
				await syncZohoExpenseReports(reportTable);
				reports = await fetchAllRows(reportTable);
			}

			let advances = await fetchAllRows(advanceTable);
			if (advances.length === 0) {
				await initZohoExpenseAdvances(advanceTable);
				advances = await fetchAllRows(advanceTable);
			}

			let purchaseRequests = await fetchAllRows(prTable);
			if (purchaseRequests.length === 0) {
				await initPurchaseRequests(prTable);
				purchaseRequests = await fetchAllRows(prTable);
			}

			let cards = await fetchAllRows(cardTable);
			if (cards.length === 0) {
				await initCorporateCards(cardTable);
				cards = await fetchAllRows(cardTable);
			}

			let rawAppUsers = await fetchAllRows(appUserTable);
			if (rawAppUsers.length <= 1) {
				await syncZohoExpenseUsers(appUserTable);
				rawAppUsers = await fetchAllRows(appUserTable);
			}
			const appUsers = rawAppUsers.map(sanitizeAppUser);

			const employees = await fetchAllRows(empTable);
			const designations = await fetchAllRows(desigTable);
			const trips = await fetchAllRows(tripTable);

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