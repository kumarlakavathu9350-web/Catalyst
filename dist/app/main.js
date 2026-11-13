document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const isAppSubdir = window.location.pathname.startsWith('/app');
    const LOGIN_URL = isAppSubdir ? '/app/login.html' : '/login.html';

    function getBackendUrl(path) {
        if (window.location.hostname.endsWith('onslate.in')) {
            return 'https://management-60094939168.development.catalystserverless.in' + path;
        }
        return path;
    }

    const empModal = $('empModal');
    const desigModal = $('desigModal');
    const appUserModal = $('appUserModal');
    const prModal = $('prModal');
    const expenseModal = $('expenseModal');
    const empForm = $('empForm');
    const desigForm = $('desigForm');
    const appUserForm = $('appUserForm');
    const prForm = $('prForm');
    const expenseForm = $('expenseForm');
    const empTableBody = $('empTableBody');
    const desigTableBody = $('desigTableBody');
    const appUserTableBody = $('appUserTableBody');
    const prTableBody = $('prTableBody');
    const expenseTableBody = $('expenseTableBody');
    const reportTableBody = $('reportTableBody');
    const tripTableBody = $('tripTableBody');
    const advanceTableBody = $('advanceTableBody');
    const cardTableBody = $('cardTableBody');
    const empStatus = $('empStatus');
    const desigStatus = $('desigStatus');
    const appUserStatus = $('appUserStatus');
    const prStatus = $('prStatus');
    const expenseStatus = $('expenseStatus');
    const reportStatus = $('reportStatus');
    const tripStatus = $('tripStatus');
    const advanceStatus = $('advanceStatus');
    const cardStatus = $('cardStatus');
    const empCount = $('empCount');
    const desigCount = $('desigCount');
    const appUserCount = $('appUserCount');
    const prCount = $('prCount');
    const expenseCount = $('expenseCount');
    const reportCount = $('reportCount');
    const tripCount = $('tripCount');
    const advanceCount = $('advanceCount');
    const cardCount = $('cardCount');
    const desigEmpSelect = $('desigEmpSelect');
    const prUserSelect = $('prUserSelect');
    const expenseUserSelect = $('expenseUserSelect');
    const currentUserEl = $('currentUser');

    // Modal controls
    $('openEmpModalBtn').onclick = () => { empModal.style.display = 'flex'; };
    $('closeEmpModalBtn').onclick = () => { empModal.style.display = 'none'; };
    $('openDesigModalBtn').onclick = () => { desigModal.style.display = 'flex'; };
    $('closeDesigModalBtn').onclick = () => { desigModal.style.display = 'none'; };
    $('openAppUserModalBtn').onclick = () => { appUserModal.style.display = 'flex'; };
    $('closeAppUserModalBtn').onclick = () => { appUserModal.style.display = 'none'; };
    $('openPrModalBtn').onclick = () => { prModal.style.display = 'flex'; };
    $('closePrModalBtn').onclick = () => { prModal.style.display = 'none'; };
    $('openExpenseModalBtn').onclick = () => { expenseModal.style.display = 'flex'; };
    $('closeExpenseModalBtn').onclick = () => { expenseModal.style.display = 'none'; };
    window.onclick = (e) => {
        if (e.target === empModal || e.target === desigModal || e.target === appUserModal || e.target === prModal || e.target === expenseModal) {
            e.target.style.display = 'none';
        }
    };

    $('refreshBtn').onclick = loadData;
    $('signOutBtn').onclick = signOutToLogin;

    async function signOutToLogin() {
        sessionStorage.removeItem('appUserSession');
        try {
            if (window.catalyst?.auth?.isUserAuthenticated) {
                try {
                    const auth = await window.catalyst.auth.isUserAuthenticated();
                    if (auth) {
                        await window.catalyst.auth.signOut(LOGIN_URL);
                        return;
                    }
                } catch {
                    // Not signed in via Catalyst Hosted Auth
                }
            }
            window.location.replace(LOGIN_URL);
        } catch (err) {
            alert('Failed to sign out: ' + (err.message || 'Error'));
        }
    }

    const escapeHtml = (val) => String(val)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    async function callFunction(payload) {
        const url = getBackendUrl('/server/management_function/execute');
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const text = await res.text();
        try {
            const raw = JSON.parse(text);
            return typeof raw?.output === 'string' ? JSON.parse(raw.output) : raw?.output || raw;
        } catch {
            throw new Error(text || `HTTP ${res.status}`);
        }
    }

    function renderRows(tbody, countEl, statusEl, emptyText, rows, buildRow) {
        countEl.textContent = rows.length;
        statusEl.style.display = rows.length ? 'none' : 'block';
        statusEl.textContent = emptyText;
        tbody.innerHTML = '';

        rows.forEach((item, i) => {
            const { cells, onDelete } = buildRow(item, i);
            const tr = document.createElement('tr');
            tr.innerHTML = cells.join('') + '<td><button class="btn-danger" type="button">Delete</button></td>';
            tr.querySelector('button').onclick = onDelete;
            tbody.appendChild(tr);
        });
    }

    async function loadData() {
        empStatus.style.display = desigStatus.style.display = appUserStatus.style.display = prStatus.style.display = expenseStatus.style.display = reportStatus.style.display = tripStatus.style.display = advanceStatus.style.display = cardStatus.style.display = 'block';
        empStatus.textContent = 'Loading employees...';
        desigStatus.textContent = 'Loading designations...';
        appUserStatus.textContent = 'Loading app users...';
        prStatus.textContent = 'Loading purchase requests...';
        expenseStatus.textContent = 'Loading expenses...';
        reportStatus.textContent = 'Loading expense reports...';
        tripStatus.textContent = 'Loading trips...';
        advanceStatus.textContent = 'Loading advances...';
        cardStatus.textContent = 'Loading cards...';

        try {
            const data = await callFunction({ action: 'getAll' });
            if (data.status !== 'Success') throw new Error(data.message || 'Error');

            const employees = data.employees || [];
            const designations = data.designations || [];
            const appUsers = data.appUsers || [];
            const purchaseRequests = data.purchaseRequests || [];
            const expenses = data.expenses || [];

            desigEmpSelect.innerHTML = '<option value="">-- Select Employee --</option>';
            prUserSelect.innerHTML = '<option value="">-- Select Requester --</option>';
            expenseUserSelect.innerHTML = '<option value="">-- Select Employee --</option>';

            renderRows(empTableBody, empCount, empStatus, 'No employees found.', employees, (emp, i) => {
                const r = emp.Emp || emp;
                const rowId = r.ROWID || '-';
                const name = r.emp_name || '-';
                const email = r.emp_email || '-';
                if (name !== '-') {
                    desigEmpSelect.add(new Option(`${name} (${email})`, name));
                    prUserSelect.add(new Option(`${name} (${email})`, name));
                    expenseUserSelect.add(new Option(`${name} (${email})`, name));
                }
                return {
                    cells: [
                        `<td>${i + 1}</td>`,
                        `<td><code>${escapeHtml(rowId)}</code></td>`,
                        `<td><strong>${escapeHtml(name)}</strong></td>`,
                        `<td>${escapeHtml(email)}</td>`,
                        `<td>${escapeHtml(r.CREATEDTIME || '-')}</td>`
                    ],
                    onDelete: () => deleteRecord('delete_emp', rowId, name)
                };
            });

            renderRows(desigTableBody, desigCount, desigStatus, 'No designations found.', designations, (desig, i) => {
                const r = desig.Designation || desig;
                const rowId = r.ROWID || '-';
                const dName = r.D_name || r.d_name || '-';
                return {
                    cells: [
                        `<td>${i + 1}</td>`,
                        `<td><code>${escapeHtml(rowId)}</code></td>`,
                        `<td><strong>${escapeHtml(dName)}</strong></td>`,
                        `<td>${escapeHtml(r.Employeename || r.employeename || '-')}</td>`,
                        `<td>${escapeHtml(r.CREATEDTIME || '-')}</td>`
                    ],
                    onDelete: () => deleteRecord('delete_desig', rowId, dName)
                };
            });

            renderRows(appUserTableBody, appUserCount, appUserStatus, 'No app users found.', appUsers, (user, i) => {
                const r = user.App_user || user;
                const rowId = r.ROWID || '-';
                const empName = r.Emp_name || '-';
                const pwdMask = r.has_password ? '••••••' : '-';
                return {
                    cells: [
                        `<td>${i + 1}</td>`,
                        `<td><code>${escapeHtml(rowId)}</code></td>`,
                        `<td><strong>${escapeHtml(empName)}</strong></td>`,
                        `<td>${escapeHtml(r.emp_mail || '-')}</td>`,
                        `<td><code>${pwdMask}</code></td>`,
                        `<td>${escapeHtml(r.CREATEDTIME || '-')}</td>`
                    ],
                    onDelete: () => deleteRecord('delete_app_user', rowId, empName)
                };
            });

            // Render Purchase Requests with Approve & Delete
            prCount.textContent = purchaseRequests.length;
            prStatus.style.display = purchaseRequests.length ? 'none' : 'block';
            prStatus.textContent = 'No purchase requests found.';
            prTableBody.innerHTML = '';
            purchaseRequests.forEach((pr, i) => {
                const r = pr.Purchase_request || pr;
                const rowId = r.ROWID || '-';
                const itemName = r.Item_name || '-';
                const vendor = r.Preferred_vendor || '-';
                const reqBy = r.Requested_by || '-';
                const amt = r.Amount != null ? `₹${Number(r.Amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';
                const isApproved = r.approval_status === 'approved';
                const statusBadge = isApproved
                    ? `<span class="badge badge-approved">✓ Approved</span>`
                    : `<span class="badge badge-draft">Pending</span>`;
                const approveBtn = !isApproved
                    ? `<button class="btn-approve btn-approve-pr" type="button" data-id="${escapeHtml(rowId)}">Approve</button> `
                    : '';
                const tr = document.createElement('tr');
                tr.innerHTML = [
                    `<td>${i + 1}</td>`,
                    `<td><code>${escapeHtml(rowId)}</code></td>`,
                    `<td><strong>${escapeHtml(itemName)}</strong></td>`,
                    `<td>${escapeHtml(vendor)}</td>`,
                    `<td>${escapeHtml(reqBy)}</td>`,
                    `<td>${escapeHtml(amt)}</td>`,
                    `<td>${statusBadge}</td>`,
                    `<td>${escapeHtml(r.CREATEDTIME || '-')}</td>`,
                    `<td>${approveBtn}<button class="btn-danger btn-del" type="button">Delete</button></td>`
                ].join('');
                const appBtn = tr.querySelector('.btn-approve-pr');
                if (appBtn) {
                    appBtn.onclick = async () => {
                        appBtn.disabled = true;
                        appBtn.textContent = 'Approving...';
                        try {
                            const res = await callFunction({ action: 'approve_pr', row_id: rowId });
                            if (res.status !== 'Success') throw new Error(res.message || 'Error');
                            await loadData();
                        } catch (err) {
                            alert('Failed to approve purchase request: ' + (err.message || 'Error'));
                            appBtn.disabled = false;
                            appBtn.textContent = 'Approve';
                        }
                    };
                }
                tr.querySelector('.btn-del').onclick = () => deleteRecord('delete_pr', rowId, itemName);
                prTableBody.appendChild(tr);
            });

            // Render Expenses with Approve & Delete
            expenseCount.textContent = expenses.length;
            expenseStatus.style.display = expenses.length ? 'none' : 'block';
            expenseStatus.textContent = 'No expenses found.';
            expenseTableBody.innerHTML = '';
            expenses.forEach((exp, i) => {
                const r = exp.Expense || exp;
                const rowId = r.ROWID || '-';
                const name = r.Expense_name || '-';
                const cat = r.Category || '-';
                const paidBy = r.Paid_by || '-';
                const date = r.Expense_date || '-';
                const amt = r.Amount != null ? `₹${Number(r.Amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';
                const isApproved = r.approval_status === 'approved';
                const statusBadge = isApproved
                    ? `<span class="badge badge-approved">✓ Approved</span>`
                    : `<span class="badge badge-draft">Pending</span>`;
                const approveBtn = !isApproved
                    ? `<button class="btn-approve btn-approve-exp" type="button" data-id="${escapeHtml(rowId)}">Approve</button> `
                    : '';
                const tr = document.createElement('tr');
                tr.innerHTML = [
                    `<td>${i + 1}</td>`,
                    `<td><code>${escapeHtml(rowId)}</code></td>`,
                    `<td><strong>${escapeHtml(name)}</strong></td>`,
                    `<td>${escapeHtml(cat)}</td>`,
                    `<td>${escapeHtml(amt)}</td>`,
                    `<td>${escapeHtml(date)}</td>`,
                    `<td>${escapeHtml(paidBy)}</td>`,
                    `<td>${statusBadge}</td>`,
                    `<td>${escapeHtml(r.CREATEDTIME || '-')}</td>`,
                    `<td>${approveBtn}<button class="btn-danger btn-del" type="button">Delete</button></td>`
                ].join('');
                const appBtn = tr.querySelector('.btn-approve-exp');
                if (appBtn) {
                    appBtn.onclick = async () => {
                        appBtn.disabled = true;
                        appBtn.textContent = 'Approving...';
                        try {
                            const res = await callFunction({ action: 'approve_expense', row_id: rowId });
                            if (res.status !== 'Success') throw new Error(res.message || 'Error');
                            await loadData();
                        } catch (err) {
                            alert('Failed to approve expense: ' + (err.message || 'Error'));
                            appBtn.disabled = false;
                            appBtn.textContent = 'Approve';
                        }
                    };
                }
                tr.querySelector('.btn-del').onclick = () => deleteRecord('delete_expense', rowId, name);
                expenseTableBody.appendChild(tr);
            });

            // Render Reports with Approve Action
            const reports = data.reports || [];
            reportCount.textContent = reports.length;
            reportStatus.style.display = reports.length ? 'none' : 'block';
            reportTableBody.innerHTML = '';
            reports.forEach((rep, i) => {
                const tr = document.createElement('tr');
                const amt = rep.total != null ? `₹${Number(rep.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';
                const isApproved = rep.status === 'approved';
                const badgeCls = `badge badge-${escapeHtml(rep.status || 'draft')}`;
                const actionCell = isApproved
                    ? `<span class="badge badge-approved">✓ Approved</span>`
                    : `<button class="btn-approve" type="button" data-report="${escapeHtml(rep.report_number)}">Approve</button>`;

                tr.innerHTML = [
                    `<td>${i + 1}</td>`,
                    `<td><code>${escapeHtml(rep.report_number || '-')}</code></td>`,
                    `<td><strong>${escapeHtml(rep.report_name || '-')}</strong></td>`,
                    `<td>${escapeHtml(rep.submitter_name || '-')}</td>`,
                    `<td>${escapeHtml(rep.date_range || '-')}</td>`,
                    `<td>${escapeHtml(amt)}</td>`,
                    `<td><span class="${badgeCls}">${escapeHtml(rep.status || 'draft')}</span></td>`,
                    `<td>${actionCell}</td>`
                ].join('');

                const btn = tr.querySelector('.btn-approve');
                if (btn) {
                    btn.onclick = async () => {
                        btn.disabled = true;
                        btn.textContent = 'Approving...';
                        try {
                            const res = await callFunction({ action: 'approve_report', report_number: rep.report_number });
                            if (res.status !== 'Success') throw new Error(res.message || 'Error');
                            await loadData();
                        } catch (err) {
                            alert('Failed to approve report: ' + (err.message || 'Error'));
                            btn.disabled = false;
                            btn.textContent = 'Approve';
                        }
                    };
                }
                reportTableBody.appendChild(tr);
            });

            // Render Trips with Approve Action
            const trips = data.trips || [];
            tripCount.textContent = trips.length;
            tripStatus.style.display = trips.length ? 'none' : 'block';
            tripTableBody.innerHTML = '';
            trips.forEach((trItem, i) => {
                const tr = document.createElement('tr');
                const bgt = trItem.budget_amount != null ? `₹${Number(trItem.budget_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';
                const isApproved = trItem.status === 'approved';
                const badgeCls = `badge badge-${escapeHtml(trItem.status || 'draft')}`;
                const actionCell = isApproved
                    ? `<span class="badge badge-approved">✓ Approved</span>`
                    : `<button class="btn-approve" type="button" data-trip="${escapeHtml(trItem.trip_number)}">Approve</button>`;

                tr.innerHTML = [
                    `<td>${i + 1}</td>`,
                    `<td><code>${escapeHtml(trItem.trip_number || '-')}</code></td>`,
                    `<td><strong>${escapeHtml(trItem.trip_name || '-')}</strong></td>`,
                    `<td>${escapeHtml(trItem.traveler_name || '-')}</td>`,
                    `<td>${escapeHtml(trItem.purpose || '-')}</td>`,
                    `<td>${escapeHtml(bgt)}</td>`,
                    `<td><span class="${badgeCls}">${escapeHtml(trItem.status || 'draft')}</span></td>`,
                    `<td>${actionCell}</td>`
                ].join('');

                const btn = tr.querySelector('.btn-approve');
                if (btn) {
                    btn.onclick = async () => {
                        btn.disabled = true;
                        btn.textContent = 'Approving...';
                        try {
                            const res = await callFunction({ action: 'approve_trip', trip_number: trItem.trip_number });
                            if (res.status !== 'Success') throw new Error(res.message || 'Error');
                            await loadData();
                        } catch (err) {
                            alert('Failed to approve trip: ' + (err.message || 'Error'));
                            btn.disabled = false;
                            btn.textContent = 'Approve';
                        }
                    };
                }
                tripTableBody.appendChild(tr);
            });

            // Render Advances
            const advances = data.advances || [];
            advanceCount.textContent = advances.length;
            advanceStatus.style.display = advances.length ? 'none' : 'block';
            advanceTableBody.innerHTML = '';
            advances.forEach((adv, i) => {
                const tr = document.createElement('tr');
                const amt = adv.amount != null ? `₹${Number(adv.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';
                const badgeCls = `badge badge-${escapeHtml(adv.status || 'approved')}`;
                tr.innerHTML = [
                    `<td>${i + 1}</td>`,
                    `<td><code>${escapeHtml(adv.advance_id || '-')}</code></td>`,
                    `<td><strong>${escapeHtml(adv.user_name || '-')}</strong></td>`,
                    `<td>${escapeHtml(amt)}</td>`,
                    `<td>${escapeHtml(adv.account_name || 'Petty Cash')}</td>`,
                    `<td>${escapeHtml(adv.notes || '-')}</td>`,
                    `<td><span class="${badgeCls}">${escapeHtml(adv.status || 'approved')}</span></td>`
                ].join('');
                advanceTableBody.appendChild(tr);
            });

            // Render Corporate & Personal Cards
            const cards = data.cards || [];
            cardCount.textContent = cards.length;
            cardStatus.style.display = cards.length ? 'none' : 'block';
            cardTableBody.innerHTML = '';
            cards.forEach((c, i) => {
                const tr = document.createElement('tr');
                const limit = c.limit != null ? `₹${Number(c.limit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';
                const avail = c.available_limit != null ? `₹${Number(c.available_limit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';
                const typeBadge = c.card_type === 'Corporate' ? 'badge badge-corporate' : 'badge badge-personal';
                tr.innerHTML = [
                    `<td>${i + 1}</td>`,
                    `<td><code>${escapeHtml(c.card_id || '-')}</code></td>`,
                    `<td><strong>${escapeHtml(c.card_name || '-')}</strong></td>`,
                    `<td><code>${escapeHtml(c.card_number || '-')}</code></td>`,
                    `<td><span class="${typeBadge}">${escapeHtml(c.card_type || 'Corporate')}</span></td>`,
                    `<td>${escapeHtml(c.card_holder || '-')}</td>`,
                    `<td>${escapeHtml(limit)}</td>`,
                    `<td>${escapeHtml(avail)}</td>`,
                    `<td><span class="badge badge-active">${escapeHtml(c.status || 'active')}</span></td>`
                ].join('');
                cardTableBody.appendChild(tr);
            });
        } catch (err) {
            empStatus.textContent = desigStatus.textContent = appUserStatus.textContent = prStatus.textContent = expenseStatus.textContent = reportStatus.textContent = tripStatus.textContent = advanceStatus.textContent = cardStatus.textContent =
                'Error: ' + (err.message || 'Unable to load records');
        }
    }

    function bindSubmit(form, modal, getPayload, label) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const payload = getPayload();
            if (!payload) return;

            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            try {
                const res = await callFunction(payload);
                if (res.status !== 'Success') throw new Error(res.message || 'Error');
                modal.style.display = 'none';
                form.reset();
                loadData();
            } catch (err) {
                alert(`Failed to ${label}: ${err.message || 'Unable to reach server'}`);
            } finally {
                btn.disabled = false;
            }
        };
    }

    bindSubmit(empForm, empModal, () => {
        const emp_name = $('empName').value.trim();
        const emp_email = $('empEmail').value.trim();
        if (!emp_name || !emp_email) {
            alert('Please enter both employee name and email.');
            return null;
        }
        return { emp_name, emp_email };
    }, 'add employee');

    bindSubmit(desigForm, desigModal, () => {
        const D_name = $('desigName').value.trim();
        const Employeename = desigEmpSelect.value.trim();
        if (!D_name || !Employeename) {
            alert('Please enter a designation name and select an employee.');
            return null;
        }
        return { action: 'add_desig', D_name, Employeename };
    }, 'add designation');

    bindSubmit(appUserForm, appUserModal, () => {
        const Emp_name = $('appUserName').value.trim();
        const emp_mail = $('appUserEmail').value.trim();
        const emp_password = $('appUserPassword').value;
        if (!Emp_name || !emp_mail || !emp_password) {
            alert('Please enter Emp_name, emp_mail, and emp_password.');
            return null;
        }
        return { action: 'add_app_user', Emp_name, emp_mail, emp_password };
    }, 'add app user');

    bindSubmit(prForm, prModal, () => {
        const Item_name = $('prItemName').value.trim();
        const Preferred_vendor = $('prVendor').value.trim();
        const Requested_by = prUserSelect.value.trim();
        const Amount = $('prAmount').value.trim();
        if (!Item_name || !Preferred_vendor) {
            alert('Please enter Item Name and Preferred Vendor.');
            return null;
        }
        return { action: 'add_pr', Item_name, Preferred_vendor, Requested_by, Amount };
    }, 'add purchase request');

    bindSubmit(expenseForm, expenseModal, () => {
        const Expense_name = $('expenseNameInput').value.trim();
        const Category = $('expenseCategorySelect').value.trim();
        const Amount = $('expenseAmountInput').value.trim();
        const Expense_date = $('expenseDateInput').value;
        const Paid_by = expenseUserSelect.value.trim();
        if (!Expense_name || !Category || !Amount) {
            alert('Please enter Expense Description, Category, and Amount.');
            return null;
        }
        return {
            action: 'add_expense',
            Expense_name,
            Category,
            Amount,
            Expense_date: Expense_date || new Date().toISOString().slice(0, 10),
            Paid_by: Paid_by || 'General'
        };
    }, 'add expense');

    async function deleteRecord(action, rowId, label) {
        if (!confirm(`Delete "${label}" (ID: ${rowId})?`)) return;
        try {
            const res = await callFunction({ action, row_id: rowId });
            if (res.status !== 'Success') throw new Error(res.message || 'Error');
            loadData();
        } catch (err) {
            alert('Failed to delete: ' + (err.message || 'Unable to reach server'));
        }
    }

    (async () => {
        try {
            let catalystEmail = '';
            let catalystName = '';
            if (window.catalyst?.auth?.isUserAuthenticated) {
                try {
                    const auth = await window.catalyst.auth.isUserAuthenticated();
                    const user = auth?.content || auth?.data || (auth && typeof auth === 'object' ? auth : null);
                    catalystEmail = String(user?.email_id || '').trim().toLowerCase();
                    catalystName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
                } catch {
                    catalystEmail = '';
                }
            }

            let check = null;
            let activeEmail = catalystEmail;
            if (catalystEmail) {
                check = await callFunction({
                    action: 'validate_app_user',
                    mode: 'catalyst_auth',
                    emp_mail: catalystEmail
                });
            } else {
                const stored = JSON.parse(sessionStorage.getItem('appUserSession') || 'null');
                if (stored?.emp_mail && stored?.session_token) {
                    activeEmail = stored.emp_mail;
                    check = await callFunction({
                        action: 'validate_app_user',
                        mode: 'session',
                        emp_mail: stored.emp_mail,
                        session_token: stored.session_token
                    });
                }
            }

            if (!check || check.status !== 'Success' || !check.allowed) {
                if (activeEmail) {
                    alert(`Access denied: "${activeEmail}" is not an authorized Zoho Expense organization member.`);
                }
                await signOutToLogin();
                return;
            }

            if (currentUserEl) {
                const displayName = check.user?.Emp_name || catalystName;
                const emailStr = (check.email || activeEmail).toLowerCase();
                currentUserEl.textContent = displayName
                    ? `Logged in: ${displayName} (${emailStr})`
                    : `Logged in: ${emailStr}`;
            }
            loadData();
        } catch {
            window.location.replace(LOGIN_URL);
        }
    })();
});
