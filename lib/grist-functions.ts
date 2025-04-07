import { GristDocAPI, IWorkspace, IOrg, IDoc, ITable, IRecord } from 'grist-api';
import * as logger from 'leo-logger';

// Constants
export const GRIST_URL = process.env.GRIST_URL || "http://localhost:8484/api";
export const LEASE_END_ORG_NAME = process.env.LEASE_END_ORG_NAME || "Lease End - Finance";
export const INCOME_STATEMENT_WORKSPACE_NAME = process.env.INCOME_STATEMENT_WORKSPACE_NAME || "Income Statement";
export const BALANCE_SHEET_WORKSPACE_NAME = process.env.BALANCE_SHEET_WORKSPACE_NAME || "Balance Sheet";
export const CASH_FLOW_WORKSPACE_NAME = process.env.CASH_FLOW_WORKSPACE_NAME || "Cash Flow";

export const HOME_WORKSPACE_NAME = "Home";
export const INCOME_STATEMENT_DOC_NAME = "Income Statement";
export const BALANCE_SHEET_DOC_NAME = "Balance Sheet";
export const CASH_FLOW_DOC_NAME = "Cash Flow";
export const INCOME_STATEMENT_TABLE_NAME = "Income_Statement";

// Types
interface IFinancialWorkspaces {
  incomeStatement: IWorkspace;
  balanceSheet: IWorkspace;
  cashFlow: IWorkspace;
}

interface IIncomeStatementRecord {
  date: string;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: number;
  netIncome: number;
}

// Initialize the Grist API client
export const initializeGristAPI = (): GristDocAPI => {
  return new GristDocAPI({ server: GRIST_URL });
};

// Get or create the LeaseEnd organization
export const getOrg = async (api: GristDocAPI): Promise<IOrg> => {
  const org = await api.getOrgByName({ name: LEASE_END_ORG_NAME });
  if(!org) {
    throw new Error("Organization not found - looking for " + LEASE_END_ORG_NAME);
  }
  logger.info("[Found org]", org);
  await api.setOrgId(org.id);
  return org;
};

// Clean up existing home workspace if it exists
export const cleanupHomeWorkspace = async (api: GristDocAPI, org: IOrg): Promise<void> => {
  const homeWorkspace = await api.getWorkspaceByName({ name: HOME_WORKSPACE_NAME, orgId: org.id });
  logger.info("[Found workspace]", homeWorkspace);
  if(homeWorkspace) {
    await api.deleteWorkspace({ workspaceId: homeWorkspace.id });
    logger.info("[Deleted workspace]", homeWorkspace);
  }
};

// Get or create a workspace
export const getOrCreateWorkspace = async (
  api: GristDocAPI,
  org: IOrg,
  workspaceName: string
): Promise<IWorkspace> => {
    try {
        let workspace = await api.getWorkspaceByName({ name: workspaceName, orgId: org.id });
        logger.info(`[Found ${workspaceName} workspace]`, workspace);
        
        if(!workspace) {
            const workspaceId = await api.createWorkspace({ orgId: org.id, name: workspaceName });
            logger.info(`[Created ${workspaceName} workspace]`, workspaceId);
            workspace = await api.getWorkspaceByName({ name: workspaceName, orgId: org.id });
        }

        if(!workspace) {
            throw new Error("Workspace not found - looking for " + workspaceName);
        }
  
        return workspace;
    } catch (error) {
        logger.error("[Error getting workspace]", error);
        throw error;
    }
};

// Create workspaces for financial statements
export const createFinancialWorkspaces = async (
  api: GristDocAPI,
  org: IOrg
): Promise<IFinancialWorkspaces> => {
    try {
        const workspaces = {
            incomeStatement: await getOrCreateWorkspace(api, org, INCOME_STATEMENT_WORKSPACE_NAME),
            balanceSheet: await getOrCreateWorkspace(api, org, BALANCE_SHEET_WORKSPACE_NAME),
            cashFlow: await getOrCreateWorkspace(api, org, CASH_FLOW_WORKSPACE_NAME)
        };
        
        return workspaces;
    } catch (error) {
        logger.error("[Error creating workspaces]", error);
        throw error;
    }
};

// Create or get a document in a workspace
export const getOrCreateDocument = async (
  api: GristDocAPI,
  workspace: IWorkspace,
  docName: string
): Promise<IDoc> => {
    try {
        let doc = await api.getDocByName({ name: docName, workspaceId: workspace.id });
        logger.info(`[Found ${docName} doc]`, doc);
        
        if(!doc) {
            const docId = await api.createDoc({ workspaceId: workspace.id, name: docName });
            logger.info(`[Created ${docName} doc]`, docId);
            doc = await api.getDocByName({ name: docName, workspaceId: workspace.id });
        }

        if(!doc) {
            throw new Error("Document not found - looking for " + docName);
        }
  
        return doc;
    } catch (error) {
        logger.error("[Error getting document]", error);
        throw error;
    }
};

// Create the income statement table schema
export const createIncomeStatementTable = async (
  api: GristDocAPI,
  doc: IDoc
): Promise<ITable> => {
    try {
        let table = await api.getTableByName({ name: INCOME_STATEMENT_TABLE_NAME, docId: doc.id });
        logger.info("[Found incomeStatementTable]", table);
  
        if(!table) {
            const tableId = await api.createTable({
            docId: doc.id,
            schema: {
                tables: [{
                id: INCOME_STATEMENT_TABLE_NAME,
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
            table = await api.getTableByName({ name: INCOME_STATEMENT_TABLE_NAME, docId: doc.id });
        }

        if(!table) {
            throw new Error("Table not found - looking for " + INCOME_STATEMENT_TABLE_NAME);
        }
  
        return table;
    } catch (error) {
        logger.error("[Error creating income statement table]", error);
        throw error;
    }
};

// Add sample data to the income statement
export const addSampleIncomeData = async (
  api: GristDocAPI,
  tableName: string,
  doc: IDoc
): Promise<void> => {
    try {
        const sampleData: IRecord[] = [
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
    } catch (error) {
        logger.error("[Error adding sample data]", error);
        throw error;
    }
}; 