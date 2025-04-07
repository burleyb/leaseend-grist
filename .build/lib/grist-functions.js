"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSampleIncomeData = exports.createIncomeStatementTable = exports.getOrCreateDocument = exports.createFinancialWorkspaces = exports.getOrCreateWorkspace = exports.cleanupHomeWorkspace = exports.getOrg = exports.initializeGristAPI = exports.INCOME_STATEMENT_TABLE_NAME = exports.CASH_FLOW_DOC_NAME = exports.BALANCE_SHEET_DOC_NAME = exports.INCOME_STATEMENT_DOC_NAME = exports.HOME_WORKSPACE_NAME = exports.CASH_FLOW_WORKSPACE_NAME = exports.BALANCE_SHEET_WORKSPACE_NAME = exports.INCOME_STATEMENT_WORKSPACE_NAME = exports.LEASE_END_ORG_NAME = exports.GRIST_URL = void 0;
const grist_api_1 = require("grist-api");
const logger = __importStar(require("leo-logger"));
// Constants
exports.GRIST_URL = process.env.GRIST_URL || "http://localhost:8484/api";
exports.LEASE_END_ORG_NAME = process.env.LEASE_END_ORG_NAME || "Lease End - Finance";
exports.INCOME_STATEMENT_WORKSPACE_NAME = process.env.INCOME_STATEMENT_WORKSPACE_NAME || "Income Statement";
exports.BALANCE_SHEET_WORKSPACE_NAME = process.env.BALANCE_SHEET_WORKSPACE_NAME || "Balance Sheet";
exports.CASH_FLOW_WORKSPACE_NAME = process.env.CASH_FLOW_WORKSPACE_NAME || "Cash Flow";
exports.HOME_WORKSPACE_NAME = "Home";
exports.INCOME_STATEMENT_DOC_NAME = "Income Statement";
exports.BALANCE_SHEET_DOC_NAME = "Balance Sheet";
exports.CASH_FLOW_DOC_NAME = "Cash Flow";
exports.INCOME_STATEMENT_TABLE_NAME = "Income_Statement";
// Initialize the Grist API client
const initializeGristAPI = () => {
    return new grist_api_1.GristDocAPI({ server: exports.GRIST_URL });
};
exports.initializeGristAPI = initializeGristAPI;
// Get or create the LeaseEnd organization
const getOrg = async (api) => {
    const org = await api.getOrgByName({ name: exports.LEASE_END_ORG_NAME });
    if (!org) {
        throw new Error("Organization not found - looking for " + exports.LEASE_END_ORG_NAME);
    }
    logger.info("[Found org]", org);
    await api.setOrgId(org.id);
    return org;
};
exports.getOrg = getOrg;
// Clean up existing home workspace if it exists
const cleanupHomeWorkspace = async (api, org) => {
    const homeWorkspace = await api.getWorkspaceByName({ name: exports.HOME_WORKSPACE_NAME, orgId: org.id });
    logger.info("[Found workspace]", homeWorkspace);
    if (homeWorkspace) {
        await api.deleteWorkspace({ workspaceId: homeWorkspace.id });
        logger.info("[Deleted workspace]", homeWorkspace);
    }
};
exports.cleanupHomeWorkspace = cleanupHomeWorkspace;
// Get or create a workspace
const getOrCreateWorkspace = async (api, org, workspaceName) => {
    try {
        let workspace = await api.getWorkspaceByName({ name: workspaceName, orgId: org.id });
        logger.info(`[Found ${workspaceName} workspace]`, workspace);
        if (!workspace) {
            const workspaceId = await api.createWorkspace({ orgId: org.id, name: workspaceName });
            logger.info(`[Created ${workspaceName} workspace]`, workspaceId);
            workspace = await api.getWorkspaceByName({ name: workspaceName, orgId: org.id });
        }
        if (!workspace) {
            throw new Error("Workspace not found - looking for " + workspaceName);
        }
        return workspace;
    }
    catch (error) {
        logger.error("[Error getting workspace]", error);
        throw error;
    }
};
exports.getOrCreateWorkspace = getOrCreateWorkspace;
// Create workspaces for financial statements
const createFinancialWorkspaces = async (api, org) => {
    try {
        const workspaces = {
            incomeStatement: await (0, exports.getOrCreateWorkspace)(api, org, exports.INCOME_STATEMENT_WORKSPACE_NAME),
            balanceSheet: await (0, exports.getOrCreateWorkspace)(api, org, exports.BALANCE_SHEET_WORKSPACE_NAME),
            cashFlow: await (0, exports.getOrCreateWorkspace)(api, org, exports.CASH_FLOW_WORKSPACE_NAME)
        };
        return workspaces;
    }
    catch (error) {
        logger.error("[Error creating workspaces]", error);
        throw error;
    }
};
exports.createFinancialWorkspaces = createFinancialWorkspaces;
// Create or get a document in a workspace
const getOrCreateDocument = async (api, workspace, docName) => {
    try {
        let doc = await api.getDocByName({ name: docName, workspaceId: workspace.id });
        logger.info(`[Found ${docName} doc]`, doc);
        if (!doc) {
            const docId = await api.createDoc({ workspaceId: workspace.id, name: docName });
            logger.info(`[Created ${docName} doc]`, docId);
            doc = await api.getDocByName({ name: docName, workspaceId: workspace.id });
        }
        if (!doc) {
            throw new Error("Document not found - looking for " + docName);
        }
        return doc;
    }
    catch (error) {
        logger.error("[Error getting document]", error);
        throw error;
    }
};
exports.getOrCreateDocument = getOrCreateDocument;
// Create the income statement table schema
const createIncomeStatementTable = async (api, doc) => {
    try {
        let table = await api.getTableByName({ name: exports.INCOME_STATEMENT_TABLE_NAME, docId: doc.id });
        logger.info("[Found incomeStatementTable]", table);
        if (!table) {
            const tableId = await api.createTable({
                docId: doc.id,
                schema: {
                    tables: [{
                            id: exports.INCOME_STATEMENT_TABLE_NAME,
                            columns: [
                                { id: "date", fields: { label: "Date" } },
                                { id: "revenue", fields: { label: "Revenue" } },
                                { id: "costOfGoodsSold", fields: { label: "Cost of Goods Sold" } },
                                { id: "grossProfit", fields: { label: "Gross Profit" } },
                                { id: "operatingExpenses", fields: { label: "Operating Expenses" } },
                                { id: "netIncome", fields: { label: "Net Income" } }
                            ]
                        }]
                }
            });
            logger.info("[Created table]", tableId);
            table = await api.getTableByName({ name: exports.INCOME_STATEMENT_TABLE_NAME, docId: doc.id });
        }
        if (!table) {
            throw new Error("Table not found - looking for " + exports.INCOME_STATEMENT_TABLE_NAME);
        }
        return table;
    }
    catch (error) {
        logger.error("[Error creating income statement table]", error);
        throw error;
    }
};
exports.createIncomeStatementTable = createIncomeStatementTable;
// Add sample data to the income statement
const addSampleIncomeData = async (api, tableName, doc) => {
    try {
        const sampleData = [
            {
                date: '2024-01-01',
                revenue: 1000,
                costOfGoodsSold: 500,
                grossProfit: 500,
                operatingExpenses: 200,
                netIncome: 300
            },
            {
                date: '2024-01-02',
                revenue: 1000,
                costOfGoodsSold: 500,
                grossProfit: 500,
                operatingExpenses: 200,
                netIncome: 300
            }
        ];
        await api.addRecords({
            tableName,
            records: sampleData
        });
    }
    catch (error) {
        logger.error("[Error adding sample data]", error);
        throw error;
    }
};
exports.addSampleIncomeData = addSampleIncomeData;
