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
export const BALANCE_SHEET_TABLE_NAME = "Balance_Sheet";
export const TRANSACTION_DETAILS_TABLE_NAME = "Transaction_Details";

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

// Update the income statement table schema
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
            schema:  {
                    "tables": [{
                    "id": INCOME_STATEMENT_TABLE_NAME,
                    "columns": [
                        { "id": "transaction_id", "fields": { "label": "Transaction ID", "type": "Int" } },
                        { "id": "transaction_line_id", "fields": { "label": "Transaction Line ID", "type": "Int" } },
                        { "id": "_fivetran_synced_date", "fields": { "label": "Fivetran Synced Date", "type": "Date" } },
                        { "id": "accounting_book_id", "fields": { "label": "Accounting Book ID", "type": "Int" } },
                        { "id": "accounting_book_name", "fields": { "label": "Accounting Book Name", "type": "Text" } },
                        { "id": "accounting_period_id", "fields": { "label": "Accounting Period ID", "type": "Int" } },
                        { "id": "accounting_period_ending", "fields": { "label": "Accounting Period Ending", "type": "Date" } },
                        { "id": "accounting_period_name", "fields": { "label": "Accounting Period Name", "type": "Text" } },
                        { "id": "is_accounting_period_adjustment", "fields": { "label": "Is Accounting Period Adjustment", "type": "Bool" } },
                        { "id": "is_accounting_period_closed", "fields": { "label": "Is Accounting Period Closed", "type": "Bool" } },
                        { "id": "account_name", "fields": { "label": "Account Name", "type": "Text" } },
                        { "id": "account_display_name", "fields": { "label": "Account Display Name", "type": "Text" } },
                        { "id": "account_type_name", "fields": { "label": "Account Type Name", "type": "Text" } },
                        { "id": "account_type_id", "fields": { "label": "Account Type ID", "type": "Text" } },
                        { "id": "account_id", "fields": { "label": "Account ID", "type": "Int" } },
                        { "id": "account_number", "fields": { "label": "Account Number", "type": "Text" } },
                        { "id": "subsidiary_id", "fields": { "label": "Subsidiary ID", "type": "Int" } },
                        { "id": "subsidiary_full_name", "fields": { "label": "Subsidiary Full Name", "type": "Text" } },
                        { "id": "subsidiary_name", "fields": { "label": "Subsidiary Name", "type": "Text" } },
                        { "id": "subsidiary_currency_symbol", "fields": { "label": "Subsidiary Currency Symbol", "type": "Text" } }
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

// Create the balance sheet table schema
export const createBalanceSheetTable = async (
  api: GristDocAPI,
  doc: IDoc
): Promise<ITable> => {
    try {
        let table = await api.getTableByName({ name: BALANCE_SHEET_TABLE_NAME, docId: doc.id });
        logger.info("[Found balanceSheetTable]", table);
  
        if(!table) {
            const tableId = await api.createTable({
                "docId": doc.id,
                "schema": {
                    "tables": [{
                    "id": BALANCE_SHEET_TABLE_NAME,
                    "columns": [
                        { "id": "transaction_id", "fields": { "label": "Transaction ID", "type": "Int" } },
                        { "id": "transaction_line_id", "fields": { "label": "Transaction Line ID", "type": "Int" } },
                        { "id": "subsidiary_id", "fields": { "label": "Subsidiary ID", "type": "Int" } },
                        { "id": "_fivetran_synced_date", "fields": { "label": "Fivetran Synced Date", "type": "Date" } },
                        { "id": "subsidiary_full_name", "fields": { "label": "Subsidiary Full Name", "type": "Text" } },
                        { "id": "subsidiary_name", "fields": { "label": "Subsidiary Name", "type": "Text" } },
                        { "id": "subsidiary_currency_symbol", "fields": { "label": "Subsidiary Currency Symbol", "type": "Text" } },
                        { "id": "accounting_book_id", "fields": { "label": "Accounting Book ID", "type": "Int" } },
                        { "id": "accounting_book_name", "fields": { "label": "Accounting Book Name", "type": "Text" } },
                        { "id": "accounting_period_id", "fields": { "label": "Accounting Period ID", "type": "Int" } },
                        { "id": "accounting_period_ending", "fields": { "label": "Accounting Period Ending", "type": "Date" } },
                        { "id": "accounting_period_name", "fields": { "label": "Accounting Period Name", "type": "Text" } },
                        { "id": "is_accounting_period_adjustment", "fields": { "label": "Is Accounting Period Adjustment", "type": "Bool" } },
                        { "id": "is_accounting_period_closed", "fields": { "label": "Is Accounting Period Closed", "type": "Bool" } },
                        { "id": "account_category", "fields": { "label": "Account Category", "type": "Text" } },
                        { "id": "account_name", "fields": { "label": "Account Name", "type": "Text" } },
                        { "id": "account_display_name", "fields": { "label": "Account Display Name", "type": "Text" } },
                        { "id": "account_type_name", "fields": { "label": "Account Type Name", "type": "Text" } },
                        { "id": "account_type_id", "fields": { "label": "Account Type ID", "type": "Text" } },
                        { "id": "account_id", "fields": { "label": "Account ID", "type": "Int" } }
                    ]
                    }]
                }
                });
            logger.info("[Created balance sheet table]", tableId);
            table = await api.getTableByName({ name: BALANCE_SHEET_TABLE_NAME, docId: doc.id });
        }

        if(!table) {
            throw new Error("Table not found - looking for " + BALANCE_SHEET_TABLE_NAME);
        }
  
        return table;
    } catch (error) {
        logger.error("[Error creating balance sheet table]", error);
        throw error;
    }
};

// Create the transaction details table schema
export const createTransactionDetailsTable = async (
  api: GristDocAPI,
  doc: IDoc
): Promise<ITable> => {
    try {
        let table = await api.getTableByName({ name: TRANSACTION_DETAILS_TABLE_NAME, docId: doc.id });
        logger.info("[Found transactionDetailsTable]", table);
  
        if(!table) {
            const tableId = await api.createTable({
                "docId": doc.id,
                "schema": {
                    "tables": [{
                    "id": TRANSACTION_DETAILS_TABLE_NAME,
                    "columns": [
                        { "id": "accounting_book_id", "fields": { "label": "Accounting Book ID", "type": "Int" } },
                        { "id": "accounting_book_name", "fields": { "label": "Accounting Book Name", "type": "Text" } },
                        { "id": "transaction_line_id", "fields": { "label": "Transaction Line ID", "type": "Int" } },
                        { "id": "transaction_memo", "fields": { "label": "Transaction Memo", "type": "Text" } },
                        { "id": "is_transaction_non_posting", "fields": { "label": "Is Transaction Non Posting", "type": "Bool" } },
                        { "id": "transaction_id", "fields": { "label": "Transaction ID", "type": "Int" } },
                        { "id": "transaction_status", "fields": { "label": "Transaction Status", "type": "Text" } },
                        { "id": "transaction_date", "fields": { "label": "Transaction Date", "type": "DateTime" } }, 
                        { "id": "transaction_due_date", "fields": { "label": "Transaction Due Date", "type": "DateTime" } }, 
                        { "id": "transaction_type", "fields": { "label": "Transaction Type", "type": "Text" } },
                        { "id": "is_transaction_intercompany_adjustment", "fields": { "label": "Is Transaction Intercompany Adjustment", "type": "Bool" } },
                        { "id": "accounting_period_ending", "fields": { "label": "Accounting Period Ending", "type": "DateTime" } }, 
                        { "id": "accounting_period_name", "fields": { "label": "Accounting Period Name", "type": "Text" } },
                        { "id": "accounting_period_id", "fields": { "label": "Accounting Period ID", "type": "Int" } },
                        { "id": "is_accounting_period_adjustment", "fields": { "label": "Is Accounting Period Adjustment", "type": "Bool" } },
                        { "id": "is_accounting_period_closed", "fields": { "label": "Is Accounting Period Closed", "type": "Bool" } },
                        { "id": "account_name", "fields": { "label": "Account Name", "type": "Text" } },
                        { "id": "account_type_name", "fields": { "label": "Account Type Name", "type": "Text" } },
                        { "id": "account_type_id", "fields": { "label": "Account Type ID", "type": "Text" } },
                        { "id": "account_id", "fields": { "label": "Account ID", "type": "Int" } }
                    ]
                    }]
                }
                });
            logger.info("[Created transaction details table]", tableId);
            table = await api.getTableByName({ name: TRANSACTION_DETAILS_TABLE_NAME, docId: doc.id });
        }

        if(!table) {
            throw new Error("Table not found - looking for " + TRANSACTION_DETAILS_TABLE_NAME);
        }
  
        return table;
    } catch (error) {
        logger.error("[Error creating transaction details table]", error);
        throw error;
    }
};