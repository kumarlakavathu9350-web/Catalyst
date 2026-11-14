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

    // Modal elements
    const expenseModal = $('expenseModal');
    const expenseForm = $('expenseForm');
    const openExpenseModalBtn = $('openExpenseModalBtn');
    const closeExpenseModalBtn = $('closeExpenseModalBtn');
    const cancelExpenseModalBtn = $('cancelExpenseModalBtn');

    // Toolbar & filter elements
    const searchInput = $('expenseSearchInput');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const streamContainer = $('expenseStreamContainer');
    const streamCountBadge = $('streamCountBadge');

    // KPI & Analytics elements
    const kpiTotalSpend = $('kpiTotalSpend');
    const kpiTotalCount = $('kpiTotalCount');
    const kpiApprovedSpend = $('kpiApprovedSpend');
    const kpiApprovedCount = $('kpiApprovedCount');
    const kpiPendingSpend = $('kpiPendingSpend');
    const kpiPendingCount = $('kpiPendingCount');
    const kpiMembersCount = $('kpiMembersCount');
    const categoryListContainer = $('categoryListContainer');
    const categoryCountBadge = $('categoryCountBadge');
    const healthApprovedCount = $('healthApprovedCount');
    const healthApprovedAmt = $('healthApprovedAmt');
    const healthPendingCount = $('healthPendingCount');
    const healthPendingAmt = $('healthPendingAmt');
    const healthReimbursedCount = $('healthReimbursedCount');
    const healthReimbursedAmt = $('healthReimbursedAmt');
    const currentUserEl = $('currentUser');
    const userInitialEl = $('userInitial');

    let allExpenses = [];
    let currentFilter = 'all';
    let searchQuery = '';

    // Modal controls
    if (openExpenseModalBtn) openExpenseModalBtn.onclick = () => { expenseModal.style.display = 'flex'; };
    if (closeExpenseModalBtn) closeExpenseModalBtn.onclick = () => { expenseModal.style.display = 'none'; };
    if (cancelExpenseModalBtn) cancelExpenseModalBtn.onclick = () => { expenseModal.style.display = 'none'; };
    window.onclick = (e) => {
        if (e.target === expenseModal) {
            expenseModal.style.display = 'none';
        }
    };

    $('refreshBtn').onclick = loadData;
    $('signOutBtn').onclick = signOutToLogin;

    // Search and Filter controls
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            renderStream();
        });
    }

    filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            filterBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter') || 'all';
            renderStream();
        });
    });

    const syncZohoBtn = $('syncZohoBtn');
    if (syncZohoBtn) {
        syncZohoBtn.onclick = async () => {
            syncZohoBtn.disabled = true;
            syncZohoBtn.textContent = '🔄 Syncing with Zoho Expense...';
            try {
                const res = await callFunction({ action: 'sync_all_from_expense' });
                if (res.status !== 'Success') throw new Error(res.message || 'Sync failed');
                await loadData();
            } catch (err) {
                alert('Failed to sync: ' + (err.message || 'Error'));
            } finally {
                syncZohoBtn.disabled = false;
                syncZohoBtn.textContent = '🔄 Sync Zoho Expense';
            }
        };
    }

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
                } catch {}
            }
            window.location.replace(LOGIN_URL);
        } catch (err) {
            alert('Failed to sign out: ' + (err.message || 'Error'));
        }
    }

    function formatINR(num) {
        const val = Number(num) || 0;
        return '₹' + val.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    const escapeHtml = (val) => String(val || '')
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

    function getCategoryIcon(cat) {
        const c = String(cat || '').toLowerCase();
        if (c.includes('internet') || c.includes('it') || c.includes('software')) return { icon: '💻', bg: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' };
        if (c.includes('travel') || c.includes('flight') || c.includes('trip')) return { icon: '✈️', bg: 'rgba(2, 132, 199, 0.2)', color: '#38bdf8' };
        if (c.includes('food') || c.includes('meal') || c.includes('entertainment')) return { icon: '🍔', bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' };
        if (c.includes('hotel') || c.includes('lodging')) return { icon: '🏨', bg: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' };
        if (c.includes('fuel') || c.includes('auto') || c.includes('cab')) return { icon: '🚗', bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171' };
        if (c.includes('report')) return { icon: '📄', bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399' };
        return { icon: '🏢', bg: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' };
    }

    async function loadData() {
        streamContainer.innerHTML = `
            <div class="empty-stream">
                <div class="empty-stream-icon">⏳</div>
                <p>Loading live expenses from Catalyst Datastore...</p>
            </div>
        `;

        try {
            const data = await callFunction({ action: 'getAll' });
            if (data.status !== 'Success') throw new Error(data.message || 'Error');

            allExpenses = data.expenses || [];
            const appUsers = data.appUsers || [];

            // 1. Calculate Executive KPIs
            let totalSpend = 0;
            let approvedSpend = 0;
            let approvedCount = 0;
            let pendingSpend = 0;
            let pendingCount = 0;
            let reimbursedSpend = 0;
            let reimbursedCount = 0;

            const categoryMap = {};

            allExpenses.forEach((item) => {
                const r = item.Expense || item;
                const amt = Number(parseFloat(r.Amount)) || 0;
                const status = String(r.Status || 'unreported').toLowerCase();
                const cat = String(r.Category || 'Office Supplies').trim();

                totalSpend += amt;

                if (status === 'approved') {
                    approvedSpend += amt;
                    approvedCount++;
                } else if (status === 'reimbursed') {
                    reimbursedSpend += amt;
                    reimbursedCount++;
                } else {
                    pendingSpend += amt;
                    pendingCount++;
                }

                categoryMap[cat] = (categoryMap[cat] || 0) + amt;
            });

            // Update KPI cards
            kpiTotalSpend.textContent = formatINR(totalSpend);
            kpiTotalCount.textContent = `${allExpenses.length} Transactions`;

            kpiApprovedSpend.textContent = formatINR(approvedSpend);
            kpiApprovedCount.textContent = `${approvedCount} Approved Items`;

            kpiPendingSpend.textContent = formatINR(pendingSpend + reimbursedSpend);
            kpiPendingCount.textContent = `${pendingCount} In Review · ${reimbursedCount} Reimbursed`;

            kpiMembersCount.textContent = `${appUsers.length || 2} Active Members`;

            // 2. Render Spend by Category
            renderCategoryBreakdown(categoryMap, totalSpend);

            // 3. Render Workflow & Health Breakdown
            healthApprovedCount.textContent = `${approvedCount} item(s) approved`;
            healthApprovedAmt.textContent = formatINR(approvedSpend);

            healthPendingCount.textContent = `${pendingCount} item(s) in review`;
            healthPendingAmt.textContent = formatINR(pendingSpend);

            healthReimbursedCount.textContent = `${reimbursedCount} item(s) settled`;
            healthReimbursedAmt.textContent = formatINR(reimbursedSpend);

            // 4. Render Expense Activity Stream
            renderStream();

        } catch (err) {
            streamContainer.innerHTML = `
                <div class="empty-stream" style="color: #f87171;">
                    <div class="empty-stream-icon">⚠️</div>
                    <p>Failed to load expenses: ${escapeHtml(err.message || 'Error connecting to server')}</p>
                </div>
            `;
        }
    }

    function renderCategoryBreakdown(catMap, totalSpend) {
        const categories = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
        categoryCountBadge.textContent = `${categories.length} Categories`;

        if (!categories.length) {
            categoryListContainer.innerHTML = '<div class="empty-stream" style="padding: 16px;">No categories recorded yet.</div>';
            return;
        }

        const colors = [
            'linear-gradient(90deg, #6366f1, #818cf8)',
            'linear-gradient(90deg, #10b981, #34d399)',
            'linear-gradient(90deg, #0284c7, #38bdf8)',
            'linear-gradient(90deg, #f59e0b, #fbbf24)',
            'linear-gradient(90deg, #ec4899, #f472b6)',
            'linear-gradient(90deg, #8b5cf6, #a78bfa)'
        ];

        categoryListContainer.innerHTML = categories.map(([name, amt], idx) => {
            const pct = totalSpend > 0 ? ((amt / totalSpend) * 100).toFixed(1) : '0.0';
            const iconObj = getCategoryIcon(name);
            const grad = colors[idx % colors.length];

            return `
                <div class="category-item">
                    <div class="category-meta">
                        <div class="category-name-group">
                            <span>${iconObj.icon}</span>
                            <span>${escapeHtml(name)}</span>
                            <span class="badge" style="background: rgba(255,255,255,0.06); font-size:11px;">${pct}%</span>
                        </div>
                        <div class="category-amount-group">
                            <span class="category-amount">${formatINR(amt)}</span>
                        </div>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill" style="width: ${Math.min(100, Math.max(3, pct))}%; background: ${grad};"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderStream() {
        let filtered = allExpenses.filter((item) => {
            const r = item.Expense || item;
            const status = String(r.Status || 'unreported').toLowerCase();

            // Status filter
            if (currentFilter === 'approved' && status !== 'approved') return false;
            if (currentFilter === 'pending' && status === 'approved') return false;
            if (currentFilter === 'reimbursed' && status !== 'reimbursed') return false;

            // Search filter
            if (searchQuery) {
                const name = String(r.Expense_name || '').toLowerCase();
                const cat = String(r.Category || '').toLowerCase();
                const paidBy = String(r.Paid_by || '').toLowerCase();
                if (!name.includes(searchQuery) && !cat.includes(searchQuery) && !paidBy.includes(searchQuery)) {
                    return false;
                }
            }

            return true;
        });

        streamCountBadge.textContent = `${filtered.length} of ${allExpenses.length}`;

        if (!filtered.length) {
            streamContainer.innerHTML = `
                <div class="empty-stream">
                    <div class="empty-stream-icon">🔍</div>
                    <p>No matching expenses found.</p>
                </div>
            `;
            return;
        }

        streamContainer.innerHTML = '';

        filtered.forEach((item) => {
            const r = item.Expense || item;
            const rowId = r.ROWID || '';
            const name = r.Expense_name || 'General Expense';
            const cat = r.Category || 'Office Supplies';
            const paidBy = r.Paid_by || 'KR Tech Solutions';
            const date = r.Expense_date || 'Today';
            const amt = Number(parseFloat(r.Amount)) || 0;
            const rawStatus = String(r.Status || 'unreported').toLowerCase();

            const iconInfo = getCategoryIcon(cat);

            let statusClass = 'badge-pending';
            let statusLabel = '⏳ In Review';
            if (rawStatus === 'approved') {
                statusClass = 'badge-approved';
                statusLabel = '✓ Approved';
            } else if (rawStatus === 'reimbursed') {
                statusClass = 'badge-reimbursed';
                statusLabel = '💎 Reimbursed';
            }

            const card = document.createElement('div');
            card.className = 'stream-card';

            const approveBtnHtml = rawStatus !== 'approved'
                ? `<button class="btn-card-approve btn-approve-action" type="button" data-id="${escapeHtml(rowId)}">Approve</button>`
                : '';

            card.innerHTML = `
                <div class="card-left">
                    <div class="category-icon-box" style="background: ${iconInfo.bg}; color: ${iconInfo.color};">
                        ${iconInfo.icon}
                    </div>
                    <div class="card-details">
                        <div class="card-title" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
                        <div class="card-meta-row">
                            <span class="meta-pill">📅 ${escapeHtml(date)}</span>
                            <span class="meta-pill">👤 ${escapeHtml(paidBy)}</span>
                            <span class="meta-pill">🏷️ ${escapeHtml(cat)}</span>
                        </div>
                    </div>
                </div>

                <div class="card-right">
                    <div class="card-amount-block">
                        <div class="card-amount">${formatINR(amt)}</div>
                        <span class="card-status-badge ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="card-actions">
                        ${approveBtnHtml}
                        <button class="btn-card-delete btn-delete-action" type="button" title="Delete record" data-id="${escapeHtml(rowId)}" data-name="${escapeHtml(name)}">🗑️</button>
                    </div>
                </div>
            `;

            const approveBtn = card.querySelector('.btn-approve-action');
            if (approveBtn) {
                approveBtn.onclick = async () => {
                    approveBtn.disabled = true;
                    approveBtn.textContent = 'Approving...';
                    try {
                        const res = await callFunction({ action: 'approve_expense', row_id: rowId });
                        if (res.status !== 'Success') throw new Error(res.message || 'Error');
                        await loadData();
                    } catch (err) {
                        alert('Failed to approve: ' + (err.message || 'Error'));
                        approveBtn.disabled = false;
                        approveBtn.textContent = 'Approve';
                    }
                };
            }

            const delBtn = card.querySelector('.btn-delete-action');
            if (delBtn) {
                delBtn.onclick = async () => {
                    if (!confirm(`Delete "${name}"?`)) return;
                    delBtn.disabled = true;
                    try {
                        const res = await callFunction({ action: 'delete_expense', row_id: rowId });
                        if (res.status !== 'Success') throw new Error(res.message || 'Error');
                        await loadData();
                    } catch (err) {
                        alert('Failed to delete: ' + (err.message || 'Error'));
                        delBtn.disabled = false;
                    }
                };
            }

            streamContainer.appendChild(card);
        });
    }

    // Modal Form Submission
    if (expenseForm) {
        expenseForm.onsubmit = async (e) => {
            e.preventDefault();
            const Expense_name = $('expenseNameInput').value.trim();
            const Category = $('expenseCategorySelect').value.trim();
            const Amount = $('expenseAmountInput').value.trim();
            const Expense_date = $('expenseDateInput').value;
            const Paid_by = $('expenseUserSelect').value.trim();

            if (!Expense_name || !Category || !Amount) {
                alert('Please enter description, category, and amount.');
                return;
            }

            const submitBtn = expenseForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            try {
                const res = await callFunction({
                    action: 'add_expense',
                    Expense_name,
                    Category,
                    Amount,
                    Expense_date: Expense_date || new Date().toISOString().slice(0, 10),
                    Paid_by: Paid_by || 'KR Tech Solutions'
                });
                if (res.status !== 'Success') throw new Error(res.message || 'Failed to save');

                expenseModal.style.display = 'none';
                expenseForm.reset();
                await loadData();
            } catch (err) {
                alert('Error adding expense: ' + (err.message || 'Error'));
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Expense';
            }
        };
    }

    // Authentication session check
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
                    alert(`Access denied: "${activeEmail}" is not an authorized Zoho Expense member.`);
                }
                await signOutToLogin();
                return;
            }

            const displayName = check.user?.Emp_name || catalystName || activeEmail.split('@')[0];
            const emailStr = (check.email || activeEmail).toLowerCase();

            if (currentUserEl) {
                currentUserEl.textContent = `${displayName} (${emailStr})`;
            }
            if (userInitialEl) {
                userInitialEl.textContent = (displayName[0] || 'U').toUpperCase();
            }

            loadData();
        } catch {
            window.location.replace(LOGIN_URL);
        }
    })();
});
