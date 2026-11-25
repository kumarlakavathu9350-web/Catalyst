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
    const headerNewExpenseBtn = $('headerNewExpenseBtn');
    const quickAddExpenseNavBtn = $('quickAddExpenseNavBtn');
    const closeExpenseModalBtn = $('closeExpenseModalBtn');
    const cancelExpenseModalBtn = $('cancelExpenseModalBtn');

    // Trip Modal & Table elements
    const tripModal = $('tripModal');
    const tripForm = $('tripForm');
    const openTripModalBtn = $('openTripModalBtn');
    const closeTripModalBtn = $('closeTripModalBtn');
    const cancelTripModalBtn = $('cancelTripModalBtn');
    const tripsTableBody = $('tripsTableBody');
    const tripsCountBadge = $('tripsCountBadge');

    // Reports, Advances & Purchase Requests Elements
    const reportsTableBody = $('reportsTableBody');
    const reportsCountBadge = $('reportsCountBadge');
    const reportModal = $('reportModal');
    const reportForm = $('reportForm');
    const openReportModalBtn = $('openReportModalBtn');
    const closeReportModalBtn = $('closeReportModalBtn');
    const cancelReportModalBtn = $('cancelReportModalBtn');

    const advancesTableBody = $('advancesTableBody');
    const advancesCountBadge = $('advancesCountBadge');
    const advanceModal = $('advanceModal');
    const advanceForm = $('advanceForm');
    const openAdvanceModalBtn = $('openAdvanceModalBtn');
    const closeAdvanceModalBtn = $('closeAdvanceModalBtn');
    const cancelAdvanceModalBtn = $('cancelAdvanceModalBtn');

    const purchasesTableBody = $('purchasesTableBody');
    const purchasesCountBadge = $('purchasesCountBadge');
    const purchaseModal = $('purchaseModal');
    const purchaseForm = $('purchaseForm');
    const openPurchaseModalBtn = $('openPurchaseModalBtn');
    const closePurchaseModalBtn = $('closePurchaseModalBtn');
    const cancelPurchaseModalBtn = $('cancelPurchaseModalBtn');

    const cardsTableBody = $('cardsTableBody');
    const cardsCountBadge = $('cardsCountBadge');
    const cardModal = $('cardModal');
    const cardForm = $('cardForm');
    const openCardModalBtn = $('openCardModalBtn');
    const closeCardModalBtn = $('closeCardModalBtn');
    const cancelCardModalBtn = $('cancelCardModalBtn');

    const settingsUsersTableBody = $('settingsUsersTableBody');
    const settingsUsersCountBadge = $('settingsUsersCountBadge');
    const addUserModal = $('addUserModal');
    const addUserForm = $('addUserForm');
    const openAddUserModalBtn = $('openAddUserModalBtn');
    const closeAddUserModalBtn = $('closeAddUserModalBtn');
    const cancelAddUserModalBtn = $('cancelAddUserModalBtn');
    const syncUsersBtn = $('syncUsersBtn');

    // Custom Module: Data Fetches Elements
    const dataFetchTableBody = $('dataFetchTableBody');
    const dataFetchCountBadge = $('dataFetchCountBadge');
    const dataFetchModal = $('dataFetchModal');
    const dataFetchForm = $('dataFetchForm');
    const openDataFetchModalBtn = $('openDataFetchModalBtn');
    const closeDataFetchModalBtn = $('closeDataFetchModalBtn');
    const cancelDataFetchModalBtn = $('cancelDataFetchModalBtn');
    const syncDataFetchBtn = $('syncDataFetchBtn');
    const dataFetchSearch = $('dataFetchSearch');
    const expenseUserScopeSelect = $('expenseUserScopeSelect');
    const dataFetchUserScopeSelect = $('dataFetchUserScopeSelect');

    // Sidebar navigation tabs
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const viewPanels = document.querySelectorAll('.view-panel');

    // View toggles (Table vs Card view)
    const btnToggleTableView = $('btnToggleTableView');
    const btnToggleCardView = $('btnToggleCardView');
    const expenseTableViewContainer = $('expenseTableViewContainer');
    const expenseCardViewContainer = $('expenseCardViewContainer');

    // Filters and Search
    const expenseStatusViewSelect = $('expenseStatusViewSelect');
    const globalTopSearch = $('globalTopSearch');
    const totalExpenseCounter = $('totalExpenseCounter');

    // Table elements
    const expenseTableBody = $('expenseTableBody');
    const selectAllCheckbox = $('selectAllCheckbox');
    const batchActionBar = $('batchActionBar');
    const selectedCountText = $('selectedCountText');
    const batchApproveBtn = $('batchApproveBtn');
    const batchDeleteBtn = $('batchDeleteBtn');
    const batchDeselectBtn = $('batchDeselectBtn');

    // KPI & Stream elements
    const streamContainer = $('expenseStreamContainer');
    const cardStreamCountBadge = $('cardStreamCountBadge');
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
    const fullAnalyticsBreakdown = $('fullAnalyticsBreakdown');

    let allExpenses = [];
    let allTrips = [];
    let allDataFetches = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let selectedRowIds = new Set();
    let currentViewMode = 'table'; // 'table' or 'card'
    let currentLoggedInUser = {
        name: '',
        email: '',
        role: 'submitter'
    };
    let expenseUserScope = 'my';
    let dataFetchUserScope = 'my';

    // =========================================================================
    // Sidebar Tab Switching
    // =========================================================================
    navLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
            if (e.target.closest('#quickAddExpenseNavBtn')) return;
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

            if (targetTab === 'zia') {
                initZiaView();
            }
        });
    });

    // View Mode Toggle (Table View vs Card View)
    if (btnToggleTableView && btnToggleCardView) {
        btnToggleTableView.onclick = () => {
            currentViewMode = 'table';
            btnToggleTableView.classList.add('active');
            btnToggleCardView.classList.remove('active');
            expenseTableViewContainer.style.display = 'block';
            expenseCardViewContainer.style.display = 'none';
        };

        btnToggleCardView.onclick = () => {
            currentViewMode = 'card';
            btnToggleCardView.classList.add('active');
            btnToggleTableView.classList.remove('active');
            expenseTableViewContainer.style.display = 'none';
            expenseCardViewContainer.style.display = 'flex';
        };
    }

    // Modal controls
    function populateExpenseDataFetchDropdown() {
        const sel = $('expenseDataFetchSelect');
        if (!sel) return;
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">-- Choose Data Fetch Record or Enter Manually Below --</option>';

        const userEmail = (currentLoggedInUser.email || '').toLowerCase();
        const userName = (currentLoggedInUser.name || '').toLowerCase();

        const userRecords = allDataFetches.filter(item => {
            const r = item.Data_fetch || item;
            const recEmail = String(r.Email || '').toLowerCase();
            const recName = String(r.Employee_name || '').toLowerCase();
            return !userEmail || recEmail.includes(userEmail) || (userName && recName.includes(userName));
        });

        userRecords.forEach(item => {
            const r = item.Data_fetch || item;
            const customId = r.Custom_id || r.Record_name || 'Cus-000';
            const bank = r.Customer_account_name || 'Bank';
            const amt = Number(parseFloat(r.Amount)) || 0;
            const opt = document.createElement('option');
            opt.value = customId;
            opt.textContent = `${customId} · ${bank} · ${formatINR(amt)} (${r.Employee_name || r.Email})`;
            sel.appendChild(opt);
        });

        if (currentVal) sel.value = currentVal;
    }

    function fillExpenseFormFromDataFetch(r) {
        if (!r) return;
        const customId = r.Custom_id || r.Record_name || '';
        const bank = r.Customer_account_name || 'Bank';
        const amt = Number(parseFloat(r.Amount)) || 0;
        const email = r.Email || currentLoggedInUser.email || '';

        if ($('expenseNameInput')) {
            $('expenseNameInput').value = `[${customId}] ${bank} - Reimbursement`;
        }
        if ($('expenseAmountInput')) {
            $('expenseAmountInput').value = amt.toFixed(2);
        }
        if ($('expenseDateInput')) {
            $('expenseDateInput').value = new Date().toISOString().slice(0, 10);
        }
        if ($('expenseUserSelect') && email) {
            $('expenseUserSelect').value = email;
        }
        if ($('expenseCategorySelect')) {
            $('expenseCategorySelect').value = 'Office Supplies';
        }
    }

    if ($('expenseDataFetchSelect')) {
        $('expenseDataFetchSelect').onchange = () => {
            const customId = $('expenseDataFetchSelect').value;
            if (!customId) return;
            const found = allDataFetches.find(item => {
                const r = item.Data_fetch || item;
                return (r.Custom_id || r.Record_name) === customId;
            });
            if (found) {
                fillExpenseFormFromDataFetch(found.Data_fetch || found);
            }
        };
    }

    function openExpenseModal() {
        if (expenseModal) {
            populateExpenseDataFetchDropdown();
            if ($('expenseUserSelect') && currentLoggedInUser.email) {
                $('expenseUserSelect').value = currentLoggedInUser.email;
            }
            expenseModal.style.display = 'flex';
        }
    }
    function closeExpenseModal() {
        if (expenseModal) expenseModal.style.display = 'none';
    }

    if (openExpenseModalBtn) openExpenseModalBtn.onclick = openExpenseModal;
    if (headerNewExpenseBtn) headerNewExpenseBtn.onclick = openExpenseModal;
    if (quickAddExpenseNavBtn) {
        quickAddExpenseNavBtn.onclick = (e) => {
            e.stopPropagation();
            openExpenseModal();
        };
    }
    if (closeExpenseModalBtn) closeExpenseModalBtn.onclick = closeExpenseModal;
    if (cancelExpenseModalBtn) cancelExpenseModalBtn.onclick = closeExpenseModal;

    // Trip Modal controls
    function openTripModal() {
        if (tripModal) tripModal.style.display = 'flex';
    }
    function closeTripModal() {
        if (tripModal) tripModal.style.display = 'none';
    }

    if (openTripModalBtn) openTripModalBtn.onclick = openTripModal;
    if (closeTripModalBtn) closeTripModalBtn.onclick = closeTripModal;
    if (cancelTripModalBtn) cancelTripModalBtn.onclick = closeTripModal;

    // Report Modal controls
    function openReportModal() {
        if (reportModal) reportModal.style.display = 'flex';
    }
    function closeReportModal() {
        if (reportModal) reportModal.style.display = 'none';
    }
    if (openReportModalBtn) openReportModalBtn.onclick = openReportModal;
    if (closeReportModalBtn) closeReportModalBtn.onclick = closeReportModal;
    if (cancelReportModalBtn) cancelReportModalBtn.onclick = closeReportModal;

    // Advance Modal controls
    function openAdvanceModal() {
        if (advanceModal) advanceModal.style.display = 'flex';
    }
    function closeAdvanceModal() {
        if (advanceModal) advanceModal.style.display = 'none';
    }
    if (openAdvanceModalBtn) openAdvanceModalBtn.onclick = openAdvanceModal;
    if (closeAdvanceModalBtn) closeAdvanceModalBtn.onclick = closeAdvanceModal;
    if (cancelAdvanceModalBtn) cancelAdvanceModalBtn.onclick = closeAdvanceModal;

    // Purchase Request Modal controls
    function openPurchaseModal() {
        if (purchaseModal) purchaseModal.style.display = 'flex';
    }
    function closePurchaseModal() {
        if (purchaseModal) purchaseModal.style.display = 'none';
    }
    if (openPurchaseModalBtn) openPurchaseModalBtn.onclick = openPurchaseModal;
    if (closePurchaseModalBtn) closePurchaseModalBtn.onclick = closePurchaseModal;
    if (cancelPurchaseModalBtn) cancelPurchaseModalBtn.onclick = closePurchaseModal;

    // Card Modal controls
    function openCardModal() {
        if (cardModal) cardModal.style.display = 'flex';
    }
    function closeCardModal() {
        if (cardModal) cardModal.style.display = 'none';
    }
    if (openCardModalBtn) openCardModalBtn.onclick = openCardModal;
    if (closeCardModalBtn) closeCardModalBtn.onclick = closeCardModal;
    if (cancelCardModalBtn) cancelCardModalBtn.onclick = closeCardModal;

    // Add User Modal controls
    function openAddUserModal() {
        if (addUserModal) addUserModal.style.display = 'flex';
    }
    function closeAddUserModal() {
        if (addUserModal) addUserModal.style.display = 'none';
    }
    if (openAddUserModalBtn) openAddUserModalBtn.onclick = openAddUserModal;
    if (closeAddUserModalBtn) closeAddUserModalBtn.onclick = closeAddUserModal;
    if (cancelAddUserModalBtn) cancelAddUserModalBtn.onclick = closeAddUserModal;

    // Data Fetch Modal controls
    function openDataFetchModal() {
        if (dataFetchModal) {
            if ($('dfEmployeeNameInput') && !$('dfEmployeeNameInput').value) {
                $('dfEmployeeNameInput').value = currentLoggedInUser.name || '';
            }
            if ($('dfEmailInput') && !$('dfEmailInput').value) {
                $('dfEmailInput').value = currentLoggedInUser.email || '';
            }
            dataFetchModal.style.display = 'flex';
        }
    }
    function closeDataFetchModal() {
        if (dataFetchModal) dataFetchModal.style.display = 'none';
    }
    if (openDataFetchModalBtn) openDataFetchModalBtn.onclick = openDataFetchModal;
    if (closeDataFetchModalBtn) closeDataFetchModalBtn.onclick = closeDataFetchModal;
    if (cancelDataFetchModalBtn) cancelDataFetchModalBtn.onclick = closeDataFetchModal;

    window.onclick = (e) => {
        if (e.target === expenseModal) closeExpenseModal();
        if (e.target === tripModal) closeTripModal();
        if (e.target === reportModal) closeReportModal();
        if (e.target === advanceModal) closeAdvanceModal();
        if (e.target === purchaseModal) closePurchaseModal();
        if (e.target === cardModal) closeCardModal();
        if (e.target === addUserModal) closeAddUserModal();
        if (e.target === dataFetchModal) closeDataFetchModal();
    };

    if ($('refreshBtn')) {
        $('refreshBtn').onclick = () => {
            showSyncToast('🔄 Refreshing and syncing with Zoho Expense...', 'info');
            loadData(true);
        };
    }
    $('signOutBtn').onclick = signOutToLogin;

    // Filters and Search
    if (expenseStatusViewSelect) {
        expenseStatusViewSelect.onchange = (e) => {
            currentFilter = e.target.value;
            renderAllViews();
        };
    }

    if (globalTopSearch) {
        globalTopSearch.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            renderAllViews();
        });
    }

    // Batch Actions
    if (selectAllCheckbox) {
        selectAllCheckbox.onchange = (e) => {
            const isChecked = e.target.checked;
            const checkboxes = expenseTableBody.querySelectorAll('.row-select-checkbox');
            checkboxes.forEach((cb) => {
                cb.checked = isChecked;
                const id = cb.getAttribute('data-id');
                if (isChecked) selectedRowIds.add(id);
                else selectedRowIds.delete(id);
            });
            updateBatchActionBar();
        };
    }

    if (batchDeselectBtn) {
        batchDeselectBtn.onclick = () => {
            selectedRowIds.clear();
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            const checkboxes = expenseTableBody.querySelectorAll('.row-select-checkbox');
            checkboxes.forEach((cb) => cb.checked = false);
            updateBatchActionBar();
        };
    }

    if (batchApproveBtn) {
        batchApproveBtn.onclick = async () => {
            if (!selectedRowIds.size) return;
            batchApproveBtn.disabled = true;
            batchApproveBtn.textContent = 'Approving...';
            try {
                for (const rowId of selectedRowIds) {
                    await callFunction({ action: 'approve_expense', row_id: rowId });
                }
                selectedRowIds.clear();
                await loadData();
            } catch (err) {
                alert('Batch approve error: ' + (err.message || 'Error'));
            } finally {
                batchApproveBtn.disabled = false;
                batchApproveBtn.textContent = 'Approve Selected';
            }
        };
    }

    if (batchDeleteBtn) {
        batchDeleteBtn.onclick = async () => {
            if (!selectedRowIds.size) return;
            if (!confirm(`Delete ${selectedRowIds.size} selected expenses?`)) return;
            batchDeleteBtn.disabled = true;
            batchDeleteBtn.textContent = 'Deleting...';
            try {
                for (const rowId of selectedRowIds) {
                    await callFunction({ action: 'delete_expense', row_id: rowId });
                }
                selectedRowIds.clear();
                await loadData();
            } catch (err) {
                alert('Batch delete error: ' + (err.message || 'Error'));
            } finally {
                batchDeleteBtn.disabled = false;
                batchDeleteBtn.textContent = 'Delete Selected';
            }
        };
    }

    function updateBatchActionBar() {
        const count = selectedRowIds.size;
        if (count > 0) {
            batchActionBar.classList.add('visible');
            selectedCountText.textContent = `${count} expense(s) selected`;
        } else {
            batchActionBar.classList.remove('visible');
        }
    }

    function showSyncToast(msg, type = 'info') {
        let toast = $('syncToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'syncToast';
            toast.className = 'sync-toast';
            document.body.appendChild(toast);
        }
        toast.className = `sync-toast sync-toast-${type} visible`;
        toast.textContent = msg;
        clearTimeout(toast._timer);
        if (type !== 'info') {
            toast._timer = setTimeout(() => {
                toast.classList.remove('visible');
            }, 4000);
        }
    }

    const syncZohoBtn = $('syncZohoBtn');
    if (syncZohoBtn) {
        syncZohoBtn.onclick = async () => {
            syncZohoBtn.disabled = true;
            syncZohoBtn.textContent = '🔄 Syncing...';
            showSyncToast('🔄 Syncing all records with Zoho Expense in real-time...', 'info');
            try {
                const res = await callFunction({ action: 'sync_all_from_expense' });
                if (res.status !== 'Success') throw new Error(res.message || 'Sync failed');
                if (res.expenses) {
                    applyLoadedData(res);
                } else {
                    await loadData(false);
                }
                showSyncToast(res.message || '✅ Successfully synchronized with Zoho Expense!', 'success');
            } catch (err) {
                showSyncToast('❌ Failed to sync: ' + (err.message || 'Error'), 'error');
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

    async function callZia(payload) {
        const url = getBackendUrl('/server/zia_function/execute');
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

    function applyLoadedData(data) {
        if (!data || typeof data !== 'object') return;

        allExpenses = data.expenses || [];
        allTrips = data.trips || [];
        const allReports = data.reports || [];
        const allAdvances = data.advances || [];
        const allPurchases = data.purchaseRequests || [];
        const allCards = data.cards || [];
        const appUsers = data.appUsers || [];
        const rawDataFetches = data.dataFetches || [];
        allDataFetches = rawDataFetches.map((r) => r.Data_fetch || r);

        if ($('expenseUserSelect') && Array.isArray(appUsers) && appUsers.length > 0) {
            const currentVal = $('expenseUserSelect').value;
            $('expenseUserSelect').innerHTML = '';
            appUsers.forEach(u => {
                const opt = document.createElement('option');
                const mail = u.emp_mail || '';
                const name = u.Emp_name || mail;
                opt.value = mail;
                opt.textContent = `${name} (${mail})`;
                if (mail.toLowerCase() === (currentLoggedInUser.email || '').toLowerCase()) {
                    opt.selected = true;
                }
                $('expenseUserSelect').appendChild(opt);
            });
            if (!$('expenseUserSelect').value && currentVal) {
                $('expenseUserSelect').value = currentVal;
            }
        }

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

        // 4. Render All Views
        renderAllViews();
        renderTripsView(allTrips);
        renderReportsView(allReports);
        renderAdvancesView(allAdvances);
        renderPurchasesView(allPurchases);
        renderCardsView(allCards);
        renderDataFetchesView(allDataFetches);
        renderSettingsView(appUsers);
        populateExpenseDataFetchDropdown();

        // 5. Render Full Analytics View
        renderAnalyticsView(totalSpend, approvedSpend, pendingSpend, reimbursedSpend, categoryMap);

        // 6. Update Zia AI View KPIs
        if ($('ziaKpiTotalSpend')) $('ziaKpiTotalSpend').textContent = formatINR(totalSpend);
        if ($('ziaKpiProjectedSpend')) $('ziaKpiProjectedSpend').textContent = formatINR(totalSpend * 1.12);
    }

    async function loadData(sync = false) {
        if (expenseTableBody && !allExpenses.length) {
            expenseTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 36px; color: #64748b;">
                        Loading expenses from Catalyst Datastore...
                    </td>
                </tr>
            `;
        }

        try {
            const data = await callFunction({ action: 'getAll', sync: sync ? 'true' : 'false' });
            if (data.status !== 'Success') throw new Error(data.message || 'Error');
            applyLoadedData(data);
        } catch (err) {
            if (expenseTableBody) {
                expenseTableBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 36px; color: #dc2626;">
                            Failed to load expenses: ${escapeHtml(err.message || 'Error connecting to server')}
                        </td>
                    </tr>
                `;
            }
        }
    }

    function getFilteredExpenses() {
        return allExpenses.filter((item) => {
            const r = item.Expense || item;
            const status = String(r.Status || 'unreported').toLowerCase();

            // Status filter
            if (currentFilter === 'approved' && status !== 'approved') return false;
            if (currentFilter === 'pending' && status !== 'pending' && status !== 'submitted') return false;
            if (currentFilter === 'reimbursed' && status !== 'reimbursed') return false;
            if (currentFilter === 'unreported' && status !== 'unreported') return false;

            // User scope filter: 'my' filters against current logged-in user
            if (expenseUserScope === 'my' && currentLoggedInUser.email) {
                const paidBy = String(r.Paid_by || '').toLowerCase();
                const userEmail = currentLoggedInUser.email.toLowerCase();
                const userName = (currentLoggedInUser.name || '').toLowerCase();
                const matchEmail = paidBy.includes(userEmail);
                const matchName = userName && paidBy.includes(userName);
                if (!matchEmail && !matchName) return false;
            }

            // Search query filter
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
    }

    function renderAllViews() {
        const filtered = getFilteredExpenses();

        if (totalExpenseCounter) {
            totalExpenseCounter.textContent = `${filtered.length} of ${allExpenses.length} records`;
        }
        if (cardStreamCountBadge) {
            cardStreamCountBadge.textContent = `${filtered.length} Total`;
        }

        renderTableView(filtered);
        renderCardStream(filtered);
    }

    // =========================================================================
    // 1. Classic Zoho Expense Table Rendering
    // =========================================================================
    function renderTableView(filtered) {
        if (!expenseTableBody) return;

        if (!filtered.length) {
            expenseTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 36px; color: #64748b;">
                        🔍 No matching expenses found in KR Tech Solutions.
                    </td>
                </tr>
            `;
            return;
        }

        expenseTableBody.innerHTML = '';

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

            let statusClass = 'chip-unreported';
            let statusLabel = 'Unreported';
            if (rawStatus === 'approved') {
                statusClass = 'chip-approved';
                statusLabel = 'Approved';
            } else if (rawStatus === 'reimbursed') {
                statusClass = 'chip-reimbursed';
                statusLabel = 'Reimbursed';
            } else if (rawStatus === 'pending' || rawStatus === 'submitted') {
                statusClass = 'chip-pending';
                statusLabel = 'In Review';
            }

            const tr = document.createElement('tr');
            if (selectedRowIds.has(rowId)) tr.classList.add('selected');

            const approveBtnHtml = rawStatus !== 'approved' && rawStatus !== 'reimbursed'
                ? `<button class="btn-row-approve btn-approve-action" type="button" data-id="${escapeHtml(rowId)}">Approve</button>`
                : '';

            tr.innerHTML = `
                <td class="cell-checkbox">
                    <input type="checkbox" class="zoho-checkbox row-select-checkbox" data-id="${escapeHtml(rowId)}" ${selectedRowIds.has(rowId) ? 'checked' : ''}>
                </td>
                <td style="color: #64748b; font-size: 13px;">${escapeHtml(date)}</td>
                <td class="cell-title" title="${escapeHtml(name)}">${escapeHtml(name)}</td>
                <td>
                    <div class="cell-category">
                        <span>${iconInfo.icon}</span>
                        <span>${escapeHtml(cat)}</span>
                    </div>
                </td>
                <td style="color: #475569;">${escapeHtml(paidBy)}</td>
                <td>
                    <span class="status-badge-chip ${statusClass}">${statusLabel}</span>
                </td>
                <td class="cell-amount">${formatINR(amt)}</td>
                <td class="cell-actions">
                    ${approveBtnHtml}
                    <button class="btn-row-delete btn-delete-action" type="button" title="Delete record" data-id="${escapeHtml(rowId)}" data-name="${escapeHtml(name)}">🗑️</button>
                </td>
            `;

            const cb = tr.querySelector('.row-select-checkbox');
            cb.onchange = (e) => {
                if (e.target.checked) {
                    selectedRowIds.add(rowId);
                    tr.classList.add('selected');
                } else {
                    selectedRowIds.delete(rowId);
                    tr.classList.remove('selected');
                }
                updateBatchActionBar();
            };

            const approveBtn = tr.querySelector('.btn-approve-action');
            if (approveBtn) {
                approveBtn.onclick = async () => {
                    approveBtn.disabled = true;
                    approveBtn.textContent = '...';
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

            const delBtn = tr.querySelector('.btn-delete-action');
            if (delBtn) {
                delBtn.onclick = async () => {
                    if (!confirm(`Delete "${name}"?`)) return;
                    delBtn.disabled = true;
                    try {
                        const res = await callFunction({ action: 'delete_expense', row_id: rowId });
                        if (res.status !== 'Success') throw new Error(res.message || 'Error');
                        selectedRowIds.delete(rowId);
                        await loadData();
                    } catch (err) {
                        alert('Failed to delete: ' + (err.message || 'Error'));
                        delBtn.disabled = false;
                    }
                };
            }

            expenseTableBody.appendChild(tr);
        });
    }

    // =========================================================================
    // 2. Executive Card Stream Rendering
    // =========================================================================
    function renderCardStream(filtered) {
        if (!streamContainer) return;

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

            let statusClass = 'chip-unreported';
            let statusLabel = 'Unreported';
            if (rawStatus === 'approved') {
                statusClass = 'chip-approved';
                statusLabel = '✓ Approved';
            } else if (rawStatus === 'reimbursed') {
                statusClass = 'chip-reimbursed';
                statusLabel = '💎 Reimbursed';
            } else if (rawStatus === 'pending' || rawStatus === 'submitted') {
                statusClass = 'chip-pending';
                statusLabel = '⏳ In Review';
            }

            const card = document.createElement('div');
            card.className = 'expense-row-card';

            const approveBtnHtml = rawStatus !== 'approved' && rawStatus !== 'reimbursed'
                ? `<button class="btn-card-approve btn-approve-card-action" type="button" data-id="${escapeHtml(rowId)}">Approve</button>`
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
                        <button class="btn-card-delete btn-delete-card-action" type="button" title="Delete record" data-id="${escapeHtml(rowId)}" data-name="${escapeHtml(name)}">🗑️</button>
                    </div>
                </div>
            `;

            const approveBtn = card.querySelector('.btn-approve-card-action');
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

            const delBtn = card.querySelector('.btn-delete-card-action');
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
                    <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #0f172a;">Top Expenditure Categories</h4>
                    <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13.5px;">
                        ${catEntries.slice(0, 5).map(([cat, amt]) => `
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
            const Status = $('expenseStatusSelect')?.value || 'unreported';

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
                    Paid_by: Paid_by || 'kumar lakavthu',
                    Status
                });
                if (res.status !== 'Success') throw new Error(res.message || 'Failed to save');

                closeExpenseModal();
                expenseForm.reset();
                showSyncToast(`✅ Expense of ${formatINR(Amount)} recorded successfully!`, 'success');
                await loadData();

                // Automatically switch to Expenses tab to show the record against the user
                const expensesNav = document.querySelector('.sidebar-nav .nav-link[data-tab="expenses"]');
                if (expensesNav) expensesNav.click();
            } catch (err) {
                alert('Error adding expense: ' + (err.message || 'Error'));
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Expense';
            }
        };
    }

    function renderTripsView(trips) {
        if (!tripsTableBody) return;
        if (tripsCountBadge) tripsCountBadge.textContent = `${trips.length} Trips`;

        if (!trips.length) {
            tripsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">
                        No trips recorded in Catalyst Datastore.
                    </td>
                </tr>
            `;
            return;
        }

        tripsTableBody.innerHTML = '';
        trips.forEach((item) => {
            const t = item.Trip || item;
            const rowId = t.ROWID || '';
            const tripNum = t.Trip_number || 'TRIP-00000';
            const tripName = t.Trip_name || 'Business Trip';
            const departure = t.Departure || 'HQ';
            const destination = t.Destination || 'Site';
            const dates = `${t.Start_date || ''} - ${t.End_date || ''}`;
            const submitter = t.Submitter || 'Submiter';
            const status = String(t.Status || 'approved').toLowerCase();

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(tripNum)}</strong></td>
                <td>${escapeHtml(tripName)}</td>
                <td>${escapeHtml(departure)} ➔ ${escapeHtml(destination)}</td>
                <td style="color: #64748b; font-size: 13px;">${escapeHtml(dates)}</td>
                <td style="color: #475569;">${escapeHtml(submitter)}</td>
                <td><span class="status-badge-chip chip-approved">${escapeHtml(status)}</span></td>
                <td style="text-align: right;">
                    <button class="btn-row-delete btn-delete-trip-action" type="button" title="Delete trip" data-id="${escapeHtml(rowId)}" data-name="${escapeHtml(tripName)}">🗑️</button>
                </td>
            `;

            const delBtn = tr.querySelector('.btn-delete-trip-action');
            if (delBtn) {
                delBtn.onclick = async () => {
                    if (!confirm(`Delete trip "${tripName}"?`)) return;
                    delBtn.disabled = true;
                    try {
                        const res = await callFunction({ action: 'delete_trip', row_id: rowId });
                        if (res.status !== 'Success') throw new Error(res.message || 'Error');
                        await loadData();
                    } catch (err) {
                        alert('Failed to delete trip: ' + (err.message || 'Error'));
                        delBtn.disabled = false;
                    }
                };
            }

            tripsTableBody.appendChild(tr);
        });
    }

    // Trip Modal Form Submission
    if (tripForm) {
        tripForm.onsubmit = async (e) => {
            e.preventDefault();
            const Trip_name = $('tripNameInput').value.trim();
            const Departure = $('tripDepartureInput').value.trim();
            const Destination = $('tripDestinationInput').value.trim();
            const Start_date = $('tripStartDateInput').value;
            const End_date = $('tripEndDateInput').value;
            const Submitter = $('tripSubmitterSelect').value.trim();
            const Budget = $('tripBudgetInput').value.trim();

            if (!Trip_name || !Departure || !Destination) {
                alert('Please enter trip name, departure, and destination.');
                return;
            }

            const submitBtn = tripForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            try {
                const res = await callFunction({
                    action: 'add_trip',
                    Trip_name,
                    Departure,
                    Destination,
                    Start_date,
                    End_date,
                    Submitter,
                    Budget: Budget || 0,
                    Status: 'approved'
                });
                if (res.status !== 'Success') throw new Error(res.message || 'Failed to save');

                closeTripModal();
                tripForm.reset();
                await loadData();
            } catch (err) {
                alert('Error adding trip: ' + (err.message || 'Error'));
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Trip';
            }
        };
    }

    // =========================================================================
    // Reports View & Multi-Level Approvals
    // =========================================================================
    function renderReportsView(reports) {
        if (!reportsTableBody) return;
        if (reportsCountBadge) reportsCountBadge.textContent = `${reports.length} Reports`;

        if (!reports.length) {
            reportsTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 24px; color: #64748b;">
                        No expense reports found in Catalyst Datastore.
                    </td>
                </tr>
            `;
            return;
        }

        reportsTableBody.innerHTML = '';
        reports.forEach((item) => {
            const r = item.Report || item;
            const rowId = r.ROWID || '';
            const reportNum = r.Report_number || 'ER-00000';
            const reportName = r.Report_name || 'Expense Report';
            const submitter = r.Submitter_name || 'Submiter';
            const dates = `${r.Start_date || ''} - ${r.End_date || ''}`;
            const approvalLevel = r.Approval_level || 'Level 1 - Manager Review';
            const rawStatus = String(r.Status || 'submitted').toLowerCase();
            const total = Number(parseFloat(r.Total_amount)) || 0;

            let stageColor = '#b45309';
            let stageBg = '#fffbeb';
            if (rawStatus === 'approved' || rawStatus === 'reimbursed') {
                stageColor = '#15803d';
                stageBg = '#f0fdf4';
            } else if (rawStatus === 'rejected') {
                stageColor = '#dc2626';
                stageBg = '#fef2f2';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(reportNum)}</strong></td>
                <td>${escapeHtml(reportName)}</td>
                <td style="color: #475569;">${escapeHtml(submitter)}</td>
                <td style="color: #64748b; font-size: 13px;">${escapeHtml(dates)}</td>
                <td><span style="display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 600; background: ${stageBg}; color: ${stageColor};">${escapeHtml(approvalLevel)}</span></td>
                <td><span class="status-badge-chip ${rawStatus === 'approved' || rawStatus === 'reimbursed' ? 'chip-approved' : (rawStatus === 'rejected' ? 'chip-unreported' : 'chip-pending')}">${escapeHtml(rawStatus)}</span></td>
                <td style="text-align: right; font-weight: 700;">${formatINR(total)}</td>
                <td style="text-align: right; white-space: nowrap;">
                    ${rawStatus !== 'approved' && rawStatus !== 'reimbursed' && rawStatus !== 'rejected' ? `
                        <button type="button" class="btn btn-primary btn-approve-report" data-id="${escapeHtml(rowId)}" style="padding: 3px 8px; font-size: 11.5px; margin-right: 4px;">Approve</button>
                        <button type="button" class="btn btn-danger btn-reject-report" data-id="${escapeHtml(rowId)}" style="padding: 3px 8px; font-size: 11.5px;">Reject</button>
                    ` : `<span style="color: #16a34a; font-weight: 600; font-size: 12px;">✓ Settled</span>`}
                </td>
            `;

            const approveBtn = tr.querySelector('.btn-approve-report');
            if (approveBtn) {
                approveBtn.onclick = async () => {
                    approveBtn.disabled = true;
                    approveBtn.textContent = '...';
                    try {
                        const res = await callFunction({ action: 'approve_level', module: 'report', row_id: rowId });
                        if (res.status !== 'Success') throw new Error(res.message || 'Error');
                        await loadData();
                    } catch (err) {
                        alert('Approval error: ' + (err.message || 'Error'));
                        approveBtn.disabled = false;
                        approveBtn.textContent = 'Approve';
                    }
                };
            }

            const rejectBtn = tr.querySelector('.btn-reject-report');
            if (rejectBtn) {
                rejectBtn.onclick = async () => {
                    const reason = prompt('Please enter rejection reason:');
                    if (reason === null) return;
                    rejectBtn.disabled = true;
                    try {
                        const res = await callFunction({ action: 'reject_level', module: 'report', row_id: rowId, reason });
                        if (res.status !== 'Success') throw new Error(res.message || 'Error');
                        await loadData();
                    } catch (err) {
                        alert('Rejection error: ' + (err.message || 'Error'));
                        rejectBtn.disabled = false;
                    }
                };
            }

            reportsTableBody.appendChild(tr);
        });
    }

    // =========================================================================
    // Advances View & Multi-Level Approvals
    // =========================================================================
    function renderAdvancesView(advances) {
        if (!advancesTableBody) return;
        if (advancesCountBadge) advancesCountBadge.textContent = `${advances.length} Advances`;

        if (!advances.length) {
            advancesTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 24px; color: #64748b;">
                        No advances recorded in Catalyst Datastore.
                    </td>
                </tr>
            `;
            return;
        }

        advancesTableBody.innerHTML = '';
        advances.forEach((item) => {
            const a = item.Advance || item;
            const rowId = a.ROWID || '';
            const advNum = a.Advance_number || 'ADV-000';
            const empName = a.Employee_name || 'Employee';
            const advDate = a.Advance_date || 'Today';
            const reason = a.Reason || 'Advance';
            const approvalLevel = a.Approval_level || 'Level 1 - Manager Review';
            const rawStatus = String(a.Status || 'pending').toLowerCase();
            const amount = Number(parseFloat(a.Amount)) || 0;

            let stageColor = '#b45309';
            let stageBg = '#fffbeb';
            if (rawStatus === 'approved') {
                stageColor = '#15803d';
                stageBg = '#f0fdf4';
            } else if (rawStatus === 'rejected') {
                stageColor = '#dc2626';
                stageBg = '#fef2f2';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(advNum)}</strong></td>
                <td>${escapeHtml(empName)}</td>
                <td style="color: #64748b; font-size: 13px;">${escapeHtml(advDate)}</td>
                <td style="color: #475569;">${escapeHtml(reason)}</td>
                <td><span style="display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 600; background: ${stageBg}; color: ${stageColor};">${escapeHtml(approvalLevel)}</span></td>
                <td><span class="status-badge-chip ${rawStatus === 'approved' ? 'chip-approved' : (rawStatus === 'rejected' ? 'chip-unreported' : 'chip-pending')}">${escapeHtml(rawStatus)}</span></td>
                <td style="text-align: right; font-weight: 700; color: #0284c7;">${formatINR(amount)}</td>
                <td style="text-align: right; white-space: nowrap;">
                    ${rawStatus !== 'approved' && rawStatus !== 'rejected' ? `
                        <button type="button" class="btn btn-primary btn-approve-advance" data-id="${escapeHtml(rowId)}" style="padding: 3px 8px; font-size: 11.5px; margin-right: 4px;">Approve</button>
                        <button type="button" class="btn btn-danger btn-reject-advance" data-id="${escapeHtml(rowId)}" style="padding: 3px 8px; font-size: 11.5px;">Reject</button>
                    ` : `<span style="color: #16a34a; font-weight: 600; font-size: 12px;">✓ Disbursed</span>`}
                </td>
            `;

            const approveBtn = tr.querySelector('.btn-approve-advance');
            if (approveBtn) {
                approveBtn.onclick = async () => {
                    approveBtn.disabled = true;
                    approveBtn.textContent = '...';
                    try {
                        const res = await callFunction({ action: 'approve_level', module: 'advance', row_id: rowId });
                        if (res.status !== 'Success') throw new Error(res.message || 'Error');
                        await loadData();
                    } catch (err) {
                        alert('Approval error: ' + (err.message || 'Error'));
                        approveBtn.disabled = false;
                        approveBtn.textContent = 'Approve';
                    }
                };
            }

            const rejectBtn = tr.querySelector('.btn-reject-advance');
            if (rejectBtn) {
                rejectBtn.onclick = async () => {
                    const reason = prompt('Please enter rejection reason:');
                    if (reason === null) return;
                    rejectBtn.disabled = true;
                    try {
                        const res = await callFunction({ action: 'reject_level', module: 'advance', row_id: rowId, reason });
                        if (res.status !== 'Success') throw new Error(res.message || 'Error');
                        await loadData();
                    } catch (err) {
                        alert('Rejection error: ' + (err.message || 'Error'));
                        rejectBtn.disabled = false;
                    }
                };
            }

            advancesTableBody.appendChild(tr);
        });
    }

    // =========================================================================
    // Purchase Requests View & Multi-Level Approvals
    // =========================================================================
    function renderPurchasesView(purchases) {
        if (!purchasesTableBody) return;
        if (purchasesCountBadge) purchasesCountBadge.textContent = `${purchases.length} Requests`;

        if (!purchases.length) {
            purchasesTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 24px; color: #64748b;">
                        No purchase requests found in Catalyst Datastore.
                    </td>
                </tr>
            `;
            return;
        }

        purchasesTableBody.innerHTML = '';
        purchases.forEach((item) => {
            const p = item.Purchase_request || item;
            const rowId = p.ROWID || '';
            const itemName = p.Item_name || 'Procurement Item';
            const vendor = p.Vendor || 'Vendor';
            const reqInfo = `${p.Requester || 'Requester'} (${p.Department || 'General'})`;
            const reqDate = p.Request_date || 'Today';
            const approvalLevel = p.Approval_level || 'Level 1 - Manager Review';
            const rawStatus = String(p.Status || 'pending').toLowerCase();
            const amount = Number(parseFloat(p.Amount)) || 0;

            let stageColor = '#b45309';
            let stageBg = '#fffbeb';
            if (rawStatus === 'approved') {
                stageColor = '#15803d';
                stageBg = '#f0fdf4';
            } else if (rawStatus === 'rejected') {
                stageColor = '#dc2626';
                stageBg = '#fef2f2';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(itemName)}</strong></td>
                <td>${escapeHtml(vendor)}</td>
                <td style="color: #475569;">${escapeHtml(reqInfo)}</td>
                <td style="color: #64748b; font-size: 13px;">${escapeHtml(reqDate)}</td>
                <td><span style="display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 600; background: ${stageBg}; color: ${stageColor};">${escapeHtml(approvalLevel)}</span></td>
                <td><span class="status-badge-chip ${rawStatus === 'approved' ? 'chip-approved' : (rawStatus === 'rejected' ? 'chip-unreported' : 'chip-pending')}">${escapeHtml(rawStatus)}</span></td>
                <td style="text-align: right; font-weight: 700; color: #6366f1;">${formatINR(amount)}</td>
                <td style="text-align: right; white-space: nowrap;">
                    ${rawStatus !== 'approved' && rawStatus !== 'rejected' ? `
                        <button type="button" class="btn btn-primary btn-approve-pr" data-id="${escapeHtml(rowId)}" style="padding: 3px 8px; font-size: 11.5px; margin-right: 4px;">Approve</button>
                        <button type="button" class="btn btn-danger btn-reject-pr" data-id="${escapeHtml(rowId)}" style="padding: 3px 8px; font-size: 11.5px;">Reject</button>
                    ` : `<span style="color: #16a34a; font-weight: 600; font-size: 12px;">✓ Procured</span>`}
                </td>
            `;

            const approveBtn = tr.querySelector('.btn-approve-pr');
            if (approveBtn) {
                approveBtn.onclick = async () => {
                    approveBtn.disabled = true;
                    approveBtn.textContent = '...';
                    try {
                        const res = await callFunction({ action: 'approve_level', module: 'pr', row_id: rowId });
                        if (res.status !== 'Success') throw new Error(res.message || 'Error');
                        await loadData();
                    } catch (err) {
                        alert('Approval error: ' + (err.message || 'Error'));
                        approveBtn.disabled = false;
                        approveBtn.textContent = 'Approve';
                    }
                };
            }

            const rejectBtn = tr.querySelector('.btn-reject-pr');
            if (rejectBtn) {
                rejectBtn.onclick = async () => {
                    const reason = prompt('Please enter rejection reason:');
                    if (reason === null) return;
                    rejectBtn.disabled = true;
                    try {
                        const res = await callFunction({ action: 'reject_level', module: 'pr', row_id: rowId, reason });
                        if (res.status !== 'Success') throw new Error(res.message || 'Error');
                        await loadData();
                    } catch (err) {
                        alert('Rejection error: ' + (err.message || 'Error'));
                        rejectBtn.disabled = false;
                    }
                };
            }

            purchasesTableBody.appendChild(tr);
        });
    }

    // Modal Form Submissions for Reports, Advances, Purchase Requests
    if (reportForm) {
        reportForm.onsubmit = async (e) => {
            e.preventDefault();
            const Report_name = $('reportNameInput').value.trim();
            const Start_date = $('reportStartDateInput').value;
            const End_date = $('reportEndDateInput').value;
            const Submitter_name = $('reportSubmitterSelect').value.trim();
            const Total_amount = $('reportTotalAmountInput').value.trim();

            const submitBtn = reportForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            try {
                const res = await callFunction({
                    action: 'add_report',
                    Report_name,
                    Start_date,
                    End_date,
                    Submitter_name,
                    Total_amount: Total_amount || 0
                });
                if (res.status !== 'Success') throw new Error(res.message || 'Failed to submit report');
                closeReportModal();
                reportForm.reset();
                await loadData();
            } catch (err) {
                alert('Error creating report: ' + (err.message || 'Error'));
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Report';
            }
        };
    }

    if (advanceForm) {
        advanceForm.onsubmit = async (e) => {
            e.preventDefault();
            const Employee_name = $('advanceEmployeeSelect').value.trim();
            const Amount = $('advanceAmountInput').value.trim();
            const Advance_date = $('advanceDateInput').value;
            const Reason = $('advanceReasonInput').value.trim();

            const submitBtn = advanceForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            try {
                const res = await callFunction({
                    action: 'add_advance',
                    Employee_name,
                    Amount: Amount || 0,
                    Advance_date: Advance_date || new Date().toISOString().slice(0, 10),
                    Reason
                });
                if (res.status !== 'Success') throw new Error(res.message || 'Failed to submit advance');
                closeAdvanceModal();
                advanceForm.reset();
                await loadData();
            } catch (err) {
                alert('Error requesting advance: ' + (err.message || 'Error'));
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Advance';
            }
        };
    }

    if (purchaseForm) {
        purchaseForm.onsubmit = async (e) => {
            e.preventDefault();
            const Item_name = $('purchaseItemInput').value.trim();
            const Vendor = $('purchaseVendorInput').value.trim();
            const Amount = $('purchaseAmountInput').value.trim();
            const Department = $('purchaseDeptSelect').value.trim();
            const Requester = $('purchaseRequesterSelect').value.trim();

            const submitBtn = purchaseForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            try {
                const res = await callFunction({
                    action: 'add_purchase_request',
                    Item_name,
                    Vendor,
                    Amount: Amount || 0,
                    Department,
                    Requester
                });
                if (res.status !== 'Success') throw new Error(res.message || 'Failed to submit request');
                closePurchaseModal();
                purchaseForm.reset();
                await loadData();
            } catch (err) {
                alert('Error submitting purchase request: ' + (err.message || 'Error'));
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Request';
            }
        };
    }

    // =========================================================================
    // Corporate Cards View
    // =========================================================================
    function renderCardsView(cards) {
        if (!cardsTableBody) return;
        if (cardsCountBadge) cardsCountBadge.textContent = `${cards.length} Cards`;

        if (!cards.length) {
            cardsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">
                        No corporate cards registered in Catalyst Datastore.
                    </td>
                </tr>
            `;
            return;
        }

        cardsTableBody.innerHTML = '';
        cards.forEach((item) => {
            const c = item.Card || item;
            const rowId = c.ROWID || '';
            const cardholder = c.Cardholder_name || 'Cardholder';
            const cardNum = c.Card_number || '•••• •••• •••• 0000';
            const bankName = c.Bank_name || 'HDFC Corporate Banking';
            const cardType = c.Card_type || 'Mastercard Corporate';
            const status = c.Status || 'Active Feed';
            const totalSpend = Number(parseFloat(c.Total_spend)) || 0;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(cardholder)}</strong></td>
                <td><code style="font-size: 13px; font-weight: 600; color: #1e293b;">${escapeHtml(cardNum)}</code></td>
                <td>${escapeHtml(bankName)}</td>
                <td>${escapeHtml(cardType)}</td>
                <td><span class="status-badge-chip chip-approved">${escapeHtml(status)}</span></td>
                <td style="text-align: right; font-weight: 700; color: #2563eb;">${formatINR(totalSpend)}</td>
                <td style="text-align: right;">
                    <button class="btn-row-delete btn-delete-card-action" type="button" title="Delete card" data-id="${escapeHtml(rowId)}">🗑️</button>
                </td>
            `;

            const delBtn = tr.querySelector('.btn-delete-card-action');
            if (delBtn) {
                delBtn.onclick = async () => {
                    if (!confirm(`Delete card for "${cardholder}"?`)) return;
                    delBtn.disabled = true;
                    try {
                        const res = await callFunction({ action: 'delete_card', row_id: rowId });
                        if (res.status !== 'Success') throw new Error(res.message || 'Error');
                        await loadData();
                    } catch (err) {
                        alert('Failed to delete card: ' + (err.message || 'Error'));
                        delBtn.disabled = false;
                    }
                };
            }

            cardsTableBody.appendChild(tr);
        });
    }

    // =========================================================================
    // Settings & User Management View
    // =========================================================================
    function renderSettingsView(users) {
        if (!settingsUsersTableBody) return;
        if (settingsUsersCountBadge) settingsUsersCountBadge.textContent = `${users.length} Members`;

        if (!users.length) {
            settingsUsersTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 24px; color: #64748b;">
                        No team members registered yet.
                    </td>
                </tr>
            `;
            return;
        }

        settingsUsersTableBody.innerHTML = '';
        users.forEach((item) => {
            const u = item.App_user || item;
            const rowId = u.ROWID || '';
            const name = u.Emp_name || 'Team Member';
            const email = u.emp_mail || '';
            const role = u.Role || 'submitter';
            const initial = (name[0] || email[0] || 'U').toUpperCase();

            let roleBadge = '<span class="status-badge-chip chip-unreported">Submitter</span>';
            if (role === 'admin') {
                roleBadge = '<span class="status-badge-chip chip-approved">Admin</span>';
            } else if (role === 'approver') {
                roleBadge = '<span class="status-badge-chip chip-pending">Approver</span>';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background: #2563eb; color: #fff; font-weight: 700; font-size: 13px;">${initial}</span>
                        <strong>${escapeHtml(name)}</strong>
                    </div>
                </td>
                <td style="color: #475569;">${escapeHtml(email)}</td>
                <td>${roleBadge}</td>
                <td><span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11.5px; font-weight: 600; background: #f0fdf4; color: #16a34a;">✅ Synced with Zoho Expense</span></td>
                <td style="text-align: right;">
                    <button class="btn-row-delete btn-delete-user-action" type="button" title="Delete member" data-id="${escapeHtml(rowId)}" data-name="${escapeHtml(name)}">🗑️</button>
                </td>
            `;

            const delBtn = tr.querySelector('.btn-delete-user-action');
            if (delBtn) {
                delBtn.onclick = async () => {
                    if (!confirm(`Delete member "${name}" (${email})?`)) return;
                    delBtn.disabled = true;
                    try {
                        const res = await callFunction({ action: 'delete_user', row_id: rowId });
                        if (res.status !== 'Success') throw new Error(res.message || 'Error');
                        await loadData();
                    } catch (err) {
                        alert('Failed to delete member: ' + (err.message || 'Error'));
                        delBtn.disabled = false;
                    }
                };
            }

            settingsUsersTableBody.appendChild(tr);
        });
    }

    // Modal Form Submissions for Cards & Users
    if (cardForm) {
        cardForm.onsubmit = async (e) => {
            e.preventDefault();
            const Cardholder_name = $('cardHolderInput').value.trim();
            const Card_number = $('cardNumberInput').value.trim();
            const Bank_name = $('cardBankSelect').value.trim();
            const Card_type = $('cardTypeSelect').value.trim();
            const Total_spend = $('cardInitialSpendInput').value.trim();

            const submitBtn = cardForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Linking...';

            try {
                const res = await callFunction({
                    action: 'add_card',
                    Cardholder_name,
                    Card_number,
                    Bank_name,
                    Card_type,
                    Total_spend: Total_spend || 0
                });
                if (res.status !== 'Success') throw new Error(res.message || 'Failed to add card');
                closeCardModal();
                cardForm.reset();
                await loadData();
            } catch (err) {
                alert('Error adding card: ' + (err.message || 'Error'));
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Link Card Feed';
            }
        };
    }

    if (addUserForm) {
        addUserForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = $('newUserNameInput').value.trim();
            const email = $('newUserEmailInput').value.trim();
            const role = $('newUserRoleSelect').value.trim();
            const department = $('newUserDeptSelect').value.trim();
            const password = $('newUserPasswordInput').value.trim();

            const submitBtn = addUserForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating User in Zoho & DB...';

            try {
                const res = await callFunction({
                    action: 'add_user',
                    name,
                    email,
                    role,
                    department,
                    password
                });
                if (res.status !== 'Success') throw new Error(res.message || 'Failed to add user');
                alert(`✅ User "${name}" (${email}) created in Zoho Expense & Catalyst DB!`);
                closeAddUserModal();
                addUserForm.reset();
                await loadData();
            } catch (err) {
                alert('Error adding user: ' + (err.message || 'Error'));
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create User in Zoho & DB';
            }
        };
    }

    if (syncUsersBtn) {
        syncUsersBtn.onclick = async () => {
            syncUsersBtn.disabled = true;
            syncUsersBtn.textContent = '🔄 Syncing...';
            try {
                const res = await callFunction({ action: 'sync_users' });
                if (res.status !== 'Success') throw new Error(res.message || 'Sync failed');
                await loadData();
            } catch (err) {
                alert('Failed to sync users: ' + (err.message || 'Error'));
            } finally {
                syncUsersBtn.disabled = false;
                syncUsersBtn.textContent = '🔄 Sync Zoho Users';
            }
        };
    }

    // =========================================================================
    // Custom Module: Data Fetches View & Operations
    // =========================================================================
    function renderDataFetchesView(records) {
        if (!dataFetchTableBody) return;

        let displayRecords = records;
        if (dataFetchUserScope === 'my' && currentLoggedInUser.email) {
            const userEmail = currentLoggedInUser.email.toLowerCase();
            const userName = (currentLoggedInUser.name || '').toLowerCase();
            displayRecords = records.filter(item => {
                const r = item.Data_fetch || item;
                const recEmail = String(r.Email || '').toLowerCase();
                const recName = String(r.Employee_name || '').toLowerCase();
                return recEmail.includes(userEmail) || (userName && recName.includes(userName));
            });
        }

        if (dataFetchCountBadge) {
            const scopeLabel = dataFetchUserScope === 'my' ? 'My Records' : 'All Records';
            dataFetchCountBadge.textContent = `${displayRecords.length} ${scopeLabel}`;
        }

        if (!displayRecords.length) {
            dataFetchTableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 28px; color: #64748b;">
                        No Data Fetch records found for <strong>${escapeHtml(currentLoggedInUser.name || currentLoggedInUser.email || 'current user')}</strong> (${escapeHtml(currentLoggedInUser.email || '')}).<br>
                        <span style="font-size: 12px; color: #94a3b8;">Switch dropdown to "👥 All Records" to view entire organization data or click "+ New Record".</span>
                    </td>
                </tr>
            `;
            return;
        }

        dataFetchTableBody.innerHTML = '';
        displayRecords.forEach((item) => {
            const r = item.Data_fetch || item;
            const rowId = r.ROWID || '';
            const zohoRecId = r.Zoho_record_id || '';
            const customId = r.Custom_id || r.Record_name || 'Cus-000';
            const empName = r.Employee_name || '—';
            const email = r.Email || '—';
            const accountName = r.Customer_account_name || '—';
            const ifsc = r.Ifsc || '—';
            const accNum = r.Account_number || '—';
            const amount = Number(parseFloat(r.Amount)) || 0;
            const status = (r.Status || 'draft').toLowerCase();

            let statusBadge = '<span class="status-badge-chip chip-unreported">Draft</span>';
            if (status === 'active') {
                statusBadge = '<span class="status-badge-chip chip-approved">Active</span>';
            } else if (status === 'verified') {
                statusBadge = '<span class="status-badge-chip chip-reimbursed">Verified</span>';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong style="color: #0369a1; font-family: monospace; font-size: 13px;">${escapeHtml(customId)}</strong></td>
                <td><strong>${escapeHtml(empName)}</strong></td>
                <td style="color: #64748b; font-size: 12.5px;">${escapeHtml(email)}</td>
                <td>${escapeHtml(accountName)}</td>
                <td><code style="font-size: 12px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${escapeHtml(ifsc)}</code></td>
                <td style="font-family: monospace;">${escapeHtml(accNum)}</td>
                <td style="font-weight: 700; color: #0284c7;">${formatINR(amount)}</td>
                <td>${statusBadge}</td>
                <td style="text-align: right; white-space: nowrap;">
                    <button class="btn btn-primary btn-claim-to-expense" type="button" style="padding: 4px 10px; font-size: 11.5px; border-radius: 6px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-right: 6px;" title="Choose this record and add to Expenses">
                        <span>➕ Add to Expense</span>
                    </button>
                    <button class="btn-row-delete btn-delete-datafetch" type="button" title="Delete record" data-id="${escapeHtml(rowId)}" data-zoho-id="${escapeHtml(zohoRecId)}">🗑️</button>
                </td>
            `;

            const claimBtn = tr.querySelector('.btn-claim-to-expense');
            if (claimBtn) {
                claimBtn.onclick = () => {
                    openExpenseModal();
                    if ($('expenseDataFetchSelect')) {
                        $('expenseDataFetchSelect').value = customId;
                    }
                    fillExpenseFormFromDataFetch(r);
                };
            }

            const delBtn = tr.querySelector('.btn-delete-datafetch');
            if (delBtn) {
                delBtn.onclick = async () => {
                    if (!confirm(`Delete custom module record "${customId}"? This will delete it from both Zoho Expense and Catalyst Datastore.`)) return;
                    delBtn.disabled = true;
                    try {
                        const res = await callFunction({
                            action: 'delete_data_fetch',
                            row_id: rowId,
                            zoho_record_id: zohoRecId
                        });
                        if (res.status !== 'Success') throw new Error(res.message || 'Error');
                        showSyncToast('Record deleted successfully.', 'success');
                        await loadData();
                    } catch (err) {
                        alert('Delete error: ' + (err.message || 'Error'));
                        delBtn.disabled = false;
                    }
                };
            }

            dataFetchTableBody.appendChild(tr);
        });
    }

    if (expenseUserScopeSelect) {
        expenseUserScopeSelect.onchange = () => {
            expenseUserScope = expenseUserScopeSelect.value;
            renderAllViews();
        };
    }

    if (dataFetchUserScopeSelect) {
        dataFetchUserScopeSelect.onchange = () => {
            dataFetchUserScope = dataFetchUserScopeSelect.value;
            renderDataFetchesView(allDataFetches);
        };
    }

    // Search filter for Data Fetch
    if (dataFetchSearch) {
        dataFetchSearch.oninput = () => {
            const q = dataFetchSearch.value.trim().toLowerCase();
            if (!q) {
                renderDataFetchesView(allDataFetches);
                return;
            }
            const filtered = allDataFetches.filter((item) => {
                const r = item.Data_fetch || item;
                return (
                    (r.Custom_id || '').toLowerCase().includes(q) ||
                    (r.Record_name || '').toLowerCase().includes(q) ||
                    (r.Employee_name || '').toLowerCase().includes(q) ||
                    (r.Email || '').toLowerCase().includes(q) ||
                    (r.Customer_account_name || '').toLowerCase().includes(q) ||
                    (r.Ifsc || '').toLowerCase().includes(q) ||
                    (r.Account_number || '').toLowerCase().includes(q)
                );
            });
            renderDataFetchesView(filtered);
        };
    }

    // Sync button for Data Fetch
    if (syncDataFetchBtn) {
        syncDataFetchBtn.onclick = async () => {
            syncDataFetchBtn.disabled = true;
            syncDataFetchBtn.textContent = '🔄 Syncing...';
            showSyncToast('🔄 Fetching custom module records from Zoho Expense cm_data_fetch...', 'info');
            try {
                const res = await callFunction({ action: 'sync_data_fetch' });
                if (res.status !== 'Success') throw new Error(res.message || 'Sync failed');
                await loadData();
                showSyncToast(res.message || 'Custom module synced successfully!', 'success');
            } catch (err) {
                showSyncToast('Sync error: ' + (err.message || 'Error'), 'error');
            } finally {
                syncDataFetchBtn.disabled = false;
                syncDataFetchBtn.textContent = '🔄 Sync from Zoho';
            }
        };
    }

    // Modal form submit for Data Fetch
    if (dataFetchForm) {
        dataFetchForm.onsubmit = async (e) => {
            e.preventDefault();
            const custom_id = $('dfCustomIdInput').value.trim();
            const employee_name = $('dfEmployeeNameInput').value.trim();
            const email = $('dfEmailInput').value.trim();
            const customer_account_name = $('dfAccountNameInput').value.trim();
            const ifsc = $('dfIfscInput').value.trim();
            const account_number = $('dfAccountNumberInput').value.trim();
            const amount = $('dfAmountInput').value.trim();
            const status = $('dfStatusSelect').value;

            const submitBtn = $('saveDataFetchBtn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';
            }

            try {
                const res = await callFunction({
                    action: 'add_data_fetch',
                    custom_id,
                    employee_name,
                    email,
                    customer_account_name,
                    ifsc,
                    account_number,
                    amount: amount || 0,
                    status
                });
                if (res.status !== 'Success') throw new Error(res.message || 'Failed to save record');
                closeDataFetchModal();
                dataFetchForm.reset();
                showSyncToast('✅ Custom module record created successfully!', 'success');
                await loadData();
            } catch (err) {
                alert('Error creating custom module record: ' + (err.message || 'Error'));
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Save Record to Zoho & DB';
                }
            }
        };
    }

    // =========================================================================
    // Zia AI Assistant & Receipt OCR System (Powered by zia_function)
    // =========================================================================
    let ziaInitialized = false;

    function formatZiaMarkdown(text) {
        if (!text) return '';
        let escaped = escapeHtml(text);
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        escaped = escaped.replace(/^[•\-]\s+(.*)$/gm, '<li>$1</li>');
        escaped = escaped.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        return escaped.split('\n\n').map(p => p.startsWith('<ul>') ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    }

    function getStatusTagClass(status) {
        const s = String(status || '').toLowerCase();
        if (s.includes('init') || s.includes('draft') || s.includes('start')) return 'tag-initiated';
        if (s.includes('active') || s.includes('progress') || s.includes('pend')) return 'tag-active';
        if (s.includes('review') || s.includes('audit')) return 'tag-review';
        if (s.includes('approv') || s.includes('done') || s.includes('reimburs')) return 'tag-approved';
        return 'tag-active';
    }

    function renderInlineFlowChartHtml(flowData) {
        if (!flowData || !Array.isArray(flowData.steps)) return '';
        const stepsHtml = flowData.steps.map((step, idx) => {
            const isLast = idx === flowData.steps.length - 1;
            const tagClass = getStatusTagClass(step.status);
            return `
              <div class="timeline-step-node">
                <div class="timeline-rail">
                  <div class="timeline-number-badge">${step.step || idx + 1}</div>
                  ${isLast ? '' : '<div class="timeline-connector-line"></div>'}
                </div>
                <div class="timeline-step-card">
                  <div class="timeline-step-header">
                    <span class="timeline-step-name">${escapeHtml(step.name || '')}</span>
                    <span class="timeline-step-tag ${tagClass}">${escapeHtml(step.status || 'Active')}</span>
                  </div>
                  <div class="timeline-step-desc">${escapeHtml(step.desc || '')}</div>
                  ${step.role ? `<div class="timeline-step-role"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${escapeHtml(step.role)}</div>` : ''}
                </div>
              </div>
            `;
        }).join('');

        return `
          <div class="chat-flowchart-card">
            <div class="chat-flowchart-header">
              <div class="chat-flowchart-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="6" height="6" rx="1.5"></rect>
                  <rect x="15" y="3" width="6" height="6" rx="1.5"></rect>
                  <rect x="9" y="15" width="6" height="6" rx="1.5"></rect>
                  <path d="M6 9v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9"></path>
                  <path d="M12 15v-3"></path>
                </svg>
              </div>
              <div class="chat-flowchart-info">
                <div class="chat-flowchart-title">${escapeHtml(flowData.title || 'Workflow Timeline')}</div>
                <div class="chat-flowchart-summary">${escapeHtml(flowData.summary || '')}</div>
              </div>
              <span class="chat-flowchart-count-badge">${flowData.steps.length} Stages</span>
            </div>
            <div class="chat-flowchart-timeline">
              ${stepsHtml}
            </div>
          </div>
        `;
    }

    function renderInlineChart(chartData, container) {
        if (!chartData || !chartData.labels || !chartData.data) return;
        const card = document.createElement('div');
        card.className = 'chat-chart-card';
        const canvasId = `ziaChart_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        card.innerHTML = `
          <div class="chat-chart-header">
            <span>📊</span>
            <span>${escapeHtml(chartData.title || 'Spending Distribution')}</span>
          </div>
          <div class="chat-chart-canvas-wrap">
            <canvas id="${canvasId}"></canvas>
          </div>
        `;
        container.appendChild(card);

        setTimeout(() => {
            const canvas = document.getElementById(canvasId);
            if (!canvas || !window.Chart) return;
            const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];
            new window.Chart(canvas, {
                type: chartData.type || 'doughnut',
                data: {
                    labels: chartData.labels,
                    datasets: [{
                        label: 'Amount (₹)',
                        data: chartData.data,
                        backgroundColor: colors.slice(0, chartData.labels.length),
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { boxWidth: 12, font: { size: 11 } }
                        }
                    }
                }
            });
        }, 60);
    }

    function appendZiaChatMessage(role, content, followUps = [], extra = {}) {
        const chatWindow = $('ziaChatWindow');
        if (!chatWindow) return;

        const bubble = document.createElement('div');
        bubble.className = `chat-bubble bubble-${role}`;

        const avatar = document.createElement('div');
        avatar.className = 'bubble-avatar';
        avatar.textContent = role === 'user' ? '👤' : '✨';

        const body = document.createElement('div');
        body.className = 'bubble-content';
        body.innerHTML = role === 'user' ? `<p>${escapeHtml(content)}</p>` : formatZiaMarkdown(content);

        // Inject Interactive Dynamic Flowchart if provided by Zia
        if (extra && extra.flowchart) {
            const flowWrapper = document.createElement('div');
            flowWrapper.innerHTML = renderInlineFlowChartHtml(extra.flowchart);
            body.appendChild(flowWrapper);
        }

        // Inject Interactive Dynamic Chart.js if provided by Zia
        if (extra && extra.chart) {
            renderInlineChart(extra.chart, body);
        }

        if (Array.isArray(followUps) && followUps.length > 0) {
            const followUpWrap = document.createElement('div');
            followUpWrap.className = 'bubble-followups';
            followUps.forEach(q => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'bubble-followup-chip';
                chip.textContent = q;
                chip.onclick = () => {
                    if (q.includes('Approve safe') || q.includes('Auto-Approve')) {
                        const autoBtn = $('ziaAutoApproveSafeBtn');
                        if (autoBtn) autoBtn.click();
                        else sendZiaQuery(q);
                    } else {
                        sendZiaQuery(q);
                    }
                };
                followUpWrap.appendChild(chip);
            });
            body.appendChild(followUpWrap);
        }

        bubble.appendChild(avatar);
        bubble.appendChild(body);
        chatWindow.appendChild(bubble);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    async function sendZiaQuery(query) {
        if (!query || !query.trim()) return;
        const text = query.trim();
        appendZiaChatMessage('user', text);

        const chatWindow = $('ziaChatWindow');
        const typingEl = document.createElement('div');
        typingEl.className = 'chat-bubble bubble-zia';
        typingEl.id = 'ziaTypingIndicator';
        typingEl.innerHTML = `<div class="bubble-avatar">✨</div><div class="bubble-content" style="color: #9333ea; font-style: italic;">Zia is analyzing Datastore records...</div>`;
        if (chatWindow) {
            chatWindow.appendChild(typingEl);
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }

        const sendBtn = $('ziaSendBtn');
        const input = $('ziaChatInput');
        if (sendBtn) sendBtn.disabled = true;
        if (input) input.value = '';

        try {
            const res = await callZia({ action: 'zia_chat', query: text });
            if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
            if (res?.status !== 'Success') throw new Error(res?.message || 'Error querying Zia');
            appendZiaChatMessage('zia', res.answer, res.suggestedFollowUps || [], { flowchart: res.flowchart, chart: res.chart });
        } catch (err) {
            if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
            appendZiaChatMessage('zia', `⚠️ **Zia Assistant Error:** ${err.message || 'Unable to retrieve insights.'}`);
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    }

    async function loadZiaAudit() {
        const auditBtn = $('ziaAuditRefreshBtn');
        const headerAuditBtn = $('ziaRunAuditHeaderBtn');
        const anomalyContainer = $('ziaAnomalyList');
        if (auditBtn) auditBtn.textContent = 'Auditing...';
        if (headerAuditBtn) headerAuditBtn.textContent = 'Auditing...';

        try {
            const res = await callZia({ action: 'zia_anomaly_audit' });
            if (res?.status === 'Success') {
                if ($('ziaComplianceScore')) $('ziaComplianceScore').textContent = `${res.healthScore || 95}%`;
                if ($('ziaKpiRiskCount')) {
                    const count = (res.anomalies || []).length;
                    $('ziaKpiRiskCount').textContent = count === 0 ? '0 Alerts' : `${count} Alerts`;
                    $('ziaKpiRiskCount').style.color = count === 0 ? '#10b981' : '#f59e0b';
                }

                if (anomalyContainer) {
                    anomalyContainer.innerHTML = '';
                    const anomalies = res.anomalies || [];
                    if (anomalies.length === 0) {
                        anomalyContainer.innerHTML = `
                            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; text-align: center; color: #166534; font-size: 13px;">
                                ✅ <strong>100% Policy Adherence:</strong> No expense violations, high-value outliers, or duplicate claims found in active records!
                            </div>
                        `;
                    } else {
                        anomalies.forEach(a => {
                            const item = document.createElement('div');
                            item.className = `anomaly-item severity-${a.severity || 'INFO'}`;
                            item.innerHTML = `
                                <div class="anomaly-title-row">
                                    <span>${escapeHtml(a.title)}</span>
                                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase;">${escapeHtml(a.severity)}</span>
                                </div>
                                <div class="anomaly-desc">${escapeHtml(a.description)}</div>
                                <div style="margin-top: 6px; font-size: 11.5px; color: #4338ca; font-weight: 500;">
                                    💡 Recommendation: ${escapeHtml(a.action_recommended || 'Review claim')}
                                </div>
                            `;
                            anomalyContainer.appendChild(item);
                        });
                    }
                }
            }
        } catch (err) {
            console.warn('[Zia] Audit error:', err);
        } finally {
            if (auditBtn) auditBtn.textContent = 'Run Audit';
            if (headerAuditBtn) headerAuditBtn.textContent = '🛡️ Audit Expenses';
        }
    }

    function initZiaView() {
        if (ziaInitialized) return;
        ziaInitialized = true;

        const chatWindow = $('ziaChatWindow');
        if (chatWindow && !chatWindow.children.length) {
            appendZiaChatMessage('zia',
                `✨ **Welcome to Zia AI Assistant for Zoho Expense!**\n\nI am your intelligent enterprise financial co-pilot powered by Zoho Catalyst Zia.\n\nHere is how I can assist you:\n• **Financial Q&A:** Ask about spending totals, budgets, departments, or vendors\n• **Receipt Scanner:** Drop a bill or invoice to extract amounts, dates, and categories instantly\n• **Policy Audits:** Automatically flag duplicates, high-value outliers, and unapproved claims\n\nClick any quick prompt below or type your question!`,
                ['Executive Spend Summary', 'Check policy anomalies', 'Show IT and Software spending', 'Reports awaiting approval']
            );
        }

        loadZiaAudit();

        const chatForm = $('ziaChatForm');
        if (chatForm) {
            chatForm.onsubmit = (e) => {
                e.preventDefault();
                const input = $('ziaChatInput');
                if (input && input.value.trim()) {
                    sendZiaQuery(input.value.trim());
                }
            };
        }

        const promptPills = $('ziaPromptPills');
        if (promptPills) {
            promptPills.querySelectorAll('.zia-pill-btn').forEach(btn => {
                btn.onclick = () => {
                    const q = btn.getAttribute('data-query');
                    if (q) sendZiaQuery(q);
                };
            });
        }

        const clearBtn = $('ziaClearChatBtn');
        if (clearBtn) {
            clearBtn.onclick = () => {
                if (chatWindow) chatWindow.innerHTML = '';
                appendZiaChatMessage('zia', 'Chat history cleared. How can I assist you with your expense operations?');
            };
        }

        const auditHeaderBtn = $('ziaRunAuditHeaderBtn');
        if (auditHeaderBtn) auditHeaderBtn.onclick = loadZiaAudit;
        const auditRefreshBtn = $('ziaAuditRefreshBtn');
        if (auditRefreshBtn) auditRefreshBtn.onclick = loadZiaAudit;

        const dropzone = $('ziaOcrDropzone');
        const fileInput = $('ziaReceiptFileInput');
        if (dropzone && fileInput) {
            dropzone.onclick = () => fileInput.click();
            fileInput.onchange = (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async () => {
                    showSyncToast('📸 Zia is scanning and extracting receipt data...', 'info');
                    try {
                        const res = await callZia({ action: 'zia_ocr_scan', receipt_base64: reader.result });
                        if (res?.status !== 'Success' || !res?.extracted) throw new Error(res?.message || 'OCR extraction failed');
                        displayOcrResult(res.extracted);
                        showSyncToast(`✅ Extracted: ${res.extracted.merchant} (₹${res.extracted.amount})`, 'success');
                    } catch (err) {
                        showSyncToast('❌ OCR Error: ' + (err.message || 'Error scanning receipt'), 'error');
                    }
                };
                reader.readAsDataURL(file);
            };
        }

        const sampleBtn = $('ziaSampleReceiptBtn');
        if (sampleBtn) {
            sampleBtn.onclick = async () => {
                showSyncToast('📸 Processing sample receipt with Zia OCR...', 'info');
                try {
                    const res = await callZia({ action: 'zia_ocr_scan' });
                    if (res?.status !== 'Success' || !res?.extracted) throw new Error(res?.message || 'Sample scan failed');
                    displayOcrResult(res.extracted);
                    showSyncToast(`✅ Extracted: ${res.extracted.merchant} (₹${res.extracted.amount})`, 'success');
                } catch (err) {
                    showSyncToast('❌ Error: ' + (err.message || 'Error processing sample'), 'error');
                }
            };
        }

        function displayOcrResult(extracted) {
            const card = $('ziaOcrResultCard');
            if (!card) return;
            card.style.display = 'block';

            if ($('ocrMerchantInput')) $('ocrMerchantInput').value = extracted.merchant || '';
            if ($('ocrAmountInput')) $('ocrAmountInput').value = extracted.amount || '';
            if ($('ocrDateInput')) $('ocrDateInput').value = extracted.date || new Date().toISOString().split('T')[0];
            if ($('ocrCategorySelect') && extracted.category) {
                $('ocrCategorySelect').value = extracted.category;
            }
            if ($('ocrConfidencePill')) {
                const pct = Math.round((extracted.confidence || 0.94) * 100);
                $('ocrConfidencePill').textContent = `${pct}% Confidence`;
            }
            if ($('ocrSourceBadge')) {
                $('ocrSourceBadge').textContent = extracted.ocr_source || 'Zia OCR';
            }
        }

        const createExpenseBtn = $('ocrCreateExpenseBtn');
        if (createExpenseBtn) {
            createExpenseBtn.onclick = async () => {
                const merchant = ($('ocrMerchantInput')?.value || '').trim();
                const amount = parseFloat($('ocrAmountInput')?.value || '0');
                const date = $('ocrDateInput')?.value || new Date().toISOString().split('T')[0];
                const category = $('ocrCategorySelect')?.value || 'Office Supplies';

                if (!merchant || !amount) {
                    alert('Please ensure merchant and amount are valid.');
                    return;
                }

                createExpenseBtn.disabled = true;
                createExpenseBtn.textContent = 'Filing Expense...';

                try {
                    const res = await callFunction({
                        action: 'add_expense',
                        Merchant: merchant,
                        Amount: amount,
                        Expense_date: date,
                        Category: category,
                        Description: 'Filed automatically via Catalyst Zia Smart OCR Scanner'
                    });
                    if (res?.status !== 'Success') throw new Error(res?.message || 'Failed to file expense');
                    showSyncToast(`✅ Filed expense ₹${amount} for "${merchant}" to Zoho Expense & Catalyst!`, 'success');
                    if ($('ziaOcrResultCard')) $('ziaOcrResultCard').style.display = 'none';
                    await loadData(false);
                    loadZiaAudit();
                } catch (err) {
                    alert('Failed to file expense: ' + (err.message || 'Error'));
                } finally {
                    createExpenseBtn.disabled = false;
                    createExpenseBtn.textContent = '➕ File Expense to Zoho & DB';
                }
            };
        }

        const dismissBtn = $('ocrResetBtn');
        if (dismissBtn) {
            dismissBtn.onclick = () => {
                if ($('ziaOcrResultCard')) $('ziaOcrResultCard').style.display = 'none';
            };
        }

        // Voice Input (Speech-to-Expense powered by Catalyst Zia NLP)
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        let recognition = null;
        if (SpeechRec) {
            recognition = new SpeechRec();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-IN';
        }

        function startListening(targetMode = 'chat') {
            if (!recognition) {
                alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
                return;
            }
            const vBtn = $('ziaVoiceBtn');
            const hVoiceBtn = $('ziaVoiceExpenseHeroBtn');
            if (vBtn) vBtn.classList.add('listening');
            if (hVoiceBtn) hVoiceBtn.textContent = '🔴 Listening...';
            showSyncToast('🎙️ Listening... Speak your expense claim or question now!', 'info');

            recognition.onresult = async (event) => {
                const transcript = event.results[0][0].transcript;
                showSyncToast(`🎙️ Heard: "${transcript}"`, 'info');
                if (targetMode === 'voice_claim') {
                    showSyncToast('🧠 Zia is extracting your voice claim details...', 'info');
                    try {
                        const parsed = await callZia({ action: 'zia_parse_voice', transcript });
                        if (parsed?.status === 'Success') {
                            displayOcrResult({
                                merchant: parsed.merchant,
                                amount: parsed.amount,
                                date: parsed.date,
                                category: parsed.category,
                                confidence: parsed.confidence,
                                ocr_source: 'Zia Voice NLP Engine'
                            });
                            showSyncToast(`✅ Zia parsed claim: ₹${parsed.amount} for "${parsed.merchant}"`, 'success');
                        }
                    } catch (err) {
                        showSyncToast('❌ Failed to parse voice claim: ' + err.message, 'error');
                    }
                } else {
                    const input = $('ziaChatInput');
                    if (input) input.value = transcript;
                    sendZiaQuery(transcript);
                }
            };

            recognition.onerror = () => {
                showSyncToast('⚠️ Voice recognition ended or canceled.', 'info');
            };

            recognition.onend = () => {
                if (vBtn) vBtn.classList.remove('listening');
                if (hVoiceBtn) hVoiceBtn.textContent = '🎙️ Voice Claim';
            };

            try {
                recognition.start();
            } catch {
                recognition.stop();
            }
        }

        const voiceBtn = $('ziaVoiceBtn');
        if (voiceBtn) voiceBtn.onclick = () => startListening('chat');

        const heroVoiceBtn = $('ziaVoiceExpenseHeroBtn');
        if (heroVoiceBtn) heroVoiceBtn.onclick = () => startListening('voice_claim');

        // Zia 1-Click Auto-Approve Safe Expenses
        const autoApproveBtn = $('ziaAutoApproveSafeBtn');
        if (autoApproveBtn) {
            autoApproveBtn.onclick = async () => {
                if (!confirm('Let Zia automatically verify and approve all low-risk pending claims (≤ ₹5,000) that have zero policy flags?')) return;
                autoApproveBtn.disabled = true;
                autoApproveBtn.textContent = '⚡ Approving...';
                try {
                    const res = await callZia({ action: 'zia_auto_approve_safe', threshold: 5000 });
                    if (res?.status !== 'Success') throw new Error(res?.message || 'Auto-approve failed');
                    showSyncToast(res.message || '✅ Zia auto-approved low-risk expenses!', 'success');
                    await loadData(false);
                    loadZiaAudit();
                } catch (err) {
                    alert('Auto-approve error: ' + (err.message || 'Error'));
                } finally {
                    autoApproveBtn.disabled = false;
                    autoApproveBtn.textContent = '⚡ Auto-Approve Safe';
                }
            };
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
                    alert(`Access denied: "${activeEmail}" is not an authorized Zoho Expense member.`);
                }
                await signOutToLogin();
                return;
            }

            const displayName = check.user?.Emp_name || catalystName || activeEmail.split('@')[0];
            const emailStr = (check.email || activeEmail).toLowerCase();
            const userRole = (check.user?.Role || 'submitter').toLowerCase();

            currentLoggedInUser = {
                name: displayName,
                email: emailStr,
                role: userRole
            };

            if (currentUserEl) {
                currentUserEl.textContent = `${displayName} (${emailStr})`;
            }
            if (userInitialEl) {
                userInitialEl.textContent = (displayName[0] || 'U').toUpperCase();
            }

            // Sync with Zoho Expense and load data for current user
            await loadData(true);
        } catch {
            window.location.replace(LOGIN_URL);
        }
    })();
});
