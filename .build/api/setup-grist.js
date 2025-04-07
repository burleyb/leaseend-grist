"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const grist_functions_1 = require("../lib/grist-functions");
// Put here the URL of your document.
const GRIST_URL = "http://localhost:8484/api";
const handler = async (event) => {
    const api = (0, grist_functions_1.initializeGristAPI)();
    try {
        // Initialize organization
        const org = await (0, grist_functions_1.getOrg)(api);
        // Clean up existing home workspace
        await (0, grist_functions_1.cleanupHomeWorkspace)(api, org);
        // Create financial workspaces
        const workspaces = await (0, grist_functions_1.createFinancialWorkspaces)(api, org);
        // Create Income Statement document and table
        const incomeStatementDoc = await (0, grist_functions_1.getOrCreateDocument)(api, workspaces.incomeStatement, grist_functions_1.INCOME_STATEMENT_DOC_NAME);
        await api.setDocId(incomeStatementDoc.id);
        const incomeStatementTable = await (0, grist_functions_1.createIncomeStatementTable)(api, incomeStatementDoc);
        await (0, grist_functions_1.addSampleIncomeData)(api, "Income_Statement", incomeStatementDoc);
        // Create Balance Sheet document
        const balanceSheetDoc = await api.createDoc({
            workspaceId: workspaces.balanceSheet.id,
            name: 'Balance Sheet'
        });
        console.log("[Created doc]", balanceSheetDoc);
        // Create Cash Flow document
        const cashFlowDoc = await api.createDoc({
            workspaceId: workspaces.cashFlow.id,
            name: 'Cash Flow'
        });
        console.log("[Created doc]", cashFlowDoc);
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Go Serverless v3.0! Your function executed successfully!',
                input: event,
            }, null, 2),
        };
    }
    catch (error) {
        console.error(error, api);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Error',
                error: error,
            }),
        };
    }
};
exports.handler = handler;
