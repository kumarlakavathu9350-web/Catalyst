document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const LOGIN_URL = '/app/login.html';

    const empModal = $('empModal');
    const desigModal = $('desigModal');
    const appUserModal = $('appUserModal');
    const empForm = $('empForm');
    const desigForm = $('desigForm');
    const appUserForm = $('appUserForm');
    const empTableBody = $('empTableBody');
    const desigTableBody = $('desigTableBody');
    const appUserTableBody = $('appUserTableBody');
    const empStatus = $('empStatus');
    const desigStatus = $('desigStatus');
    const appUserStatus = $('appUserStatus');
    const empCount = $('empCount');
    const desigCount = $('desigCount');
    const appUserCount = $('appUserCount');
    const desigEmpSelect = $('desigEmpSelect');
    const currentUserEl = $('currentUser');

    // Modal controls
    $('openEmpModalBtn').onclick = () => { empModal.style.display = 'flex'; };
    $('closeEmpModalBtn').onclick = () => { empModal.style.display = 'none'; };
    $('openDesigModalBtn').onclick = () => { desigModal.style.display = 'flex'; };
    $('closeDesigModalBtn').onclick = () => { desigModal.style.display = 'none'; };
    $('openAppUserModalBtn').onclick = () => { appUserModal.style.display = 'flex'; };
    $('closeAppUserModalBtn').onclick = () => { appUserModal.style.display = 'none'; };
    window.onclick = (e) => {
        if (e.target === empModal || e.target === desigModal || e.target === appUserModal) {
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
        const res = await fetch('/server/management_function/execute', {
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
        empStatus.style.display = desigStatus.style.display = appUserStatus.style.display = 'block';
        empStatus.textContent = 'Loading employees...';
        desigStatus.textContent = 'Loading designations...';
        appUserStatus.textContent = 'Loading app users...';

        try {
            const data = await callFunction({ action: 'getAll' });
            if (data.status !== 'Success') throw new Error(data.message || 'Error');

            const employees = data.employees || [];
            const designations = data.designations || [];
            const appUsers = data.appUsers || [];

            desigEmpSelect.innerHTML = '<option value="">-- Select Employee --</option>';

            renderRows(empTableBody, empCount, empStatus, 'No employees found.', employees, (emp, i) => {
                const r = emp.Emp || emp;
                const rowId = r.ROWID || '-';
                const name = r.emp_name || '-';
                const email = r.emp_email || '-';
                if (name !== '-') {
                    desigEmpSelect.add(new Option(`${name} (${email})`, name));
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
        } catch (err) {
            empStatus.textContent = desigStatus.textContent = appUserStatus.textContent =
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
                    alert(`Access denied: Login ID "${activeEmail}" could not be verified in App_user.`);
                }
                await signOutToLogin();
                return;
            }

            if (currentUserEl) {
                const displayName = check.user?.Emp_name || catalystName;
                currentUserEl.textContent = displayName
                    ? `Login ID: ${displayName} (${check.email || activeEmail})`
                    : `Login ID: ${check.email || activeEmail}`;
            }
            loadData();
        } catch {
            window.location.replace(LOGIN_URL);
        }
    })();
});
