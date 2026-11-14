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
    const quickAddExpenseNavBtn = $('quickAddExpenseNavBtn');
    const closeExpenseModalBtn = $('closeExpenseModalBtn');
    const cancelExpenseModalBtn = $('cancelExpenseModalBtn');

    // Sidebar navigation tabs
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const viewPanels = document.querySelectorAll('.view-panel');

    // Toolbar & filter elements
    const searchInput = $('expenseSearchInput');
    const filterBtns = document.querySelectorAll('.filter-tab-btn');
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
    const reportsListContainer = $('reportsListContainer');
    const reportsCountBadge = $('reportsCountBadge');
    const fullAnalyticsBreakdown = $('fullAnalyticsBreakdown');

    let allExpenses = [];
    let currentFilter = 'all';
    let searchQuery = '';

    // =========================================================================
    // Sidebar Tab Switching
    // =========================================================================
    navLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
            // If user clicked the '+' inside the Expenses tab, don't re-switch tab
            if (e.target.closest('#quickAddExpenseNavBtn')) {
                return;
            }

            const targetTab = link.getAttribute('data-tab');
            if (!targetTab) return;

            navLinks.forEach((l) => l.classList.remove('active'));
            link.classList.add('active');

            viewPanels.forEach((panel) => {
                panel.classList.remove('active');
                if (panel.id === `view-${targetTab}`) {
                    panel.classList.add('active');
                }
            });
        });
    });

    // Quick Add Expense button inside the Expenses tab pill
    if (quickAddExpenseNavBtn) {
        quickAddExpenseNavBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openExpenseModal();
        });
    }

    // Modal controls
    function openExpenseModal() {
        if (expenseModal) expenseModal.style.display = 'flex';
    }
    function closeExpenseModal() {
        if (expenseModal) expenseModal.style.display = 'none';
    }

    if (openExpenseModalBtn) openExpenseModalBtn.onclick = openExpenseModal;
    if (closeExpenseModalBtn) closeExpenseModalBtn.onclick = closeExpenseModal;
    if (cancelExpenseModalBtn) cancelExpenseModalBtn.onclick = closeExpenseModal;
    window.onclick = (e) => {
        if (e.target === expenseModal) {
            closeExpenseModal();
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
            syncZohoBtn.textContent = '🔄 Syncing...';
            try {
                const res = await callFunction({ action: 'sync_all_from_expense' });
                if (res.status !== 'Success') throw new Error(res.message || 'Sync failed');
                await loadData();
            } catch (err) {
                alert('Failed to sync: ' + (err.message || 'Error'));
            } finally {
                syncZohoBtn.disabled = false;
                syncZohoBtn.textContent = '🔄 Sync Zoho';
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
        if (c.includes('internet') || c.includes('it') || c.includes('software')) return { icon: '💻', bg: '#eff6ff', color: '#2563eb' };
        if (c.includes('travel') || c.includes('flight') || c.includes('trip')) return { icon: '✈️', bg: '#f0fdf4', color: '#16a34a' };
        if (c.includes('food') || c.includes('meal') || c.includes('entertainment')) return { icon: '🍔', bg: '#fffbeb', color: '#d97706' };
        if (c.includes('hotel') || c.includes('lodging')) return { icon: '🏨', bg: '#faf5ff', color: '#9333ea' };
        if (c.includes('fuel') || c.includes('auto') || c.includes('cab')) return { icon: '🚗', bg: '#fef2f2', color: '#dc2626' };
        if (c.includes('report')) return { icon: '📄', bg: '#ecfdf5', color: '#059669' };
        return { icon: '🏢', bg: '#f1f5f9', color: '#475569' };
    }

    async function loadData() {
        if (streamContainer) {
            streamContainer.innerHTML = `
                <div class="empty-placeholder">
                    <div class="empty-icon">⏳</div>
                    <p>Loading live expenses from Catalyst Datastore...</p>
                </div>
            `;
        }

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
            if (kpiTotalSpend) kpiTotalSpend.textContent = formatINR(totalSpend);
            if (kpiTotalCount) kpiTotalCount.textContent = `${allExpenses.length} Transactions`;

            if (kpiApprovedSpend) kpiApprovedSpend.textContent = formatINR(approvedSpend);
            if (kpiApprovedCount) kpiApprovedCount.textContent = `${approvedCount} Approved Items`;

            if (kpiPendingSpend) kpiPendingSpend.textContent = formatINR(pendingSpend + reimbursedSpend);
            if (kpiPendingCount) kpiPendingCount.textContent = `${pendingCount} In Review · ${reimbursedCount} Reimbursed`;

            if (kpiMembersCount) kpiMembersCount.textContent = `${appUsers.length || 2} Active Members`;

            // 2. Render Spend by Category
            renderCategoryBreakdown(categoryMap, totalSpend);

            // 3. Render Workflow & Health Breakdown
            if (healthApprovedCount) healthApprovedCount.textContent = `${approvedCount} item(s) approved`;
            if (healthApprovedAmt) healthApprovedAmt.textContent = formatINR(approvedSpend);

            if (healthPendingCount) healthPendingCount.textContent = `${pendingCount} item(s) in review`;
            if (healthPendingAmt) healthPendingAmt.textContent = formatINR(pendingSpend);

            if (healthReimbursedCount) healthReimbursedCount.textContent = `${reimbursedCount} item(s) settled`;
            if (healthReimbursedAmt) healthReimbursedAmt.textContent = formatINR(reimbursedSpend);

            // 4. Render Expense Activity Stream
            renderStream();

            // 5. Render Reports & Full Analytics Views
            renderReportsView();
            renderAnalyticsView(totalSpend, approvedSpend, pendingSpend, reimbursedSpend, categoryMap);

        } catch (err) {
            if (streamContainer) {
                streamContainer.innerHTML = `
                    <div class="empty-placeholder" style="color: #dc2626;">
                        <div class="empty-icon">⚠️</div>
                        <p>Failed to load expenses: ${escapeHtml(err.message || 'Error connecting to server')}</p>
                    </div>
                `;
            }
        }
    }

    function renderCategoryBreakdown(catMap, totalSpend) {
        if (!categoryListContainer) return;
        const categories = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
        if (categoryCountBadge) categoryCountBadge.textContent = `${categories.length} Categories`;

        if (!categories.length) {
            categoryListContainer.innerHTML = '<div class="empty-placeholder">No categories recorded yet.</div>';
            return;
        }

        const barColors = ['#2563eb', '#10b981', '#0284c7', '#f59e0b', '#ec4899', '#8b5cf6'];

        categoryListContainer.innerHTML = categories.map(([name, amt], idx) => {
            const pct = totalSpend > 0 ? ((amt / totalSpend) * 100).toFixed(1) : '0.0';
            const iconObj = getCategoryIcon(name);
            const color = barColors[idx % barColors.length];

            return `
                <div class="cat-bar-item">
                    <div class="cat-bar-meta">
                        <div class="cat-name-box">
                            <span>${iconObj.icon}</span>
                            <span>${escapeHtml(name)}</span>
                            <span class="badge-pill">${pct}%</span>
                        </div>
                        <div class="cat-amount-box">
                            <span>${formatINR(amt)}</span>
                        </div>
                    </div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${Math.min(100, Math.max(3, pct))}%; background: ${color};"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderStream() {
        if (!streamContainer) return;

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

        if (streamCountBadge) streamCountBadge.textContent = `${filtered.length} of ${allExpenses.length}`;

        if (!filtered.length) {
            streamContainer.innerHTML = `
                <div class="empty-placeholder">
                    <div class="empty-icon">🔍</div>
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

            let statusClass = 'chip-pending';
            let statusLabel = '⏳ In Review';
            if (rawStatus === 'approved') {
                statusClass = 'chip-approved';
                statusLabel = '✓ Approved';
            } else if (rawStatus === 'reimbursed') {
                statusClass = 'chip-reimbursed';
                statusLabel = '💎 Reimbursed';
            }

            const card = document.createElement('div');
            card.className = 'expense-row-card';

            const approveBtnHtml = rawStatus !== 'approved'
                ? `<button class="btn-card-approve btn-approve-action" type="button" data-id="${escapeHtml(rowId)}">Approve</button>`
                : '';

            card.innerHTML = `
                <div class="exp-left-cluster">
                    <div class="cat-icon-container" style="background: ${iconInfo.bg}; color: ${iconInfo.color};">
                        ${iconInfo.icon}
                    </div>
                    <div class="exp-info-col">
                        <div class="exp-title-text" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
                        <div class="exp-meta-pills">
                            <span class="tag-pill">📅 ${escapeHtml(date)}</span>
                            <span class="tag-pill">👤 ${escapeHtml(paidBy)}</span>
                            <span class="tag-pill">🏷️ ${escapeHtml(cat)}</span>
                        </div>
                    </div>
                </div>

                <div class="exp-right-cluster">
                    <div class="exp-amount-block">
                        <div class="exp-amount-text">${formatINR(amt)}</div>
                        <span class="status-badge-chip ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="action-btn-group">
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

    function renderReportsView() {
        if (!reportsListContainer) return;
        const reports = allExpenses.filter((item) => {
            const r = item.Expense || item;
            const cat = String(r.Category || '').toLowerCase();
            const name = String(r.Expense_name || '').toLowerCase();
            return cat.includes('report') || name.startsWith('er-') || name.includes('report');
        });

        if (reportsCountBadge) reportsCountBadge.textContent = `${reports.length} Reports`;

        if (!reports.length) {
            reportsListContainer.innerHTML = `
                <div class="empty-placeholder">
                    <div class="empty-icon">📄</div>
                    <p>No submitted expense reports found in Datastore.</p>
                </div>
            `;
            return;
        }

        let tableHtml = `
            <div style="overflow-x: auto;">
                <table class="clean-table">
                    <thead>
                        <tr>
                            <th>Report Name</th>
                            <th>Submitter</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th style="text-align: right;">Total Amount</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        reports.forEach((item) => {
            const r = item.Expense || item;
            const name = r.Expense_name || 'Report';
            const paidBy = r.Paid_by || 'KR Tech Solutions';
            const date = r.Expense_date || 'Today';
            const amt = Number(parseFloat(r.Amount)) || 0;
            const status = String(r.Status || 'unreported');

            tableHtml += `
                <tr>
                    <td><strong>${escapeHtml(name)}</strong></td>
                    <td>${escapeHtml(paidBy)}</td>
                    <td>${escapeHtml(date)}</td>
                    <td><span class="status-badge-chip chip-approved">${escapeHtml(status)}</span></td>
                    <td style="text-align: right; font-weight: 700;">${formatINR(amt)}</td>
                </tr>
            `;
        });

        tableHtml += '</tbody></table></div>';
        reportsListContainer.innerHTML = tableHtml;
    }

    function renderAnalyticsView(totalSpend, approvedSpend, pendingSpend, reimbursedSpend, categoryMap) {
        if (!fullAnalyticsBreakdown) return;
        const catEntries = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

        fullAnalyticsBreakdown.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px;">
                    <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #0f172a;">Executive Spend Summary</h4>
                    <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13.5px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #64748b;">Gross Spend:</span>
                            <span style="font-weight: 700;">${formatINR(totalSpend)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #64748b;">Approved &amp; Cleared:</span>
                            <span style="font-weight: 700; color: #15803d;">${formatINR(approvedSpend)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #64748b;">In Review Pipeline:</span>
                            <span style="font-weight: 700; color: #b45309;">${formatINR(pendingSpend)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #64748b;">Reimbursed to Date:</span>
                            <span style="font-weight: 700; color: #0284c7;">${formatINR(reimbursedSpend)}</span>
                        </div>
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px;">
                    <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #0f172a;">Top 3 Expenditure Categories</h4>
                    <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13.5px;">
                        ${catEntries.slice(0, 3).map(([cat, amt]) => `
                            <div style="display: flex; justify-content: space-between;">
                                <span>${escapeHtml(cat)}</span>
                                <span style="font-weight: 700;">${formatINR(amt)}</span>
                            </div>
                        `).join('') || '<div style="color: #64748b;">No categories recorded yet.</div>'}
                    </div>
                </div>
            </div>
        `;
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

                closeExpenseModal();
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
