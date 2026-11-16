const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

async function exportAllData() {
    console.log('Fetching all live data from Catalyst Datastore...');
    const res = await fetch('https://management-60094939168.development.catalystserverless.in/server/management_function/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getAll' })
    });

    const raw = await res.json();
    const data = typeof raw.output === 'string' ? JSON.parse(raw.output) : raw.output;

    const exportDir = path.join(__dirname, 'exports');
    const clientExportDir = path.join(__dirname, 'client', 'exports');
    const distExportDir = path.join(__dirname, 'dist', 'exports');

    [exportDir, clientExportDir, distExportDir].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    // Create a new Excel Workbook for Zoho Sheet
    const workbook = xlsx.utils.book_new();

    const tables = [
        {
            key: 'expenses',
            sheetName: 'Expenses',
            fileName: 'Expenses.csv',
            mapper: (e) => ({
                'Expense ID (ROWID)': e.ROWID,
                'Zoho Expense ID': e.Zoho_expense_id || '',
                'Expense Name / Merchant': e.Expense_name || e.Merchant || '',
                'Category': e.Category || '',
                'Amount (INR)': Number(e.Amount) || 0,
                'Expense Date': e.Expense_date || '',
                'Paid By': e.Paid_by || '',
                'Status': e.Status || '',
                'Created Time': e.CREATEDTIME || '',
                'Modified Time': e.MODIFIEDTIME || ''
            })
        },
        {
            key: 'reports',
            sheetName: 'Reports',
            fileName: 'Reports.csv',
            mapper: (r) => ({
                'Report ID (ROWID)': r.ROWID,
                'Report Number': r.Report_number || '',
                'Report Name': r.Report_name || '',
                'Submitter Name': r.Submitter_name || '',
                'Submitter Email': r.Submitter_email || '',
                'Total Amount (INR)': Number(r.Total_amount) || 0,
                'Status': r.Status || '',
                'Approval Level': r.Approval_level || '',
                'Start Date': r.Start_date || '',
                'End Date': r.End_date || '',
                'Created Time': r.CREATEDTIME || '',
                'Modified Time': r.MODIFIEDTIME || ''
            })
        },
        {
            key: 'trips',
            sheetName: 'Trips',
            fileName: 'Trips.csv',
            mapper: (t) => ({
                'Trip ID (ROWID)': t.ROWID,
                'Trip Number': t.Trip_number || '',
                'Trip Name': t.Trip_name || '',
                'Submitter': t.Submitter || '',
                'Departure City': t.Departure || '',
                'Destination City': t.Destination || '',
                'Budget (INR)': Number(t.Budget) || 0,
                'Start Date': t.Start_date || '',
                'End Date': t.End_date || '',
                'Status': t.Status || '',
                'Created Time': t.CREATEDTIME || '',
                'Modified Time': t.MODIFIEDTIME || ''
            })
        },
        {
            key: 'advances',
            sheetName: 'Advances',
            fileName: 'Advances.csv',
            mapper: (a) => ({
                'Advance ID (ROWID)': a.ROWID,
                'Advance Number': a.Advance_number || '',
                'Employee Name': a.Employee_name || '',
                'Employee Email': a.Employee_email || '',
                'Amount (INR)': Number(a.Amount) || 0,
                'Reason / Purpose': a.Reason || '',
                'Advance Date': a.Advance_date || '',
                'Status': a.Status || '',
                'Approval Level': a.Approval_level || '',
                'Created Time': a.CREATEDTIME || '',
                'Modified Time': a.MODIFIEDTIME || ''
            })
        },
        {
            key: 'cards',
            sheetName: 'Corporate Cards',
            fileName: 'Cards.csv',
            mapper: (c) => ({
                'Card ID (ROWID)': c.ROWID,
                'Cardholder Name': c.Cardholder_name || '',
                'Bank Name': c.Bank_name || '',
                'Card Type': c.Card_type || '',
                'Card Number': c.Card_number || '',
                'Total Spend (INR)': Number(c.Total_spend) || 0,
                'Status': c.Status || '',
                'Created Time': c.CREATEDTIME || '',
                'Modified Time': c.MODIFIEDTIME || ''
            })
        },
        {
            key: 'purchaseRequests',
            sheetName: 'Purchase Requests',
            fileName: 'Purchase_Requests.csv',
            mapper: (p) => ({
                'Request ID (ROWID)': p.ROWID,
                'Item Name': p.Item_name || '',
                'Requester': p.Requester || '',
                'Department': p.Department || '',
                'Vendor': p.Vendor || '',
                'Amount (INR)': Number(p.Amount) || 0,
                'Request Date': p.Request_date || '',
                'Status': p.Status || '',
                'Approval Level': p.Approval_level || '',
                'Created Time': p.CREATEDTIME || '',
                'Modified Time': p.MODIFIEDTIME || ''
            })
        },
        {
            key: 'appUsers',
            sheetName: 'App Users',
            fileName: 'App_Users.csv',
            mapper: (u) => ({
                'User ID (ROWID)': u.ROWID,
                'Zoho User ID': u.Zoho_user_id || '',
                'Employee Name': u.Emp_name || '',
                'Employee Email': u.emp_mail || '',
                'Role': u.Role || '',
                'Created Time': u.CREATEDTIME || '',
                'Modified Time': u.MODIFIEDTIME || ''
            })
        }
    ];

    const summaryRows = [];

    for (const t of tables) {
        const rawList = data[t.key] || [];
        const mappedList = rawList.map(t.mapper);

        console.log(`Processing table "${t.sheetName}": ${mappedList.length} rows`);

        // 1. Create SheetJS worksheet and append to workbook
        const worksheet = xlsx.utils.json_to_sheet(mappedList);
        xlsx.utils.book_append_sheet(workbook, worksheet, t.sheetName);

        // 2. Export individual CSV
        const csvContent = xlsx.utils.sheet_to_csv(worksheet);
        fs.writeFileSync(path.join(exportDir, t.fileName), csvContent, 'utf-8');
        fs.writeFileSync(path.join(clientExportDir, t.fileName), csvContent, 'utf-8');
        fs.writeFileSync(path.join(distExportDir, t.fileName), csvContent, 'utf-8');

        summaryRows.push({
            'Module / Entity': t.sheetName,
            'Exported File': t.fileName,
            'Total Records': mappedList.length,
            'Status': 'Successfully Exported'
        });
    }

    // Add Summary sheet as the first tab
    const summarySheet = xlsx.utils.json_to_sheet(summaryRows);
    xlsx.utils.book_append_sheet(workbook, summarySheet, 'Export Summary');

    // Reorder sheets so 'Export Summary' is first
    const sheetOrder = ['Export Summary', ...tables.map(t => t.sheetName)];
    workbook.SheetNames = sheetOrder;

    // Write multi-sheet .xlsx workbook
    const xlsxFileName = 'Zoho_Expense_Catalyst_Full_Export.xlsx';
    const mainXlsxPath = path.join(exportDir, xlsxFileName);
    xlsx.writeFile(workbook, mainXlsxPath);
    xlsx.writeFile(workbook, path.join(clientExportDir, xlsxFileName));
    xlsx.writeFile(workbook, path.join(distExportDir, xlsxFileName));

    console.log(`\n✓ SUCCESS! Full multi-sheet workbook created: ${mainXlsxPath}`);
    console.log('✓ All CSV files and XLSX spreadsheet exported successfully.');
}

exportAllData().catch(err => {
    console.error('Error during data export:', err);
    process.exit(1);
});
